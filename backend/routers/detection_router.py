"""
Bhoomi Kavalu - Wildlife Detection Router
Integrates YOLOv8 vision model and RandomForest Mel-spectrogram audio classifier,
plus ground vibration telemetry ingestion and role-filtered detection history.
"""

from datetime import datetime
import base64
import io
import json
import os
import tempfile
from typing import Optional
import cv2
import joblib
import librosa
import numpy as np
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, Request
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.config import settings
from backend.database import get_db
from backend.models import (
    Alert,
    AudioDetection,
    CameraDetection,
    Land,
    SensorNode,
    User,
    VibrationReading,
)
from backend.schemas import VibrationReadingCreate
from backend.services.sensor_fusion import is_critical_species, normalize_species, run_node_fusion
from backend.services.sms_service import dispatch_sms_for_alert
from backend.services.audio_classifier_2class import classify_audio_buffer
from backend.services.firebase_service import sync_detection_to_firebase, sync_heartbeat_to_firebase
from backend.websocket_manager import ws_manager

router = APIRouter(prefix="/api/detect", tags=["Detections"])

# Lazy-loaded ML models (loaded once on first inference)
_yolo_model = None
_wild_boar_model = None
_audio_model = None


def get_yolo_model():
    global _yolo_model
    if _yolo_model is None:
        from ultralytics import YOLO
        if not os.path.exists(settings.YOLO_MODEL_PATH):
            raise HTTPException(status_code=503, detail="YOLO model file not found")
        _yolo_model = YOLO(settings.YOLO_MODEL_PATH)
    return _yolo_model


def get_wild_boar_model():
    global _wild_boar_model
    if _wild_boar_model is None:
        from ultralytics import YOLO
        if not os.path.exists(settings.WILD_BOAR_MODEL_PATH):
            raise HTTPException(status_code=503, detail="Wild Boar model file not found")
        _wild_boar_model = YOLO(settings.WILD_BOAR_MODEL_PATH)
    return _wild_boar_model


def calculate_iou(box1, box2):
    """Calculate Intersection over Union of two bounding boxes [x1, y1, x2, y2]."""
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])

    intersection_width = max(0, x2 - x1)
    intersection_height = max(0, y2 - y1)
    intersection_area = intersection_width * intersection_height

    area1 = max(0, box1[2] - box1[0]) * max(0, box1[3] - box1[1])
    area2 = max(0, box2[2] - box2[0]) * max(0, box2[3] - box2[1])

    union_area = area1 + area2 - intersection_area
    if union_area == 0:
        return 0.0

    return intersection_area / union_area


def get_audio_model():
    global _audio_model
    if _audio_model is None:
        if not os.path.exists(settings.AUDIO_MODEL_PATH):
            raise HTTPException(status_code=503, detail="Audio classifier model file not found")
        _audio_model = joblib.load(settings.AUDIO_MODEL_PATH)
    return _audio_model


