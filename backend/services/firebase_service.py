"""
Bhoomi Kavalu - Firebase Realtime Database Service
Synchronizes ESP32 node connection, microphone status, sound detection,
animal classification, confidence score, latest detection, and detection history.
Preserves existing database schema from node1_ai_firebase.py while supporting
both configured Firebase instances (e8adc and cb186).
"""

import asyncio
import os
import time
from datetime import datetime
from typing import Any, Dict, Optional
import httpx

FIREBASE_URLS = [
    # Primary configured project
    "https://bhoomikavalu-e8adc-default-rtdb.asia-southeast1.firebasedatabase.app",
    # Active reference node project from node1_ai_firebase.py
    "https://bhoomikavalu-cb186-default-rtdb.asia-southeast1.firebasedatabase.app",
]

# Allow overriding via environment variable
CUSTOM_FIREBASE_URL = os.getenv("FIREBASE_DATABASE_URL")
if CUSTOM_FIREBASE_URL:
    FIREBASE_URLS.insert(0, CUSTOM_FIREBASE_URL.rstrip("/"))


def _format_node_key(node_code: str) -> str:
    """Normalize node code to Firebase node key (e.g. NODE_001 -> node1)."""
    norm = node_code.lower().replace("-", "_").replace(" ", "")
    if "001" in norm or "node_1" in norm or "node1" in norm:
        return "node1"
    if "002" in norm or "node_2" in norm or "node2" in norm:
        return "node2"
    if "003" in norm or "node_3" in norm or "node3" in norm:
        return "node3"
    return norm


async def _put_json(url: str, payload: Dict[str, Any], timeout: float = 1.2) -> bool:
    """Async PUT JSON to a Firebase REST endpoint with fast timeout."""
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.put(url, json=payload)
            return resp.status_code in (200, 204)
    except Exception:
        return False


async def _post_json(url: str, payload: Dict[str, Any], timeout: float = 1.2) -> bool:
    """Async POST (append) JSON to a Firebase REST endpoint with fast timeout."""
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, json=payload)
            return resp.status_code in (200, 204)
    except Exception:
        return False


async def sync_detection_to_firebase(
    node_code: str,
    detection: Dict[str, Any],
) -> Dict[str, bool]:
    """
    Sync AI detection and history to Firebase Realtime Database.
    Preserves exact structure expected by node1_ai_firebase.py and frontend:
    - /forestMonitoring/{nodeKey}/aiDetection.json
    - /forestMonitoring/{nodeKey}/status.json
    - /forestMonitoring/{nodeKey}/history.json
    """
    node_key = _format_node_key(node_code)
    now_ms = int(time.time() * 1000)
    now_iso = datetime.utcnow().isoformat()

    animal = detection.get("animal", "None")
    conf_pct = detection.get("confidence_pct", detection.get("confidence", 0.0) * 100)
    status = detection.get("status", "IDLE")
    rms = detection.get("rms", 0.0)

    ai_detection_payload = {
        "animal": str(animal),
        "confidence": round(float(conf_pct), 2),
        "status": status,
        "audio_rms": round(float(rms), 6),
        "source": "esp32_inmp441",
        "timestamp": now_ms,
        "timestamp_iso": now_iso,
    }

    status_payload = {
        "device_status": "ONLINE",
        "mic_status": "ACTIVE",
        "sound_status": "DETECTED" if status == "ANIMAL_DETECTED" else status,
        "animal": str(animal),
        "confidence": round(float(conf_pct), 2),
        "audio_level_rms": round(float(rms), 6),
        "audio_processing_status": "SUCCESS",
        "last_heartbeat": now_ms,
        "last_heartbeat_iso": now_iso,
    }

    results = {}
    for base_url in FIREBASE_URLS:
        try:
            ai_url = f"{base_url}/forestMonitoring/{node_key}/aiDetection.json"
            status_url = f"{base_url}/forestMonitoring/{node_key}/status.json"

            t1 = _put_json(ai_url, ai_detection_payload)
            t2 = _put_json(status_url, status_payload)

            # If wildlife detected, also append to history list
            if detection.get("is_wildlife") or status == "ANIMAL_DETECTED":
                hist_url = f"{base_url}/forestMonitoring/{node_key}/history.json"
                hist_payload = {
                    "animal": str(animal),
                    "confidence": round(float(conf_pct), 2),
                    "status": status,
                    "audio_rms": round(float(rms), 6),
                    "timestamp": now_ms,
                    "timestamp_iso": now_iso,
                }
                t3 = _post_json(hist_url, hist_payload)
                success = any(await asyncio.gather(t1, t2, t3, return_exceptions=True))
            else:
                success = any(await asyncio.gather(t1, t2, return_exceptions=True))

            results[base_url] = success
        except Exception:
            results[base_url] = False

    return results


async def sync_heartbeat_to_firebase(
    node_code: str,
    device_status: str = "ONLINE",
    mic_status: str = "ACTIVE",
    audio_level: float = 0.0,
) -> Dict[str, bool]:
    """Sync heartbeat / device status to Firebase Realtime Database."""
    node_key = _format_node_key(node_code)
    now_ms = int(time.time() * 1000)
    now_iso = datetime.utcnow().isoformat()

    payload = {
        "device_status": device_status,
        "mic_status": mic_status,
        "sound_status": "LISTENING" if device_status == "ONLINE" else "OFFLINE",
        "audio_level_rms": round(float(audio_level), 6),
        "last_heartbeat": now_ms,
        "last_heartbeat_iso": now_iso,
    }

    results = {}
    for base_url in FIREBASE_URLS:
        try:
            status_url = f"{base_url}/forestMonitoring/{node_key}/status.json"
            success = await _put_json(status_url, payload)
            results[base_url] = success
        except Exception:
            results[base_url] = False

    return results
