import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

async def migrate():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["PeerLearn"]

    # Fix 1: add free_materials field to profiles that don't have it
    r1 = await db.teacher_profiles.update_many(
        {"free_materials": {"$exists": False}},
        {"$set": {"free_materials": []}}
    )
    print(f"Added free_materials to {r1.modified_count} profiles")

    # Fix 2: create missing profiles for teacher users with no profile doc
    created = []
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
            created.append(user.get("name"))
    print(f"Created profiles for: {created}")

    # Verify final state
    profiles = await db.teacher_profiles.find({}).to_list(length=20)
    print(f"\nFinal teacher_profiles count: {len(profiles)}")
    for p in profiles:
        has_fm = "free_materials" in p
        print(f"  name={p.get('full_name')!r}, status={p.get('status')!r}, free_materials={has_fm}")

asyncio.run(migrate())
