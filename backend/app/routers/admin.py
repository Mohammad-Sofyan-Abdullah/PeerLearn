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
from app.email_service import email_service
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
    total_notes = await db.documents.count_documents({})
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
    search: Optional[str] = None,
    sort: str = "newest",
    skip: int = 0,
    limit: int = 50,
    admin: UserInDB = Depends(require_admin),
    db=Depends(get_database),
):
    """List all teacher profiles with optional status filter, search, and sort."""
    query: dict = {}
    if status_filter:
        query["status"] = status_filter

    sort_field, sort_dir = "updated_at", -1
    if sort == "oldest":
        sort_field, sort_dir = "updated_at", 1
    elif sort == "experience_high":
        sort_field, sort_dir = "years_of_experience", -1
    elif sort == "experience_low":
        sort_field, sort_dir = "years_of_experience", 1

    cursor = db.teacher_profiles.find(query).sort(sort_field, sort_dir).skip(skip).limit(limit)
    profiles = []
    async for p in cursor:
        serialized = _serialize(p)
        try:
            uid = ObjectId(str(p.get("user_id", "")))
            user = await db.users.find_one({"_id": uid}, {"name": 1, "email": 1, "avatar": 1})
            if user:
                serialized["user"] = _serialize(user)
                if search:
                    s = search.lower()
                    search_fields = [
                        p.get("full_name", ""),
                        " ".join(p.get("areas_of_expertise", [])),
                        " ".join(p.get("courses_offered", [])),
                        user.get("name", ""),
                        user.get("email", ""),
                    ]
                    search_text = " ".join(f for f in search_fields if f).lower()
                    if s not in search_text:
                        continue
            elif search:
                continue  # no user doc, can't match search
        except Exception:
            if search:
                continue
        profiles.append(serialized)

    total = len(profiles)
    return {"profiles": profiles, "total": total}


