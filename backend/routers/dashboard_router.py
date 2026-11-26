"""
Bhoomi Kavalu - Dashboard Analytics & Officer Regional Endpoints
"""

from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.auth import get_current_user, require_role
from backend.config import settings
from backend.database import get_db
from backend.models import (
    Alert,
    AudioDetection,
    CameraDetection,
    FusedDetection,
    Land,
    Region,
    SensorNode,
    User,
    VibrationReading,
)

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/landowner")
def get_landowner_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lands = db.query(Land).filter(Land.owner_id == current_user.id).all()
    land_ids = [l.id for l in lands]
    nodes = db.query(SensorNode).filter(SensorNode.land_id.in_(land_ids)).all() if land_ids else []
    node_ids = [n.id for n in nodes]

    active_nodes = [n for n in nodes if n.status == "active"]

    cam_count = db.query(CameraDetection).filter(CameraDetection.node_id.in_(node_ids)).count() if node_ids else 0
    aud_count = db.query(AudioDetection).filter(AudioDetection.node_id.in_(node_ids)).count() if node_ids else 0
    total_detections = cam_count + aud_count

    latest_fused = (
        db.query(FusedDetection)
        .filter(FusedDetection.node_id.in_(node_ids))
        .order_by(FusedDetection.detected_at.desc())
        .first()
        if node_ids
        else None
    )

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    alerts_today = (
        db.query(Alert)
        .filter(Alert.land_id.in_(land_ids), Alert.created_at >= today_start)
        .count()
        if land_ids
        else 0
    )

    weekly = []
    for i in range(6, -1, -1):
        day = (datetime.utcnow() - timedelta(days=i)).date()
        day_start = datetime.combine(day, datetime.min.time())
        day_end = day_start + timedelta(days=1)
        c_cnt = (
            db.query(CameraDetection)
            .filter(
                CameraDetection.node_id.in_(node_ids),
                CameraDetection.detected_at >= day_start,
                CameraDetection.detected_at < day_end,
            )
            .count()
            if node_ids
            else 0
        )
        a_cnt = (
            db.query(AudioDetection)
            .filter(
                AudioDetection.node_id.in_(node_ids),
                AudioDetection.detected_at >= day_start,
                AudioDetection.detected_at < day_end,
            )
            .count()
            if node_ids
            else 0
        )
        weekly.append({"date": day.strftime("%b %d"), "count": c_cnt + a_cnt})

    primary_land = lands[0] if lands else None
    primary_node = nodes[0] if nodes else None

    return {
        "demo_mode": settings.DEMO_MODE,
        "land_name": primary_land.name if primary_land else "No Land Registered",
        "land_location": primary_land.location if primary_land else "—",
        "node_id": primary_node.node_id if primary_node else "—",
        "active_sensors": len(active_nodes),
        "total_sensors": len(nodes),
        "monitoring_status": "active" if active_nodes else "inactive",
        "latest_animal": latest_fused.final_species if latest_fused else "None",
        "latest_detection_time": latest_fused.detected_at.isoformat() if latest_fused else None,
        "threat_level": latest_fused.threat_level if latest_fused else "normal",
        "total_detections": total_detections,
        "confidence_score": latest_fused.overall_confidence if latest_fused else 0.0,
        "detections_today": weekly[-1]["count"] if weekly else 0,
        "alerts_today": alerts_today,
        "weekly_detections": weekly,
    }


@router.get("/officer")
def get_officer_dashboard(
    current_user: User = Depends(require_role("forest_officer")),
    db: Session = Depends(get_db),
):
    region = db.query(Region).filter(Region.id == current_user.region_id).first()
    land_q = db.query(Land)
    if current_user.region_id:
        land_q = land_q.filter(Land.region_id == current_user.region_id)
    lands = land_q.all()
    land_ids = [l.id for l in lands]

    landowners = (
        db.query(User)
        .filter(User.role == "landowner", User.region_id == current_user.region_id)
        .all()
        if current_user.region_id
        else db.query(User).filter(User.role == "landowner").all()
    )

    nodes = db.query(SensorNode).filter(SensorNode.land_id.in_(land_ids)).all() if land_ids else []
    node_ids = [n.id for n in nodes]

    active_cameras = sum(1 for n in nodes if n.status == "active" and n.node_type in {"camera", "multi"})
    active_audio = sum(1 for n in nodes if n.status == "active" and n.node_type in {"audio", "multi"})
    active_vibration = sum(1 for n in nodes if n.status == "active" and n.node_type in {"vibration", "multi"})

    cam_total = db.query(CameraDetection).filter(CameraDetection.node_id.in_(node_ids)).count() if node_ids else 0
    aud_total = db.query(AudioDetection).filter(AudioDetection.node_id.in_(node_ids)).count() if node_ids else 0

    critical_alerts = (
        db.query(Alert)
        .filter(Alert.land_id.in_(land_ids), Alert.threat_level == "critical", Alert.status != "resolved")
        .count()
        if land_ids
        else 0
    )

    weekly = []
    for i in range(6, -1, -1):
        day = (datetime.utcnow() - timedelta(days=i)).date()
        day_start = datetime.combine(day, datetime.min.time())
        day_end = day_start + timedelta(days=1)
        c_cnt = (
            db.query(CameraDetection)
            .filter(
                CameraDetection.node_id.in_(node_ids),
                CameraDetection.detected_at >= day_start,
                CameraDetection.detected_at < day_end,
            )
            .count()
            if node_ids
            else 0
        )
        a_cnt = (
            db.query(AudioDetection)
            .filter(
                AudioDetection.node_id.in_(node_ids),
                AudioDetection.detected_at >= day_start,
                AudioDetection.detected_at < day_end,
            )
            .count()
            if node_ids
            else 0
        )
        weekly.append({"date": day.strftime("%b %d"), "count": c_cnt + a_cnt})

    return {
        "demo_mode": settings.DEMO_MODE,
        "region_name": region.name if region else "All Regions",
        "total_lands": len(lands),
        "total_landowners": len(landowners),
        "total_nodes": len(nodes),
        "active_cameras": active_cameras,
        "active_audio": active_audio,
        "active_vibration": active_vibration,
        "total_detections": cam_total + aud_total,
        "critical_alerts": critical_alerts,
        "weekly_detections": weekly,
    }


@router.get("/landowners")
def list_region_landowners(
    current_user: User = Depends(require_role("forest_officer")),
    db: Session = Depends(get_db),
):
    q = db.query(User).filter(User.role == "landowner")
    if current_user.region_id:
        q = q.filter(User.region_id == current_user.region_id)
    owners = q.all()
    result = []
    for o in owners:
        lands = db.query(Land).filter(Land.owner_id == o.id).all()
        land_ids = [l.id for l in lands]
        nodes = db.query(SensorNode).filter(SensorNode.land_id.in_(land_ids)).all() if land_ids else []
        result.append({
            "id": o.id,
            "full_name": o.full_name,
            "email": o.email,
            "phone": o.phone,
            "created_at": o.created_at.isoformat(),
            "lands": [{"id": l.id, "name": l.name, "location": l.location, "area_acres": l.area_acres} for l in lands],
            "node_ids": [n.node_id for n in nodes],
        })
    return result
