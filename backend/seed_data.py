"""
Bhoomi Kavalu - Demo Seed Data
Populates initial realistic wildlife monitoring data when the database is empty.
"""

from datetime import datetime, timedelta
import json
from sqlalchemy.orm import Session

from backend.auth import hash_password
from backend.models import (
    Region,
    User,
    Land,
    SensorNode,
    CameraDetection,
    AudioDetection,
    VibrationReading,
    FusedDetection,
    Alert,
    SMSNotification,
)


def seed_database(db: Session) -> None:
    """Seed initial demo data if no users exist yet."""
    if db.query(User).count() > 0:
        return

    now = datetime.utcnow()

    # 1. Regions
    region1 = Region(
        name="Nagarhole-Bandipur Corridor",
        description="Southern Karnataka wildlife corridor spanning Nagarhole & Bandipur Tiger Reserves.",
    )
    region2 = Region(
        name="BRT Hills",
        description="Biligirirangana Hills Wildlife Sanctuary buffer zone.",
    )
    db.add_all([region1, region2])
    db.flush()

    # 2. Users
    officer = User(
        email="officer@bhoomi.in",
        phone="+919845011223",
        full_name="Rajeshwar Rao (RFO)",
        hashed_password=hash_password("password123"),
        role="forest_officer",
        region_id=region1.id,
        is_active=True,
    )
    farmer1 = User(
        email="farmer1@bhoomi.in",
        phone="+919900112233",
        full_name="Siddappa Gowda",
        hashed_password=hash_password("password123"),
        role="landowner",
        region_id=region1.id,
        is_active=True,
    )
    farmer2 = User(
        email="farmer2@bhoomi.in",
        phone="+919900445566",
        full_name="Lakshmi Devi",
        hashed_password=hash_password("password123"),
        role="landowner",
        region_id=region1.id,
        is_active=True,
    )
    db.add_all([officer, farmer1, farmer2])
    db.flush()

    # 3. Lands
    land1 = Land(
        name="Kaveri Coffee & Banana Estate",
        location="Veeranahosahalli Border, Hunsur, Karnataka",
        latitude=12.0124,
        longitude=76.2712,
        area_acres=14.5,
        owner_id=farmer1.id,
        region_id=region1.id,
    )
    land2 = Land(
        name="Kabini Edge Sugarcane Farm",
        location="DB Kuppe, HD Kote, Karnataka",
        latitude=11.9642,
        longitude=76.2248,
        area_acres=9.2,
        owner_id=farmer2.id,
        region_id=region1.id,
    )
    db.add_all([land1, land2])
    db.flush()

    # 4. Sensor Nodes
    node1 = SensorNode(
        node_id="NODE_001",
        land_id=land1.id,
        node_type="multi",
        status="active",
        latitude=12.0129,
        longitude=76.2718,
        last_heartbeat=now - timedelta(minutes=2),
    )
    node2 = SensorNode(
        node_id="NODE_002",
        land_id=land1.id,
        node_type="camera",
        status="active",
        latitude=12.0118,
        longitude=76.2704,
        last_heartbeat=now - timedelta(minutes=5),
    )
    node3 = SensorNode(
        node_id="NODE_003",
        land_id=land2.id,
        node_type="multi",
        status="active",
        latitude=11.9645,
        longitude=76.2252,
        last_heartbeat=now - timedelta(minutes=1),
    )
    node4 = SensorNode(
        node_id="NODE_004",
        land_id=land2.id,
        node_type="vibration",
        status="maintenance",
        latitude=11.9638,
        longitude=76.2241,
        last_heartbeat=now - timedelta(hours=3),
    )
    db.add_all([node1, node2, node3, node4])
    db.flush()

    # 5. Camera Detections
    cam_samples = [
        (node1.id, "Asian Elephant", 0.91, "CRITICAL", [120, 80, 410, 390], now - timedelta(hours=1, minutes=20)),
        (node1.id, "WILD BOAR", 0.78, "CRITICAL", [200, 180, 380, 340], now - timedelta(hours=6)),
        (node2.id, "Leopard", 0.86, "CRITICAL", [95, 110, 320, 300], now - timedelta(days=1, hours=2)),
        (node3.id, "Tiger", 0.94, "CRITICAL", [150, 90, 460, 410], now - timedelta(minutes=45)),
        (node3.id, "Deer", 0.82, "MONITOR", [210, 140, 340, 310], now - timedelta(days=2)),
    ]
    cam_objs = []
    for nid, sp, conf, lvl, bbox, dt in cam_samples:
        c = CameraDetection(
            node_id=nid,
            species=sp,
            confidence=conf,
            alert_level=lvl,
            bbox=json.dumps(bbox),
            detected_at=dt,
        )
        cam_objs.append(c)
    db.add_all(cam_objs)
    db.flush()

    # 6. Audio Detections
    aud_samples = [
        (node1.id, "Elephant", 0.88, {"Elephant": 0.88, "Tiger": 0.07, "Leopard": 0.05}, now - timedelta(hours=1, minutes=20)),
        (node1.id, "Leopard", 0.74, {"Elephant": 0.11, "Tiger": 0.15, "Leopard": 0.74}, now - timedelta(days=1, hours=2)),
        (node3.id, "Tiger", 0.89, {"Elephant": 0.05, "Tiger": 0.89, "Leopard": 0.06}, now - timedelta(minutes=45)),
        (node3.id, "Elephant", 0.79, {"Elephant": 0.79, "Tiger": 0.12, "Leopard": 0.09}, now - timedelta(days=3)),
    ]
    aud_objs = []
    for nid, sp, conf, probs, dt in aud_samples:
        a = AudioDetection(
            node_id=nid,
            species=sp,
            confidence=conf,
            probabilities=json.dumps(probs),
            detected_at=dt,
        )
        aud_objs.append(a)
    db.add_all(aud_objs)
    db.flush()

    # 7. Vibration Readings
    vib_samples = [
        (node1.id, 7.8, 18.4, "high", 780.0, now - timedelta(hours=1, minutes=20)),
        (node1.id, 1.4, 8.2, "normal", 140.0, now - timedelta(hours=3)),
        (node1.id, 4.9, 14.1, "elevated", 490.0, now - timedelta(hours=6)),
        (node3.id, 6.2, 16.5, "high", 620.0, now - timedelta(minutes=45)),
        (node3.id, 0.9, 6.1, "normal", 90.0, now - timedelta(hours=2)),
    ]
    vib_objs = []
    for nid, inten, freq, st, raw, dt in vib_samples:
        v = VibrationReading(
            node_id=nid,
            intensity=inten,
            frequency=freq,
            threshold_status=st,
            raw_value=raw,
            detected_at=dt,
        )
        vib_objs.append(v)
    db.add_all(vib_objs)
    db.flush()

    # 8. Fused Detections
    fused1 = FusedDetection(
        node_id=node1.id,
        camera_detection_id=cam_objs[0].id,
        audio_detection_id=aud_objs[0].id,
        vibration_reading_id=vib_objs[0].id,
        final_species="Asian Elephant",
        camera_confidence=0.91,
        audio_confidence=0.88,
        vibration_intensity=7.8,
        overall_confidence=0.93,
        fusion_method="multi_sensor",
        threat_level="critical",
        detected_at=now - timedelta(hours=1, minutes=20),
    )
    fused2 = FusedDetection(
        node_id=node1.id,
        camera_detection_id=cam_objs[1].id,
        vibration_reading_id=vib_objs[2].id,
        final_species="WILD BOAR",
        camera_confidence=0.78,
        vibration_intensity=4.9,
        overall_confidence=0.79,
        fusion_method="multi_sensor",
        threat_level="high",
        detected_at=now - timedelta(hours=6),
    )
    fused3 = FusedDetection(
        node_id=node3.id,
        camera_detection_id=cam_objs[3].id,
        audio_detection_id=aud_objs[2].id,
        vibration_reading_id=vib_objs[3].id,
        final_species="Tiger",
        camera_confidence=0.94,
        audio_confidence=0.89,
        vibration_intensity=6.2,
        overall_confidence=0.95,
        fusion_method="multi_sensor",
        threat_level="critical",
        detected_at=now - timedelta(minutes=45),
    )
    db.add_all([fused1, fused2, fused3])
    db.flush()

    # 9. Alerts
    alert1 = Alert(
        alert_id="ALT-20261125-001",
        fused_detection_id=fused1.id,
        node_id=node1.id,
        land_id=land1.id,
        species="Asian Elephant",
        confidence=0.93,
        threat_level="critical",
        detection_source="multi_sensor",
        status="active",
        created_at=now - timedelta(hours=1, minutes=20),
    )
    alert2 = Alert(
        alert_id="ALT-20261125-002",
        fused_detection_id=fused2.id,
        node_id=node1.id,
        land_id=land1.id,
        species="WILD BOAR",
        confidence=0.79,
        threat_level="high",
        detection_source="multi_sensor",
        status="acknowledged",
        acknowledged_by=farmer1.id,
        acknowledged_at=now - timedelta(hours=5),
        created_at=now - timedelta(hours=6),
    )
    alert3 = Alert(
        alert_id="ALT-20261125-003",
        fused_detection_id=fused3.id,
        node_id=node3.id,
        land_id=land2.id,
        species="Tiger",
        confidence=0.95,
        threat_level="critical",
        detection_source="multi_sensor",
        status="active",
        created_at=now - timedelta(minutes=45),
    )
    db.add_all([alert1, alert2, alert3])
    db.flush()

    # 10. SMS Notifications
    sms1 = SMSNotification(
        alert_id=alert1.id,
        recipient_id=farmer1.id,
        phone_number=farmer1.phone,
        message=(
            "BHOOMI KAVALU ALERT\n\nWildlife detected: Asian Elephant\n"
            "Land: Kaveri Coffee & Banana Estate\nNode ID: NODE_001\n"
            "Threat Level: CRITICAL\nLocation: Veeranahosahalli Border, Hunsur, Karnataka"
        ),
        status="delivered",
        sent_at=now - timedelta(hours=1, minutes=19),
    )
    sms2 = SMSNotification(
        alert_id=alert1.id,
        recipient_id=officer.id,
        phone_number=officer.phone,
        message=(
            "BHOOMI KAVALU ALERT\n\nWildlife detected: Asian Elephant\n"
            "Land: Kaveri Coffee & Banana Estate\nNode ID: NODE_001\n"
            "Threat Level: CRITICAL"
        ),
        status="delivered",
        sent_at=now - timedelta(hours=1, minutes=19),
    )
    sms3 = SMSNotification(
        alert_id=alert3.id,
        recipient_id=farmer2.id,
        phone_number=farmer2.phone,
        message=(
            "BHOOMI KAVALU ALERT\n\nWildlife detected: Tiger\n"
            "Land: Kabini Edge Sugarcane Farm\nNode ID: NODE_003\n"
            "Threat Level: CRITICAL"
        ),
        status="delivered",
        sent_at=now - timedelta(minutes=44),
    )
    db.add_all([sms1, sms2, sms3])
    db.commit()
