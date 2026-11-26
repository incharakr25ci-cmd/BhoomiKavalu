"""
Bhoomi Kavalu - SMS Notification Router
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.database import get_db
from backend.models import Alert, Land, SMSNotification, User
from backend.schemas import SMSNotificationResponse, SMSSendRequest
from backend.services.sms_service import dispatch_sms_for_alert, retry_sms_notification

router = APIRouter(prefix="/api/sms", tags=["SMS Notifications"])


@router.post("/send", response_model=List[SMSNotificationResponse])
def send_sms(
    payload: SMSSendRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alert = db.query(Alert).filter(Alert.id == payload.alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    land = db.query(Land).filter(Land.id == alert.land_id).first()
    if current_user.role == "landowner" and land and land.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return dispatch_sms_for_alert(db, alert)


@router.get("/status/{alert_id}", response_model=List[SMSNotificationResponse])
def get_sms_status(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(SMSNotification).filter(SMSNotification.alert_id == alert_id)
    if current_user.role == "landowner":
        q = q.filter(SMSNotification.recipient_id == current_user.id)
    return q.all()


@router.get("/history", response_model=List[SMSNotificationResponse])
def get_sms_history(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(SMSNotification)
    if current_user.role == "landowner":
        q = q.filter(SMSNotification.recipient_id == current_user.id)
    elif current_user.role == "forest_officer" and current_user.region_id:
        q = (
            q.join(Alert, SMSNotification.alert_id == Alert.id)
            .join(Land, Alert.land_id == Land.id)
            .filter(Land.region_id == current_user.region_id)
        )
    return q.order_by(SMSNotification.created_at.desc()).limit(limit).all()


@router.post("/retry/{sms_id}", response_model=SMSNotificationResponse)
def retry_sms(
    sms_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sms = retry_sms_notification(db, sms_id)
    if not sms:
        raise HTTPException(status_code=404, detail="SMS notification not found")
    return sms
