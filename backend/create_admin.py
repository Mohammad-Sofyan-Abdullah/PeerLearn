"""
One-time script to create the platform admin (superuser) account.

Usage (from the backend/ directory):
    python create_admin.py

You will be prompted for email and password.
The account is created as already-verified with role="admin".
If the email already exists the role is simply upgraded to admin.
"""
import asyncio
import getpass
import sys
import os

# Make sure app package is importable
sys.path.insert(0, os.path.dirname(__file__))

from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings
from app.auth import get_password_hash
from datetime import datetime


async def main():
    print("=" * 50)
    print("  PeerLearn — Create Admin Account")
    print("=" * 50)

    email = input("Admin email: ").strip()
    if not email:
        print("Email cannot be empty.")
        return

    name = input("Admin display name [Admin]: ").strip() or "Admin"

    password = getpass.getpass("Admin password: ")
    if len(password) < 8:
        print("Password must be at least 8 characters.")
        return
    confirm = getpass.getpass("Confirm password: ")
    if password != confirm:
        print("Passwords do not match.")
        return

    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]

    existing = await db.users.find_one({"email": email})

    if existing:
        # Upgrade existing account to admin
        await db.users.update_one(
            {"email": email},
            {"$set": {
                "role": "admin",
                "hashed_password": get_password_hash(password),
                "is_verified": True,
                "is_banned": False,
                "updated_at": datetime.utcnow(),
            }}
        )
        print(f"\n✓ Existing account '{email}' upgraded to ADMIN role.")
    else:
        # Create brand-new admin account
        await db.users.insert_one({
            "email": email,
            "name": name,
            "hashed_password": get_password_hash(password),
            "role": "admin",
            "is_verified": True,
            "is_banned": False,
            "bio": None,
            "avatar": None,
            "study_interests": [],
            "learning_streaks": 0,
            "student_id": None,
            "friends": [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        })
        print(f"\n✓ Admin account created for '{email}'.")

    client.close()
    print("  Login at /admin/login with the credentials you just set.")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
