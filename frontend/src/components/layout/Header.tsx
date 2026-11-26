import { Bell, Menu } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
  activeAlertCount?: number;
}

export function Header({ title, onMenuClick, activeAlertCount = 0 }: HeaderProps) {
  const { user } = useAuthStore();
  const alertsPath = user?.role === 'forest_officer' ? '/officer/alerts' : '/landowner/alerts';

  return (
    <header className="h-16 bg-bk-white border-b border-bk-gray-dark/50 px-4 md:px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-bk-black hover:bg-bk-gray"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold text-bk-black tracking-tight">{title}</h2>
      </div>

      <div className="flex items-center gap-4">
        <Link
          to={alertsPath}
          className="relative p-2 rounded-xl bg-bk-gray hover:bg-bk-yellow/40 text-bk-black transition"
        >
          <Bell className="w-5 h-5" />
          {activeAlertCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-bk-danger text-white text-[10px] font-bold flex items-center justify-center">
              {activeAlertCount}
            </span>
          )}
        </Link>

        <div className="hidden sm:flex items-center gap-2.5 pl-3 border-l border-bk-gray-dark/50">
          <div className="w-8 h-8 rounded-full bg-olive text-bk-white flex items-center justify-center text-xs font-bold">
            {(user?.full_name || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-bk-black leading-none">
              {user?.full_name}
            </p>
            <p className="text-[11px] text-bk-black/55 mt-0.5 capitalize">
              {user?.role?.replace('_', ' ')}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
