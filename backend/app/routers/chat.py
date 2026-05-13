from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from typing import List, Dict, Any, Optional
from app.models import Message, MessageCreate, MessageUpdate, MessageInDB
from app.auth import get_current_active_user, verify_token
from app.database import get_database
from app.ai_service import ai_service
from app.models import UserInDB
from app.config import settings
from bson import ObjectId
import json
import logging
import asyncio
from datetime import datetime
from jose import JWTError, jwt
from pathlib import Path
from uuid import uuid4
import aiofiles
import os
import json
import logging
from app.socketio_server import sio

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])

# Ensure upload directory exists at module load time
UPLOAD_BASE = Path("uploads/chat")
UPLOAD_BASE.mkdir(parents=True, exist_ok=True)

ALLOWED_MIME_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf", "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg",
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

def is_classroom_member(classroom: dict, user_id: str) -> bool:
    """Type-safe membership check — members array may contain ObjectId or str."""
    admin_id = str(classroom.get('admin_id', ''))
    members = [str(m) for m in classroom.get('members', [])]
    return str(user_id) == admin_id or str(user_id) in members

# Socket.IO Event Handlers

@sio.on('connect')
async def handle_connect(sid, environ, auth):
    """
    Fix 1: WebSocket connect handler.
    Extracts JWT from the Socket.io handshake 'auth' dict,
    verifies it, looks up the user in MongoDB, and saves
    the user's identity to the socket session.
    Raises ConnectionRefusedError on any failure so the
    client receives a proper rejection instead of connecting
    with an empty session.
    """
    token = None

    # python-socketio passes the client's auth dict directly as the 'auth' argument
    if auth and isinstance(auth, dict):
        token = auth.get('token')

    # Fallback: some older versions tunnel it through environ headers
    if not token and environ:
        auth_header = environ.get('HTTP_AUTHORIZATION', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]

    if not token:
        logger.warning(f"Socket {sid} rejected: no token provided")
        raise ConnectionRefusedError('Unauthorized: no token provided')

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email = payload.get('sub')
        token_type = payload.get('type')

        if not email or token_type != 'access':
            raise JWTError('Invalid token payload')

        # Look up the user in MongoDB to get their full profile
        db = await get_database()
        user = await db.users.find_one({'email': email})
        if not user:
            logger.warning(f"Socket {sid} rejected: user not found ({email})")
            raise ConnectionRefusedError('Unauthorized: user not found')

        # Save identity to the socket session for use in subsequent events
        await sio.save_session(sid, {
            'user_id': str(user['_id']),
            'email':   user.get('email', ''),
            'name':    user.get('name', ''),
            'avatar':  user.get('avatar', ''),
            'role':    user.get('role', 'student'),
        })

        # Place the socket in its own user-scoped room so we can reach it by user_id
        sio.enter_room(sid, str(user['_id']))

        logger.info(f"Socket {sid} authenticated as {email}")
        await sio.emit('authenticated', {'status': 'success', 'user_id': str(user['_id'])}, room=sid)

    except JWTError as e:
        logger.warning(f"Socket {sid} rejected: JWT error — {e}")
        raise ConnectionRefusedError('Unauthorized: invalid or expired token')
    except ConnectionRefusedError:
        raise  # Re-raise cleanly without wrapping
    except Exception as e:
        logger.error(f"Socket {sid} connect error: {e}")
        raise ConnectionRefusedError('Unauthorized: server error during authentication')


@sio.on('disconnect')
async def handle_disconnect(sid):
    """Log disconnections for debugging."""
    logger.info(f"Socket {sid} disconnected")


@sio.event
async def authenticate(sid, *args):
    """Kept for backwards compatibility; real auth now happens in connect."""
    session = await sio.get_session(sid)
    if session:
        await sio.emit('authenticated', {'status': 'success'}, room=sid)
        return True
    await sio.emit('error', {'error': 'Not authenticated'}, room=sid)
    return False

