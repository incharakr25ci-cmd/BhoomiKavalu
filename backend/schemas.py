"""
Bhoomi Kavalu - Pydantic Schemas
Request/Response models for all API endpoints.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field


# ============================================================
# Auth / User Schemas
# ============================================================

class UserCreate(BaseModel):
    email: str = Field(..., description="User email address")
    phone: str = Field(..., description="Phone number for SMS alerts")
    full_name: str = Field(..., description="Full name")
    password: str = Field(..., min_length=6, description="Password (min 6 chars)")
    role: str = Field(default="landowner", description="User role: landowner or forest_officer")
    region_id: Optional[int] = Field(None, description="Region ID (required for forest officers)")


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    phone: str
    full_name: str
    role: str
    region_id: Optional[int] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    phone: Optional[str] = None
    full_name: Optional[str] = None
    region_id: Optional[int] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ============================================================
# Region Schemas
# ============================================================

class RegionCreate(BaseModel):
    name: str
    description: Optional[str] = None


class RegionResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ============================================================
# Land Schemas
# ============================================================

class LandCreate(BaseModel):
    name: str = Field(..., description="Land/farm name")
    location: str = Field(..., description="Location description")
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    area_acres: float = Field(..., gt=0)
    region_id: int = Field(..., description="Region this land belongs to")


class LandUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    area_acres: Optional[float] = None


class LandResponse(BaseModel):
    id: int
    name: str
    location: str
    latitude: float
    longitude: float
    area_acres: float
    owner_id: int
    region_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class LandDetailResponse(LandResponse):
    owner: Optional[UserResponse] = None
    region: Optional[RegionResponse] = None


# ============================================================
# Sensor Node Schemas
# ============================================================

class SensorNodeCreate(BaseModel):
    node_id: str = Field(..., description="Unique node identifier, e.g. NODE_001")
    land_id: int
    node_type: str = Field(..., description="camera, audio, vibration, or multi")
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class SensorNodeUpdate(BaseModel):
    status: Optional[str] = None
    node_type: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class SensorNodeResponse(BaseModel):
    id: int
    node_id: str
    land_id: int
    node_type: str
    status: str
    latitude: float
    longitude: float
    installed_at: datetime
    last_heartbeat: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ============================================================
# Camera Detection Schemas
# ============================================================

class CameraDetectionCreate(BaseModel):
    node_id: int
    species: str
    confidence: float = Field(..., ge=0, le=1)
    alert_level: str = Field(default="MONITOR")
    bbox: Optional[str] = None
    image_path: Optional[str] = None


class CameraDetectionResponse(BaseModel):
    id: int
    node_id: int
    species: str
    confidence: float
    alert_level: str
    bbox: Optional[str] = None
    image_path: Optional[str] = None
    detected_at: datetime

    model_config = {"from_attributes": True}


# ============================================================
# Audio Detection Schemas
# ============================================================

class AudioDetectionCreate(BaseModel):
    node_id: int
    species: str
    confidence: float = Field(..., ge=0, le=1)
    probabilities: Optional[str] = None


class AudioDetectionResponse(BaseModel):
    id: int
    node_id: int
    species: str
    confidence: float
    probabilities: Optional[str] = None
    detected_at: datetime

    model_config = {"from_attributes": True}


# ============================================================
# Vibration Reading Schemas
# ============================================================

class VibrationReadingCreate(BaseModel):
    node_id: int
    intensity: float = Field(..., ge=0)
    frequency: float = Field(..., ge=0)
    raw_value: float


class VibrationReadingResponse(BaseModel):
    id: int
    node_id: int
    intensity: float
    frequency: float
    threshold_status: str
    raw_value: float
    detected_at: datetime

    model_config = {"from_attributes": True}


# ============================================================
# Fused Detection Schemas
# ============================================================

class FusedDetectionResponse(BaseModel):
    id: int
    node_id: int
    camera_detection_id: Optional[int] = None
    audio_detection_id: Optional[int] = None
    vibration_reading_id: Optional[int] = None
    final_species: str
    camera_confidence: Optional[float] = None
    audio_confidence: Optional[float] = None
    vibration_intensity: Optional[float] = None
    overall_confidence: float
    fusion_method: str
    threat_level: str
    detected_at: datetime

    model_config = {"from_attributes": True}


class FusionRequest(BaseModel):
    node_id: int = Field(..., description="Sensor node DB id to fuse readings for")
    time_window_seconds: int = Field(default=30, description="Time window to look back for readings")


# ============================================================
# Alert Schemas
# ============================================================

class AlertCreate(BaseModel):
    node_id: int
    land_id: int
    species: str
    confidence: float
    threat_level: str
    detection_source: str
    fused_detection_id: Optional[int] = None


class AlertResponse(BaseModel):
    id: int
    alert_id: str
    fused_detection_id: Optional[int] = None
    node_id: int
    land_id: int
    species: str
    confidence: float
    threat_level: str
    detection_source: str
    status: str
    acknowledged_by: Optional[int] = None
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AlertUpdate(BaseModel):
    status: Optional[str] = None


class AlertDetailResponse(AlertResponse):
    node: Optional[SensorNodeResponse] = None
    land: Optional[LandResponse] = None
    acknowledged_by_user: Optional[UserResponse] = None


# ============================================================
# SMS Notification Schemas
# ============================================================

class SMSSendRequest(BaseModel):
    alert_id: int = Field(..., description="Alert ID to send SMS for")


class SMSNotificationResponse(BaseModel):
    id: int
    alert_id: int
    recipient_id: int
    phone_number: str
    message: str
    status: str
    retry_count: int
    sent_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ============================================================
# Dashboard Schemas
# ============================================================

class DashboardStats(BaseModel):
    total_lands: int = 0
    total_nodes: int = 0
    active_nodes: int = 0
    total_alerts: int = 0
    active_alerts: int = 0
    critical_alerts: int = 0
    total_detections_today: int = 0
    recent_species: List[str] = []


class RegionalStats(BaseModel):
    region_name: str = ""
    total_lands: int = 0
    total_nodes: int = 0
    active_nodes: int = 0
    total_alerts: int = 0
    active_alerts: int = 0
    critical_alerts: int = 0
    total_detections_today: int = 0
    officer_count: int = 0
    landowner_count: int = 0
    recent_species: List[str] = []


class DetectionSummary(BaseModel):
    id: int
    source: str  # "camera", "audio", "vibration"
    species: str
    confidence: float
    node_id: str
    detected_at: datetime


# ============================================================
# WebSocket Schemas
# ============================================================

class SensorUpdate(BaseModel):
    event_type: str  # "camera_detection", "audio_detection", "vibration_reading", "alert", "heartbeat"
    node_id: str
    data: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.utcnow)
