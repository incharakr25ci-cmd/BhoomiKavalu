"""
Bhoomi Kavalu - Dedicated ESP32 Hardware Router
Provides clean, fast HTTP endpoints for ESP32 + INMP441 audio transmission
and device heartbeats. Completely replaces the legacy UDP architecture.
"""

from datetime import datetime
import json
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import AudioDetection, SensorNode
from backend.services.audio_classifier_2class import classify_audio_buffer
from backend.services.firebase_service import sync_detection_to_firebase, sync_heartbeat_to_firebase
from backend.services.sensor_fusion import run_node_fusion
from backend.websocket_manager import ws_manager

router = APIRouter(prefix="/api/esp32", tags=["ESP32 Hardware"])


@router.get("/status")
def esp32_api_status():
    """Health check endpoint for ESP32 Wi-Fi validation."""
    return {
        "status": "online",
        "service": "Bhoomi Kavalu ESP32 HTTP Audio Receiver",
        "audio_format": "22050Hz 16-bit Mono PCM WAV",
        "classes": ["Elephant", "Tiger"],
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.post("/heartbeat")
async def esp32_heartbeat(
    node_id: str = Query(default="NODE_001"),
    device_status: str = Query(default="ONLINE"),
    mic_status: str = Query(default="ACTIVE"),
    db: Session = Depends(get_db),
):
    """ESP32 periodic heartbeat ping."""
    node = db.query(SensorNode).filter(SensorNode.node_id == node_id).first()
    if node:
        node.last_heartbeat = datetime.utcnow()
        db.commit()

    try:
        await sync_heartbeat_to_firebase(node_id, device_status=device_status, mic_status=mic_status)
    except Exception:
        pass

    return {
        "status": "ok",
        "node_id": node_id,
        "device_status": device_status,
        "mic_status": mic_status,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.post("/audio")
async def esp32_audio(
    request: Request,
    node_id: str = Query(default="NODE_001"),
    db: Session = Depends(get_db),
):
    """
    Receive audio buffer from ESP32 via HTTP POST.
    Supports raw WAV body (Content-Type: audio/wav or application/octet-stream)
    or multipart form-data.
    Runs 2-class classifier, updates Firebase Realtime DB, and notifies dashboard via WebSocket.
    """
    content_type = request.headers.get("content-type", "")
    if "multipart/form-data" in content_type:
        form = await request.form()
        uploaded = form.get("file")
        if hasattr(uploaded, "read"):
            contents = await uploaded.read()
        else:
            contents = await request.body()
    else:
        contents = await request.body()

    if not contents or len(contents) == 0:
        raise HTTPException(status_code=400, detail="Empty audio payload received from ESP32")

    # Run 2-class inference
    try:
        result = classify_audio_buffer(contents, "esp32_audio.wav")
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "node_id": node_id,
        }

    # Ensure species is populated
    species_val = result.get("animal", "None")
    if species_val == "None" or not result.get("is_wildlife", False):
        if result.get("status") == "IDLE":
            species_val = "Ambient / Quiet"
    result["species"] = species_val

    # Update node in database & run sensor fusion
    node = db.query(SensorNode).filter(SensorNode.node_id == node_id).first()
    if node:
        node.last_heartbeat = datetime.utcnow()
        if result.get("is_wildlife"):
            aud_det = AudioDetection(
                node_id=node.id,
                species=result["species"],
                confidence=result["confidence"],
                probabilities=json.dumps(result.get("probabilities", {})),
            )
            db.add(aud_det)
            db.commit()
            db.refresh(aud_det)

            run_node_fusion(db, node.id)

        # Notify dashboard WebSocket
        await ws_manager.broadcast_to_node(
            node.node_id,
            {"type": "audio_detection", "node_id": node.node_id, "data": result},
        )

    # Sync to Firebase Realtime Database asynchronously in the background
    try:
        import asyncio
        asyncio.create_task(sync_detection_to_firebase(node_id, result))
    except Exception as e:
        print(f"[Firebase Sync Warning] {e}")

    return {
        "status": "success",
        "node_id": node_id,
        "animal": result.get("animal", "None"),
        "confidence": result.get("confidence", 0.0),
        "confidence_pct": result.get("confidence_pct", 0.0),
        "sound_status": result.get("status", "IDLE"),
        "rms": result.get("rms", 0.0),
        "timestamp": datetime.utcnow().isoformat(),
    }
