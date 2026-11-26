import { useEffect, useState } from 'react';
import { Camera, Mic, Activity, Radio, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { formatConfidence, formatRelativeTime, getAnimalIcon } from '../../utils/formatters';

export function LiveMonitoring() {
  const user = useAuthStore((s) => s.user);
  const prefix = user?.role === 'forest_officer' ? '/officer' : '/landowner';
  const [latest, setLatest] = useState<any>(null);
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => {
      Promise.all([api.getLatestDetections(), api.getNodes()])
        .then(([l, n]) => {
          setLatest(l);
          setNodes(n);
        })
        .finally(() => setLoading(false));
    };
    load();
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, []);

  if (loading) return <LoadingSpinner label="Connecting to sensor streams..." />;

  const activeCount = nodes.filter((n) => n.status === 'active').length;

  return (
    <div className="space-y-6">
      <div className="bg-bk-white rounded-xl p-4 border border-bk-gray-dark/50 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-olive/10 text-olive flex items-center justify-center">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-bk-black">Multi-Sensor Telemetry Hub</h3>
            <p className="text-xs text-bk-black/60">
              {activeCount} of {nodes.length} sensor nodes online • Auto-refreshing every 4s
            </p>
          </div>
        </div>
        <Link
          to={`${prefix}/analysis`}
          className="px-4 py-2 rounded-xl bg-olive text-bk-white text-xs font-semibold flex items-center gap-1.5 hover:bg-olive-deep transition"
        >
          Open Sensor Fusion <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Camera Panel */}
        <div className="bg-bk-white rounded-xl p-5 border border-bk-gray-dark/50 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-2 text-sm font-bold text-bk-black">
                <Camera className="w-4 h-4 text-olive" /> Camera AI (YOLOv8)
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-olive/15 text-olive">
                READY
              </span>
            </div>
            {latest?.camera ? (
              <div className="p-3.5 rounded-xl bg-bk-gray/60 space-y-1">
                <p className="text-base font-bold text-bk-black flex items-center gap-1.5">
                  <span>{getAnimalIcon(latest.camera.species)}</span>
                  <span>{latest.camera.species}</span>
                </p>
                <p className="text-xs text-bk-black/70">
                  Confidence: {formatConfidence(latest.camera.confidence)}
                </p>
                <p className="text-[11px] text-bk-black/50">
                  {formatRelativeTime(latest.camera.detected_at)}
                </p>
              </div>
            ) : (
              <p className="text-xs text-bk-black/50 py-6 text-center">No camera detections yet.</p>
            )}
          </div>
          <Link
            to={`${prefix}/camera`}
            className="w-full py-2 rounded-xl border border-olive text-olive text-xs font-semibold text-center hover:bg-olive hover:text-white transition"
          >
            Open Camera Monitor
          </Link>
        </div>

        {/* Audio Panel */}
        <div className="bg-bk-white rounded-xl p-5 border border-bk-gray-dark/50 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-2 text-sm font-bold text-bk-black">
                <Mic className="w-4 h-4 text-olive" /> Acoustic AI
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-olive/15 text-olive">
                READY
              </span>
            </div>
            {latest?.audio ? (
              <div className="p-3.5 rounded-xl bg-bk-gray/60 space-y-1">
                <p className="text-base font-bold text-bk-black">{latest.audio.species}</p>
                <p className="text-xs text-bk-black/70">
                  Confidence: {formatConfidence(latest.audio.confidence)}
                </p>
                <p className="text-[11px] text-bk-black/50">
                  {formatRelativeTime(latest.audio.detected_at)}
                </p>
              </div>
            ) : (
              <p className="text-xs text-bk-black/50 py-6 text-center">No audio detections yet.</p>
            )}
          </div>
          <Link
            to={`${prefix}/audio`}
            className="w-full py-2 rounded-xl border border-olive text-olive text-xs font-semibold text-center hover:bg-olive hover:text-white transition"
          >
            Open Audio Monitor
          </Link>
        </div>

        {/* Vibration Panel */}
        <div className="bg-bk-white rounded-xl p-5 border border-bk-gray-dark/50 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-2 text-sm font-bold text-bk-black">
                <Activity className="w-4 h-4 text-olive" /> Ground Vibration
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-olive/15 text-olive">
                READY
              </span>
            </div>
            {latest?.vibration ? (
              <div className="p-3.5 rounded-xl bg-bk-gray/60 space-y-1">
                <p className="text-base font-bold text-bk-black">
                  {latest.vibration.intensity.toFixed(1)} mm/s
                </p>
                <p className="text-xs text-bk-black/70 capitalize">
                  Status: {latest.vibration.threshold_status}
                </p>
                <p className="text-[11px] text-bk-black/50">
                  {formatRelativeTime(latest.vibration.detected_at)}
                </p>
              </div>
            ) : (
              <p className="text-xs text-bk-black/50 py-6 text-center">No vibration readings yet.</p>
            )}
          </div>
          <Link
            to={`${prefix}/vibration`}
            className="w-full py-2 rounded-xl border border-olive text-olive text-xs font-semibold text-center hover:bg-olive hover:text-white transition"
          >
            Open Vibration Monitor
          </Link>
        </div>
      </div>
    </div>
  );
}
