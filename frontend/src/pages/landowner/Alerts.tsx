import { useEffect, useState } from 'react';
import { Bell, CheckCircle2, MessageSquare, ShieldCheck, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { ThreatBadge } from '../../components/ui/ThreatBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { formatConfidence, formatDateTime, getAnimalIcon } from '../../utils/formatters';

export function Alerts() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState('');
  const [selectedAlert, setSelectedAlert] = useState<any>(null);

  const loadAlerts = () => {
    api
      .getAlerts({
        threat_level: severityFilter || undefined,
        species: speciesFilter || undefined,
      })
      .then(setAlerts)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAlerts();
  }, [severityFilter, speciesFilter]);

  const handleAcknowledge = async (id: number) => {
    try {
      await api.acknowledgeAlert(id);
      toast.success('Alert acknowledged');
      loadAlerts();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleResolve = async (id: number) => {
    try {
      await api.resolveAlert(id);
      toast.success('Alert resolved');
      loadAlerts();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSendSms = async (id: number) => {
    try {
      await api.sendSmsForAlert(id);
      toast.success('SMS alert dispatched via cellular gateway');
      loadAlerts();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) return <LoadingSpinner label="Loading alerts..." />;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-bk-white rounded-xl p-4 border border-bk-gray-dark/50 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={speciesFilter}
          onChange={(e) => setSpeciesFilter(e.target.value)}
          placeholder="Filter by animal (e.g. Elephant, Tiger, Wild Boar)..."
          className="px-3.5 py-2 rounded-xl border border-bk-gray-dark text-xs flex-1 min-w-[200px]"
        />
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="px-3.5 py-2 rounded-xl border border-bk-gray-dark text-xs bg-bk-white"
        >
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="warning">Warning</option>
          <option value="normal">Normal</option>
        </select>
      </div>

      {alerts.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No alerts match your filters"
          description="When wildlife is detected by your sensor nodes, early-warning alerts and SMS statuses appear here."
        />
      ) : (
        <div className="bg-bk-white rounded-xl border border-bk-gray-dark/50 shadow-sm overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-bk-gray-dark/50 bg-bk-gray/50 text-bk-black/65 uppercase">
                <th className="py-3 px-4">Alert ID</th>
                <th className="py-3 px-4">Species</th>
                <th className="py-3 px-4">Land / Node</th>
                <th className="py-3 px-4">Threat</th>
                <th className="py-3 px-4">SMS Status</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bk-gray-dark/30">
              {alerts.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => setSelectedAlert(a)}
                  className="hover:bg-bk-gray/40 cursor-pointer"
                >
                  <td className="py-3 px-4 font-mono font-semibold">{a.alert_id}</td>
                  <td className="py-3 px-4 font-bold">
                    {getAnimalIcon(a.species)} {a.species}{' '}
                    <span className="text-bk-black/50 font-normal">
                      ({formatConfidence(a.confidence)})
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-medium">{a.land_name}</p>
                    <p className="text-[11px] font-mono text-bk-black/55">{a.node_code}</p>
                  </td>
                  <td className="py-3 px-4">
                    <ThreatBadge level={a.threat_level} />
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        a.sms_status === 'delivered' || a.sms_status === 'sent'
                          ? 'bg-olive/15 text-olive'
                          : 'bg-bk-yellow text-bk-black'
                      }`}
                    >
                      {a.sms_status}
                    </span>
                  </td>
                  <td className="py-3 px-4 capitalize font-medium">{a.status}</td>
                  <td className="py-3 px-4 text-bk-black/60">{formatDateTime(a.created_at)}</td>
                  <td className="py-3 px-4 text-right space-x-1.5" onClick={(e) => e.stopPropagation()}>
                    {a.status === 'active' && (
                      <button
                        onClick={() => handleAcknowledge(a.id)}
                        className="px-2.5 py-1 rounded-lg bg-bk-yellow text-bk-black font-semibold hover:bg-bk-yellow-dark"
                      >
                        Ack
                      </button>
                    )}
                    {a.status !== 'resolved' && (
                      <button
                        onClick={() => handleResolve(a.id)}
                        className="px-2.5 py-1 rounded-lg bg-olive text-white font-semibold hover:bg-olive-deep"
                      >
                        Resolve
                      </button>
                    )}
                    <button
                      onClick={() => handleSendSms(a.id)}
                      title="Dispatch SMS"
                      className="p-1.5 rounded-lg border border-bk-gray-dark hover:bg-bk-gray"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-olive" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Alert Detail Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-bk-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-bk-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-bk-gray-dark/40 pb-3">
              <div>
                <p className="text-xs font-mono text-bk-black/55">{selectedAlert.alert_id}</p>
                <h4 className="text-lg font-bold text-bk-black">
                  {getAnimalIcon(selectedAlert.species)} {selectedAlert.species}
                </h4>
              </div>
              <button onClick={() => setSelectedAlert(null)} className="p-1 rounded-lg hover:bg-bk-gray">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-bk-gray/60">
                <p className="text-bk-black/55">Land</p>
                <p className="font-bold mt-0.5">{selectedAlert.land_name}</p>
              </div>
              <div className="p-3 rounded-xl bg-bk-gray/60">
                <p className="text-bk-black/55">Node ID</p>
                <p className="font-mono font-bold mt-0.5">{selectedAlert.node_code}</p>
              </div>
              <div className="p-3 rounded-xl bg-bk-gray/60">
                <p className="text-bk-black/55">Source</p>
                <p className="font-bold capitalize mt-0.5">{selectedAlert.detection_source.replace('_', ' ')}</p>
              </div>
              <div className="p-3 rounded-xl bg-bk-gray/60">
                <p className="text-bk-black/55">SMS Recipient</p>
                <p className="font-bold mt-0.5">{selectedAlert.sms_recipient || selectedAlert.owner_phone || '—'}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {selectedAlert.status === 'active' && (
                <button
                  onClick={() => {
                    handleAcknowledge(selectedAlert.id);
                    setSelectedAlert(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-bk-yellow text-bk-black text-xs font-semibold flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" /> Acknowledge
                </button>
              )}
              {selectedAlert.status !== 'resolved' && (
                <button
                  onClick={() => {
                    handleResolve(selectedAlert.id);
                    setSelectedAlert(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-olive text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" /> Mark Resolved
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
