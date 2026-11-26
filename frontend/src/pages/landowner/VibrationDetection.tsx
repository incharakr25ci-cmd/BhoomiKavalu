import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, Sliders } from 'lucide-react';
import { api } from '../../services/api';
import { VibrationLineChart } from '../../components/charts/VibrationLineChart';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { formatTime } from '../../utils/formatters';

const STATUS_STYLE: Record<string, { label: string; badge: string }> = {
  normal: { label: 'Normal Ground Activity', badge: 'bg-olive/15 text-olive' },
  elevated: { label: 'Unusual Vibration', badge: 'bg-bk-yellow text-bk-black' },
  high: { label: 'Possible Wildlife Movement', badge: 'bg-amber-100 text-amber-800' },
  critical: { label: 'High-Intensity Vibration', badge: 'bg-bk-danger-light text-bk-danger' },
};

export function VibrationDetection() {
  const [nodes, setNodes] = useState<any[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [readings, setReadings] = useState<any[]>([]);
  const [threshold, setThreshold] = useState(5.5);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getNodes().then((n) => {
      setNodes(n);
      if (n.length > 0) {
        setSelectedNodeId(n[0].id);
      } else {
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedNodeId) return;
    api
      .getNodeReadings(selectedNodeId, 20)
      .then((res) => setReadings(res.vibration_readings || []))
      .finally(() => setLoading(false));
  }, [selectedNodeId]);

  if (loading) return <LoadingSpinner label="Loading vibration telemetry..." />;

  const latest = readings[0];
  const st = STATUS_STYLE[latest?.threshold_status || 'normal'] || STATUS_STYLE.normal;
  const chartData = [...readings]
    .reverse()
    .map((r) => ({ time: formatTime(r.detected_at), intensity: r.intensity }));

  return (
    <div className="space-y-6">
      <div className="bg-bk-white rounded-xl p-4 border border-bk-gray-dark/50 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-olive" />
          <div>
            <h3 className="text-sm font-bold text-bk-black">Ground Seismic &amp; Vibration Sensor</h3>
            <p className="text-xs text-bk-black/60">
              Note: Vibration intensity indicates ground movement and does not identify species alone.
            </p>
          </div>
        </div>

        <select
          value={selectedNodeId ?? ''}
          onChange={(e) => setSelectedNodeId(Number(e.target.value))}
          className="px-3 py-1.5 rounded-lg border border-bk-gray-dark text-xs font-mono bg-bk-white"
        >
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.node_id}
            </option>
          ))}
        </select>
      </div>

      {/* Live Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-bk-white rounded-xl p-4 border border-bk-gray-dark/50">
          <p className="text-xs text-bk-black/55">Latest Intensity</p>
          <p className="text-2xl font-bold text-bk-black mt-1">
            {latest ? `${latest.intensity.toFixed(2)} mm/s` : '—'}
          </p>
        </div>
        <div className="bg-bk-white rounded-xl p-4 border border-bk-gray-dark/50">
          <p className="text-xs text-bk-black/55">Dominant Frequency</p>
          <p className="text-2xl font-bold text-bk-black mt-1">
            {latest ? `${latest.frequency.toFixed(1)} Hz` : '—'}
          </p>
        </div>
        <div className="bg-bk-white rounded-xl p-4 border border-bk-gray-dark/50">
          <p className="text-xs text-bk-black/55">Activity Classification</p>
          <span className={`inline-block mt-2 px-2.5 py-1 rounded-full text-xs font-bold ${st.badge}`}>
            {st.label}
          </span>
        </div>
        <div className="bg-bk-white rounded-xl p-4 border border-bk-gray-dark/50">
          <p className="text-xs text-bk-black/55 flex items-center gap-1">
            <Sliders className="w-3.5 h-3.5 text-olive" /> Calibration Threshold
          </p>
          <input
            type="range"
            min={2}
            max={9}
            step={0.5}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-full mt-2 accent-olive"
          />
          <p className="text-[11px] font-semibold text-bk-black/70">{threshold} mm/s</p>
        </div>
      </div>

      {latest && latest.intensity >= threshold && (
        <div className="p-4 rounded-xl bg-bk-yellow/60 border border-bk-yellow-dark flex items-center gap-3 text-xs font-semibold text-bk-black">
          <AlertTriangle className="w-5 h-5 text-bk-danger shrink-0" />
          Abnormal ground vibration ({latest.intensity.toFixed(2)} mm/s) exceeds calibrated threshold ({threshold} mm/s). Corroborate with Camera/Audio AI in Overall Analysis.
        </div>
      )}

      {/* Historical Graph */}
      <div className="bg-bk-white rounded-xl p-5 border border-bk-gray-dark/50 shadow-sm">
        <h4 className="text-sm font-bold text-bk-black mb-3">Historical Vibration Intensity</h4>
        <VibrationLineChart data={chartData} threshold={threshold} />
      </div>
    </div>
  );
}
