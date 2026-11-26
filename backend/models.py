"""
Bhoomi Kavalu - SQLAlchemy ORM Models
All database tables for the wildlife monitoring platform.
"""

from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
)
from sqlalchemy.orm import relationship

from backend.database import Base


class Region(Base):
    __tablename__ = "regions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    users = relationship("User", back_populates="region")
    lands = relationship("Land", back_populates="region")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(20), nullable=False)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="landowner")  # "landowner" or "forest_officer"
    region_id = Column(Integer, ForeignKey("regions.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    region = relationship("Region", back_populates="users")
    lands = relationship("Land", back_populates="owner")
    acknowledged_alerts = relationship(
        "Alert",
        back_populates="acknowledged_by_user",
        foreign_keys="Alert.acknowledged_by",
    )
    sms_notifications = relationship("SMSNotification", back_populates="recipient")


class Land(Base):
    __tablename__ = "lands"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    location = Column(String(500), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    area_acres = Column(Float, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    region_id = Column(Integer, ForeignKey("regions.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    owner = relationship("User", back_populates="lands")
    region = relationship("Region", back_populates="lands")
    sensor_nodes = relationship("SensorNode", back_populates="land")
    alerts = relationship("Alert", back_populates="land")


class SensorNode(Base):
    __tablename__ = "sensor_nodes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    node_id = Column(String(50), unique=True, nullable=False)  # e.g., "NODE_001"
    land_id = Column(Integer, ForeignKey("lands.id"), nullable=False)
    node_type = Column(String(20), nullable=False)  # "camera", "audio", "vibration", "multi"
    status = Column(String(20), nullable=False, default="active")  # "active", "inactive", "maintenance"
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    installed_at = Column(DateTime, default=datetime.utcnow)
    last_heartbeat = Column(DateTime, nullable=True)

    # Relationships
    land = relationship("Land", back_populates="sensor_nodes")
    camera_detections = relationship("CameraDetection", back_populates="node")
    audio_detections = relationship("AudioDetection", back_populates="node")
    vibration_readings = relationship("VibrationReading", back_populates="node")
    fused_detections = relationship("FusedDetection", back_populates="node")
    alerts = relationship("Alert", back_populates="node")


class CameraDetection(Base):
    __tablename__ = "camera_detections"

    id = Column(Integer, primary_key=True, autoincrement=True)
    node_id = Column(Integer, ForeignKey("sensor_nodes.id"), nullable=False)
    species = Column(String(100), nullable=False)
    confidence = Column(Float, nullable=False)
    alert_level = Column(String(20), nullable=False)  # "CRITICAL", "MONITOR", "CLEAR"
    bbox = Column(String(100), nullable=True)  # JSON string [x1,y1,x2,y2]
    image_path = Column(String(500), nullable=True)
    detected_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    node = relationship("SensorNode", back_populates="camera_detections")
    fused_detection = relationship("FusedDetection", back_populates="camera_detection")


class AudioDetection(Base):
    __tablename__ = "audio_detections"

    id = Column(Integer, primary_key=True, autoincrement=True)
    node_id = Column(Integer, ForeignKey("sensor_nodes.id"), nullable=False)
    species = Column(String(100), nullable=False)
    confidence = Column(Float, nullable=False)
    probabilities = Column(Text, nullable=True)  # JSON string {"Elephant": 0.8, ...}
    detected_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    node = relationship("SensorNode", back_populates="audio_detections")
    fused_detection = relationship("FusedDetection", back_populates="audio_detection")


class VibrationReading(Base):
    __tablename__ = "vibration_readings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    node_id = Column(Integer, ForeignKey("sensor_nodes.id"), nullable=False)
    intensity = Column(Float, nullable=False)
    frequency = Column(Float, nullable=False)
    threshold_status = Column(String(20), nullable=False, default="normal")  # "normal", "elevated", "high", "critical"
    raw_value = Column(Float, nullable=False)
    detected_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    node = relationship("SensorNode", back_populates="vibration_readings")
    fused_detection = relationship("FusedDetection", back_populates="vibration_reading")


class FusedDetection(Base):
    __tablename__ = "fused_detections"

    id = Column(Integer, primary_key=True, autoincrement=True)
    node_id = Column(Integer, ForeignKey("sensor_nodes.id"), nullable=False)
    camera_detection_id = Column(
        Integer, ForeignKey("camera_detections.id"), nullable=True
    )
    audio_detection_id = Column(
        Integer, ForeignKey("audio_detections.id"), nullable=True
    )
    vibration_reading_id = Column(
        Integer, ForeignKey("vibration_readings.id"), nullable=True
    )
    final_species = Column(String(100), nullable=False)
    camera_confidence = Column(Float, nullable=True)
    audio_confidence = Column(Float, nullable=True)
    vibration_intensity = Column(Float, nullable=True)
    overall_confidence = Column(Float, nullable=False)
    fusion_method = Column(String(50), nullable=False)  # "multi_sensor", "single_sensor", "conflicting"
    threat_level = Column(String(20), nullable=False)  # "normal", "warning", "high", "critical"
    detected_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    node = relationship("SensorNode", back_populates="fused_detections")
    camera_detection = relationship(
        "CameraDetection", back_populates="fused_detection"
    )
    audio_detection = relationship("AudioDetection", back_populates="fused_detection")
    vibration_reading = relationship(
        "VibrationReading", back_populates="fused_detection"
    )
    alerts = relationship("Alert", back_populates="fused_detection")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    alert_id = Column(String(50), unique=True, nullable=False)  # e.g., "ALT-20241125-001"
    fused_detection_id = Column(
        Integer, ForeignKey("fused_detections.id"), nullable=True
    )
    node_id = Column(Integer, ForeignKey("sensor_nodes.id"), nullable=False)
    land_id = Column(Integer, ForeignKey("lands.id"), nullable=False)
    species = Column(String(100), nullable=False)
    confidence = Column(Float, nullable=False)
    threat_level = Column(String(20), nullable=False)  # "normal", "warning", "high", "critical"
    detection_source = Column(String(20), nullable=False)  # "camera", "audio", "vibration", "multi_sensor"
    status = Column(String(20), nullable=False, default="active")  # "active", "acknowledged", "resolved"
    acknowledged_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    fused_detection = relationship("FusedDetection", back_populates="alerts")
    node = relationship("SensorNode", back_populates="alerts")
    land = relationship("Land", back_populates="alerts")
    acknowledged_by_user = relationship(
        "User",
        back_populates="acknowledged_alerts",
        foreign_keys=[acknowledged_by],
    )
    sms_notifications = relationship("SMSNotification", back_populates="alert")


class SMSNotification(Base):
    __tablename__ = "sms_notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    alert_id = Column(Integer, ForeignKey("alerts.id"), nullable=False)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    phone_number = Column(String(20), nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="queued")  # "queued", "sent", "delivered", "failed"
    retry_count = Column(Integer, default=0)
    sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    alert = relationship("Alert", back_populates="sms_notifications")
    recipient = relationship("User", back_populates="sms_notifications")
