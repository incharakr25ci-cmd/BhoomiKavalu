// ============================================
// BHOOMI KAVALU - TypeScript Type Definitions
// ============================================

// --- Auth Types ---
export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: 'landowner' | 'forest_officer';
  region?: string;
  created_at: string;
  is_active: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
  role: 'landowner' | 'forest_officer';
}

export interface RegisterData {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  confirm_password: string;
  land_name: string;
  land_location: string;
  land_area: number;
  region: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// --- Land & Sensor Types ---
export interface Land {
  id: string;
  name: string;
  location: string;
  area: number;
  latitude: number;
  longitude: number;
  owner_id: string;
  owner_name: string;
  owner_phone: string;
  region: string;
  registered_at: string;
  nodes: SensorNode[];
}

export interface SensorNode {
  id: string;
  node_id: string;
  land_id: string;
  status: 'online' | 'offline' | 'maintenance';
  camera_status: 'active' | 'inactive' | 'error';
  audio_status: 'active' | 'inactive' | 'error';
  vibration_status: 'active' | 'inactive' | 'error';
  battery_level: number;
  last_heartbeat: string;
  installed_at: string;
  latitude: number;
  longitude: number;
}

// --- Detection Types ---
export interface CameraDetection {
  id: string;
  node_id: string;
  species: string;
  confidence: number;
  alert_level: 'CRITICAL' | 'MONITOR' | 'CLEAR';
  bbox: [number, number, number, number];
  image_url?: string;
  source?: string;
  timestamp: string;
}

export interface AudioDetection {
  id: string;
  node_id: string;
  species: string;
  confidence: number;
  probabilities: Record<string, number>;
  audio_url?: string;
  duration_seconds: number;
  timestamp: string;
}

export interface VibrationReading {
  id: string;
  node_id: string;
  intensity: number;
  frequency: number;
  level: 'normal' | 'elevated' | 'high' | 'critical';
  is_abnormal: boolean;
  timestamp: string;
}

// --- Fusion & Alert Types ---
export interface FusedDetection {
  id: string;
  node_id: string;
  land_id: string;
  land_name: string;
  species: string;
  confidence: number;
  threat_level: 'normal' | 'warning' | 'high' | 'critical';
  fusion_method: 'multi_sensor' | 'single_sensor' | 'conflicting';
  camera_result?: { species: string; confidence: number };
  audio_result?: { species: string; confidence: number };
  vibration_result?: { intensity: number; level: string };
  timestamp: string;
}

export interface Alert {
  id: string;
  land_id: string;
  land_name: string;
  node_id: string;
  species: string;
  confidence: number;
  threat_level: 'normal' | 'warning' | 'high' | 'critical';
  detection_source: 'camera' | 'audio' | 'vibration' | 'fused';
  status: 'active' | 'acknowledged' | 'resolved';
  sms_status: 'sent' | 'pending' | 'failed' | 'not_sent';
  sms_recipient?: string;
  timestamp: string;
  acknowledged_at?: string;
  resolved_at?: string;
}

export interface SMSNotification {
  id: string;
  alert_id: string;
  recipient_phone: string;
  message: string;
  status: 'sent' | 'pending' | 'failed';
  sent_at?: string;
}

// --- Dashboard Stats ---
export interface DashboardStats {
  land_name: string;
  land_location: string;
  node_id: string;
  active_sensors: number;
  total_sensors: number;
  monitoring_status: 'active' | 'inactive';
  latest_animal: string;
  latest_detection_time: string;
  threat_level: 'normal' | 'warning' | 'high' | 'critical';
  total_detections: number;
  confidence_score: number;
  detections_today: number;
  alerts_today: number;
  weekly_detections: DailyCount[];
}

export interface DailyCount {
  date: string;
  count: number;
}

export interface RegionalStats {
  total_lands: number;
  total_landowners: number;
  total_nodes: number;
  active_cameras: number;
  active_audio: number;
  active_vibration: number;
  total_detections: number;
  critical_alerts: number;
  weekly_detections: DailyCount[];
}

// --- WebSocket Types ---
export type WSMessageType =
  | 'camera_detection'
  | 'audio_detection'
  | 'vibration_reading'
  | 'fused_detection'
  | 'alert'
  | 'sensor_status'
  | 'heartbeat';

export interface WSMessage {
  type: WSMessageType;
  data: CameraDetection | AudioDetection | VibrationReading | FusedDetection | Alert | SensorNode;
  timestamp: string;
}

// --- UI Types ---
export type ThreatLevel = 'normal' | 'warning' | 'high' | 'critical';
export type SensorType = 'camera' | 'audio' | 'vibration';
export type UserRole = 'landowner' | 'forest_officer';
