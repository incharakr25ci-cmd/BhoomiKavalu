import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Trees, UserCheck, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

export function LoginPage() {
  const [selectedRole, setSelectedRole] = useState<'landowner' | 'forest_officer'>('landowner');
  const [email, setEmail] = useState('farmer1@bhoomi.in');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const handleRoleSwitch = (role: 'landowner' | 'forest_officer') => {
    setSelectedRole(role);
    setEmail(role === 'landowner' ? 'farmer1@bhoomi.in' : 'officer@bhoomi.in');
    setPassword('password123');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.login(email, password);
      if (res.user.role !== selectedRole) {
        toast.error(
          `This account is registered as a ${res.user.role.replace('_', ' ')}. Please use the matching login tab.`
        );
        setLoading(false);
        return;
      }
      setAuth(res.user, res.access_token);
      toast.success(`Welcome back, ${res.user.full_name}`);
      navigate(res.user.role === 'forest_officer' ? '/officer/overview' : '/landowner/overview');
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bk-gray flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-bk-white rounded-2xl shadow-lg border border-bk-gray-dark/60 overflow-hidden">
        {/* Top Brand Banner */}
        <div className="bg-olive-deep px-6 py-7 text-center text-bk-white">
          <div className="w-12 h-12 rounded-2xl bg-olive mx-auto flex items-center justify-center border border-bk-yellow/40 mb-3">
            <Shield className="w-6 h-6 text-bk-yellow" />
          </div>
          <h1 className="text-xl font-extrabold tracking-wider">BHOOMI KAVALU</h1>
          <p className="text-xs text-bk-yellow/90 mt-1">
            AI-Powered Multi-Animal Detection &amp; Early Warning System
          </p>
        </div>

        {/* Role Selector Tabs */}
        <div className="grid grid-cols-2 border-b border-bk-gray-dark/50 bg-bk-gray/60">
          <button
            type="button"
            onClick={() => handleRoleSwitch('landowner')}
            className={`py-3.5 text-xs font-semibold flex items-center justify-center gap-2 transition border-b-2 ${
              selectedRole === 'landowner'
                ? 'border-olive text-olive bg-bk-white'
                : 'border-transparent text-bk-black/60 hover:text-bk-black'
            }`}
          >
            <UserCheck className="w-4 h-4" /> Landowner Login
          </button>
          <button
            type="button"
            onClick={() => handleRoleSwitch('forest_officer')}
            className={`py-3.5 text-xs font-semibold flex items-center justify-center gap-2 transition border-b-2 ${
              selectedRole === 'forest_officer'
                ? 'border-olive text-olive bg-bk-white'
                : 'border-transparent text-bk-black/60 hover:text-bk-black'
            }`}
          >
            <Trees className="w-4 h-4" /> Forest Officer Login
          </button>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-bk-black/75 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-bk-gray-dark text-sm focus:outline-none focus:ring-2 focus:ring-olive"
              placeholder="you@bhoomi.in"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-bk-black/75 mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-bk-gray-dark text-sm focus:outline-none focus:ring-2 focus:ring-olive"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-olive hover:bg-olive-deep text-bk-white font-semibold text-sm flex items-center justify-center gap-2 transition disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign In'}
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="p-3 rounded-xl bg-bk-yellow/40 border border-bk-yellow-dark/40 text-[11px] text-bk-black/80">
            <strong>Demo Credentials:</strong>{' '}
            {selectedRole === 'landowner' ? 'farmer1@bhoomi.in' : 'officer@bhoomi.in'} /{' '}
            <code>password123</code>
          </div>

          {selectedRole === 'landowner' && (
            <p className="text-center text-xs text-bk-black/65 pt-1">
              New landowner?{' '}
              <Link to="/register" className="font-semibold text-olive hover:underline">
                Register your land
              </Link>
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
