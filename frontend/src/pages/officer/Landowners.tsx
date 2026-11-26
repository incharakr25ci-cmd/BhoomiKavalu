import { useEffect, useState } from 'react';
import { Users, Search } from 'lucide-react';
import { api } from '../../services/api';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDate } from '../../utils/formatters';

export function Landowners() {
  const [owners, setOwners] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getOfficerLandowners()
      .then(setOwners)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner label="Loading regional landowners..." />;

  const filtered = owners.filter(
    (o) =>
      o.full_name.toLowerCase().includes(search.toLowerCase()) ||
      o.email.toLowerCase().includes(search.toLowerCase()) ||
      o.phone.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="bg-bk-white rounded-xl p-4 border border-bk-gray-dark/50 flex items-center gap-3">
        <Search className="w-4 h-4 text-bk-black/50" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search landowner by name, email, or phone..."
          className="flex-1 text-xs focus:outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No landowners found"
          description="Registered landowners under your region will appear here."
        />
      ) : (
        <div className="bg-bk-white rounded-xl border border-bk-gray-dark/50 shadow-sm overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-bk-gray-dark/50 bg-bk-gray/50 text-bk-black/65 uppercase">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Registered Lands</th>
                <th className="py-3 px-4">Assigned Nodes</th>
                <th className="py-3 px-4">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bk-gray-dark/30">
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-bk-gray/40">
                  <td className="py-3 px-4 font-bold text-bk-black">{o.full_name}</td>
                  <td className="py-3 px-4">
                    <p>{o.phone}</p>
                    <p className="text-[11px] text-bk-black/55">{o.email}</p>
                  </td>
                  <td className="py-3 px-4">
                    {o.lands.map((l: any) => l.name).join(', ') || '—'}
                  </td>
                  <td className="py-3 px-4 font-mono">{o.node_ids.join(', ') || '—'}</td>
                  <td className="py-3 px-4 text-bk-black/60">{formatDate(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