def _create_alert_if_needed(
    db: Session,
    node: SensorNode,
    species: str,
    confidence: float,
    threat_level: str,
    source: str,
    fused_id: Optional[int] = None,
) -> Optional[Alert]:
    if threat_level not in {"warning", "high", "critical"}:
        return None
    count = db.query(Alert).count() + 1
    alert_code = f"ALT-{datetime.utcnow().strftime('%Y%m%d')}-{count:03d}"
    alert = Alert(
        alert_id=alert_code,
        fused_detection_id=fused_id,
        node_id=node.id,
        land_id=node.land_id,
        species=species,
        confidence=confidence,
        threat_level=threat_level,
        detection_source=source,
        status="active",
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    if threat_level in {"high", "critical"}:
        dispatch_sms_for_alert(db, alert)

    return alert


@router.post("/camera-frame")
async def detect_camera_frame(
    file: UploadFile = File(...),
    node_code: str = Query(default="NODE_001"),
    db: Session = Depends(get_db),
):
    """Run dual-YOLO inference (multi-animal + specialized Wild Boar) on an uploaded camera frame."""
    contents = await file.read()
    img_array = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid image frame")

    # 1. Multi-animal YOLO model
    wildlife_model = get_yolo_model()
    wildlife_results = wildlife_model.predict(source=frame, conf=0.55, imgsz=640, verbose=False)[0]
    wildlife_detections = []

    for box in wildlife_results.boxes:
        cls_id = int(box.cls[0])
        raw_name = wildlife_model.names[cls_id].strip()
        if raw_name.lower() in {"0", "otherentities"}:
            continue

        if raw_name.lower() in {"wildboar", "wild boar", "pig"}:
            species = "WILD BOAR"
        else:
            species = normalize_species(raw_name)

        conf = round(float(box.conf[0]), 2)
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        critical = is_critical_species(species)
        alert_level = "CRITICAL" if critical else "MONITOR"

        wildlife_detections.append({
            "species": species,
            "confidence": conf,
            "alert_level": alert_level,
            "bbox": [x1, y1, x2, y2],
            "timestamp": datetime.utcnow().isoformat(),
            "source": "multi_animal_model",
        })

    # 2. Specialized Wild Boar YOLO model
    boar_detections = []
    try:
        boar_model = get_wild_boar_model()
        boar_results = boar_model.predict(source=frame, conf=0.50, imgsz=640, verbose=False)[0]
        for box in boar_results.boxes:
            cls_id = int(box.cls[0])
            raw_name = boar_model.names[cls_id].strip()
            conf = round(float(box.conf[0]), 2)
            x1, y1, x2, y2 = map(int, box.xyxy[0])

            # Class Pig represents Wild Boar
            species = "WILD BOAR" if raw_name.lower() == "pig" else raw_name.upper()

            boar_detections.append({
                "species": species,
                "confidence": conf,
                "alert_level": "CRITICAL",
                "bbox": [x1, y1, x2, y2],
                "timestamp": datetime.utcnow().isoformat(),
                "source": "wild_boar_specialized_model",
            })
    except Exception as e:
        # If specialized model is unavailable, proceed with multi-animal detections
        pass

    # 3. Deduplicate: prefer specialized Wild Boar model when detections overlap (IoU >= 0.5)
    final_detections = []
    for wd in wildlife_detections:
        norm = wd["species"].lower().replace(" ", "")
        if norm in {"wildboar", "pig"}:
            duplicate = False
            for bd in boar_detections:
                if calculate_iou(wd["bbox"], bd["bbox"]) >= 0.5:
                    duplicate = True
                    break
            if duplicate:
                continue
        final_detections.append(wd)
    final_detections.extend(boar_detections)

    node = db.query(SensorNode).filter(SensorNode.node_id == node_code).first()
    if node:
        node.last_heartbeat = datetime.utcnow()

    # Persist detections, run fusion & generate alerts
    for det_payload in final_detections:
        species = det_payload["species"]
        conf = det_payload["confidence"]
        alert_level = det_payload["alert_level"]
        bbox = det_payload["bbox"]
        critical = is_critical_species(species)

        if node:
            cam_det = CameraDetection(
                node_id=node.id,
                species=species,
                confidence=conf,
                alert_level=alert_level,
                bbox=json.dumps(bbox),
            )
            db.add(cam_det)
            db.commit()
            db.refresh(cam_det)

            fused = run_node_fusion(db, node.id)
            if critical and conf >= 0.60:
                _create_alert_if_needed(
                    db, node, fused.final_species, fused.overall_confidence, fused.threat_level, "camera", fused.id
                )

            await ws_manager.broadcast_to_node(
                node.node_id,
                {"type": "camera_detection", "node_id": node.node_id, "data": det_payload},
            )

    # Broadcast the raw JPEG frame (base64) to the dashboard so it can display the live phone video
    frame_b64 = base64.b64encode(contents).decode("ascii")
    if node:
        await ws_manager.broadcast_to_node(
            node.node_id,
            {
                "type": "camera_frame",
                "node_id": node.node_id if node else node_code,
                "frame": frame_b64,
                "frame_width": frame.shape[1],
                "frame_height": frame.shape[0],
                "detections": final_detections,
            },
        )

    return {
        "node_code": node_code,
        "node_id": node_code,
        "detections": final_detections,
        "frame_width": frame.shape[1],
        "frame_height": frame.shape[0],
    }


def _run_audio_inference(audio_bytes: bytes, filename: str) -> dict:
    """Classify audio using the 2-class wildlife classifier model (wildlife_audio_classifier_2class.pkl)."""
    try:
        res = classify_audio_buffer(audio_bytes, filename)
        # Ensure both species and animal fields exist for backwards compatibility
        species_val = res.get("animal", "None")
        if species_val == "None" or not res.get("is_wildlife", False):
            if res.get("status") == "IDLE":
                species_val = "Ambient / Quiet"
        res["species"] = species_val
        return res
    except Exception as e:
        return {
            "species": "Processing Error",
            "animal": "None",
            "confidence": 0.0,
            "confidence_pct": 0.0,
            "status": "ERROR",
            "probabilities": {},
            "is_wildlife": False,
            "error": str(e),
        }


@router.post("/audio")
async def detect_live_audio(
    file: UploadFile = File(...),
    node_code: str = Query(default="NODE_001"),
    db: Session = Depends(get_db),
):
    """Process live microphone audio chunk from gateway/browser, run 2-class inference, and sync to Firebase."""
    contents = await file.read()
    result = _run_audio_inference(contents, file.filename or "live.wav")

    node = db.query(SensorNode).filter(SensorNode.node_id == node_code).first()
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

            fused = run_node_fusion(db, node.id)
            if fused.threat_level in {"high", "critical"}:
                _create_alert_if_needed(
                    db, node, fused.final_species, fused.overall_confidence, fused.threat_level, "audio", fused.id
                )

        # Broadcast live audio result so dashboard updates in real-time
        await ws_manager.broadcast_to_node(
            node.node_id,
            {"type": "audio_detection", "node_id": node.node_id, "data": result},
        )

    # Sync detection and node status to Firebase Realtime Database asynchronously
    try:
        import asyncio
        asyncio.create_task(sync_detection_to_firebase(node_code, result))
    except Exception as e:
        print(f"[Firebase Sync Warning] {e}")

    return {**result, "node_id": node_code, "timestamp": datetime.utcnow().isoformat()}


@router.post("/esp32/audio")
async def esp32_audio_detection(
    request: Request,
    node_id: str = Query(default="NODE_001"),
    db: Session = Depends(get_db),
):
    """
    Dedicated endpoint for ESP32 + INMP441 audio transmission via HTTP POST.
    Accepts raw binary WAV payload (Content-Type: audio/wav or application/octet-stream)
    or standard multipart/form-data.
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

    result = _run_audio_inference(contents, "esp32_audio.wav")

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

            fused = run_node_fusion(db, node.id)
            if fused.threat_level in {"high", "critical"}:
                _create_alert_if_needed(
                    db, node, fused.final_species, fused.overall_confidence, fused.threat_level, "audio", fused.id
                )

        await ws_manager.broadcast_to_node(
            node.node_id,
            {"type": "audio_detection", "node_id": node.node_id, "data": result},
        )

    # Sync detection & hardware status to Firebase Realtime Database
    try:
        await sync_detection_to_firebase(node_id, result)
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


@router.post("/esp32/heartbeat")
async def esp32_heartbeat(
    node_id: str = Query(default="NODE_001"),
    device_status: str = Query(default="ONLINE"),
    mic_status: str = Query(default="ACTIVE"),
    db: Session = Depends(get_db),
):
    """Heartbeat endpoint for ESP32 hardware node."""
    node = db.query(SensorNode).filter(SensorNode.node_id == node_id).first()
    if node:
        node.last_heartbeat = datetime.utcnow()
        db.commit()

    try:
        await sync_heartbeat_to_firebase(node_id, device_status=device_status, mic_status=mic_status)
    except Exception:
        pass

    return {"status": "ok", "node_id": node_id, "timestamp": datetime.utcnow().isoformat()}


@router.post("/audio-upload")
async def detect_uploaded_audio(
    file: UploadFile = File(...),
    node_code: str = Query(default="NODE_001"),
    db: Session = Depends(get_db),
):
    """Testing endpoint for uploading a pre-recorded audio clip."""
    contents = await file.read()
    result = _run_audio_inference(contents, file.filename or "upload.wav")
    return {
        **result,
        "node_id": node_code,
        "mode": "test_upload",
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.post("/vibration")
async def ingest_vibration(
    payload: VibrationReadingCreate,
    db: Session = Depends(get_db),
):
    """Ingest ground vibration telemetry from an IoT seismic/geophone node."""
    node = db.query(SensorNode).filter(SensorNode.id == payload.node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Sensor node not found")

    if payload.intensity >= 8.0:
        status_label = "critical"
    elif payload.intensity >= 5.5:
        status_label = "high"
    elif payload.intensity >= 3.0:
        status_label = "elevated"
    else:
        status_label = "normal"

    reading = VibrationReading(
        node_id=node.id,
        intensity=payload.intensity,
        frequency=payload.frequency,
        threshold_status=status_label,
        raw_value=payload.raw_value,
    )
    node.last_heartbeat = datetime.utcnow()
    db.add(reading)
    db.commit()
    db.refresh(reading)

    if status_label in {"elevated", "high", "critical"}:
        fused = run_node_fusion(db, node.id)
        if status_label in {"high", "critical"}:
            _create_alert_if_needed(
                db, node, fused.final_species, fused.overall_confidence, fused.threat_level, "vibration", fused.id
            )

    await ws_manager.broadcast_to_node(
        node.node_id,
        {
            "type": "vibration_reading",
            "node_id": node.node_id,
            "data": {
                "id": reading.id,
                "intensity": reading.intensity,
                "frequency": reading.frequency,
                "threshold_status": reading.threshold_status,
                "timestamp": reading.detected_at.isoformat(),
            },
        },
    )

    return reading


@router.get("/latest")
def get_latest_detections(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return latest camera, audio, and vibration readings scoped by user role."""
    node_query = db.query(SensorNode).join(Land, SensorNode.land_id == Land.id)
    if current_user.role == "landowner":
        node_query = node_query.filter(Land.owner_id == current_user.id)
    elif current_user.role == "forest_officer" and current_user.region_id:
        node_query = node_query.filter(Land.region_id == current_user.region_id)

    node_ids = [n.id for n in node_query.all()]
    if not node_ids:
        return {"camera": None, "audio": None, "vibration": None}

    latest_cam = (
        db.query(CameraDetection)
        .filter(CameraDetection.node_id.in_(node_ids))
        .order_by(CameraDetection.detected_at.desc())
        .first()
    )
    latest_aud = (
        db.query(AudioDetection)
        .filter(AudioDetection.node_id.in_(node_ids))
        .order_by(AudioDetection.detected_at.desc())
        .first()
    )
    latest_vib = (
        db.query(VibrationReading)
        .filter(VibrationReading.node_id.in_(node_ids))
        .order_by(VibrationReading.detected_at.desc())
        .first()
    )
    return {"camera": latest_cam, "audio": latest_aud, "vibration": latest_vib}


@router.get("/history")
def get_detection_history(
    sensor_type: Optional[str] = None,
    species: Optional[str] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return combined detection history scoped to the user's lands/region."""
    node_query = db.query(SensorNode).join(Land, SensorNode.land_id == Land.id)
    if current_user.role == "landowner":
        node_query = node_query.filter(Land.owner_id == current_user.id)
    elif current_user.role == "forest_officer" and current_user.region_id:
        node_query = node_query.filter(Land.region_id == current_user.region_id)

    nodes = {n.id: n.node_id for n in node_query.all()}
    if not nodes:
        return []

    records = []

    if sensor_type in (None, "all", "camera"):
        cam_q = db.query(CameraDetection).filter(CameraDetection.node_id.in_(nodes.keys()))
        if species:
            cam_q = cam_q.filter(CameraDetection.species.ilike(f"%{species}%"))
        for c in cam_q.order_by(CameraDetection.detected_at.desc()).limit(limit).all():
            records.append({
                "id": f"cam-{c.id}",
                "source": "camera",
                "node_id": nodes.get(c.node_id, ""),
                "species": c.species,
                "confidence": c.confidence,
                "alert_level": c.alert_level,
                "timestamp": c.detected_at.isoformat(),
            })

    if sensor_type in (None, "all", "audio"):
        aud_q = db.query(AudioDetection).filter(AudioDetection.node_id.in_(nodes.keys()))
        if species:
            aud_q = aud_q.filter(AudioDetection.species.ilike(f"%{species}%"))
        for a in aud_q.order_by(AudioDetection.detected_at.desc()).limit(limit).all():
            records.append({
                "id": f"aud-{a.id}",
                "source": "audio",
                "node_id": nodes.get(a.node_id, ""),
                "species": a.species,
                "confidence": a.confidence,
                "alert_level": "CRITICAL" if is_critical_species(a.species) else "MONITOR",
                "timestamp": a.detected_at.isoformat(),
            })

    if sensor_type in (None, "all", "vibration") and not species:
        vib_q = db.query(VibrationReading).filter(VibrationReading.node_id.in_(nodes.keys()))
        for v in vib_q.order_by(VibrationReading.detected_at.desc()).limit(limit).all():
            records.append({
                "id": f"vib-{v.id}",
                "source": "vibration",
                "node_id": nodes.get(v.node_id, ""),
                "species": f"Ground Activity ({v.threshold_status})",
                "confidence": min(1.0, v.intensity / 10.0),
                "alert_level": v.threshold_status.upper(),
                "timestamp": v.detected_at.isoformat(),
            })

    records.sort(key=lambda r: r["timestamp"], reverse=True)
    return records[:limit]
