import { useEffect, useState } from 'react';
import { Clock, Download } from 'lucide-react';
import { api } from '../../services/api';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { formatConfidence, formatDateTime, getAnimalIcon } from '../../utils/formatters';

export function DetectionHistory() {
  const [records, setRecords] = useState<any[]>([]);
  const [sensorType, setSensorType] = useState('all');
  const [species, setSpecies] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getDetectionHistory({
        sensor_type: sensorType === 'all' ? undefined : sensorType,
        species: species || undefined,
        limit: 100,
      })
      .then(setRecords)
      .finally(() => setLoading(false));
  }, [sensorType, species]);

  const exportCsv = () => {
    const header = 'ID,Source,Node,Species,Confidence,AlertLevel,Timestamp\n';
    const rows = records
      .map(
        (r) =>
          `${r.id},${r.source},${r.node_id},"${r.species}",${r.confidence},${r.alert_level},${r.timestamp}`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bhoomi-kavalu-detections.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <LoadingSpinner label="Loading detection history..." />;

  return (
    <div className="space-y-6">
      <div className="bg-bk-white rounded-xl p-4 border border-bk-gray-dark/50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <select
            value={sensorType}
            onChange={(e) => setSensorType(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-bk-gray-dark text-xs bg-bk-white"
          >
            <option value="all">All Sensors</option>
            <option value="camera">Camera AI</option>
            <option value="audio">Audio AI</option>
            <option value="vibration">Ground Vibration</option>
          </select>
          <input
            type="text"
            value={species}
            onChange={(e) => setSpecies(e.target.value)}
            placeholder="Filter by species (e.g. WILD BOAR, Elephant)..."
            className="px-3.5 py-2 rounded-xl border border-bk-gray-dark text-xs min-w-[200px]"
          />
        </div>

        <button
          onClick={exportCsv}
          className="px-4 py-2 rounded-xl bg-olive text-white text-xs font-semibold flex items-center gap-2 hover:bg-olive-deep transition"
        >
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      {records.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No detection records"
          description="Sensor detections matching your filters will appear here."
        />
      ) : (
        <div className="bg-bk-white rounded-xl border border-bk-gray-dark/50 shadow-sm overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-bk-gray-dark/50 bg-bk-gray/50 text-bk-black/65 uppercase">
                <th className="py-3 px-4">Species / Event</th>
                <th className="py-3 px-4">Sensor</th>
                <th className="py-3 px-4">Node</th>
                <th className="py-3 px-4">Confidence</th>
                <th className="py-3 px-4">Level</th>
                <th className="py-3 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bk-gray-dark/30">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-bk-gray/40">
                  <td className="py-3 px-4 font-bold">
                    {getAnimalIcon(r.species)} {r.species}
                  </td>
                  <td className="py-3 px-4 capitalize">{r.source}</td>
                  <td className="py-3 px-4 font-mono">{r.node_id}</td>
                  <td className="py-3 px-4 font-semibold text-olive">
                    {formatConfidence(r.confidence)}
                  </td>
                  <td className="py-3 px-4 uppercase font-semibold text-[11px]">
                    {r.alert_level}
                  </td>
                  <td className="py-3 px-4 text-bk-black/60">{formatDateTime(r.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