@sio.on('join_room')
async def handle_join_room(sid, data):
    """Handle room joining"""
    try:
        room_id = data.get('room_id') if isinstance(data, dict) else data
        room_object_id = ObjectId(str(room_id))

        session = await sio.get_session(sid)
        if not session:
            await sio.emit('error', {'error': 'Unauthorized'}, room=sid)
            return

        db = await get_database()
        room = await db.rooms.find_one({"_id": room_object_id})
        if not room:
            await sio.emit('error', {'error': 'Room not found'}, room=sid)
            return

        classroom = await db.classrooms.find_one({"_id": room["classroom_id"]})
        if not classroom or not is_classroom_member(classroom, session['user_id']):
            await sio.emit('error', {'error': 'Access denied'}, room=sid)
            return

        await sio.enter_room(sid, str(room_object_id))
        await sio.emit('room_joined', {
            'room_id': str(room_object_id),
            'user_name': session['name']
        }, room=sid)
        logger.info(f"Client {sid} joined room {room_object_id}")
    except Exception as e:
        logger.error(f"Error joining room: {e}")
        await sio.emit('error', {'error': str(e)}, room=sid)

@sio.on('leave_room')
async def handle_leave_room(sid, room_id):
    """Handle room leaving"""
    try:
        sio.leave_room(sid, str(room_id))
        session = await sio.get_session(sid)
        if session:
            await sio.emit('user_left', {
                'user_name': session['name']
            }, room=str(room_id))
        logger.info(f"Client {sid} left room {room_id}")
    except Exception as e:
        logger.error(f"Error leaving room: {e}")

@sio.on('send_message')
async def handle_message(sid, data):
    """Handle new message in a room"""
    try:
        room_id = data.get('room_id')
        content = data.get('content')
        
        if not all([room_id, content]):
            await sio.emit('error', {'error': 'Missing required fields'}, room=sid)
            return

        # Get user from session
        db = await get_database()
        user_data = await sio.get_session(sid)
        if not user_data:
            await sio.emit('error', {'error': 'Unauthorized'}, room=sid)
            return

        # Create and save message
        message_data = {
            'room_id': ObjectId(room_id),
            'content': content,
            'sender_id': user_data['user_id'],
            'timestamp': datetime.utcnow(),
            'edited': False,
            'deleted': False
        }
        
        result = await db.messages.insert_one(message_data)
        created_message = await db.messages.find_one({'_id': result.inserted_id})
        
        # Broadcast to room
        await sio.emit('new_message', {
            'message': {
                **created_message,
                '_id': str(created_message['_id']),
                'room_id': str(created_message['room_id'])
            },
            'sender_name': user_data.get('name'),
            'sender_avatar': user_data.get('avatar')
        }, room=str(room_id))
        
    except Exception as e:
        logger.error(f"Error handling message: {e}")
        await sio.emit('error', {'error': str(e)}, room=sid)

