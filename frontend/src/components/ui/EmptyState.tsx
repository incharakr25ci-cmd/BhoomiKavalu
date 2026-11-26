import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-bk-white rounded-xl border border-bk-gray-dark/50">
      <div className="p-3 rounded-full bg-bk-gray text-olive mb-3">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-semibold text-bk-black">{title}</h3>
      <p className="mt-1 text-xs text-bk-black/60 max-w-sm">{description}</p>
    </div>
  );
}
