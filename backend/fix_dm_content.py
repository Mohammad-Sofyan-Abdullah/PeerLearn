import re

path = r'd:\FYP Project PeerLearn (1)\FYP Project PeerLearn\backend\app\routers\teachers.py'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the dm_content block by line range and replace it using regex
# Match the entire if meet_link: ... dm_content block
pattern = re.compile(
    r'(                    if meet_link:\r?\n'
    r'                        dm_content = \(\r?\n)'
    r'.*?'
    r'(                        \)\r?\n'
    r'                    else:\r?\n'
    r'                        connect_note = \(\r?\n)'
    r'.*?'
    r'(                        \)\r?\n'
    r'                        dm_content = \(\r?\n)'
    r'.*?'
    r'(                        \)\r?\n)',
    re.DOTALL
)

new_block = (
    "                    if meet_link:\r\n"
    "                        dm_content = (\r\n"
    "                            f\"\u2705 Your session request for '{subj}' has been approved!\u005cn\u005cn\"\r\n"
    "                            f\"\U0001f4c5 Session Details\u005cn\"\r\n"
    "                            f\"Subject: {subj}\u005cn\"\r\n"
    "                            f\"Teacher: {teacher_name}\u005cn\"\r\n"
    "                            f\"Time: {time_str}\u005cn\"\r\n"
    "                            f\"Duration: {dur} hour(s)\u005cn\u005cn\"\r\n"
    "                            f\"\U0001f3a5 Google Meet Link\u005cn\"\r\n"
    "                            f\"{meet_link}\u005cn\u005cn\"\r\n"
    "                            f\"\U0001f4ce Calendar Event\u005cn\"\r\n"
    "                            f\"{event_link}\u005cn\u005cn\"\r\n"
    "                            f\"See you in the session! \U0001f393\"\r\n"
    "                        )\r\n"
    "                    else:\r\n"
    "                        connect_note = (\r\n"
    "                            \"Connect your Google Calendar in Profile > Connected Accounts to get automatic Meet links next time.\"\r\n"
    "                            if not calendar_connected else\r\n"
    "                            \"The Meet link could not be created automatically. The teacher will share one shortly.\"\r\n"
    "                        )\r\n"
    "                        dm_content = (\r\n"
    "                            f\"\u2705 Your session request for '{subj}' has been approved!\u005cn\u005cn\"\r\n"
    "                            f\"\U0001f4c5 Session Details\u005cn\"\r\n"
    "                            f\"Subject: {subj}\u005cn\"\r\n"
    "                            f\"Teacher: {teacher_name}\u005cn\"\r\n"
    "                            f\"Time: {time_str}\u005cn\"\r\n"
    "                            f\"Duration: {dur} hour(s)\u005cn\u005cn\"\r\n"
    "                            f\"The teacher will share a meeting link with you shortly.\u005cn\u005cn\"\r\n"
    "                            f\"{connect_note}\"\r\n"
    "                        )\r\n"
)

match = pattern.search(content)
if match:
    content = content[:match.start()] + new_block + content[match.end():]
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("SUCCESS: dm_content block replaced with plain text")
else:
    # Dump relevant lines for debugging
    lines = content.splitlines()
    for i, l in enumerate(lines[774:808], start=775):
        print(f"{i}: {repr(l)}")
    print("FAILED: pattern not matched")
