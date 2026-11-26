import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { api } from '../../services/api';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export function RegionalMap() {
  const [lands, setLands] = useState<any[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    Promise.all([api.getLands(), api.getNodes(), api.getAlerts()])
      .then(([l, n, a]) => {
        setLands(l);
        setNodes(n);
        setAlerts(a);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!containerRef.current || lands.length === 0) return;
    const center = lands[0];
    const map = L.map(containerRef.current).setView([center.latitude, center.longitude], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    lands.forEach((land) => {
      const landAlerts = alerts.filter((a) => a.land_id === land.id && a.status !== 'resolved');
      const hasCritical = landAlerts.some((a) => a.threat_level === 'critical');
      const color = hasCritical ? '#DC2626' : landAlerts.length > 0 ? '#E8D56C' : '#687442';

      L.circleMarker([land.latitude, land.longitude], {
        radius: 11,
        color: '#151713',
        fillColor: color,
        fillOpacity: 0.85,
      })
        .addTo(map)
        .bindPopup(
          `<strong>${land.name}</strong><br/>Owner: ${land.owner?.full_name || '—'}<br/>Active Alerts: ${landAlerts.length}`
        );
    });

    nodes.forEach((n) => {
      L.circleMarker([n.latitude, n.longitude], {
        radius: 6,
        color: '#424B2D',
        fillColor: n.status === 'active' ? '#F3E9A4' : '#D4D5D0',
        fillOpacity: 1,
      })
        .addTo(map)
        .bindPopup(`<strong>${n.node_id}</strong> (${n.node_type}) • ${n.status}`);
    });

    return () => {
      map.remove();
    };
  }, [lands, nodes, alerts]);

  if (loading) return <LoadingSpinner label="Rendering regional GIS map..." />;

  return (
    <div className="space-y-4">
      <div className="bg-bk-white rounded-xl p-4 border border-bk-gray-dark/50 flex flex-wrap items-center justify-between gap-4 text-xs">
        <span className="font-bold text-bk-black">Regional Wildlife &amp; Sensor Node Map</span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-olive inline-block" /> Normal
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-bk-yellow-dark inline-block" /> Warning / High
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-bk-danger inline-block" /> Critical Alert
          </span>
        </div>
      </div>

      <div className="bg-bk-white rounded-xl p-3 border border-bk-gray-dark/50 shadow-sm">
        <div ref={containerRef} className="h-[520px] w-full rounded-xl overflow-hidden z-0" />
      </div>
    </div>
  );
}
