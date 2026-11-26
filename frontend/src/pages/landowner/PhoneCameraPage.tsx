import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Camera, RefreshCw, Shield } from 'lucide-react';

/**
 * Smartphone-only camera transmitter.
 * Captures rear/front camera frames and streams them to the backend.
 * Intentionally displays NO AI detection results on the phone screen.
 *
 * Uses window.location.origin so the fetch goes through the same host the page
 * was loaded from (the laptop's LAN IP), which Vite proxies to the backend.
 */
export function PhoneCameraPage() {
  const { nodeCode = 'NODE_001' } = useParams();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [streaming, setStreaming] = useState(false);
  const [framesSent, setFramesSent] = useState(0);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Ready');

  const startStream = async (mode: 'environment' | 'user') => {
    setError('');
    setStatus('Requesting camera...');
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStreaming(true);
        setStatus('Streaming');
      }
    } catch (err) {
      setError(
        'Camera permission denied. Make sure you are on HTTPS and have granted camera access. ' +
        'If you see a certificate warning, tap Advanced → Proceed.'
      );
      setStatus('Error');
    }
  };

  useEffect(() => {
    if (!streaming) return;
    let active = true;

    const sendFrame = async () => {
      if (!active) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== 4) {
        if (active) setTimeout(sendFrame, 300);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(async (blob) => {
        if (!blob || !active) return;
        const fd = new FormData();
        fd.append('file', blob, 'phone_frame.jpg');
        try {
          // Use relative URL — Vite proxy on the same origin routes /api/* to the backend
          await fetch(`/api/detect/camera-frame?node_code=${encodeURIComponent(nodeCode)}`, {
            method: 'POST',
            body: fd,
          });
          if (active) {
            setFramesSent((c) => c + 1);
            setStatus('Streaming');
          }
        } catch {
          if (active) setStatus('Reconnecting...');
        }
        // Schedule next frame (adaptive rate ~1.5 fps)
        if (active) setTimeout(sendFrame, 650);
      }, 'image/jpeg', 0.70);
    };

    sendFrame();
    return () => { active = false; };
  }, [streaming, nodeCode]);

  const toggleCamera = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    if (streaming) startStream(next);
  };

  return (
    <div className="min-h-screen bg-[#151713] text-white flex flex-col justify-between p-4">
      <header className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#F3E9A4]" />
          <div>
            <p className="text-xs font-bold tracking-wider">BHOOMI KAVALU SENSOR</p>
            <p className="text-[11px] text-white/60 font-mono">{nodeCode}</p>
          </div>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
            streaming ? 'bg-[#687442] text-white' : 'bg-white/10 text-white/70'
          }`}
        >
          {streaming ? `STREAMING (${framesSent})` : 'STANDBY'}
        </span>
      </header>

      <div className="my-4 flex-1 flex flex-col items-center justify-center">
        <div className="w-full bg-black rounded-2xl overflow-hidden border border-white/10">
          <video ref={videoRef} playsInline muted className="w-full h-auto object-contain" />
          <canvas ref={canvasRef} className="hidden" />
        </div>
        <p className="mt-2 text-[11px] text-white/50 text-center">{status}</p>
      </div>

      {error && (
        <div className="mb-3 p-3 rounded-xl bg-red-900/30 border border-red-500/40">
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={() => startStream(facingMode)}
          className="flex-1 py-3 rounded-xl bg-[#687442] text-white font-semibold text-sm flex items-center justify-center gap-2"
        >
          <Camera className="w-4 h-4" /> {streaming ? 'Restart Feed' : 'Start Camera Feed'}
        </button>
        <button
          onClick={toggleCamera}
          className="px-4 py-3 rounded-xl bg-white/10 text-white text-xs font-semibold flex items-center gap-1.5"
        >
          <RefreshCw className="w-4 h-4" /> Flip
        </button>
      </div>

      <p className="mt-3 text-[10px] text-white/30 text-center">
        This device is a camera sensor only. AI analysis runs on the monitoring station.
      </p>
    </div>
  );
}
