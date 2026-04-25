from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from datetime import datetime
from app.models import (
    Classroom, ClassroomCreate, ClassroomUpdate, ClassroomInDB,
    Room, RoomCreate, RoomUpdate, RoomInDB
)
from app.auth import get_current_active_user, generate_invite_code
from app.database import get_database
from app.ai_service import ai_service
from app.models import UserInDB
from app.socketio_server import sio
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/classrooms", tags=["classrooms"])

# ---------------------------------------------------------------------------
# Access-control helpers
# The members array may contain ObjectIds (admin-added / join via invite) or
# plain strings (legacy data).  Always compare via str() to handle both.
# ---------------------------------------------------------------------------

def is_classroom_member(classroom: dict, user_id: str) -> bool:
    """Return True if user_id is the admin OR appears in the members list."""
    admin_id = str(classroom.get('admin_id', ''))
    members = [str(m) for m in classroom.get('members', [])]
    return str(user_id) == admin_id or str(user_id) in members

def is_classroom_admin(classroom: dict, user_id: str) -> bool:
    """Return True if user_id is the classroom admin."""
    return str(classroom.get('admin_id', '')) == str(user_id)

@router.post("/", response_model=Classroom)
async def create_classroom(
    classroom_data: ClassroomCreate,
    current_user: UserInDB = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Create a new classroom"""
    # Generate unique invite code
    invite_code = generate_invite_code()
    
    # Ensure invite code is unique
    while await db.classrooms.find_one({"invite_code": invite_code}):
        invite_code = generate_invite_code()
    
    # Create classroom
    classroom_dict = classroom_data.dict()
    classroom_dict.update({
        "admin_id": current_user.id,
        "members": [ObjectId(str(current_user.id))],  # Store as ObjectId for consistency
        "invite_code": invite_code,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    })
    
    result = await db.classrooms.insert_one(classroom_dict)
    classroom_id = result.inserted_id
    
    # Create default "General" room
    general_room = RoomCreate(
        name="General",
        description="General discussion room",
        classroom_id=classroom_id
    )
    
    room_dict = general_room.dict()
    room_dict.update({
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    })
    
    await db.rooms.insert_one(room_dict)
    
    # Get created classroom
    created_classroom = await db.classrooms.find_one({"_id": classroom_id})
    return Classroom(**created_classroom)

@router.get("/", response_model=List[Classroom])
async def get_user_classrooms(
    current_user: UserInDB = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Get classrooms where user is admin or a member"""
    user_object_id = ObjectId(str(current_user.id))
    classrooms = await db.classrooms.find({
        "$or": [
            {"admin_id": current_user.id},
            {"admin_id": user_object_id},
            {"members": current_user.id},
            {"members": user_object_id},
        ]
    }).to_list(length=100)

    return [Classroom(**classroom) for classroom in classrooms]

@router.get("/{classroom_id}", response_model=Classroom)
async def get_classroom(
    classroom_id: str,
    current_user: UserInDB = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Get classroom details"""
    try:
        classroom_object_id = ObjectId(classroom_id)
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid classroom ID"
        )
    
    classroom = await db.classrooms.find_one({"_id": classroom_object_id})
    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Classroom not found"
        )
    
    # Check access: admin or member (type-safe — members array may contain ObjectId or str)
    user_str = str(current_user.id)
    is_member = any(str(m) == user_str for m in classroom.get("members", []))
    is_admin = str(classroom.get("admin_id", "")) == user_str
    if not is_member and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this classroom"
        )
    
    return Classroom(**classroom)

@router.put("/{classroom_id}", response_model=Classroom)
async def update_classroom(
    classroom_id: str,
    classroom_update: ClassroomUpdate,
    current_user: UserInDB = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Update classroom (admin only)"""
    try:
        classroom_object_id = ObjectId(classroom_id)
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid classroom ID"
        )
    
    classroom = await db.classrooms.find_one({"_id": classroom_object_id})
    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Classroom not found"
        )
    
    # Only admin may update
    if not is_classroom_admin(classroom, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only classroom admin can update classroom"
        )
    
    # Prepare update data
    update_data = {k: v for k, v in classroom_update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    # Update classroom
    await db.classrooms.update_one(
        {"_id": classroom_object_id},
        {"$set": update_data}
    )
    
    # Get updated classroom
    updated_classroom = await db.classrooms.find_one({"_id": classroom_object_id})
    return Classroom(**updated_classroom)

@router.post("/join/{invite_code}")
async def join_classroom(
    invite_code: str,
    current_user: UserInDB = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Join classroom using invite code"""
    classroom = await db.classrooms.find_one({"invite_code": invite_code})
    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid invite code"
        )
    
    # Check if user is already a member (type-safe)
    user_str = str(current_user.id)
    already_member = any(str(m) == user_str for m in classroom.get("members", []))
    if already_member:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already a member of this classroom"
        )
    
    # Add user to classroom — store as ObjectId for type consistency with add_member
    await db.classrooms.update_one(
        {"_id": classroom["_id"]},
        {"$addToSet": {"members": ObjectId(str(current_user.id))}}
    )
    
    return {"message": "Successfully joined classroom", "classroom_id": str(classroom["_id"])}

@router.delete("/{classroom_id}/leave")
async def leave_classroom(
    classroom_id: str,
    current_user: UserInDB = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Leave classroom"""
    try:
        classroom_object_id = ObjectId(classroom_id)
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid classroom ID"
        )
    
    classroom = await db.classrooms.find_one({"_id": classroom_object_id})
    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Classroom not found"
        )
    
    # Admin cannot leave
    if is_classroom_admin(classroom, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin cannot leave classroom. Transfer admin or delete classroom."
        )
    
    # Check if user is a member (type-safe)
    user_str = str(current_user.id)
    if not any(str(m) == user_str for m in classroom.get("members", [])):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Not a member of this classroom"
        )
    
    # Remove user from classroom — pull both ObjectId and string variants
    # to handle mixed-type members arrays from legacy data
    user_oid = ObjectId(str(current_user.id))
    await db.classrooms.update_one(
        {"_id": classroom_object_id},
        {"$pull": {"members": {"$in": [user_oid, str(current_user.id)]}}}
    )
    
    return {"message": "Successfully left classroom"}