@router.get("/rooms/{room_id}/messages")
async def get_room_messages(
    room_id: str,
    limit: int = 50,
    offset: int = 0,
    current_user: UserInDB = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Get messages from a room"""
    try:
        room_object_id = ObjectId(room_id)
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid room ID"
        )
    
    # Check if room exists
    room = await db.rooms.find_one({"_id": room_object_id})
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )
    
    # Check if user has access to this room
    classroom = await db.classrooms.find_one({"_id": room["classroom_id"]})
    if not classroom or not is_classroom_member(classroom, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this room"
        )
    
    # Get messages
    messages = await db.messages.find(
        {"room_id": room_object_id, "deleted": False}
    ).sort("timestamp", -1).skip(offset).limit(limit).to_list(length=limit)
    
    result = []
    for message in reversed(messages):
        msg_dict = Message(**message).dict()
        msg_dict["_id"] = str(message["_id"])
        msg_dict["id"] = str(message["_id"])
        msg_dict["room_id"] = str(message["room_id"])
        msg_dict["sender_id"] = str(message["sender_id"])
        
        try:
            user = await db.users.find_one({"_id": ObjectId(str(message["sender_id"]))})
        except Exception:
            user = None
        if user:
            msg_dict["sender_name"] = user.get("name", "Unknown")
            msg_dict["sender_avatar"] = user.get("avatar")
        else:
            msg_dict["sender_name"] = "Unknown"
            msg_dict["sender_avatar"] = None
            
        result.append(msg_dict)
        
    return result

@router.post("/rooms/{room_id}/messages", response_model=Message)
async def send_message(
    room_id: str,
    message_data: MessageCreate,
    current_user: UserInDB = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Send a message to a room"""
    try:
        room_object_id = ObjectId(room_id)
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid room ID"
        )
    
    # Check if room exists
    room = await db.rooms.find_one({"_id": room_object_id})
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )
    
    # Check if user has access to this room
    classroom = await db.classrooms.find_one({"_id": room["classroom_id"]})
    if not classroom or not is_classroom_member(classroom, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this room"
        )
    
    # Moderate message content
    moderation_result = await ai_service.moderate_message(message_data.content)
    if not moderation_result.get("is_appropriate", True):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Message content inappropriate: {moderation_result.get('reason', 'Content not suitable')}"
        )
    
    # Create message — always use room_id from URL path (Fix 3: override any body value)
    message_dict = message_data.dict()
    message_dict.update({
        "room_id": room_object_id,  # URL param is the authoritative source of truth
        "sender_id": current_user.id,
        "timestamp": datetime.utcnow(),
        "edited": False,
        "deleted": False
    })
    
    result = await db.messages.insert_one(message_dict)
    message_id = result.inserted_id
    
    # Get created message with sender info
    created_message = await db.messages.find_one({"_id": message_id})
    message_obj = Message(**created_message)
    
    # Broadcast to Socket.IO room — include all file fields
    broadcast_dict = message_obj.dict()
    broadcast_dict['id'] = str(message_obj.id)
    broadcast_dict['_id'] = str(message_obj.id)
    broadcast_dict['room_id'] = str(message_obj.room_id)
    broadcast_dict['sender_id'] = str(message_obj.sender_id)
    broadcast_dict['timestamp'] = message_obj.timestamp.isoformat() if message_obj.timestamp else None
    # Ensure file fields are included (they may be None for text messages)
    broadcast_dict['message_type'] = message_obj.message_type
    broadcast_dict['file_url'] = message_obj.file_url
    broadcast_dict['file_name'] = message_obj.file_name
    broadcast_dict['file_type'] = message_obj.file_type
    broadcast_dict['file_size'] = message_obj.file_size
    
    await sio.emit('new_message', {
        'message': broadcast_dict,
        'sender_name': current_user.name,
        'sender_avatar': current_user.avatar
    }, room=str(room_id))
    
    # Check for AI mention
    if message_data.content and "@AI" in message_data.content.upper():
        async def process_ai_mention():
            try:
                # Get recent conversation context
                recent_messages = await db.messages.find({
                    "room_id": room_object_id, "deleted": False
                }).sort("timestamp", -1).limit(10).to_list(length=10)
                
                context = []
                for msg in reversed(recent_messages):
                    context.append({
                        "content": msg["content"],
                        "is_ai_response": msg.get("is_ai_response", False)
                    })
                
                # Generate AI response
                ai_response = await ai_service.respond_to_ai_mention(message_data.content, context)
                
                # Create AI response message
                ai_message_dict = {
                    "room_id": room_object_id,
                    "sender_id": "AI",
                    "content": ai_response,
                    "message_type": "ai_response",
                    "is_ai_response": True,
                    "timestamp": datetime.utcnow(),
                    "edited": False,
                    "deleted": False
                }
                
                ai_result = await db.messages.insert_one(ai_message_dict)
                ai_message_id = ai_result.inserted_id
                
                ai_created_message = await db.messages.find_one({"_id": ai_message_id})
                ai_message_obj = Message(**ai_created_message)
                
                ai_broadcast_dict = ai_message_obj.dict()
                ai_broadcast_dict['id'] = str(ai_message_obj.id)
                ai_broadcast_dict['_id'] = str(ai_message_obj.id)
                ai_broadcast_dict['room_id'] = str(ai_message_obj.room_id)
                ai_broadcast_dict['sender_id'] = "AI"
                ai_broadcast_dict['timestamp'] = ai_message_obj.timestamp.isoformat() if ai_message_obj.timestamp else None
                ai_broadcast_dict['is_ai_response'] = True
                ai_broadcast_dict['message_type'] = 'ai_response'
                
                await sio.emit('new_message', {
                    'message': ai_broadcast_dict,
                    'sender_name': "PeerLearn AI",
                    'sender_avatar': ""
                }, room=str(room_id))
                
            except Exception as e:
                logger.error(f"Error handling AI mention in classroom: {e}")
                
        # Run AI processing in the background
        asyncio.create_task(process_ai_mention())
            
    return message_obj

