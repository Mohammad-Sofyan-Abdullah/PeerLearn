"""
Google Calendar service for PeerLearn.
Creates Calendar events with Google Meet links using student OAuth tokens.
"""
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from datetime import datetime
import os
import logging

logger = logging.getLogger(__name__)

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

SCOPES = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/userinfo.email",
    "openid",
]


def build_credentials(
    access_token: str,
    refresh_token: str,
    token_expiry: datetime = None,
) -> Credentials:
    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        scopes=SCOPES,
    )
    if token_expiry:
        creds.expiry = token_expiry
    return creds


async def _refresh_if_needed(creds: Credentials, db, user_id: str) -> Credentials:
    """Refresh credentials if expired and persist new tokens to DB."""
    if creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            from bson import ObjectId
            await db.users.update_one(
                {"_id": ObjectId(user_id)},
                {
                    "$set": {
                        "google_access_token": creds.token,
                        "google_token_expiry": creds.expiry,
                    }
                },
            )
        except Exception as e:
            logger.error(f"Failed to refresh Google credentials for user {user_id}: {e}")
            raise Exception("Google access token expired and could not be refreshed. Please reconnect Google Calendar.")
    return creds


async def create_calendar_event_with_meet(
    db,
    student_id: str,
    teacher_name: str,
    student_name: str,
    subject: str,
    start_time: datetime,
    end_time: datetime,
    timezone: str = "UTC",
) -> dict:
    """
    Creates a Google Calendar event with a Google Meet link using the
    student's stored OAuth tokens.

    Returns:
        {"meet_link": str, "event_id": str, "event_link": str}

    Raises:
        Exception — if student has no Google Calendar connected or API fails.
        Never called from outside without a try/except — callers must handle.
    """
    from bson import ObjectId

    student = await db.users.find_one({"_id": ObjectId(student_id)})
    if not student:
        raise Exception("Student not found")

    if not student.get("google_calendar_connected") or not student.get("google_access_token"):
        raise Exception("Student has not connected Google Calendar")

    creds = build_credentials(
        access_token=student["google_access_token"],
        refresh_token=student.get("google_refresh_token", ""),
        token_expiry=student.get("google_token_expiry"),
    )

    creds = await _refresh_if_needed(creds, db, student_id)

    service = build("calendar", "v3", credentials=creds)

    event_body = {
        "summary": f"PeerLearn Session: {subject}",
        "description": (
            f"Teaching session with {teacher_name} on {subject}.\n"
            f"Student: {student_name}\n\n"
            f"Booked via PeerLearn."
        ),
        "start": {
            "dateTime": start_time.isoformat(),
            "timeZone": timezone,
        },
        "end": {
            "dateTime": end_time.isoformat(),
            "timeZone": timezone,
        },
        "attendees": [
            {"email": student.get("email")},
        ],
        "conferenceData": {
            "createRequest": {
                "requestId": f"peerlearn-{student_id}-{int(start_time.timestamp())}",
                "conferenceSolutionKey": {"type": "hangoutsMeet"},
            }
        },
        "reminders": {
            "useDefault": False,
            "overrides": [
                {"method": "email", "minutes": 60},
                {"method": "popup", "minutes": 15},
            ],
        },
    }

    created_event = (
        service.events()
        .insert(
            calendarId="primary",
            body=event_body,
            conferenceDataVersion=1,
            sendUpdates="all",
        )
        .execute()
    )

    entry_points = created_event.get("conferenceData", {}).get("entryPoints", [])
    meet_link = ""
    for ep in entry_points:
        if ep.get("entryPointType") == "video":
            meet_link = ep.get("uri", "")
            break
    if not meet_link and entry_points:
        meet_link = entry_points[0].get("uri", "")

    return {
        "meet_link": meet_link,
        "event_id": created_event.get("id", ""),
        "event_link": created_event.get("htmlLink", ""),
    }
