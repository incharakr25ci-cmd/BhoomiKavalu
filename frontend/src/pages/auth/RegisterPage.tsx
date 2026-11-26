import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { REGIONS } from '../../utils/constants';

export function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
    land_name: '',
    land_location: '',
    land_area: 5,
    region: REGIONS[0],
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await api.register({
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        land_name: form.land_name,
        land_location: form.land_location,
        land_area: Number(form.land_area),
        region: form.region,
      });
      setAuth(res.user, res.access_token);
      toast.success('Registration complete! Default sensor node assigned.');
      navigate('/landowner/overview');
    } catch (err: any) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bk-gray flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-bk-white rounded-2xl shadow-lg border border-bk-gray-dark/60 overflow-hidden">
        <div className="bg-olive-deep px-6 py-5 flex items-center justify-between text-bk-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-olive flex items-center justify-center border border-bk-yellow/30">
              <Shield className="w-5 h-5 text-bk-yellow" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-wide">LANDOWNER REGISTRATION</h1>
              <p className="text-[11px] text-bk-yellow/80">Register your farm &amp; receive early-warning SMS alerts</p>
            </div>
          </div>
          <Link to="/login" className="text-xs text-bk-yellow hover:underline flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Login
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-bk-black/75 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-bk-gray-dark text-sm"
              placeholder="e.g. Ramesh Gowda"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-bk-black/75 mb-1">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-bk-gray-dark text-sm"
              placeholder="ramesh@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-bk-black/75 mb-1">Phone (for SMS Alerts)</label>
            <input
              type="tel"
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-bk-gray-dark text-sm"
              placeholder="+919900112233"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-bk-black/75 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-bk-gray-dark text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-bk-black/75 mb-1">Confirm Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={form.confirm_password}
              onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-bk-gray-dark text-sm"
            />
          </div>

          <div className="sm:col-span-2 pt-2 border-t border-bk-gray-dark/40">
            <h2 className="text-xs font-bold uppercase tracking-wider text-olive mb-2">
              Land Details
            </h2>
          </div>

          <div>
            <label className="block text-xs font-semibold text-bk-black/75 mb-1">Land / Estate Name</label>
            <input
              type="text"
              required
              value={form.land_name}
              onChange={(e) => setForm({ ...form, land_name: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-bk-gray-dark text-sm"
              placeholder="Green Valley Farm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-bk-black/75 mb-1">Region</label>
            <select
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-bk-gray-dark text-sm bg-bk-white"
            >
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-bk-black/75 mb-1">Location</label>
            <input
              type="text"
              required
              value={form.land_location}
              onChange={(e) => setForm({ ...form, land_location: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-bk-gray-dark text-sm"
              placeholder="Hunsur, Karnataka"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-bk-black/75 mb-1">Area (Acres)</label>
            <input
              type="number"
              min={0.5}
              step={0.5}
              required
              value={form.land_area}
              onChange={(e) => setForm({ ...form, land_area: Number(e.target.value) })}
              className="w-full px-3.5 py-2 rounded-xl border border-bk-gray-dark text-sm"
            />
          </div>

          <div className="sm:col-span-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-olive hover:bg-olive-deep text-bk-white font-semibold text-sm transition disabled:opacity-60"
            >
              {loading ? 'Creating Account...' : 'Register Land & Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
