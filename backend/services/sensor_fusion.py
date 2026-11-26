"""
Bhoomi Kavalu - Multi-Sensor AI Fusion Engine
Combines Camera AI, Audio AI, and Ground Vibration readings with configurable weights.
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from backend.config import settings
from backend.models import (
    CameraDetection,
    AudioDetection,
    VibrationReading,
    FusedDetection,
)

# Default configurable fusion weights
DEFAULT_WEIGHTS = {
    "camera": 0.50,
    "audio": 0.35,
    "vibration": 0.15,
}

# Normalize species naming across YOLO (e.g. ELEPHANT) and Audio model (Elephant)
SPECIES_NORMALIZE = {
    "elephant": "Asian Elephant",
    "asian elephant": "Asian Elephant",
    "tiger": "Tiger",
    "leopard": "Leopard",
    "wildboar": "WILD BOAR",
    "wild boar": "WILD BOAR",
    "pig": "WILD BOAR",
    "bear": "Bear",
    "gaur": "Gaur",
    "deer": "Deer",
    "monkey": "Monkey",
    "buffalo": "Buffalo",
    "wolf": "Wolf",
}


def normalize_species(raw: Optional[str]) -> str:
    if not raw:
        return "Unknown"
    key = raw.strip().lower()
    if key in {"wildboar", "wild boar", "pig"}:
        return "WILD BOAR"
    return SPECIES_NORMALIZE.get(key, raw.strip().title())


def is_critical_species(species: str) -> bool:
    key = species.strip().lower().replace("asian ", "").replace(" ", "").replace("_", "")
    crit = {s.lower().replace(" ", "").replace("_", "") for s in settings.CRITICAL_SPECIES}
    return key in crit or "boar" in key or "pig" in key


def calculate_fusion(
    camera_result: Optional[CameraDetection],
    audio_result: Optional[AudioDetection],
    vibration_result: Optional[VibrationReading],
    weights: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    """
    Fuse outputs from Camera AI, Audio AI, and Ground Vibration sensors.

    Rules:
    - Camera and Audio can identify animal species; Vibration alone CANNOT identify species.
    - If only one sensor is active, clearly label as `single_sensor`.
    - If Camera & Audio agree on the same species, boost confidence and label `multi_sensor`.
    - If Camera & Audio disagree on species, flag as `conflicting` and select the higher-confidence sensor.
    - Abnormal vibration corroborates presence and raises threat assessment when paired with Camera or Audio.
    """
    w = weights or DEFAULT_WEIGHTS

    cam_species = normalize_species(camera_result.species) if camera_result else None
    cam_conf = float(camera_result.confidence) if camera_result else None

    aud_species = normalize_species(audio_result.species) if audio_result else None
    aud_conf = float(audio_result.confidence) if audio_result else None

    vib_intensity = float(vibration_result.intensity) if vibration_result else None
    vib_status = vibration_result.threshold_status if vibration_result else None
    vib_active = vibration_result is not None and vib_status in {"elevated", "high", "critical"}

    # Vibration normalized corroboration factor (0.0 to 1.0) - NEVER treated as species probability
    vib_factor = 0.0
    if vibration_result is not None:
        vib_factor = min(1.0, max(0.0, vib_intensity / 10.0))

    active_id_sensors = sum([camera_result is not None, audio_result is not None])

    # Case 0: Insufficient data (no camera, no audio, and no abnormal vibration)
    if active_id_sensors == 0 and not vib_active:
        return {
            "final_species": "No Wildlife Detected",
            "camera_confidence": cam_conf,
            "audio_confidence": aud_conf,
            "vibration_intensity": vib_intensity,
            "overall_confidence": 0.0,
            "fusion_method": "insufficient_data",
            "threat_level": "normal",
        }

    # Case 1: Only vibration is elevated/high/critical (cannot identify species)
    if active_id_sensors == 0 and vib_active:
        threat = "warning" if vib_status == "elevated" else "high"
        return {
            "final_species": "Unidentified Ground Activity",
            "camera_confidence": None,
            "audio_confidence": None,
            "vibration_intensity": vib_intensity,
            "overall_confidence": round(min(0.65, vib_factor * 0.65), 3),
            "fusion_method": "single_sensor",
            "threat_level": threat,
        }

    # Case 2: Only one species-identifying sensor (Camera OR Audio)
    if active_id_sensors == 1:
        if camera_result is not None:
            base_species = cam_species
            base_conf = cam_conf or 0.0
        else:
            base_species = aud_species
            base_conf = aud_conf or 0.0

        # If vibration corroborates, boost slightly and mark multi_sensor
        if vib_active:
            boosted = min(0.99, base_conf * 0.85 + vib_factor * 0.15 + 0.05)
            method = "multi_sensor"
        else:
            boosted = base_conf
            method = "single_sensor"

        threat = _compute_threat_level(base_species, boosted, method, vib_status)
        return {
            "final_species": base_species,
            "camera_confidence": cam_conf,
            "audio_confidence": aud_conf,
            "vibration_intensity": vib_intensity,
            "overall_confidence": round(boosted, 3),
            "fusion_method": method,
            "threat_level": threat,
        }

    # Case 3: Both Camera AND Audio are present
    if cam_species == aud_species:
        # Agreement! Weighted combination + multi-sensor agreement bonus
        weighted = (
            (cam_conf or 0.0) * w["camera"] + (aud_conf or 0.0) * w["audio"]
        ) / (w["camera"] + w["audio"])
        if vib_active:
            weighted = weighted * (1.0 - w["vibration"]) + vib_factor * w["vibration"]
        overall = min(0.99, weighted + 0.08)
        threat = _compute_threat_level(cam_species, overall, "multi_sensor", vib_status)
        return {
            "final_species": cam_species,
            "camera_confidence": cam_conf,
            "audio_confidence": aud_conf,
            "vibration_intensity": vib_intensity,
            "overall_confidence": round(overall, 3),
            "fusion_method": "multi_sensor",
            "threat_level": threat,
        }
    else:
        # Conflict between Camera and Audio
        if (cam_conf or 0.0) >= (aud_conf or 0.0):
            chosen_species = cam_species
            chosen_conf = (cam_conf or 0.0) * 0.85
        else:
            chosen_species = aud_species
            chosen_conf = (aud_conf or 0.0) * 0.85

        threat = _compute_threat_level(chosen_species, chosen_conf, "conflicting", vib_status)
        return {
            "final_species": chosen_species,
            "camera_confidence": cam_conf,
            "audio_confidence": aud_conf,
            "vibration_intensity": vib_intensity,
            "overall_confidence": round(chosen_conf, 3),
            "fusion_method": "conflicting",
            "threat_level": threat,
        }


def _compute_threat_level(
    species: str, confidence: float, fusion_method: str, vib_status: Optional[str]
) -> str:
    critical = is_critical_species(species)
    if critical and (
        (fusion_method == "multi_sensor" and confidence >= 0.65) or confidence >= 0.80
    ):
        return "critical"
    if critical and confidence >= 0.55:
        return "high"
    if confidence >= 0.60 or vib_status in {"high", "critical"}:
        return "warning"
    return "normal"


def run_node_fusion(
    db: Session, node_db_id: int, time_window_seconds: int = 30
) -> FusedDetection:
    """Query recent readings for a node within time_window_seconds and persist FusedDetection."""
    cutoff = datetime.utcnow() - timedelta(seconds=time_window_seconds)

    cam = (
        db.query(CameraDetection)
        .filter(CameraDetection.node_id == node_db_id, CameraDetection.detected_at >= cutoff)
        .order_by(CameraDetection.detected_at.desc())
        .first()
    )
    aud = (
        db.query(AudioDetection)
        .filter(AudioDetection.node_id == node_db_id, AudioDetection.detected_at >= cutoff)
        .order_by(AudioDetection.detected_at.desc())
        .first()
    )
    vib = (
        db.query(VibrationReading)
        .filter(VibrationReading.node_id == node_db_id, VibrationReading.detected_at >= cutoff)
        .order_by(VibrationReading.detected_at.desc())
        .first()
    )

    result = calculate_fusion(cam, aud, vib)

    fused = FusedDetection(
        node_id=node_db_id,
        camera_detection_id=cam.id if cam else None,
        audio_detection_id=aud.id if aud else None,
        vibration_reading_id=vib.id if vib else None,
        final_species=result["final_species"],
        camera_confidence=result["camera_confidence"],
        audio_confidence=result["audio_confidence"],
        vibration_intensity=result["vibration_intensity"],
        overall_confidence=result["overall_confidence"],
        fusion_method=result["fusion_method"],
        threat_level=result["threat_level"],
    )
    db.add(fused)
    db.commit()
    db.refresh(fused)
    return fused
