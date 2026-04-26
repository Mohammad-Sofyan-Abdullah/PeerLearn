"""
Literature & Resource Recommendation API Routes
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from datetime import datetime
from app.models import UserInDB
from app.auth import get_current_active_user
from app.database import get_database
from app.ai_service import ai_service
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/resources", tags=["resources"])


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _serialise_session(session: dict) -> dict:
    """Convert MongoDB session document to JSON-serialisable dict."""
    s = dict(session)
    s["id"] = str(s.pop("_id"))
    s["user_id"] = str(s.get("user_id", ""))
    for msg in s.get("messages", []):
        if isinstance(msg.get("timestamp"), datetime):
            msg["timestamp"] = msg["timestamp"].isoformat()
    if isinstance(s.get("created_at"), datetime):
        s["created_at"] = s["created_at"].isoformat()
    if isinstance(s.get("updated_at"), datetime):
        s["updated_at"] = s["updated_at"].isoformat()
    return s


async def _get_marketplace_matches(db, query: str) -> list:
    """Return top-3 marketplace note titles that match keywords in the query."""
    keywords = [w for w in query.split() if len(w) > 3]
    if not keywords:
        return []
    regex_parts = "|".join(keywords[:8])  # cap to avoid huge regex
    results = await db.marketplace_notes.find(
        {
            "status": "approved",
            "$or": [
                {"title":   {"$regex": regex_parts, "$options": "i"}},
                {"subject": {"$regex": regex_parts, "$options": "i"}},
            ]
        },
        {"title": 1, "subject": 1}
    ).limit(3).to_list(length=3)
    return [r.get("title", "") for r in results if r.get("title")]


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/sessions")
async def create_session(
    body: dict,
    current_user: UserInDB = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Create a new recommendation session."""
    topic = (body.get("topic") or "").strip()
    if not topic:
        raise HTTPException(status_code=400, detail="topic is required")

    session_name = (body.get("session_name") or topic)[:50]

    doc = {
        "user_id": ObjectId(current_user.id),
        "session_name": session_name,
        "topic": topic,
        "messages": [],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    result = await db.resource_sessions.insert_one(doc)
    created = await db.resource_sessions.find_one({"_id": result.inserted_id})
    return _serialise_session(created)


@router.get("/sessions")
async def get_sessions(
    current_user: UserInDB = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Return all sessions for the current user, newest first."""
    sessions = await db.resource_sessions.find(
        {"user_id": ObjectId(current_user.id)}
    ).sort("updated_at", -1).to_list(length=100)
    return [_serialise_session(s) for s in sessions]


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    current_user: UserInDB = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Return a single session with full message history."""
    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session ID")

    session = await db.resource_sessions.find_one(
        {"_id": oid, "user_id": ObjectId(current_user.id)}
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return _serialise_session(session)


@router.post("/sessions/{session_id}/recommend")
async def get_recommendations(
    session_id: str,
    body: dict,
    current_user: UserInDB = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """
    Send a query; AI returns curated resources.
    Appends both user message and AI response to the session history.
    """
    query = (body.get("query") or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="query is required")

    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session ID")

    session = await db.resource_sessions.find_one(
        {"_id": oid, "user_id": ObjectId(current_user.id)}
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Fetch marketplace notes that match the query
    marketplace_notes = await _get_marketplace_matches(db, query)

    # Build conversation history for multi-turn context
    conversation_history = [
        {"role": msg["role"], "content": msg["content"]}
        for msg in session.get("messages", [])
    ]

    # Call AI
    ai_html = await ai_service.get_resource_recommendations(
        query=query,
        conversation_history=conversation_history,
        marketplace_notes=marketplace_notes,
    )

    now = datetime.utcnow()
    user_msg = {"role": "user",    "content": query,   "timestamp": now}
    ai_msg   = {"role": "assistant","content": ai_html, "timestamp": now}

    await db.resource_sessions.update_one(
        {"_id": oid},
        {
            "$push": {"messages": {"$each": [user_msg, ai_msg]}},
            "$set":  {"updated_at": now},
        }
    )

    return {
        "user_message": query,
        "ai_response":  ai_html,
    }


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    current_user: UserInDB = Depends(get_current_active_user),
    db = Depends(get_database)
):
    """Delete a recommendation session."""
    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session ID")

    result = await db.resource_sessions.delete_one(
        {"_id": oid, "user_id": ObjectId(current_user.id)}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"message": "Session deleted"}


@router.get("/quick")
async def quick_recommendation(
    topic: str,
    db = Depends(get_database)
):
    """
    Stateless quick recommendation — no session created, no history.
    Used by the FurtherReadingSection in DocumentSessionPage.
    Publicly accessible (no auth) so it doesn't block the summary tab.
    """
    if not topic or not topic.strip():
        raise HTTPException(status_code=400, detail="topic is required")

    marketplace_notes = await _get_marketplace_matches(db, topic)
    ai_html = await ai_service.get_resource_recommendations(
        query=f"Recommend the best resources for learning about: {topic}",
        conversation_history=[],
        marketplace_notes=marketplace_notes,
    )
    return {"content": ai_html, "topic": topic}
