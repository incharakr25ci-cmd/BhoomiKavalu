import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, Cpu, Calendar, Maximize2 } from 'lucide-react';
import { api } from '../../services/api';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { SensorStatusIndicator } from '../../components/ui/SensorStatusIndicator';
import { formatArea, formatDate, formatRelativeTime } from '../../utils/formatters';

export function MyLand() {
  const [lands, setLands] = useState<any[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    Promise.all([api.getLands(), api.getNodes()])
      .then(([l, n]) => {
        setLands(l);
        setNodes(n);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || lands.length === 0) return;
    if (mapRef.current) {
      mapRef.current.remove();
    }

    const primary = lands[0];
    const map = L.map(mapContainerRef.current).setView([primary.latitude, primary.longitude], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    lands.forEach((land) => {
      L.circleMarker([land.latitude, land.longitude], {
        radius: 10,
        color: '#424B2D',
        fillColor: '#687442',
        fillOpacity: 0.7,
      })
        .addTo(map)
        .bindPopup(`<strong>${land.name}</strong><br/>${land.location}<br/>${land.area_acres} acres`);
    });

    nodes.forEach((node) => {
      L.circleMarker([node.latitude, node.longitude], {
        radius: 7,
        color: '#151713',
        fillColor: node.status === 'active' ? '#F3E9A4' : '#DC2626',
        fillOpacity: 0.95,
      })
        .addTo(map)
        .bindPopup(`<strong>${node.node_id}</strong> (${node.node_type})<br/>Status: ${node.status}`);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [lands, nodes]);

  if (loading) return <LoadingSpinner label="Loading land & sensor nodes..." />;

  const land = lands[0];

  return (
    <div className="space-y-6">
      {land && (
        <div className="bg-bk-white rounded-xl p-6 border border-bk-gray-dark/50 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-bk-black/55 uppercase font-semibold">Land Name</p>
            <p className="text-base font-bold text-bk-black mt-1">{land.name}</p>
          </div>
          <div>
            <p className="text-xs text-bk-black/55 uppercase font-semibold flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-olive" /> Location
            </p>
            <p className="text-sm font-medium text-bk-black mt-1">{land.location}</p>
          </div>
          <div>
            <p className="text-xs text-bk-black/55 uppercase font-semibold flex items-center gap-1">
              <Maximize2 className="w-3.5 h-3.5 text-olive" /> Land Area
            </p>
            <p className="text-sm font-bold text-bk-black mt-1">{formatArea(land.area_acres)}</p>
          </div>
          <div>
            <p className="text-xs text-bk-black/55 uppercase font-semibold flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-olive" /> Registered
            </p>
            <p className="text-sm font-medium text-bk-black mt-1">{formatDate(land.created_at)}</p>
          </div>
        </div>
      )}

      {/* Interactive Map */}
      <div className="bg-bk-white rounded-xl p-5 border border-bk-gray-dark/50 shadow-sm">
        <h4 className="text-sm font-bold text-bk-black mb-3">Interactive Land &amp; Sensor Node Map</h4>
        <div ref={mapContainerRef} className="h-80 w-full rounded-xl overflow-hidden border border-bk-gray-dark/40 z-0" />
      </div>

      {/* Assigned Nodes */}
      <div className="bg-bk-white rounded-xl p-5 border border-bk-gray-dark/50 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-bk-black flex items-center gap-2">
            <Cpu className="w-4 h-4 text-olive" /> Assigned Monitoring Nodes
          </h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {nodes.map((node) => (
            <div
              key={node.id}
              className="p-4 rounded-xl border border-bk-gray-dark/50 bg-bk-gray/40 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-sm text-bk-black">{node.node_id}</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase ${
                    node.status === 'active'
                      ? 'bg-olive/15 text-olive'
                      : 'bg-bk-yellow text-bk-black'
                  }`}
                >
                  {node.status}
                </span>
              </div>
              <div className="space-y-1.5">
                <SensorStatusIndicator
                  label="Node Type"
                  active={node.status === 'active'}
                  detail={node.node_type.toUpperCase()}
                />
                <SensorStatusIndicator
                  label="Last Heartbeat"
                  active={node.status === 'active'}
                  detail={node.last_heartbeat ? formatRelativeTime(node.last_heartbeat) : 'Never'}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
