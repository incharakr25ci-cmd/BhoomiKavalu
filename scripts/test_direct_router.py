import asyncio
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from backend.database import SessionLocal
from backend.routers.esp32_router import esp32_audio, esp32_heartbeat, esp32_api_status

print("1. Testing esp32_api_status...")
status = esp32_api_status()
print("Status:", status)
assert status["status"] == "online"

print("\n2. Testing esp32_heartbeat...")
db = SessionLocal()
try:
    hb = asyncio.run(esp32_heartbeat(node_id="NODE_001", device_status="ONLINE", mic_status="ACTIVE", db=db))
    print("Heartbeat:", hb)
    assert hb["status"] == "ok"
finally:
    db.close()

print("\n3. Testing esp32_audio with elephant.wav...")
with open("reference_segments/elephant.wav", "rb") as f:
    wav_bytes = f.read()

# Create mock request with audio/wav header and body
mock_req = MagicMock()
mock_req.headers = {"content-type": "audio/wav"}
mock_req.body = AsyncMock(return_value=wav_bytes)

db = SessionLocal()
try:
    res = asyncio.run(esp32_audio(request=mock_req, node_id="NODE_001", db=db))
    print("ESP32 Audio result:", res)
    assert res["status"] == "success"
    assert res["animal"] == "Asian Elephant"
    assert res["sound_status"] == "ANIMAL_DETECTED"
    print("Elephant classification confirmed!")
finally:
    db.close()

print("\n4. Testing esp32_audio with tiger.wav...")
with open("reference_segments/tiger.wav", "rb") as f:
    tiger_bytes = f.read()

mock_req_tiger = MagicMock()
mock_req_tiger.headers = {"content-type": "audio/wav"}
mock_req_tiger.body = AsyncMock(return_value=tiger_bytes)

db = SessionLocal()
try:
    res_tiger = asyncio.run(esp32_audio(request=mock_req_tiger, node_id="NODE_001", db=db))
    print("ESP32 Tiger Audio result:", res_tiger)
    assert res_tiger["status"] == "success"
    assert res_tiger["animal"] == "Tiger"
    assert res_tiger["sound_status"] == "ANIMAL_DETECTED"
    print("Tiger classification confirmed!")
finally:
    db.close()

print("\n==========================================")
print(" ALL DIRECT ROUTER TESTS PASSED 100%!")
print("==========================================")
