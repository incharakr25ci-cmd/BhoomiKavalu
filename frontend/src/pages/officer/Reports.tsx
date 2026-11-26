import { useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../../services/api';
import { AnimalPieChart } from '../../components/charts/AnimalPieChart';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { CHART_COLORS } from '../../utils/constants';

export function Reports() {
  const [history, setHistory] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [smsList, setSmsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getDetectionHistory({ limit: 100 }), api.getAlerts(), api.getSmsHistory()])
      .then(([h, a, s]) => {
        setHistory(h);
        setAlerts(a);
        setSmsList(s);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner label="Generating regional analytics..." />;

  const speciesCounts: Record<string, number> = {};
  history.forEach((h) => {
    if (h.source !== 'vibration') {
      speciesCounts[h.species] = (speciesCounts[h.species] || 0) + 1;
    }
  });
  const pieData = Object.entries(speciesCounts).map(([name, value]) => ({ name, value }));

  const sensorCounts: Record<string, number> = { camera: 0, audio: 0, vibration: 0 };
  history.forEach((h) => {
    sensorCounts[h.source] = (sensorCounts[h.source] || 0) + 1;
  });
  const barData = Object.entries(sensorCounts).map(([sensor, count]) => ({
    sensor: sensor.toUpperCase(),
    count,
  }));

  const exportReport = () => {
    const summary = {
      generated_at: new Date().toISOString(),
      total_detections: history.length,
      total_alerts: alerts.length,
      total_sms_dispatched: smsList.length,
      species_breakdown: speciesCounts,
      sensor_breakdown: sensorCounts,
    };
    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bhoomi-kavalu-regional-report.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="bg-bk-white rounded-xl p-4 border border-bk-gray-dark/50 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-olive" />
          <div>
            <h3 className="text-sm font-bold text-bk-black">Regional Wildlife &amp; SMS Reports</h3>
            <p className="text-xs text-bk-black/60">
              {history.length} detections • {alerts.length} alerts • {smsList.length} SMS notifications
            </p>
          </div>
        </div>
        <button
          onClick={exportReport}
          className="px-4 py-2 rounded-xl bg-olive text-white text-xs font-semibold flex items-center gap-2 hover:bg-olive-deep transition"
        >
          <Download className="w-3.5 h-3.5" /> Export Report
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-bk-white rounded-xl p-5 border border-bk-gray-dark/50 shadow-sm">
          <h4 className="text-sm font-bold text-bk-black mb-3">Animal-wise Detection Distribution</h4>
          <AnimalPieChart data={pieData} />
        </div>

        <div className="bg-bk-white rounded-xl p-5 border border-bk-gray-dark/50 shadow-sm">
          <h4 className="text-sm font-bold text-bk-black mb-3">Sensor Activity Breakdown</h4>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E6E0" />
                <XAxis dataKey="sensor" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill={CHART_COLORS.primary} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
