"""
Bhoomi Kavalu - Alert Management Router
Role-scoped alerts with filtering, acknowledgement, resolution, and statistics.
"""

from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.database import get_db
from backend.models import Alert, Land, SensorNode, SMSNotification, User
from backend.schemas import AlertDetailResponse

router = APIRouter(prefix="/api/alerts", tags=["Alerts"])


def _scoped_alert_query(db: Session, user: User):
    q = db.query(Alert).join(Land, Alert.land_id == Land.id)
    if user.role == "landowner":
        q = q.filter(Land.owner_id == user.id)
    elif user.role == "forest_officer" and user.region_id:
        q = q.filter(Land.region_id == user.region_id)
    return q


def _serialize_alert(alert: Alert, db: Session) -> dict:
    land = db.query(Land).filter(Land.id == alert.land_id).first()
    node = db.query(SensorNode).filter(SensorNode.id == alert.node_id).first()
    owner = db.query(User).filter(User.id == land.owner_id).first() if land else None
    sms = (
        db.query(SMSNotification)
        .filter(SMSNotification.alert_id == alert.id)
        .order_by(SMSNotification.created_at.desc())
        .first()
    )
    return {
        "id": alert.id,
        "alert_id": alert.alert_id,
        "fused_detection_id": alert.fused_detection_id,
        "node_id": alert.node_id,
        "node_code": node.node_id if node else "",
        "land_id": alert.land_id,
        "land_name": land.name if land else "",
        "location": land.location if land else "",
        "owner_name": owner.full_name if owner else "",
        "owner_phone": owner.phone if owner else "",
        "species": alert.species,
        "confidence": alert.confidence,
        "threat_level": alert.threat_level,
        "detection_source": alert.detection_source,
        "status": alert.status,
        "sms_status": sms.status if sms else "not_sent",
        "sms_recipient": sms.phone_number if sms else None,
        "acknowledged_by": alert.acknowledged_by,
        "acknowledged_at": alert.acknowledged_at.isoformat() if alert.acknowledged_at else None,
        "resolved_at": alert.resolved_at.isoformat() if alert.resolved_at else None,
        "created_at": alert.created_at.isoformat(),
    }


@router.get("")
def list_alerts(
    species: Optional[str] = None,
    threat_level: Optional[str] = None,
    status: Optional[str] = None,
    node_code: Optional[str] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = _scoped_alert_query(db, current_user)
    if species:
        q = q.filter(Alert.species.ilike(f"%{species}%"))
    if threat_level:
        q = q.filter(Alert.threat_level == threat_level)
    if status:
        q = q.filter(Alert.status == status)
    if node_code:
        q = q.join(SensorNode, Alert.node_id == SensorNode.id).filter(SensorNode.node_id == node_code)

    alerts = q.order_by(Alert.created_at.desc()).limit(limit).all()
    return [_serialize_alert(a, db) for a in alerts]


@router.get("/stats")
def get_alert_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = _scoped_alert_query(db, current_user)
    all_alerts = q.all()
    return {
        "total": len(all_alerts),
        "active": sum(1 for a in all_alerts if a.status == "active"),
        "acknowledged": sum(1 for a in all_alerts if a.status == "acknowledged"),
        "resolved": sum(1 for a in all_alerts if a.status == "resolved"),
        "critical": sum(1 for a in all_alerts if a.threat_level == "critical"),
        "high": sum(1 for a in all_alerts if a.threat_level == "high"),
        "warning": sum(1 for a in all_alerts if a.threat_level == "warning"),
    }


@router.get("/{alert_id}")
def get_alert_detail(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alert = _scoped_alert_query(db, current_user).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return _serialize_alert(alert, db)


@router.put("/{alert_id}/acknowledge")
def acknowledge_alert(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alert = _scoped_alert_query(db, current_user).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.status = "acknowledged"
    alert.acknowledged_by = current_user.id
    alert.acknowledged_at = datetime.utcnow()
    db.commit()
    db.refresh(alert)
    return _serialize_alert(alert, db)


@router.put("/{alert_id}/resolve")
def resolve_alert(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alert = _scoped_alert_query(db, current_user).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.status = "resolved"
    alert.resolved_at = datetime.utcnow()
    if not alert.acknowledged_by:
        alert.acknowledged_by = current_user.id
        alert.acknowledged_at = datetime.utcnow()
    db.commit()
    db.refresh(alert)
    return _serialize_alert(alert, db)
