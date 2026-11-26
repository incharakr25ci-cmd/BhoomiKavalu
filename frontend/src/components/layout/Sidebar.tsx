import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  MapPin,
  Radio,
  Camera,
  Mic,
  Activity,
  BarChart3,
  Bell,
  Clock,
  Settings,
  Map,
  Users,
  FileText,
  LogOut,
  Shield,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const LANDOWNER_ITEMS = [
  { to: '/landowner/overview', label: 'Overview', icon: LayoutDashboard },
  { to: '/landowner/my-land', label: 'My Land', icon: MapPin },
  { to: '/landowner/live', label: 'Live Monitoring', icon: Radio },
  { to: '/landowner/camera', label: 'Camera Detection', icon: Camera },
  { to: '/landowner/audio', label: 'Audio Detection', icon: Mic },
  { to: '/landowner/vibration', label: 'Vibration Detection', icon: Activity },
  { to: '/landowner/analysis', label: 'Overall Analysis', icon: BarChart3 },
  { to: '/landowner/alerts', label: 'Alerts', icon: Bell },
  { to: '/landowner/history', label: 'Detection History', icon: Clock },
  { to: '/landowner/settings', label: 'Profile & Settings', icon: Settings },
];

const OFFICER_ITEMS = [
  { to: '/officer/overview', label: 'Regional Overview', icon: LayoutDashboard },
  { to: '/officer/lands', label: 'Land Management', icon: Map },
  { to: '/officer/map', label: 'Regional Map', icon: MapPin },
  { to: '/officer/live', label: 'Live Monitoring', icon: Radio },
  { to: '/officer/camera', label: 'Camera Monitoring', icon: Camera },
  { to: '/officer/audio', label: 'Audio Monitoring', icon: Mic },
  { to: '/officer/vibration', label: 'Vibration Monitoring', icon: Activity },
  { to: '/officer/analysis', label: 'Overall Analysis', icon: BarChart3 },
  { to: '/officer/alerts', label: 'Regional Alerts', icon: Bell },
  { to: '/officer/landowners', label: 'Landowners', icon: Users },
  { to: '/officer/history', label: 'Detection History', icon: Clock },
  { to: '/officer/reports', label: 'Reports', icon: FileText },
  { to: '/officer/settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const items = user?.role === 'forest_officer' ? OFFICER_ITEMS : LANDOWNER_ITEMS;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-bk-black/40 z-30 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-olive-deep text-bk-white flex flex-col transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Wordmark */}
        <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-olive flex items-center justify-center border border-bk-yellow/30">
              <Shield className="w-5 h-5 text-bk-yellow" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-wider text-bk-white">
                BHOOMI KAVALU
              </h1>
              <p className="text-[10px] uppercase tracking-widest text-bk-yellow/80">
                {user?.role === 'forest_officer' ? 'Forest Command' : 'Landowner Guard'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-white/70 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-hide">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-olive text-bk-white shadow-sm border border-bk-yellow/25'
                      : 'text-white/75 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="p-4 border-t border-white/10 bg-bk-black/20">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-bk-white truncate">
                {user?.full_name || 'User'}
              </p>
              <p className="text-[11px] text-white/60 truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="p-2 rounded-lg text-white/70 hover:text-bk-yellow hover:bg-white/10 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
