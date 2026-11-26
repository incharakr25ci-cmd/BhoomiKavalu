import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient
from backend.app import app
from backend.database import SessionLocal
from backend.models import AudioDetection, SensorNode

client = TestClient(app)

print("--- 1. Testing /api/health ---")
r_health = client.get("/api/health")
print("Status:", r_health.status_code, "Body:", r_health.json())
assert r_health.status_code == 200

print("\n--- 2. Testing /api/esp32/status ---")
r_esp_status = client.get("/api/esp32/status")
print("Status:", r_esp_status.status_code, "Body:", r_esp_status.json())
assert r_esp_status.status_code == 200

print("\n--- 3. Testing ESP32 Audio POST with elephant.wav ---")
with open("reference_segments/elephant.wav", "rb") as f:
    wav_elephant = f.read()

r_ele = client.post(
    "/api/esp32/audio?node_id=NODE_001",
    content=wav_elephant,
    headers={"Content-Type": "audio/wav"},
)
print("Elephant POST Status:", r_ele.status_code)
res_ele = r_ele.json()
print("Elephant Result:", res_ele)
assert r_ele.status_code == 200
assert res_ele["animal"] == "Asian Elephant"
assert res_ele["sound_status"] == "ANIMAL_DETECTED"
assert res_ele["confidence_pct"] > 60

print("\n--- 4. Testing ESP32 Audio POST with tiger.wav ---")
with open("reference_segments/tiger.wav", "rb") as f:
    wav_tiger = f.read()

r_tig = client.post(
    "/api/esp32/audio?node_id=NODE_001",
    content=wav_tiger,
    headers={"Content-Type": "audio/wav"},
)
print("Tiger POST Status:", r_tig.status_code)
res_tig = r_tig.json()
print("Tiger Result:", res_tig)
assert r_tig.status_code == 200
assert res_tig["animal"] == "Tiger"
assert res_tig["sound_status"] == "ANIMAL_DETECTED"
assert res_tig["confidence_pct"] > 60

print("\n--- 5. Testing ESP32 Heartbeat ---")
r_hb = client.post("/api/esp32/heartbeat?node_id=NODE_001&device_status=ONLINE&mic_status=ACTIVE")
print("Heartbeat Status:", r_hb.status_code, "Body:", r_hb.json())
assert r_hb.status_code == 200

print("\n--- 6. Checking Database Records ---")
db = SessionLocal()
try:
    recent_detections = db.query(AudioDetection).order_by(AudioDetection.detected_at.desc()).limit(5).all()
    print(f"Total recent audio records found: {len(recent_detections)}")
    for d in recent_detections:
        print(f"  ID={d.id} | Species={d.species} | Confidence={d.confidence:.2f} | Time={d.detected_at}")
    assert len(recent_detections) >= 2
finally:
    db.close()

print("\n==============================================")
print(" ALL TESTS PASSED: ESP32 HTTP AUDIO PIPELINE VERIFIED!")
print("==============================================")