@router.put("/messages/{message_id}", response_model=Message)
async def edit_message(
    message_id: str,
    message_update: MessageUpdate,
    current_user: UserInDB = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Edit a message (sender only)"""
    try:
        message_object_id = ObjectId(message_id)
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid message ID"
        )
    
    # Find message
    message = await db.messages.find_one({"_id": message_object_id})
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
    
    # Check if user is the sender
    if message["sender_id"] != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only edit your own messages"
        )
    
    # Check if message is deleted
    if message.get("deleted", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot edit deleted message"
        )
    
    # Moderate new content
    if message_update.content:
        moderation_result = await ai_service.moderate_message(message_update.content)
        if not moderation_result.get("is_appropriate", True):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Message content inappropriate: {moderation_result.get('reason', 'Content not suitable')}"
            )
    
    # Update message
    update_data = {k: v for k, v in message_update.dict().items() if v is not None}
    update_data.update({
        "edited": True,
        "edited_at": datetime.utcnow()
    })
    
    await db.messages.update_one(
        {"_id": message_object_id},
        {"$set": update_data}
    )
    
    # Get updated message
    updated_message = await db.messages.find_one({"_id": message_object_id})
    message_obj = Message(**updated_message)
    
    # Broadcast edit to Socket.IO room
    message_dict = message_obj.dict()
    message_dict['id'] = str(message_obj.id)
    message_dict['_id'] = str(message_obj.id)
    message_dict['room_id'] = str(message['room_id'])
    message_dict['sender_id'] = str(message_obj.sender_id)
    message_dict['timestamp'] = message_obj.timestamp.isoformat() if message_obj.timestamp else None
    if hasattr(message_obj, 'edited_at') and message_obj.edited_at:
        message_dict['edited_at'] = message_obj.edited_at.isoformat()
    
    await sio.emit('message_edited', {
        'message': message_dict,
        'sender_name': current_user.name
    }, room=str(message["room_id"]))
    
    return message_obj

@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: str,
    current_user: UserInDB = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Delete a message (sender only)"""
    try:
        message_object_id = ObjectId(message_id)
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid message ID"
        )
    
    # Find message
    message = await db.messages.find_one({"_id": message_object_id})
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
    
    # Check if user is the sender
    if message["sender_id"] != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only delete your own messages"
        )
    
    # Check if message is already deleted
    if message.get("deleted", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message already deleted"
        )
    
    # Mark message as deleted
    await db.messages.update_one(
        {"_id": message_object_id},
        {"$set": {"deleted": True}}
    )
    
    # Broadcast deletion to Socket.IO room
    await sio.emit('message_deleted', {
        'message_id': str(message_object_id),
        'room_id': str(message['room_id'])
    }, room=str(message['room_id']))
    
    return {"message": "Message deleted successfully"}


@router.post("/rooms/{room_id}/upload")
async def upload_chat_file(
    room_id: str,
    file: UploadFile = File(...),
    current_user: UserInDB = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Upload a file for use in chat messages (images, PDFs, audio, docs — max 10MB)."""
    try:
        room_object_id = ObjectId(room_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid room ID")

    # Verify room exists and user is a member
    room = await db.rooms.find_one({"_id": room_object_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    classroom = await db.classrooms.find_one({"_id": room["classroom_id"]})
    if not classroom or not is_classroom_member(classroom, current_user.id):
        raise HTTPException(status_code=403, detail="Access denied to this room")

    # Validate MIME type
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{file.content_type}' is not allowed. "
                   f"Allowed types: images, PDF, TXT, DOC, DOCX, audio."
        )

    # Read and validate file size
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds 10MB limit")

    # Save to uploads/chat/{room_id}/{uuid}_{original_name}
    room_upload_dir = UPLOAD_BASE / room_id
    room_upload_dir.mkdir(parents=True, exist_ok=True)

    file_ext = Path(file.filename).suffix if file.filename else ""
    stored_name = f"{uuid4().hex}{file_ext}"
    file_path = room_upload_dir / stored_name

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(file_bytes)

    # Persist metadata in MongoDB
    file_url = f"/uploads/chat/{room_id}/{stored_name}"
    metadata = {
        "room_id": room_id,
        "original_name": file.filename,
        "stored_name": stored_name,
        "file_type": file.content_type,
        "file_size": len(file_bytes),
        "uploaded_by_id": str(current_user.id),
        "uploaded_by_name": current_user.name,
        "uploaded_at": datetime.utcnow(),
        "url": file_url,
    }
    insert_result = await db.chat_files.insert_one(metadata)

    return {
        "file_id": str(insert_result.inserted_id),
        "url": file_url,
        "original_name": file.filename,
        "file_type": file.content_type,
        "file_size": len(file_bytes),
    }

@router.post("/rooms/{room_id}/summarize")
async def summarize_room_chat(
    room_id: str,
    current_user: UserInDB = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Generate AI summary of room chat"""
    try:
        room_object_id = ObjectId(room_id)
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid room ID"
        )
    
    # Check if room exists
    room = await db.rooms.find_one({"_id": room_object_id})
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )
    
    # Check if user has access to this room
    classroom = await db.classrooms.find_one({"_id": room["classroom_id"]})
    if not classroom or not is_classroom_member(classroom, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this room"
        )
    
    # Get recent messages (last 100)
    messages = await db.messages.find(
        {"room_id": room_object_id, "deleted": False}
    ).sort("timestamp", -1).limit(100).to_list(length=100)
    
    if not messages:
        return {"summary": "No messages to summarize in this room."}
    
    # Get sender names for messages
    message_data = []
    for msg in messages:
        try:
            sender = await db.users.find_one({"_id": ObjectId(str(msg["sender_id"]))})
        except Exception:
            sender = None
        message_data.append({
            "content": msg["content"],
            "sender_name": sender["name"] if sender else "Unknown",
            "timestamp": msg["timestamp"]
        })
    
    # Generate summary
    summary = await ai_service.summarize_chat(message_data, room["name"])
    
    return {"summary": summary}