@router.post("/{classroom_id}/add-member/{user_id}")
async def add_member_to_classroom(
    classroom_id: str,
    user_id: str,
    current_user: UserInDB = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Add a friend to classroom (admin only)"""
    try:
        classroom_object_id = ObjectId(classroom_id)
        user_object_id = ObjectId(user_id)
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid classroom or user ID"
        )
    
    # Get classroom
    classroom = await db.classrooms.find_one({"_id": classroom_object_id})
    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Classroom not found"
        )
    
    # Check if current user is admin
    if str(classroom["admin_id"]) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can add members"
        )
    
    # Check if user exists
    user = await db.users.find_one({"_id": user_object_id})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if user is already a member (type-safe)
    if is_classroom_member(classroom, str(user_object_id)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this classroom"
        )
    
    # Check if user is a friend
    if str(user_object_id) not in [str(friend_id) for friend_id in current_user.friends]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only add friends to classroom"
        )
    
    # Add user to classroom
    await db.classrooms.update_one(
        {"_id": classroom_object_id},
        {"$addToSet": {"members": user_object_id}}
    )
    
    # Emit socket event to notify the added user to refresh their classroom list
    payload = {
        'classroom_id': str(classroom_object_id),
        'classroom_name': classroom['name'],
        'message': f"You have been added to {classroom['name']}"
    }
    await sio.emit('classroom_added', payload, room=str(user_object_id))
    await sio.emit('added_to_classroom', payload, room=str(user_object_id))
    
    return {"message": f"Successfully added {user.get('username', 'user')} to classroom"}

@router.delete("/{classroom_id}/members/{user_id}")
async def remove_member_from_classroom(
    classroom_id: str,
    user_id: str,
    current_user: UserInDB = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Remove a member from classroom (admin only)"""
    try:
        classroom_object_id = ObjectId(classroom_id)
        user_object_id = ObjectId(user_id)
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid classroom or user ID"
        )
    
    # Get classroom
    classroom = await db.classrooms.find_one({"_id": classroom_object_id})
    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Classroom not found"
        )
    
    # Check if current user is admin
    if str(classroom["admin_id"]) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can remove members"
        )
    
    # Cannot remove admin
    if str(classroom["admin_id"]) == str(user_object_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove classroom admin"
        )
    
    # Check if user is a member (type-safe)
    if not any(str(m) == str(user_object_id) for m in classroom.get("members", [])):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not a member of this classroom"
        )
    
    # Remove user from classroom
    await db.classrooms.update_one(
        {"_id": classroom_object_id},
        {"$pull": {"members": user_object_id}}
    )
    
    # Emit socket event to notify the removed user
    await sio.emit('classroom_removed', {
        'classroom_id': str(classroom_object_id),
        'classroom_name': classroom['name']
    }, room=str(user_object_id))
    
    return {"message": "Member removed successfully"}

