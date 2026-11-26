import { useState, type FormEvent } from 'react';
import { Save, Radio, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

export function Settings() {
  const { user, updateUser } = useAuthStore();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [serialPort, setSerialPort] = useState('COM3');
  const [baudRate, setBaudRate] = useState('9600');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.updateMe({ full_name: fullName, phone });
      updateUser(updated);
      toast.success('Profile & alert preferences updated');
    } catch (err: any) {
      toast.error(err.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <form
        onSubmit={handleSave}
        className="bg-bk-white rounded-xl p-6 border border-bk-gray-dark/50 shadow-sm space-y-4"
      >
        <h3 className="text-sm font-bold text-bk-black border-b border-bk-gray-dark/40 pb-3">
          Profile &amp; Cellular SMS Alert Settings
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-bk-black/75 mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-bk-gray-dark text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-bk-black/75 mb-1">
              Registered Phone (Cellular SMS)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-bk-gray-dark text-sm"
            />
          </div>
        </div>

        <label className="flex items-center gap-3 pt-2 cursor-pointer">
          <input
            type="checkbox"
            checked={smsEnabled}
            onChange={(e) => setSmsEnabled(e.target.checked)}
            className="w-4 h-4 accent-olive"
          />
          <span className="text-xs font-medium text-bk-black flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-olive" />
            Receive SIM800L / Cellular SMS alerts when High or Critical wildlife threat is detected (works without Wi-Fi)
          </span>
        </label>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-olive text-white text-xs font-semibold flex items-center gap-2 hover:bg-olive-deep transition"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>

      {/* IoT Gateway Hardware Configuration */}
      <div className="bg-bk-white rounded-xl p-6 border border-bk-gray-dark/50 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-bk-black flex items-center gap-2 border-b border-bk-gray-dark/40 pb-3">
          <Radio className="w-4 h-4 text-olive" /> IoT Gateway &amp; GSM Hardware Interface
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-bk-black/75 mb-1">
              Gateway Serial Port
            </label>
            <input
              type="text"
              value={serialPort}
              onChange={(e) => setSerialPort(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-bk-gray-dark text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-bk-black/75 mb-1">
              Baud Rate
            </label>
            <select
              value={baudRate}
              onChange={(e) => setBaudRate(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-bk-gray-dark text-sm font-mono bg-bk-white"
            >
              <option value="9600">9600 (SIM800L)</option>
              <option value="115200">115200 (SIM7600 / LoRa)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