# The raw WebSocket endpoint was removed in favor of Socket.IO event handlers above.


@sio.on('join_document')
async def handle_join_document(sid, data):
    """Join a document-scoped socket room for collaborative editing."""
    try:
        document_id = data.get('document_id') if isinstance(data, dict) else str(data)
        session = await sio.get_session(sid)
        if not session:
            await sio.emit('error', {'error': 'Unauthorized'}, room=sid)
            return

        doc_room = f"doc_{document_id}"
        await sio.enter_room(sid, doc_room)
        logger.info(f"Client {sid} joined document room {doc_room}")
        await sio.emit('document_joined', {'document_id': document_id}, room=sid)
    except Exception as e:
        logger.error(f"Error joining document room: {e}")
        await sio.emit('error', {'error': str(e)}, room=sid)


@sio.on('leave_document')
async def handle_leave_document(sid, data):
    """Leave a document-scoped socket room."""
    try:
        document_id = data.get('document_id') if isinstance(data, dict) else str(data)
        doc_room = f"doc_{document_id}"
        sio.leave_room(sid, doc_room)
        logger.info(f"Client {sid} left document room {doc_room}")
    except Exception as e:
        logger.error(f"Error leaving document room: {e}")


@sio.on('document_update')
async def handle_document_update(sid, data):
    """
    Receive an HTML content update for a document (last-write-wins).
    Persists the new HTML to MongoDB and broadcasts to all other clients in the document room.
    """
    try:
        document_id = data.get('document_id')
        html = data.get('html', '')

        if not document_id:
            await sio.emit('error', {'error': 'document_id required'}, room=sid)
            return

        session = await sio.get_session(sid)
        if not session:
            await sio.emit('error', {'error': 'Unauthorized'}, room=sid)
            return

        db = await get_database()

        # Verify document exists
        try:
            doc = await db.documents.find_one({'_id': ObjectId(document_id)})
        except Exception:
            doc = None

        if not doc:
            await sio.emit('error', {'error': 'Document not found'}, room=sid)
            return

        # Last-write-wins: persist the incoming HTML immediately
        await db.documents.update_one(
            {'_id': ObjectId(document_id)},
            {'$set': {'content': html, 'updated_at': datetime.utcnow()}}
        )

        # Update last_edited_by on the shared resource in any room that has it
        editor_name = session.get('name', 'Someone')
        try:
            await db.rooms.update_one(
                {"shared_resources.document_id": document_id},
                {"$set": {
                    "shared_resources.$.last_edited_by": editor_name,
                    "shared_resources.$.last_edited_at": datetime.utcnow().isoformat()
                }}
            )
        except Exception as meta_err:
            logger.warning(f"Could not update shared resource metadata: {meta_err}")

        # Broadcast to all other sockets in the document room (skip the sender)
        doc_room = f"doc_{document_id}"
        await sio.emit('document_update', {
            'document_id': document_id,
            'html': html,
            'updated_by': editor_name
        }, room=doc_room, skip_sid=sid)

        logger.info(f"Document {document_id} updated by {session.get('name')}")
    except Exception as e:
        logger.error(f"Error handling document_update: {e}")
        await sio.emit('error', {'error': str(e)}, room=sid)
