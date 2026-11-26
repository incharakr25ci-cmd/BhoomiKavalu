import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
  color?: 'olive' | 'yellow' | 'red' | 'default';
}

const COLOR_MAP = {
  olive: 'bg-olive/10 text-olive',
  yellow: 'bg-bk-yellow/60 text-bk-black',
  red: 'bg-bk-danger-light text-bk-danger',
  default: 'bg-bk-gray text-bk-black',
};

export function StatCard({ title, value, icon: Icon, subtitle, color = 'olive' }: StatCardProps) {
  return (
    <div className="bg-bk-white rounded-xl p-5 border border-bk-gray-dark/50 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-bk-black/55 truncate">
            {title}
          </p>
          <p className="mt-1.5 text-2xl font-bold text-bk-black truncate">{value}</p>
          {subtitle && (
            <p className="mt-1 text-xs text-bk-black/60 truncate">{subtitle}</p>
          )}
        </div>
        <div className={`p-2.5 rounded-lg shrink-0 ${COLOR_MAP[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