@router.get("/teachers/{teacher_id}")
async def get_teacher_detail(
    teacher_id: str,
    admin: UserInDB = Depends(require_admin),
    db=Depends(get_database),
):
    """Return full teacher profile + full user record for the admin detail panel."""
    try:
        pid = ObjectId(teacher_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid teacher profile ID")

    profile = await db.teacher_profiles.find_one({"_id": pid})
    if not profile:
        raise HTTPException(status_code=404, detail="Teacher profile not found")

    serialized = _serialize(profile)

    # Join full user record — no field filtering, admin needs everything
    try:
        uid = ObjectId(str(profile.get("user_id", "")))
        user = await db.users.find_one({"_id": uid}, {"hashed_password": 0})
        if user:
            serialized["user"] = _serialize(user)
    except Exception:
        pass

    return serialized


@router.post("/teachers/{profile_id}/approve")
async def approve_teacher(
    profile_id: str,
    admin: UserInDB = Depends(require_admin),
    db=Depends(get_database),
):
    """Approve a pending teacher profile and promote the user role to teacher."""
    try:
        pid = ObjectId(profile_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid profile ID")

    # Fetch profile first so we have user_id for role promotion
    profile = await db.teacher_profiles.find_one({"_id": pid})
    if not profile:
        raise HTTPException(status_code=404, detail="Teacher profile not found")

    await db.teacher_profiles.update_one(
        {"_id": pid},
        {"$set": {"status": "approved", "updated_at": datetime.utcnow()}}
    )

    # Promote user role from student → teacher so they can access teacher routes
    await db.users.update_one(
        {"_id": profile["user_id"]},
        {"$set": {"role": "teacher", "updated_at": datetime.utcnow()}}
    )

    # Send approval email
    user = await db.users.find_one({"_id": profile["user_id"]})
    if user:
        await email_service.send_teacher_approval_email(user["email"], user["name"])

    return {"message": f"Teacher profile {profile_id} approved and user role updated"}


@router.post("/teachers/{profile_id}/reject")
async def reject_teacher(
    profile_id: str,
    payload: TeacherActionRequest,
    admin: UserInDB = Depends(require_admin),
    db=Depends(get_database),
):
    """Reject a teacher profile with a reason and notify them by email."""
    try:
        pid = ObjectId(profile_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid profile ID")

    # Fetch profile first to get user_id for email notification
    profile = await db.teacher_profiles.find_one({"_id": pid})
    if not profile:
        raise HTTPException(status_code=404, detail="Teacher profile not found")

    await db.teacher_profiles.update_one(
        {"_id": pid},
        {"$set": {
            "status": "rejected",
            "rejection_reason": payload.reason,
            "updated_at": datetime.utcnow()
        }}
    )

    # Send rejection email with reason
    user = await db.users.find_one({"_id": profile["user_id"]})
    if user:
        reason_text = payload.reason or "Your application did not meet our current requirements."
        await email_service.send_teacher_rejection_email(user["email"], user["name"], reason_text)

    return {"message": f"Teacher profile {profile_id} rejected", "reason": payload.reason}

# ── Students ──────────────────────────────────────────────────────────────────

@router.get("/students")
async def get_all_students(
    search: str = "",
    status: str = "all",   # "all" | "active" | "banned"
    limit: int = 100,
    offset: int = 0,
    admin: UserInDB = Depends(require_admin),
    db=Depends(get_database),
):
    """List all students with optional search, status filter, and activity counts."""
    query: dict = {"role": "student"}

    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]
    if status == "banned":
        query["is_banned"] = True
    elif status == "active":
        query["is_banned"] = {"$ne": True}

    cursor = db.users.find(query, {"hashed_password": 0}).skip(offset).limit(limit)
    students = []
    async for u in cursor:
        s = _serialize(u)
        uid = u["_id"]
        # Attach activity counts
        try:
            s["classroom_count"] = await db.classrooms.count_documents(
                {"$or": [{"admin_id": uid}, {"members": uid}]}
            )
        except Exception:
            s["classroom_count"] = 0
        try:
            s["document_count"] = await db.documents.count_documents({"user_id": uid})
        except Exception:
            s["document_count"] = 0
        students.append(s)

    total = await db.users.count_documents(query)
    return {"students": students, "total": total}


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
    """List all user documents for moderation review."""
    cursor = db.documents.find({}).skip(skip).limit(limit)
    notes = []
    async for n in cursor:
        serialized = _serialize(n)
        try:
            uid = ObjectId(str(n.get("user_id", "")))
            user = await db.users.find_one({"_id": uid}, {"name": 1, "email": 1})
            if user:
                serialized["owner"] = _serialize(user)
        except Exception:
            pass
        notes.append(serialized)
    total = await db.documents.count_documents({})
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

    result = await db.documents.delete_one({"_id": nid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"message": f"Note {note_id} removed"}


# ── Teacher Reviews Moderation ────────────────────────────────────────────────

@router.get("/content/reviews")
async def list_teacher_reviews(
    skip: int = 0,
    limit: int = 50,
    admin: UserInDB = Depends(require_admin),
    db=Depends(get_database),
):
    """List all teacher reviews for moderation."""
    cursor = db.teacher_reviews.find({}).skip(skip).limit(limit)
    reviews = []
    async for r in cursor:
        serialized = _serialize(r)
        # Reviewer name is stored directly on the review document
        serialized["reviewer_name"] = r.get("student_name", "—")
        # Join teacher name via teacher_id -> teacher_profiles -> users
        try:
            teacher_profile = await db.teacher_profiles.find_one(
                {"_id": r["teacher_id"]}, {"user_id": 1, "full_name": 1}
            )
            if teacher_profile:
                user = await db.users.find_one(
                    {"_id": teacher_profile["user_id"]}, {"name": 1}
                )
                serialized["teacher_name"] = (
                    user.get("name") if user and user.get("name")
                    else teacher_profile.get("full_name", "Unknown Teacher")
                )
            else:
                serialized["teacher_name"] = "Unknown Teacher"
        except Exception:
            serialized["teacher_name"] = "Unknown Teacher"
        reviews.append(serialized)
    total = await db.teacher_reviews.count_documents({})
    return {"reviews": reviews, "total": total}


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


# ── One-time migration ────────────────────────────────────────────────────────

@router.post("/migrate/fix-teacher-profiles")
async def fix_teacher_profiles(
    admin: UserInDB = Depends(require_admin),
    db=Depends(get_database),
):
    """
    One-time migration endpoint:
    1. Add free_materials field to profiles missing it.
    2. Create a pending profile for every teacher user that has none.
    """
    results = []

    # Fix 1: backfill free_materials
    r1 = await db.teacher_profiles.update_many(
        {"free_materials": {"$exists": False}},
        {"$set": {"free_materials": []}}
    )
    results.append(f"Added free_materials to {r1.modified_count} profiles")

    # Fix 2: create missing profiles for teacher users
    created_for = []
    async for user in db.users.find({"role": "teacher"}):
        existing = await db.teacher_profiles.find_one({"user_id": user["_id"]})
        if not existing:
            await db.teacher_profiles.insert_one({
                "user_id": user["_id"],
                "status": "pending",
                "full_name": user.get("name", ""),
                "short_bio": "",
                "areas_of_expertise": [],
                "courses_offered": [],
                "portfolio_links": [],
                "free_materials": [],
                "years_of_experience": 0,
                "hourly_rate": 0,
                "average_rating": 0.0,
                "total_reviews": 0,
                "total_students": 0,
                "total_sessions": 0,
                "total_earnings": 0.0,
                "is_active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            })
            created_for.append(user.get("name", str(user["_id"])))

    results.append(f"Created missing profiles for: {created_for}")
    return {"fixed": results}
