import { useEffect, useRef, useState } from 'react';
import { Camera, Radio, ShieldAlert, ShieldCheck, Smartphone, Volume2 } from 'lucide-react';

interface Detection {
  species: string;
  confidence: number;
  alert_level: 'CRITICAL' | 'MONITOR';
  bbox: [number, number, number, number];
}

interface AlertState {
  species: string;
  confidence: number;
  alert_level: string;
  lora_trigger: boolean;
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [detections, setDetections] = useState<Detection[]>([]);
  const [alertState, setAlertState] = useState<AlertState>({
    species: 'NONE',
    confidence: 0,
    alert_level: 'CLEAR',
    lora_trigger: false,
  });

  // Start rear phone camera (or laptop webcam fallback)
  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err) {
      setCameraError('Camera access blocked. Ensure you opened the HTTPS link and allowed camera permission.');
    }
  };

  // Stream frames to FastAPI YOLOv8 every 450ms when camera is active
  useEffect(() => {
    if (!cameraActive) return;

    const interval = setInterval(async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== 4) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const formData = new FormData();
        formData.append('file', blob, 'frame.jpg');

        try {
          const res = await fetch('/api/detect-frame', { method: 'POST', body: formData });
          const data = await res.json();
          setDetections(data.detections || []);
        } catch {
          // Ignore transient frame drop
        }
      }, 'image/jpeg', 0.75);
    }, 450);

    return () => clearInterval(interval);
  }, [cameraActive]);

  // Poll backend for latest LoRa + Vision alert state (for Ranger Console view)
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch('/api/latest-alert');
        const data = await res.json();
        setAlertState(data);
      } catch {
        // Backend offline
      }
    }, 1000);
    return () => clearInterval(poll);
  }, []);

  // Trigger simulated LoRa acoustic/seismic wake-up for demo
  const simulateLoraTrigger = async () => {
    await fetch('/api/lora-trigger?node_id=NODE_01&event=SEISMIC_FOOTSTEP', { method: 'POST' });
  };

  const isCritical = alertState.alert_level === 'CRITICAL' || detections.some((d) => d.alert_level === 'CRITICAL');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-emerald-400">
              BHOOMI KAVALU <span className="text-slate-400 font-normal text-sm">| Wildlife Intrusion Mesh</span>
            </h1>
            <p className="text-xs text-slate-400">LoRa Acoustic-Seismic Wake-Up + Edge YOLOv8 Vision Verification</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={simulateLoraTrigger}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-medium hover:bg-amber-500/30 transition"
            >
              <Radio className="w-4 h-4" /> Test LoRa Wake-Up
            </button>
            {!cameraActive && (
              <button
                onClick={startCamera}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-sm hover:bg-emerald-400 transition"
              >
                <Camera className="w-4 h-4" /> Start Phone Camera
              </button>
            )}
          </div>
        </header>

        {/* Critical Banner */}
        <div
          className={`rounded-xl p-4 border flex items-center justify-between ${
            isCritical
              ? 'bg-red-950/60 border-red-500 text-red-200 animate-pulse'
              : 'bg-slate-900 border-slate-800 text-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            {isCritical ? (
              <ShieldAlert className="w-8 h-8 text-red-400 shrink-0" />
            ) : (
              <ShieldCheck className="w-8 h-8 text-emerald-400 shrink-0" />
            )}
            <div>
              <div className="text-xs uppercase tracking-wider opacity-75">Perimeter Status</div>
              <div className="text-lg font-bold">
                {isCritical
                  ? `CRITICAL INTRUSION: ${detections[0]?.species || alertState.species} DETECTED`
                  : 'PERIMETER CLEAR — STANDBY'}
              </div>
            </div>
          </div>
          <div className="text-right text-xs space-y-1">
            <div className="px-2 py-1 rounded bg-slate-800 font-mono">
              LoRa Node 01: {alertState.lora_trigger ? 'TRIGGERED' : 'LISTENING'}
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Live Camera Feed + Bounding Box Overlay */}
          <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden relative">
            <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" /> Field Optical Node (Phone Cam)
              </span>
              <span>{cameraActive ? 'LIVE • 2 FPS YOLOv8' : 'IDLE'}</span>
            </div>

            <div className="relative aspect-video bg-black flex items-center justify-center">
              <video ref={videoRef} playsInline muted className="w-full h-full object-contain" />
              <canvas ref={canvasRef} className="hidden" />

              {/* Bounding Boxes */}
              {videoRef.current &&
                detections.map((det, idx) => {
                  const vw = videoRef.current?.videoWidth || 640;
                  const vh = videoRef.current?.videoHeight || 480;
                  const [x1, y1, x2, y2] = det.bbox;
                  const left = `${(x1 / vw) * 100}%`;
                  const top = `${(y1 / vh) * 100}%`;
                  const width = `${((x2 - x1) / vw) * 100}%`;
                  const height = `${((y2 - y1) / vh) * 100}%`;

                  return (
                    <div
                      key={idx}
                      style={{ left, top, width, height }}
                      className={`absolute border-2 pointer-events-none ${
                        det.alert_level === 'CRITICAL' ? 'border-red-500 bg-red-500/10' : 'border-amber-400'
                      }`}
                    >
                      <span
                        className={`px-1.5 py-0.5 text-[11px] font-bold uppercase ${
                          det.alert_level === 'CRITICAL' ? 'bg-red-500 text-white' : 'bg-amber-400 text-slate-950'
                        }`}
                      >
                        {det.species} {Math.round(det.confidence * 100)}%
                      </span>
                    </div>
                  );
                })}

              {!cameraActive && (
                <div className="text-center p-6 space-y-3">
                  <p className="text-sm text-slate-400">
                    Open this page on your phone and tap <strong>Start Phone Camera</strong> to stream live wildlife
                    detection.
                  </p>
                  {cameraError && <p className="text-xs text-red-400">{cameraError}</p>}
                </div>
              )}
            </div>
          </div>

          {/* Telemetry & Detections Sidebar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-emerald-400" /> Active Detections
            </h2>

            {detections.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">No wildlife currently in frame.</p>
            ) : (
              <div className="space-y-2">
                {detections.map((d, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-sm text-white">{d.species}</div>
                      <div className="text-xs text-slate-400">Confidence: {(d.confidence * 100).toFixed(0)}%</div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-[10px] font-bold ${
                        d.alert_level === 'CRITICAL'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {d.alert_level}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}