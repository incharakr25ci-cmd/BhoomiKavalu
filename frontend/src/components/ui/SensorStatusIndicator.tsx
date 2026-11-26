interface SensorStatusIndicatorProps {
  label: string;
  active: boolean;
  detail?: string;
}

export function SensorStatusIndicator({ label, active, detail }: SensorStatusIndicatorProps) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-bk-gray/70 border border-bk-gray-dark/40">
      <div className="flex items-center gap-2.5">
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            active ? 'bg-olive animate-pulse' : 'bg-bk-gray-dark'
          }`}
        />
        <span className="text-sm font-medium text-bk-black">{label}</span>
      </div>
      <span className={`text-xs font-semibold ${active ? 'text-olive' : 'text-bk-black/50'}`}>
        {detail || (active ? 'Online' : 'Offline')}
      </span>
    </div>
  );
}
