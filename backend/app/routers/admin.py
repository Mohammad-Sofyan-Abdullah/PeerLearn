"""
Admin Router — Superuser endpoints for PeerLearn platform management.
Protected by require_admin dependency (role == "admin").
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from bson import ObjectId
from datetime import datetime

from app.auth import require_admin
from app.database import get_database
from app.models import UserInDB, UserRole
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


# ── Request/Response schemas ──────────────────────────────────────────────────

class BanRequest(BaseModel):
    reason: str

class TeacherActionRequest(BaseModel):
    reason: Optional[str] = None

class AdminLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _serialize(doc: dict) -> dict:
    """Convert MongoDB ObjectIds and datetimes to JSON-safe types."""
    out = {}
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            out[k] = str(v)
        elif isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, list):
            out[k] = [str(i) if isinstance(i, ObjectId) else i for i in v]
        else:
            out[k] = v
    return out


# ── Platform Stats ────────────────────────────────────────────────────────────

@router.get("/stats")
async def get_platform_stats(
    admin: UserInDB = Depends(require_admin),
    db=Depends(get_database),
):
    """High-level platform metrics for the admin dashboard."""
    total_users = await db.users.count_documents({})
    total_students = await db.users.count_documents({"role": "student"})
    total_teachers = await db.users.count_documents({"role": "teacher"})
    banned_users = await db.users.count_documents({"is_banned": True})
    total_marketplace = await db.marketplace_notes.count_documents({})
    total_notes = await db.notes.count_documents({})
    pending_teachers = await db.teacher_profiles.count_documents({"status": "pending"})
    total_hire_requests = await db.hire_requests.count_documents({})

    return {
        "users": {
            "total": total_users,
            "students": total_students,
            "teachers": total_teachers,
            "banned": banned_users,
        },
        "content": {
            "marketplace_notes": total_marketplace,
            "notes": total_notes,
        },
        "teachers": {
            "pending_approval": pending_teachers,
        },
        "hire_requests": {
            "total": total_hire_requests,
        },
    }


# ── User Management ───────────────────────────────────────────────────────────

@router.get("/users")
async def list_users(
    role: Optional[str] = None,
    is_banned: Optional[bool] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    admin: UserInDB = Depends(require_admin),
    db=Depends(get_database),
):
    """List all users with optional filters."""
    query: dict = {}
    if role:
        query["role"] = role
    if is_banned is not None:
        query["is_banned"] = is_banned
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]

    cursor = db.users.find(query, {"hashed_password": 0}).skip(skip).limit(limit)
    users = []
    async for u in cursor:
        users.append(_serialize(u))

    total = await db.users.count_documents(query)
    return {"users": users, "total": total, "skip": skip, "limit": limit}


@router.get("/users/{user_id}")
async def get_user(
    user_id: str,
    admin: UserInDB = Depends(require_admin),
    db=Depends(get_database),
):
    """Get a single user's details."""
    try:
        uid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    user = await db.users.find_one({"_id": uid}, {"hashed_password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _serialize(user)


@router.post("/users/{user_id}/ban")
async def ban_user(
    user_id: str,
    payload: BanRequest,
    admin: UserInDB = Depends(require_admin),
    db=Depends(get_database),
):
    """Ban a user account with a mandatory reason."""
    try:
        uid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    user = await db.users.find_one({"_id": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("role") == UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Cannot ban another admin")

    await db.users.update_one(
        {"_id": uid},
        {"$set": {"is_banned": True, "ban_reason": payload.reason, "updated_at": datetime.utcnow()}}
    )
    return {"message": f"User {user_id} has been banned", "reason": payload.reason}


@router.post("/users/{user_id}/unban")
async def unban_user(
    user_id: str,
    admin: UserInDB = Depends(require_admin),
    db=Depends(get_database),
):
    """Remove a ban from a user account."""
    try:
        uid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    result = await db.users.update_one(
        {"_id": uid},
        {"$set": {"is_banned": False, "ban_reason": None, "updated_at": datetime.utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": f"User {user_id} has been unbanned"}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    admin: UserInDB = Depends(require_admin),
    db=Depends(get_database),
):
    """Permanently delete a user account."""
    try:
        uid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    user = await db.users.find_one({"_id": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("role") == UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Cannot delete an admin account")

    await db.users.delete_one({"_id": uid})
    return {"message": f"User {user_id} permanently deleted"}


# ── Teacher Approval ──────────────────────────────────────────────────────────

@router.get("/teachers/pending")
async def list_pending_teachers(
    admin: UserInDB = Depends(require_admin),
    db=Depends(get_database),
):
    """List all teacher profiles awaiting approval."""
    cursor = db.teacher_profiles.find({"status": "pending"})
    profiles = []
    async for p in cursor:
        serialized = _serialize(p)
        # Attach basic user info
        try:
            uid = ObjectId(str(p.get("user_id", "")))
            user = await db.users.find_one({"_id": uid}, {"name": 1, "email": 1, "avatar": 1})
            if user:
                serialized["user"] = _serialize(user)
        except Exception:
            pass
        profiles.append(serialized)
    return {"profiles": profiles, "total": len(profiles)}


@router.get("/teachers/all")
async def list_all_teachers(
    status_filter: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    admin: UserInDB = Depends(require_admin),
    db=Depends(get_database),
):
    """List all teacher profiles (optionally filtered by status)."""
    query: dict = {}
    if status_filter:
        query["status"] = status_filter

    cursor = db.teacher_profiles.find(query).skip(skip).limit(limit)
    profiles = []
    async for p in cursor:
        serialized = _serialize(p)
        try:
            uid = ObjectId(str(p.get("user_id", "")))
            user = await db.users.find_one({"_id": uid}, {"name": 1, "email": 1, "avatar": 1})
            if user:
                serialized["user"] = _serialize(user)
        except Exception:
            pass
        profiles.append(serialized)

    total = await db.teacher_profiles.count_documents(query)
    return {"profiles": profiles, "total": total}


@router.post("/teachers/{profile_id}/approve")
async def approve_teacher(
    profile_id: str,
    admin: UserInDB = Depends(require_admin),
    db=Depends(get_database),
):
    """Approve a pending teacher profile, making them visible on discovery."""
    try:
        pid = ObjectId(profile_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid profile ID")

    result = await db.teacher_profiles.update_one(
        {"_id": pid},
        {"$set": {"status": "approved", "updated_at": datetime.utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Teacher profile not found")
    return {"message": f"Teacher profile {profile_id} approved"}


@router.post("/teachers/{profile_id}/reject")
async def reject_teacher(
    profile_id: str,
    payload: TeacherActionRequest,
    admin: UserInDB = Depends(require_admin),
    db=Depends(get_database),
):
    """Reject a teacher profile with an optional reason."""
    try:
        pid = ObjectId(profile_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid profile ID")

    result = await db.teacher_profiles.update_one(
        {"_id": pid},
        {"$set": {
            "status": "rejected",
            "rejection_reason": payload.reason,
            "updated_at": datetime.utcnow()
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Teacher profile not found")
    return {"message": f"Teacher profile {profile_id} rejected", "reason": payload.reason}


# ── Content Moderation ────────────────────────────────────────────────────────

@router.get("/content/marketplace")
async def list_marketplace_notes(
    skip: int = 0,
    limit: int = 50,
    admin: UserInDB = Depends(require_admin),
    db=Depends(get_database),
):
    """List all marketplace notes for moderation review."""
    cursor = db.marketplace_notes.find({}).skip(skip).limit(limit)
    notes = []
    async for n in cursor:
        serialized = _serialize(n)
        try:
            uid = ObjectId(str(n.get("seller_id", "")))
            user = await db.users.find_one({"_id": uid}, {"name": 1, "email": 1})
            if user:
                serialized["seller"] = _serialize(user)
        except Exception:
            pass
        notes.append(serialized)
    total = await db.marketplace_notes.count_documents({})
    return {"notes": notes, "total": total}


@router.delete("/content/marketplace/{note_id}")
async def remove_marketplace_note(
    note_id: str,
    admin: UserInDB = Depends(require_admin),
    db=Depends(get_database),
):
    """Permanently remove a marketplace note (content violation etc.)."""
    try:
        nid = ObjectId(note_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid note ID")

    result = await db.marketplace_notes.delete_one({"_id": nid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"message": f"Marketplace note {note_id} removed"}


@router.get("/content/notes")
async def list_all_notes(
    skip: int = 0,
    limit: int = 50,
    admin: UserInDB = Depends(require_admin),
    db=Depends(get_database),
):
    """List all user notes for moderation review."""
    cursor = db.notes.find({}).skip(skip).limit(limit)
    notes = []
    async for n in cursor:
        serialized = _serialize(n)
        try:
            uid = ObjectId(str(n.get("owner_id", "")))
            user = await db.users.find_one({"_id": uid}, {"name": 1, "email": 1})
            if user:
                serialized["owner"] = _serialize(user)
        except Exception:
            pass
        notes.append(serialized)
    total = await db.notes.count_documents({})
    return {"notes": notes, "total": total}


@router.delete("/content/notes/{note_id}")
async def remove_note(
    note_id: str,
    admin: UserInDB = Depends(require_admin),
    db=Depends(get_database),
):
    """Permanently remove a user note."""
    try:
        nid = ObjectId(note_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid note ID")

    result = await db.notes.delete_one({"_id": nid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"message": f"Note {note_id} removed"}


# ── Teacher Reviews Moderation ────────────────────────────────────────────────

@router.delete("/content/reviews/{review_id}")
async def remove_teacher_review(
    review_id: str,
    admin: UserInDB = Depends(require_admin),
    db=Depends(get_database),
):
    """Remove an abusive or fake teacher review."""
    try:
        rid = ObjectId(review_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid review ID")

    result = await db.teacher_reviews.delete_one({"_id": rid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Review not found")
    return {"message": f"Review {review_id} removed"}
