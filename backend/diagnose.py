import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def diagnose():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["PeerLearn"]

    profiles = await db.teacher_profiles.find({}).to_list(length=20)
    print(f"teacher_profiles count: {len(profiles)}")
    for p in profiles:
        keys = list(p.keys())
        print(f"  Profile: user_id={p.get('user_id')}, status={p.get('status')}, name={p.get('full_name')}, keys={keys}")

    teachers = await db.users.find({"role": "teacher"}).to_list(length=20)
    print(f"\nUsers with role=teacher count: {len(teachers)}")
    for t in teachers:
        print(f"  User: _id={t['_id']}, name={t.get('name')}, email={t.get('email')}, role={t.get('role')}")

    collections = await db.list_collection_names()
    print(f"\nAll collections: {sorted(collections)}")

asyncio.run(diagnose())
