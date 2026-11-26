import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { Overview } from './pages/landowner/Overview';
import { MyLand } from './pages/landowner/MyLand';
import { LiveMonitoring } from './pages/landowner/LiveMonitoring';
import { CameraDetection } from './pages/landowner/CameraDetection';
import { PhoneCameraPage } from './pages/landowner/PhoneCameraPage';
import { AudioDetection } from './pages/landowner/AudioDetection';
import { VibrationDetection } from './pages/landowner/VibrationDetection';
import { OverallAnalysis } from './pages/landowner/OverallAnalysis';
import { Alerts } from './pages/landowner/Alerts';
import { DetectionHistory } from './pages/landowner/DetectionHistory';
import { Settings } from './pages/landowner/Settings';
import { RegionalOverview } from './pages/officer/RegionalOverview';
import { LandManagement } from './pages/officer/LandManagement';
import { RegionalMap } from './pages/officer/RegionalMap';
import { RegionalAlerts } from './pages/officer/RegionalAlerts';
import { Landowners } from './pages/officer/Landowners';
import { Reports } from './pages/officer/Reports';

function ProtectedRoute({
  allowedRole,
  title,
  children,
}: {
  allowedRole: 'landowner' | 'forest_officer';
  title: string;
  children: ReactNode;
}) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (user.role !== allowedRole) {
    return (
      <Navigate
        to={user.role === 'forest_officer' ? '/officer/overview' : '/landowner/overview'}
        replace
      />
    );
  }
  return <DashboardLayout title={title}>{children}</DashboardLayout>;
}

export default function App() {
  const { isAuthenticated, user } = useAuthStore();
  const homePath = user?.role === 'forest_officer' ? '/officer/overview' : '/landowner/overview';

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/phone-cam/:nodeCode" element={<PhoneCameraPage />} />

      {/* Landowner Routes */}
      <Route
        path="/landowner/overview"
        element={<ProtectedRoute allowedRole="landowner" title="Landowner Overview"><Overview /></ProtectedRoute>}
      />
      <Route
        path="/landowner/my-land"
        element={<ProtectedRoute allowedRole="landowner" title="My Land"><MyLand /></ProtectedRoute>}
      />
      <Route
        path="/landowner/live"
        element={<ProtectedRoute allowedRole="landowner" title="Live Monitoring"><LiveMonitoring /></ProtectedRoute>}
      />
      <Route
        path="/landowner/camera"
        element={<ProtectedRoute allowedRole="landowner" title="Camera Detection"><CameraDetection /></ProtectedRoute>}
      />
      <Route
        path="/landowner/audio"
        element={<ProtectedRoute allowedRole="landowner" title="Audio Detection"><AudioDetection /></ProtectedRoute>}
      />
      <Route
        path="/landowner/vibration"
        element={<ProtectedRoute allowedRole="landowner" title="Vibration Detection"><VibrationDetection /></ProtectedRoute>}
      />
      <Route
        path="/landowner/analysis"
        element={<ProtectedRoute allowedRole="landowner" title="Overall AI Analysis & Fusion"><OverallAnalysis /></ProtectedRoute>}
      />
      <Route
        path="/landowner/alerts"
        element={<ProtectedRoute allowedRole="landowner" title="Alerts"><Alerts /></ProtectedRoute>}
      />
      <Route
        path="/landowner/history"
        element={<ProtectedRoute allowedRole="landowner" title="Detection History"><DetectionHistory /></ProtectedRoute>}
      />
      <Route
        path="/landowner/settings"
        element={<ProtectedRoute allowedRole="landowner" title="Profile & Settings"><Settings /></ProtectedRoute>}
      />

      {/* Forest Officer Routes */}
      <Route
        path="/officer/overview"
        element={<ProtectedRoute allowedRole="forest_officer" title="Regional Overview"><RegionalOverview /></ProtectedRoute>}
      />
      <Route
        path="/officer/lands"
        element={<ProtectedRoute allowedRole="forest_officer" title="Land Management"><LandManagement /></ProtectedRoute>}
      />
      <Route
        path="/officer/map"
        element={<ProtectedRoute allowedRole="forest_officer" title="Regional Map"><RegionalMap /></ProtectedRoute>}
      />
      <Route
        path="/officer/live"
        element={<ProtectedRoute allowedRole="forest_officer" title="Live Monitoring"><LiveMonitoring /></ProtectedRoute>}
      />
      <Route
        path="/officer/camera"
        element={<ProtectedRoute allowedRole="forest_officer" title="Camera Monitoring"><CameraDetection /></ProtectedRoute>}
      />
      <Route
        path="/officer/audio"
        element={<ProtectedRoute allowedRole="forest_officer" title="Audio Monitoring"><AudioDetection /></ProtectedRoute>}
      />
      <Route
        path="/officer/vibration"
        element={<ProtectedRoute allowedRole="forest_officer" title="Vibration Monitoring"><VibrationDetection /></ProtectedRoute>}
      />
      <Route
        path="/officer/analysis"
        element={<ProtectedRoute allowedRole="forest_officer" title="Overall AI Analysis & Fusion"><OverallAnalysis /></ProtectedRoute>}
      />
      <Route
        path="/officer/alerts"
        element={<ProtectedRoute allowedRole="forest_officer" title="Regional Alerts"><RegionalAlerts /></ProtectedRoute>}
      />
      <Route
        path="/officer/landowners"
        element={<ProtectedRoute allowedRole="forest_officer" title="Landowners"><Landowners /></ProtectedRoute>}
      />
      <Route
        path="/officer/history"
        element={<ProtectedRoute allowedRole="forest_officer" title="Detection History"><DetectionHistory /></ProtectedRoute>}
      />
      <Route
        path="/officer/reports"
        element={<ProtectedRoute allowedRole="forest_officer" title="Reports & Analytics"><Reports /></ProtectedRoute>}
      />
      <Route
        path="/officer/settings"
        element={<ProtectedRoute allowedRole="forest_officer" title="Settings"><Settings /></ProtectedRoute>}
      />

      <Route path="*" element={<Navigate to={isAuthenticated ? homePath : '/login'} replace />} />
    </Routes>
  );
}
