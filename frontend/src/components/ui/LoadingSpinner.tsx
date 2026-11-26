export function LoadingSpinner({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <div className="w-8 h-8 border-3 border-olive/25 border-t-olive rounded-full animate-spin" />
      <span className="text-xs font-medium text-bk-black/60">{label}</span>
    </div>
  );
}