@router.get("/{classroom_id}/members")
async def get_classroom_members(
    classroom_id: str,
    current_user: UserInDB = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Get all members of a classroom"""
    try:
        classroom_object_id = ObjectId(classroom_id)
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid classroom ID"
        )
    
    classroom = await db.classrooms.find_one({"_id": classroom_object_id})
    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Classroom not found"
        )
    
    # Check access: admin or member (type-safe)
    user_str = str(current_user.id)
    is_member = any(str(m) == user_str for m in classroom.get("members", []))
    is_admin = str(classroom.get("admin_id", "")) == user_str
    if not is_member and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this classroom"
        )
    
    # Get member details
    members = []
    for member_id in classroom["members"]:
        user = await db.users.find_one({"_id": member_id})
        if user:
            members.append({
                "id": str(user["_id"]),
                "username": user.get("username", ""),
                "name": user.get("name", ""),
                "email": user.get("email", ""),
                "avatar": user.get("avatar", ""),
                "is_admin": str(user["_id"]) == str(classroom["admin_id"])
            })
    
    return members

@router.get("/{classroom_id}/available-friends")
async def get_available_friends_for_classroom(
    classroom_id: str,
    current_user: UserInDB = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Get friends who can be added to classroom (admin only)"""
    try:
        classroom_object_id = ObjectId(classroom_id)
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid classroom ID"
        )
    
    # Get classroom
    classroom = await db.classrooms.find_one({"_id": classroom_object_id})
    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Classroom not found"
        )
    
    # Check if current user is admin
    if str(classroom["admin_id"]) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can view available friends"
        )
    
    # Get friends who are not already members
    available_friends = []
    for friend_id in current_user.friends:
        if str(friend_id) not in [str(member_id) for member_id in classroom["members"]]:
            friend = await db.users.find_one({"_id": ObjectId(friend_id)})
            if friend:
                available_friends.append({
                    "id": str(friend["_id"]),
                    "username": friend.get("username", ""),
                    "email": friend.get("email", "")
                })
    
    return available_friends

@router.delete("/{classroom_id}")
async def delete_classroom(
    classroom_id: str,
    current_user: UserInDB = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Delete classroom (admin only)"""
    try:
        classroom_object_id = ObjectId(classroom_id)
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid classroom ID"
        )
    
    classroom = await db.classrooms.find_one({"_id": classroom_object_id})
    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Classroom not found"
        )
    
    # Only admin may delete
    if not is_classroom_admin(classroom, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only classroom admin can delete classroom"
        )
    
    # Delete all rooms in the classroom
    await db.rooms.delete_many({"classroom_id": classroom_object_id})
    
    # Delete all messages in the classroom
    await db.messages.delete_many({"classroom_id": classroom_object_id})
    
    # Delete classroom
    await db.classrooms.delete_one({"_id": classroom_object_id})
    
    return {"message": "Classroom deleted successfully"}

# Room Management
@router.post("/{classroom_id}/rooms", response_model=Room)
async def create_room(
    classroom_id: str,
    room_data: RoomCreate,
    current_user: UserInDB = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Create a new room in classroom (admin only)"""
    try:
        classroom_object_id = ObjectId(classroom_id)
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid classroom ID"
        )
    
    classroom = await db.classrooms.find_one({"_id": classroom_object_id})
    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Classroom not found"
        )
    
    # Only admin may create rooms
    if not is_classroom_admin(classroom, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only classroom admin can create rooms"
        )
    
    # Check if room name already exists in this classroom
    existing_room = await db.rooms.find_one({
        "classroom_id": classroom_object_id,
        "name": room_data.name
    })
    if existing_room:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Room name already exists in this classroom"
        )
    
    # Create room
    room_dict = room_data.dict()
    room_dict.update({
        "classroom_id": classroom_object_id,  # Use classroom_id from URL path
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    })
    
    result = await db.rooms.insert_one(room_dict)
    room_id = result.inserted_id
    
    # Get created room
    created_room = await db.rooms.find_one({"_id": room_id})
    return Room(**created_room)

