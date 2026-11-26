import { useEffect, useState } from 'react';
import { Camera, Mic, Activity, ArrowRight, Layers, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { ThreatBadge } from '../../components/ui/ThreatBadge';
import { ConfidenceRadarChart } from '../../components/charts/ConfidenceRadarChart';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { formatConfidence, formatDateTime } from '../../utils/formatters';

const FUSION_BADGE: Record<string, { label: string; style: string }> = {
  multi_sensor: { label: 'Confirmed Multi-Sensor Detection', style: 'bg-olive text-white' },
  single_sensor: { label: 'Single-Sensor Detection', style: 'bg-bk-yellow text-bk-black' },
  conflicting: { label: 'Conflicting Sensor Results', style: 'bg-amber-200 text-amber-900' },
  insufficient_data: { label: 'Insufficient Data', style: 'bg-bk-gray text-bk-black/60' },
};

export function OverallAnalysis() {
  const [latest, setLatest] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const loadData = () => {
    Promise.all([
      api.getLatestFusion().catch(() => null),
      api.getFusionHistory(15),
      api.getNodes(),
    ])
      .then(([l, h, n]) => {
        setLatest(l);
        setHistory(h);
        setNodes(n);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunFusion = async () => {
    if (nodes.length === 0) return;
    setAnalyzing(true);
    try {
      const res = await api.analyzeFusion(nodes[0].id, 300);
      setLatest(res);
      setHistory((prev) => [res, ...prev]);
      toast.success('Sensor fusion updated');
    } catch (err: any) {
      toast.error(err.message || 'Fusion analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) return <LoadingSpinner label="Loading multi-sensor fusion analysis..." />;

  const methodCfg = FUSION_BADGE[latest?.fusion_method || 'insufficient_data'] || FUSION_BADGE.insufficient_data;

  return (
    <div className="space-y-6">
      {/* Header Action */}
      <div className="bg-bk-white rounded-xl p-4 border border-bk-gray-dark/50 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Layers className="w-5 h-5 text-olive" />
          <div>
            <h3 className="text-sm font-bold text-bk-black">Multi-Sensor AI Fusion Engine</h3>
            <p className="text-xs text-bk-black/60">
              Weighted fusion: Camera AI (50%) • Audio AI (35%) • Ground Vibration Corroboration (15%)
            </p>
          </div>
        </div>
        <button
          onClick={handleRunFusion}
          disabled={analyzing || nodes.length === 0}
          className="px-4 py-2 rounded-xl bg-olive text-bk-white text-xs font-semibold flex items-center gap-2 hover:bg-olive-deep transition disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
          Re-evaluate Fusion
        </button>
      </div>

      {/* Sensor Fusion Convergence Diagram */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* Left: 3 Sensor Inputs */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-bk-white rounded-xl p-4 border border-bk-gray-dark/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-olive/10 text-olive">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-bk-black">Camera AI (YOLOv8)</p>
                <p className="text-[11px] text-bk-black/55">Weight: 0.50</p>
              </div>
            </div>
            <span className="text-sm font-bold text-olive">
              {latest?.camera_confidence != null ? formatConfidence(latest.camera_confidence) : 'Inactive'}
            </span>
          </div>

          <div className="bg-bk-white rounded-xl p-4 border border-bk-gray-dark/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-olive/10 text-olive">
                <Mic className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-bk-black">Audio AI Classifier</p>
                <p className="text-[11px] text-bk-black/55">Weight: 0.35</p>
              </div>
            </div>
            <span className="text-sm font-bold text-olive">
              {latest?.audio_confidence != null ? formatConfidence(latest.audio_confidence) : 'Inactive'}
            </span>
          </div>

          <div className="bg-bk-white rounded-xl p-4 border border-bk-gray-dark/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-olive/10 text-olive">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-bk-black">Ground Vibration</p>
                <p className="text-[11px] text-bk-black/55">Weight: 0.15 (Corroboration)</p>
              </div>
            </div>
            <span className="text-sm font-bold text-bk-black">
              {latest?.vibration_intensity != null ? `${latest.vibration_intensity.toFixed(1)} mm/s` : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Center Arrow */}
        <div className="lg:col-span-1 flex justify-center">
          <div className="w-10 h-10 rounded-full bg-olive text-white flex items-center justify-center shadow">
            <ArrowRight className="w-5 h-5 rotate-90 lg:rotate-0" />
          </div>
        </div>

        {/* Right: Fused Verdict */}
        <div className="lg:col-span-6 bg-bk-white rounded-2xl p-6 border-2 border-olive/40 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${methodCfg.style}`}>
              {methodCfg.label}
            </span>
            <ThreatBadge level={latest?.threat_level || 'normal'} />
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-bk-black/55 font-semibold">
              Final Species Prediction
            </p>
            <h2 className="text-3xl font-extrabold text-bk-black mt-1">
              {latest?.final_species || 'Insufficient Data'}
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-bk-gray-dark/40">
            <div>
              <p className="text-xs text-bk-black/55">Overall Fused Confidence</p>
              <p className="text-2xl font-bold text-olive">
                {latest ? formatConfidence(latest.overall_confidence) : '0.0%'}
              </p>
            </div>
            <div>
              <p className="text-xs text-bk-black/55">Timestamp</p>
              <p className="text-xs font-semibold text-bk-black mt-1">
                {latest ? formatDateTime(latest.detected_at) : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Radar Chart + History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-bk-white rounded-xl p-5 border border-bk-gray-dark/50 shadow-sm">
          <h4 className="text-sm font-bold text-bk-black mb-2">Confidence Breakdown</h4>
          <ConfidenceRadarChart
            camera={latest?.camera_confidence || 0}
            audio={latest?.audio_confidence || 0}
            vibration={latest?.vibration_intensity || 0}
            overall={latest?.overall_confidence || 0}
          />
        </div>

        <div className="lg:col-span-2 bg-bk-white rounded-xl p-5 border border-bk-gray-dark/50 shadow-sm">
          <h4 className="text-sm font-bold text-bk-black mb-3">Fusion Analysis History</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-bk-gray-dark/50 text-bk-black/60 uppercase">
                  <th className="py-2 px-3">Species</th>
                  <th className="py-2 px-3">Method</th>
                  <th className="py-2 px-3">Confidence</th>
                  <th className="py-2 px-3">Threat</th>
                  <th className="py-2 px-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bk-gray-dark/30">
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="py-2.5 px-3 font-bold">{h.final_species}</td>
                    <td className="py-2.5 px-3 capitalize">{h.fusion_method.replace('_', ' ')}</td>
                    <td className="py-2.5 px-3 font-semibold text-olive">
                      {formatConfidence(h.overall_confidence)}
                    </td>
                    <td className="py-2.5 px-3">
                      <ThreatBadge level={h.threat_level} />
                    </td>
                    <td className="py-2.5 px-3 text-bk-black/60">{formatDateTime(h.detected_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
