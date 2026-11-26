import { useEffect, useRef, useState } from 'react';
import { Camera, Smartphone, QrCode, AlertTriangle, Copy, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { useWebSocket } from '../../hooks/useWebSocket';
import { formatConfidence, formatTime, getAnimalIcon } from '../../utils/formatters';

interface DetectionBox {
  species: string;
  confidence: number;
  alert_level: 'CRITICAL' | 'MONITOR' | 'CLEAR';
  bbox: [number, number, number, number];
  timestamp?: string;
  source?: string;
  node_code?: string;
}

export function CameraDetection() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phoneImgRef = useRef<HTMLImageElement | null>(null);
  const isProcessingRef = useRef(false);
  const [nodeCode, setNodeCode] = useState('NODE_001');
  const [nodes, setNodes] = useState<any[]>([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [phoneStreaming, setPhoneStreaming] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [detections, setDetections] = useState<DetectionBox[]>([]);
  const [detectionHistory, setDetectionHistory] = useState<DetectionBox[]>([]);
  const [cameraError, setCameraError] = useState('');
  const [lanHost, setLanHost] = useState(window.location.host);
  const [frameDimensions, setFrameDimensions] = useState({ w: 640, h: 480 });
  const { lastMessage } = useWebSocket(nodeCode);

  const phoneUrl = `${window.location.protocol}//${lanHost}/phone-cam/${nodeCode}`;

  useEffect(() => {
    api.getNodes().then((n) => {
      setNodes(n);
      if (n.length > 0) setNodeCode(n[0].node_id);
    });
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      fetch('/api/network-info')
        .then((r) => r.json())
        .then((d) => {
          if (d?.lan_ip && d.lan_ip !== '127.0.0.1') {
            const port = window.location.port ? `:${window.location.port}` : '';
            setLanHost(`${d.lan_ip}${port}`);
          }
        })
        .catch(() => {});
    }
  }, []);

  // Receive live detections AND video frames from a connected smartphone over WebSocket
  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === 'camera_frame' && lastMessage.frame) {
      // Show the live phone video frame on the dashboard
      const src = `data:image/jpeg;base64,${lastMessage.frame}`;
      if (phoneImgRef.current) {
        phoneImgRef.current.src = src;
      }
      setPhoneStreaming(true);
      setFrameDimensions({
        w: lastMessage.frame_width || 640,
        h: lastMessage.frame_height || 480,
      });
      // Overlay detections from the same message
      if (lastMessage.detections && lastMessage.detections.length > 0) {
        const dets = lastMessage.detections as DetectionBox[];
        setDetections(dets);
        setDetectionHistory((prev) => [...dets, ...prev].slice(0, 30));
      } else {
        setDetections([]);
      }
    } else if (lastMessage.type === 'camera_detection' && lastMessage.data) {
      const det = lastMessage.data as DetectionBox;
      setDetections([det]);
      setDetectionHistory((prev) => [det, ...prev].slice(0, 30));
    }
  }, [lastMessage]);

  const startLocalCamera = async () => {
    setCameraError('');
    setPhoneStreaming(false);
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
    } catch {
      setCameraError('Camera access blocked. Allow camera permissions or connect a smartphone via QR.');
    }
  };

  const stopLocalCamera = () => {
    isProcessingRef.current = false;
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Local camera: capture frames and send to backend for detection
  useEffect(() => {
    if (!cameraActive) {
      isProcessingRef.current = false;
      return;
    }
    const interval = setInterval(() => {
      // Prevent overlapping backend requests
      if (isProcessingRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== 4) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      isProcessingRef.current = true;

      canvas.toBlob(async (blob) => {
        if (!blob) {
          isProcessingRef.current = false;
          return;
        }
        const fd = new FormData();
        fd.append('file', blob, 'frame.jpg');
        try {
          const res = await api.detectCameraFrame(fd, nodeCode);
          const dets: DetectionBox[] = res.detections || [];
          setDetections(dets);
          if (dets.length > 0) {
            setDetectionHistory((prev) => [...dets, ...prev].slice(0, 30));
          }
        } catch {
          // ignore transient frame error
        } finally {
          isProcessingRef.current = false;
        }
      }, 'image/jpeg', 0.75);
    }, 550);

    return () => {
      clearInterval(interval);
      isProcessingRef.current = false;
    };
  }, [cameraActive, nodeCode]);

  const copyUrl = () => {
    navigator.clipboard.writeText(phoneUrl);
    setCopied(true);
    toast.success('Phone camera URL copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const latest = detectionHistory[0];
  const isLive = cameraActive || phoneStreaming;

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="bg-bk-white rounded-xl p-4 border border-bk-gray-dark/50 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-bk-black/70">Camera Node:</span>
          <select
            value={nodeCode}
            onChange={(e) => setNodeCode(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-bk-gray-dark text-xs font-mono bg-bk-white"
          >
            {nodes.length > 0 ? (
              nodes.map((n) => (
                <option key={n.id} value={n.node_id}>
                  {n.node_id}
                </option>
              ))
            ) : (
              <option value="NODE_001">NODE_001</option>
            )}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowQrModal((v) => !v)}
            className="px-4 py-2 rounded-xl bg-olive text-bk-white text-xs font-semibold flex items-center gap-2 hover:bg-olive-deep transition"
          >
            <Smartphone className="w-4 h-4" /> Connect Phone Camera
          </button>
          {!cameraActive ? (
            <button
              onClick={startLocalCamera}
              className="px-4 py-2 rounded-xl border border-olive text-olive text-xs font-semibold flex items-center gap-2 hover:bg-olive/10 transition"
            >
              <Camera className="w-4 h-4" /> Use Local Camera
            </button>
          ) : (
            <button
              onClick={stopLocalCamera}
              className="px-4 py-2 rounded-xl bg-bk-danger text-white text-xs font-semibold"
            >
              Stop Camera
            </button>
          )}
        </div>
      </div>

      {/* QR Code Phone Pairing Panel */}
      {showQrModal && (
        <div className="bg-bk-white rounded-xl p-5 border border-olive/40 shadow-sm flex flex-col md:flex-row items-center gap-6">
          <div className="p-3 bg-white rounded-xl border border-bk-gray-dark/40">
            <QRCodeSVG value={phoneUrl} size={140} fgColor="#151713" />
          </div>
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2 text-sm font-bold text-bk-black">
              <QrCode className="w-4 h-4 text-olive" /> Smartphone Camera Sensor Link
            </div>
            <p className="text-xs text-bk-black/70">
              Scan this QR code or open the URL on your smartphone (must be on the same Wi-Fi). Accept the HTTPS certificate warning on your phone if prompted.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={lanHost}
                onChange={(e) => setLanHost(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-bk-gray-dark text-xs font-mono w-44"
                title="Laptop LAN IP:Port"
              />
              <code className="px-3 py-1.5 rounded-lg bg-bk-gray text-xs font-mono break-all flex-1">
                {phoneUrl}
              </code>
              <button
                onClick={copyUrl}
                className="px-3 py-1.5 rounded-lg bg-olive text-white text-xs font-semibold flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video Feed + Bounding Boxes */}
        <div className="lg:col-span-2 bg-bk-white rounded-xl border border-bk-gray-dark/50 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-bk-gray-dark/40 flex items-center justify-between">
            <span className="text-xs font-bold text-bk-black">Live YOLOv8 Vision Feed</span>
            <div className="flex items-center gap-2">
              {phoneStreaming && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-olive/20 text-olive">
                  📱 PHONE
                </span>
              )}
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  isLive ? 'bg-olive text-white animate-pulse' : 'bg-bk-yellow text-bk-black'
                }`}
              >
                {isLive ? '● LIVE' : 'DISCONNECTED'}
              </span>
            </div>
          </div>

          <div className="relative aspect-video bg-bk-black flex items-center justify-center">
            {/* Local camera video element */}
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-contain ${phoneStreaming && !cameraActive ? 'hidden' : ''}`}
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Phone camera live feed (displayed as streaming images) */}
            <img
              ref={phoneImgRef}
              alt=""
              className={`w-full h-full object-contain ${phoneStreaming && !cameraActive ? '' : 'hidden'}`}
            />

            {/* Bounding box overlays */}
            {isLive &&
              detections.map((det, idx) => {
                const vw = cameraActive
                  ? videoRef.current?.videoWidth || 640
                  : frameDimensions.w;
                const vh = cameraActive
                  ? videoRef.current?.videoHeight || 480
                  : frameDimensions.h;
                const [x1, y1, x2, y2] = det.bbox;
                return (
                  <div
                    key={idx}
                    style={{
                      left: `${(x1 / vw) * 100}%`,
                      top: `${(y1 / vh) * 100}%`,
                      width: `${((x2 - x1) / vw) * 100}%`,
                      height: `${((y2 - y1) / vh) * 100}%`,
                    }}
                    className={`absolute border-2 pointer-events-none ${
                      det.alert_level === 'CRITICAL' ? 'border-bk-danger' : 'border-bk-yellow'
                    }`}
                  >
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        det.alert_level === 'CRITICAL'
                          ? 'bg-bk-danger text-white'
                          : 'bg-bk-yellow text-bk-black'
                      }`}
                    >
                      {det.species} {Math.round(det.confidence * 100)}%
                    </span>
                  </div>
                );
              })}

            {!isLive && (
              <div className="text-center p-6 space-y-2">
                <AlertTriangle className="w-8 h-8 text-bk-yellow mx-auto" />
                <p className="text-xs text-white/80">
                  Camera disconnected. Pair a smartphone via <strong>Connect Phone Camera</strong> or start a local camera.
                </p>
                {cameraError && <p className="text-xs text-bk-danger">{cameraError}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel Telemetry */}
        <div className="space-y-4">
          <div className="bg-bk-white rounded-xl p-4 border border-bk-gray-dark/50 shadow-sm space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-bk-black/60">
              Camera Node Status
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-bk-gray/60">
                <p className="text-bk-black/55">Node ID</p>
                <p className="font-mono font-bold mt-0.5">{nodeCode}</p>
              </div>
              <div className="p-3 rounded-lg bg-bk-gray/60">
                <p className="text-bk-black/55">Detections</p>
                <p className="font-bold mt-0.5">{detectionHistory.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-bk-gray/60">
                <p className="text-bk-black/55">Latest Species</p>
                <p className="font-bold mt-0.5">{latest?.species || 'None'}</p>
              </div>
              <div className="p-3 rounded-lg bg-bk-gray/60">
                <p className="text-bk-black/55">Confidence</p>
                <p className="font-bold mt-0.5">
                  {latest ? formatConfidence(latest.confidence) : '—'}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-bk-gray/60 col-span-2">
                <p className="text-bk-black/55">Source</p>
                <p className="font-bold mt-0.5">
                  {phoneStreaming ? '📱 Smartphone Camera' : cameraActive ? '💻 Local Camera' : '—'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-bk-white rounded-xl p-4 border border-bk-gray-dark/50 shadow-sm">
            <h4 className="text-xs font-bold uppercase tracking-wider text-bk-black/60 mb-3">
              Recent Frame Detections
            </h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {detectionHistory.length === 0 ? (
                <p className="text-xs text-bk-black/50 text-center py-6">
                  Waiting for wildlife detections...
                </p>
              ) : (
                detectionHistory.map((d, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg bg-bk-gray/50 border border-bk-gray-dark/40 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{getAnimalIcon(d.species)}</span>
                      <div>
                        <p className="font-bold text-bk-black uppercase">{d.species}</p>
                        <p className="text-[11px] text-bk-black/55">
                          {d.timestamp ? formatTime(d.timestamp) : 'Live'}
                          {d.source && ` • ${d.source === 'wild_boar_specialized_model' ? 'Boar Model' : 'Multi-Animal'}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-olive">
                        {formatConfidence(d.confidence)}
                      </span>
                      <p
                        className={`text-[10px] font-bold ${
                          d.alert_level === 'CRITICAL' ? 'text-bk-danger' : 'text-bk-yellow-dark'
                        }`}
                      >
                        {d.alert_level}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
