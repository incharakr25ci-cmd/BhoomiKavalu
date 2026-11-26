import { useEffect, useState } from 'react';
import { Map, Users, Cpu, Camera, Mic, Activity, ShieldAlert, TrendingUp } from 'lucide-react';
import { api } from '../../services/api';
import { StatCard } from '../../components/ui/StatCard';
import { ThreatBadge } from '../../components/ui/ThreatBadge';
import { DemoDataBanner } from '../../components/ui/DemoDataBanner';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { DetectionAreaChart } from '../../components/charts/DetectionAreaChart';
import { formatRelativeTime, getAnimalIcon } from '../../utils/formatters';

export function RegionalOverview() {
  const [stats, setStats] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getOfficerDashboard(), api.getAlerts()])
      .then(([s, al]) => {
        setStats(s);
        setAlerts(al.slice(0, 6));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner label="Loading regional command center..." />;

  return (
    <div className="space-y-6">
      <DemoDataBanner show={stats?.demo_mode} />

      <div>
        <h3 className="text-xl font-bold text-bk-black">{stats?.region_name}</h3>
        <p className="text-xs text-bk-black/60">Regional Wildlife Intelligence &amp; Conflict Prevention Overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Registered Lands" value={stats?.total_lands ?? 0} icon={Map} color="olive" />
        <StatCard title="Landowners" value={stats?.total_landowners ?? 0} icon={Users} color="olive" />
        <StatCard title="Active Nodes" value={stats?.total_nodes ?? 0} icon={Cpu} color="olive" />
        <StatCard
          title="Critical Alerts"
          value={stats?.critical_alerts ?? 0}
          icon={ShieldAlert}
          color={stats?.critical_alerts > 0 ? 'red' : 'olive'}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Active Cameras" value={stats?.active_cameras ?? 0} icon={Camera} color="default" />
        <StatCard title="Active Microphones" value={stats?.active_audio ?? 0} icon={Mic} color="default" />
        <StatCard title="Active Vibration" value={stats?.active_vibration ?? 0} icon={Activity} color="default" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-bk-white rounded-xl p-5 border border-bk-gray-dark/50 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-bk-black">Regional Wildlife Activity (7 Days)</h4>
              <p className="text-xs text-bk-black/55">Total detections: {stats?.total_detections ?? 0}</p>
            </div>
            <TrendingUp className="w-4 h-4 text-olive" />
          </div>
          <DetectionAreaChart data={stats?.weekly_detections || []} />
        </div>

        <div className="bg-bk-white rounded-xl p-5 border border-bk-gray-dark/50 shadow-sm">
          <h4 className="text-sm font-bold text-bk-black mb-4">Recent Regional Alerts</h4>
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
                  <p className="text-[11px] text-bk-black/60 truncate">
                    {a.land_name} • {formatRelativeTime(a.created_at)}
                  </p>
                </div>
                <ThreatBadge level={a.threat_level} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
