import { Info } from 'lucide-react';

interface DemoDataBannerProps {
  show?: boolean;
}

export function DemoDataBanner({ show = true }: DemoDataBannerProps) {
  if (!show) return null;
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-bk-yellow/60 border border-bk-yellow-dark/40 text-bk-black text-xs font-medium">
      <Info className="w-4 h-4 shrink-0 text-olive-deep" />
      <span>
        <strong>DEMO &amp; LIVE HYBRID MODE:</strong> Historical records include seeded demonstration data for Nagarhole-Bandipur Corridor. Live camera, audio, and vibration feeds run real AI inference when connected.
      </span>
    </div>
  );
}
