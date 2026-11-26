"""
Bhoomi Kavalu - Cellular GSM SMS Notification Service
Supports SIM800L / SIM7600 GSM hardware via serial AT commands (no Wi-Fi required).
Includes offline queuing, duplicate suppression, and retry support.
"""

from datetime import datetime, timedelta
from typing import Optional
import logging
from sqlalchemy.orm import Session

from backend.config import settings
from backend.models import Alert, Land, User, SMSNotification, SensorNode

logger = logging.getLogger("bhoomi_kavalu.sms")

SMS_TEMPLATE = """BHOOMI KAVALU ALERT

Wildlife detected: {species}
Land: {land_name}
Node ID: {node_id}
Threat Level: {threat_level}
Location: {location}
Time: {timestamp}

Please take necessary precautions."""


def format_alert_sms(
    species: str,
    land_name: str,
    node_code: str,
    threat_level: str,
    location: str,
    timestamp: datetime,
) -> str:
    return SMS_TEMPLATE.format(
        species=species,
        land_name=land_name,
        node_id=node_code,
        threat_level=threat_level.upper(),
        location=location,
        timestamp=timestamp.strftime("%Y-%m-%d %H:%M:%S"),
    )


def _send_via_gsm_serial(phone_number: str, message: str) -> bool:
    """Send SMS via SIM800L/SIM7600 GSM modem connected to serial port."""
    try:
        import serial  # type: ignore
        import time

        with serial.Serial(settings.GSM_PORT, settings.GSM_BAUD_RATE, timeout=5) as ser:
            ser.write(b"AT\r")
            time.sleep(0.5)
            ser.write(b"AT+CMGF=1\r")  # Text mode
            time.sleep(0.5)
            ser.write(f'AT+CMGS="{phone_number}"\r'.encode())
            time.sleep(0.5)
            ser.write(message.encode() + b"\x1A")
            time.sleep(2.0)
            resp = ser.read_all().decode(errors="ignore")
            return "OK" in resp or "+CMGS" in resp
    except Exception as exc:
        logger.warning(f"GSM serial send failed ({settings.GSM_PORT}): {exc}")
        return False


def dispatch_sms_for_alert(db: Session, alert: Alert) -> list[SMSNotification]:
    """
    Send (or queue) SMS alerts to:
      1. The landowner who owns the affected land.
      2. The forest officer(s) assigned to that land's region.
    Prevents duplicate SMS for the same alert+recipient.
    """
    land = db.query(Land).filter(Land.id == alert.land_id).first()
    node = db.query(SensorNode).filter(SensorNode.id == alert.node_id).first()
    if not land or not node:
        return []

    owner = db.query(User).filter(User.id == land.owner_id, User.is_active == True).first()
    officers = (
        db.query(User)
        .filter(
            User.role == "forest_officer",
            User.region_id == land.region_id,
            User.is_active == True,
        )
        .all()
    )

    recipients: list[User] = []
    if owner:
        recipients.append(owner)
    for officer in officers:
        if officer.id not in {r.id for r in recipients}:
            recipients.append(officer)

    message_text = format_alert_sms(
        species=alert.species,
        land_name=land.name,
        node_code=node.node_id,
        threat_level=alert.threat_level,
        location=land.location,
        timestamp=alert.created_at,
    )

    created_records: list[SMSNotification] = []

    for recipient in recipients:
        # Duplicate suppression: check if SMS already exists for this alert & recipient
        existing = (
            db.query(SMSNotification)
            .filter(
                SMSNotification.alert_id == alert.id,
                SMSNotification.recipient_id == recipient.id,
            )
            .first()
        )
        if existing:
            continue

        # Also suppress recent identical species+node SMS within 5 minutes
        recent_cutoff = datetime.utcnow() - timedelta(minutes=5)
        recent_same = (
            db.query(SMSNotification)
            .join(Alert, SMSNotification.alert_id == Alert.id)
            .filter(
                SMSNotification.recipient_id == recipient.id,
                Alert.node_id == alert.node_id,
                Alert.species == alert.species,
                SMSNotification.created_at >= recent_cutoff,
                SMSNotification.status.in_(["sent", "delivered"]),
            )
            .first()
        )
        if recent_same:
            continue

        if settings.DEMO_MODE:
            logger.info(
                f"[DEMO SMS] To {recipient.phone} ({recipient.role}):\n{message_text}"
            )
            status = "delivered"
            sent_at: Optional[datetime] = datetime.utcnow()
        else:
            ok = _send_via_gsm_serial(recipient.phone, message_text)
            status = "sent" if ok else "queued"
            sent_at = datetime.utcnow() if ok else None

        sms_record = SMSNotification(
            alert_id=alert.id,
            recipient_id=recipient.id,
            phone_number=recipient.phone,
            message=message_text,
            status=status,
            retry_count=0,
            sent_at=sent_at,
        )
        db.add(sms_record)
        created_records.append(sms_record)

    db.commit()
    for r in created_records:
        db.refresh(r)
    return created_records


def retry_sms_notification(db: Session, sms_id: int) -> Optional[SMSNotification]:
    """Retry sending a queued or failed SMS notification."""
    sms = db.query(SMSNotification).filter(SMSNotification.id == sms_id).first()
    if not sms:
        return None

    sms.retry_count += 1
    if settings.DEMO_MODE:
        sms.status = "delivered"
        sms.sent_at = datetime.utcnow()
    else:
        ok = _send_via_gsm_serial(sms.phone_number, sms.message)
        sms.status = "sent" if ok else "failed"
        if ok:
            sms.sent_at = datetime.utcnow()

    db.commit()
    db.refresh(sms)
    return sms
