import { useEffect, useState } from 'react';
import {
  MapPin,
  Cpu,
  Radio,
  ShieldAlert,
  Activity,
  Clock,
  TrendingUp,
  Bell,
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { StatCard } from '../../components/ui/StatCard';
import { ThreatBadge } from '../../components/ui/ThreatBadge';
import { DemoDataBanner } from '../../components/ui/DemoDataBanner';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { DetectionAreaChart } from '../../components/charts/DetectionAreaChart';
import { formatConfidence, formatRelativeTime, getAnimalIcon } from '../../utils/formatters';

export function Overview() {
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getLandownerDashboard(),
      api.getAlerts(),
      api.getDetectionHistory({ limit: 5 }),
    ])
      .then(([dash, al, hist]) => {
        setStats(dash);
        setAlerts(al.slice(0, 5));
        setHistory(hist);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner label="Loading landowner overview..." />;

  return (
    <div className="space-y-6">
      <DemoDataBanner show={stats?.demo_mode} />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-bk-black">
            Welcome back, {user?.full_name}
          </h3>
          <p className="text-xs text-bk-black/60 mt-0.5">
            {stats?.land_name} • {stats?.land_location}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-bk-black/60">Current Threat:</span>
          <ThreatBadge level={stats?.threat_level || 'normal'} />
        </div>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Assigned Node"
          value={stats?.node_id || '—'}
          icon={Cpu}
          subtitle={stats?.land_name}
          color="olive"
        />
        <StatCard
          title="Active Sensors"
          value={`${stats?.active_sensors ?? 0} / ${stats?.total_sensors ?? 0}`}
          icon={Radio}
          subtitle={stats?.monitoring_status === 'active' ? 'Monitoring Active' : 'Offline'}
          color="olive"
        />
        <StatCard
          title="Latest Detected Animal"
          value={stats?.latest_animal ? `${getAnimalIcon(stats.latest_animal)} ${stats.latest_animal}` : 'None'}
          icon={ShieldAlert}
          subtitle={
            stats?.latest_detection_time
              ? formatRelativeTime(stats.latest_detection_time)
              : 'No detections yet'
          }
          color={stats?.threat_level === 'critical' ? 'red' : 'yellow'}
        />
        <StatCard
          title="System Confidence"
          value={formatConfidence(stats?.confidence_score || 0)}
          icon={TrendingUp}
          subtitle={`${stats?.total_detections ?? 0} total detections`}
          color="olive"
        />
      </div>

      {/* Activity Chart + Recent Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-bk-white rounded-xl p-5 border border-bk-gray-dark/50 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-bk-black">7-Day Detection Activity</h4>
              <p className="text-xs text-bk-black/55">Camera &amp; Audio AI detections</p>
            </div>
            <Activity className="w-4 h-4 text-olive" />
          </div>
          <DetectionAreaChart data={stats?.weekly_detections || []} />
        </div>

        <div className="bg-bk-white rounded-xl p-5 border border-bk-gray-dark/50 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-bk-black">Recent Alerts</h4>
            <Bell className="w-4 h-4 text-olive" />
          </div>
          {alerts.length === 0 ? (
            <p className="text-xs text-bk-black/55 py-8 text-center">No recent alerts.</p>
          ) : (
            <div className="space-y-3">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className="p-3 rounded-xl bg-bk-gray/60 border border-bk-gray-dark/40 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-bk-black truncate">
                      {getAnimalIcon(a.species)} {a.species}
                    </p>
                    <p className="text-[11px] text-bk-black/55 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" /> {formatRelativeTime(a.created_at)}
                    </p>
                  </div>
                  <ThreatBadge level={a.threat_level} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Detections Table */}
      <div className="bg-bk-white rounded-xl p-5 border border-bk-gray-dark/50 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-bk-black">Latest Sensor Detections</h4>
          <MapPin className="w-4 h-4 text-olive" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-bk-gray-dark/50 text-bk-black/60 uppercase">
                <th className="py-2.5 px-3">Species / Event</th>
                <th className="py-2.5 px-3">Sensor</th>
                <th className="py-2.5 px-3">Node</th>
                <th className="py-2.5 px-3">Confidence</th>
                <th className="py-2.5 px-3">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bk-gray-dark/30">
              {history.map((h) => (
                <tr key={h.id} className="hover:bg-bk-gray/40">
                  <td className="py-2.5 px-3 font-semibold">
                    {getAnimalIcon(h.species)} {h.species}
                  </td>
                  <td className="py-2.5 px-3 capitalize">{h.source}</td>
                  <td className="py-2.5 px-3 font-mono">{h.node_id}</td>
                  <td className="py-2.5 px-3">{formatConfidence(h.confidence)}</td>
                  <td className="py-2.5 px-3 text-bk-black/60">{formatRelativeTime(h.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
