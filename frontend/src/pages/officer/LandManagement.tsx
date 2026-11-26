import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../../services/api';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { formatArea, formatDate } from '../../utils/formatters';

export function LandManagement() {
  const [lands, setLands] = useState<any[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getLands(), api.getNodes()])
      .then(([l, n]) => {
        setLands(l);
        setNodes(n);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner label="Loading regional land parcels..." />;

  const filtered = lands.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.location.toLowerCase().includes(search.toLowerCase()) ||
      (l.owner?.full_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-bk-white rounded-xl p-4 border border-bk-gray-dark/50 flex items-center gap-3">
        <Search className="w-4 h-4 text-bk-black/50" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search land name, owner, or location..."
          className="flex-1 text-xs focus:outline-none"
        />
      </div>

      <div className="bg-bk-white rounded-xl border border-bk-gray-dark/50 shadow-sm overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-bk-gray-dark/50 bg-bk-gray/50 text-bk-black/65 uppercase">
              <th className="py-3 px-4">Land Name</th>
              <th className="py-3 px-4">Owner</th>
              <th className="py-3 px-4">Location</th>
              <th className="py-3 px-4">Area</th>
              <th className="py-3 px-4">Assigned Nodes</th>
              <th className="py-3 px-4">Registered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bk-gray-dark/30">
            {filtered.map((land) => {
              const landNodes = nodes.filter((n) => n.land_id === land.id);
              return (
                <tr key={land.id} className="hover:bg-bk-gray/40">
                  <td className="py-3 px-4 font-bold text-bk-black">{land.name}</td>
                  <td className="py-3 px-4">
                    <p className="font-medium">{land.owner?.full_name || '—'}</p>
                    <p className="text-[11px] text-bk-black/55">{land.owner?.phone}</p>
                  </td>
                  <td className="py-3 px-4 text-bk-black/75">{land.location}</td>
                  <td className="py-3 px-4">{formatArea(land.area_acres)}</td>
                  <td className="py-3 px-4 font-mono">
                    {landNodes.map((n) => n.node_id).join(', ') || 'None'}
                  </td>
                  <td className="py-3 px-4 text-bk-black/60">{formatDate(land.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
