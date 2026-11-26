import { API_BASE_URL } from '../utils/constants';
import { useAuthStore } from '../stores/authStore';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers = new Headers(options.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    useAuthStore.getState().logout();
  }

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const errData = await res.json();
      detail = errData.detail || detail;
    } catch {
      // ignore parse error
    }
    throw new Error(detail);
  }

  return res.json() as Promise<T>;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ access_token: string; token_type: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (payload: any) =>
    request<{ access_token: string; token_type: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getMe: () => request<any>('/auth/me'),
  updateMe: (payload: { full_name?: string; phone?: string }) =>
    request<any>('/auth/me', { method: 'PUT', body: JSON.stringify(payload) }),
  getRegions: () => request<any[]>('/auth/regions'),

  // Dashboard
  getLandownerDashboard: () => request<any>('/dashboard/landowner'),
  getOfficerDashboard: () => request<any>('/dashboard/officer'),
  getOfficerLandowners: () => request<any[]>('/dashboard/landowners'),

  // Lands & Nodes
  getLands: () => request<any[]>('/lands'),
  createLand: (payload: any) => request<any>('/lands', { method: 'POST', body: JSON.stringify(payload) }),
  getLandNodes: (landId: number) => request<any[]>(`/lands/${landId}/nodes`),
  getNodes: () => request<any[]>('/nodes'),
  getNodeReadings: (nodeId: number, limit = 20) =>
    request<any>(`/nodes/${nodeId}/readings?limit=${limit}`),
  updateNodeStatus: (nodeId: number, status: string) =>
    request<any>(`/nodes/${nodeId}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),

  // Detections
  detectCameraFrame: (formData: FormData, nodeCode = 'NODE_001') =>
    request<any>(`/detect/camera-frame?node_code=${encodeURIComponent(nodeCode)}`, {
      method: 'POST',
      body: formData,
    }),
  detectLiveAudio: (formData: FormData, nodeCode = 'NODE_001') =>
    request<any>(`/detect/audio?node_code=${encodeURIComponent(nodeCode)}`, {
      method: 'POST',
      body: formData,
    }),
  detectAudioUpload: (formData: FormData, nodeCode = 'NODE_001') =>
    request<any>(`/detect/audio-upload?node_code=${encodeURIComponent(nodeCode)}`, {
      method: 'POST',
      body: formData,
    }),
  ingestVibration: (payload: { node_id: number; intensity: number; frequency: number; raw_value: number }) =>
    request<any>('/detect/vibration', { method: 'POST', body: JSON.stringify(payload) }),
  getLatestDetections: () => request<any>('/detect/latest'),
  getDetectionHistory: (params?: { sensor_type?: string; species?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.sensor_type) qs.set('sensor_type', params.sensor_type);
    if (params?.species) qs.set('species', params.species);
    if (params?.limit) qs.set('limit', String(params.limit));
    return request<any[]>(`/detect/history?${qs.toString()}`);
  },

  // Fusion
  getLatestFusion: () => request<any>('/fusion/latest'),
  getFusionHistory: (limit = 20) => request<any[]>(`/fusion/history?limit=${limit}`),
  analyzeFusion: (nodeId: number, timeWindowSeconds = 30) =>
    request<any>('/fusion/analyze', {
      method: 'POST',
      body: JSON.stringify({ node_id: nodeId, time_window_seconds: timeWindowSeconds }),
    }),

  // Alerts
  getAlerts: (params?: { species?: string; threat_level?: string; status?: string; node_code?: string }) => {
    const qs = new URLSearchParams();
    if (params?.species) qs.set('species', params.species);
    if (params?.threat_level) qs.set('threat_level', params.threat_level);
    if (params?.status) qs.set('status', params.status);
    if (params?.node_code) qs.set('node_code', params.node_code);
    return request<any[]>(`/alerts?${qs.toString()}`);
  },
  getAlertStats: () => request<any>('/alerts/stats'),
  acknowledgeAlert: (alertId: number) =>
    request<any>(`/alerts/${alertId}/acknowledge`, { method: 'PUT' }),
  resolveAlert: (alertId: number) =>
    request<any>(`/alerts/${alertId}/resolve`, { method: 'PUT' }),

  // SMS
  sendSmsForAlert: (alertId: number) =>
    request<any[]>('/sms/send', { method: 'POST', body: JSON.stringify({ alert_id: alertId }) }),
  getSmsHistory: () => request<any[]>('/sms/history'),
  retrySms: (smsId: number) => request<any>(`/sms/retry/${smsId}`, { method: 'POST' }),
};