@router.get("/{classroom_id}/rooms", response_model=List[Room])
async def get_classroom_rooms(
    classroom_id: str,
    current_user: UserInDB = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Get all rooms in a classroom"""
    try:
        classroom_object_id = ObjectId(classroom_id)
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid classroom ID"
        )
    
    classroom = await db.classrooms.find_one({"_id": classroom_object_id})
    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Classroom not found"
        )
    
    # Check access: admin or member (type-safe)
    user_str = str(current_user.id)
    is_member = any(str(m) == user_str for m in classroom.get("members", []))
    is_admin = str(classroom.get("admin_id", "")) == user_str
    if not is_member and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this classroom"
        )
    
    rooms = await db.rooms.find({"classroom_id": classroom_object_id}).to_list(length=100)
    return [Room(**room) for room in rooms]

@router.put("/{classroom_id}/rooms/{room_id}", response_model=Room)
async def update_room(
    classroom_id: str,
    room_id: str,
    room_update: RoomUpdate,
    current_user: UserInDB = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Update room (admin only)"""
    try:
        classroom_object_id = ObjectId(classroom_id)
        room_object_id = ObjectId(room_id)
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID"
        )
    
    classroom = await db.classrooms.find_one({"_id": classroom_object_id})
    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Classroom not found"
        )
    
    # Only admin may update rooms
    if not is_classroom_admin(classroom, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only classroom admin can update rooms"
        )
    
    room = await db.rooms.find_one({"_id": room_object_id})
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )
    
    # Prepare update data
    update_data = {k: v for k, v in room_update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    # Update room
    await db.rooms.update_one(
        {"_id": room_object_id},
        {"$set": update_data}
    )
    
    # Get updated room
    updated_room = await db.rooms.find_one({"_id": room_object_id})
    return Room(**updated_room)

@router.delete("/{classroom_id}/rooms/{room_id}")
async def delete_room(
    classroom_id: str,
    room_id: str,
    current_user: UserInDB = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Delete room (admin only)"""
    try:
        classroom_object_id = ObjectId(classroom_id)
        room_object_id = ObjectId(room_id)
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID"
        )
    
    classroom = await db.classrooms.find_one({"_id": classroom_object_id})
    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Classroom not found"
        )
    
    # Only admin may delete rooms
    if not is_classroom_admin(classroom, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only classroom admin can delete rooms"
        )
    
    room = await db.rooms.find_one({"_id": room_object_id})
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )
    
    # Don't allow deleting the General room
    if room["name"] == "General":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete the General room"
        )
    
    # Delete all messages in the room
    await db.messages.delete_many({"room_id": room_object_id})
    
    # Delete room
    await db.rooms.delete_one({"_id": room_object_id})
    
    return {"message": "Room deleted successfully"}

# Room Resource Sharing
@router.post("/rooms/{room_id}/resources")
async def share_resource_to_room(
    room_id: str,
    body: dict,
    current_user: UserInDB = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Share a document into a room's shared_resources list"""
    document_id = body.get("document_id")
    if not document_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="document_id is required"
        )

    try:
        room_object_id = ObjectId(room_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid room ID")

    room = await db.rooms.find_one({"_id": room_object_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    classroom = await db.classrooms.find_one({"_id": room["classroom_id"]})
    if not classroom or not is_classroom_member(classroom, current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")

    # Build full resource metadata object and push it
    resource = {
        "document_id": str(document_id),
        "shared_by_id": str(current_user.id),
        "shared_by_name": current_user.name,
        "shared_at": datetime.utcnow().isoformat(),
        "last_edited_by": None,
        "last_edited_at": None,
    }
    await db.rooms.update_one(
        {"_id": room_object_id},
        {"$push": {"shared_resources": resource}}
    )

    # Broadcast socket event to anyone in this room
    try:
        from app.socketio_server import sio
        await sio.emit("resource_shared", {
            "room_id": str(room_id),
            "document_id": str(document_id),
            "shared_by": current_user.name
        }, room=str(room_id))
    except Exception as e:
        logger.warning(f"Socket emit for resource_shared failed: {e}")

    return {"message": "Resource shared successfully", "document_id": str(document_id)}


@router.get("/rooms/{room_id}/resources")
async def get_room_resources(
    room_id: str,
    current_user: UserInDB = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Get full document objects for all shared resources in a room"""
    try:
        room_object_id = ObjectId(room_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid room ID")

    room = await db.rooms.find_one({"_id": room_object_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    classroom = await db.classrooms.find_one({"_id": room["classroom_id"]})
    if not classroom or not is_classroom_member(classroom, current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")

    shared_resources = room.get("shared_resources", [])
    result = []
    for resource in shared_resources:
        try:
            doc = await db.documents.find_one({"_id": ObjectId(resource["document_id"])})
            if doc:
                content = doc.get("content", "") or ""
                # Strip HTML tags for preview
                import re as _re
                plain = _re.sub(r"<[^>]+>", " ", content).strip()
                preview = (plain[:150] + "...") if len(plain) > 150 else plain
                result.append({
                    "document_id": resource["document_id"],
                    "title": doc.get("title", "Untitled"),
                    "content_preview": preview,
                    "shared_by_name": resource.get("shared_by_name", "Unknown"),
                    "shared_at": resource.get("shared_at"),
                    "last_edited_by": resource.get("last_edited_by"),
                    "last_edited_at": resource.get("last_edited_at"),
                })
        except Exception:
            continue

    return result


# AI Suggestions
@router.get("/suggest-names")
async def suggest_classroom_names(description: str):
    """Get AI-suggested classroom names"""
    if len(description) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Description must be at least 3 characters long"
        )
    
    suggestions = await ai_service.suggest_classroom_name(description)
    return {"suggestions": suggestions}

@router.get("/suggest-room-names")
async def suggest_room_names(classroom_name: str, subject: str):
    """Get AI-suggested room names"""
    if len(subject) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subject must be at least 2 characters long"
        )
    
    suggestions = await ai_service.suggest_room_names(classroom_name, subject)
    return {"suggestions": suggestions}



