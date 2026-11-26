import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Upload, Volume2, Sparkles, CheckCircle2, Cpu, Wifi, Database } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { useWebSocket } from '../../hooks/useWebSocket';
import { formatConfidence, formatTime } from '../../utils/formatters';

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function resampleAudio(
  samples: Float32Array,
  sourceRate: number,
  targetRate: number
): Float32Array {
  if (sourceRate === targetRate || !sourceRate || !targetRate) return samples;

  const outputLength = Math.floor((samples.length * targetRate) / sourceRate);
  const output = new Float32Array(outputLength);
  const ratio = sourceRate / targetRate;

  for (let i = 0; i < outputLength; i++) {
    const position = i * ratio;
    const index = Math.floor(position);
    const fraction = position - index;

    const a = samples[index] || 0;
    const b = samples[Math.min(index + 1, samples.length - 1)] || 0;

    output[i] = a + (b - a) * fraction;
  }

  return output;
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export function AudioDetection() {
  const [listening, setListening] = useState(false);
  const nodeCode = 'NODE_001';
  const [latestResult, setLatestResult] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<string>('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const scriptProcRef = useRef<ScriptProcessorNode | null>(null);
  const sampleBufferRef = useRef<Float32Array[]>([]);
  const dispatchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendingRef = useRef(false);

  const { lastMessage } = useWebSocket(nodeCode);

  useEffect(() => {
    api.getDetectionHistory({ sensor_type: 'audio', limit: 15 }).then(setHistory).catch(() => {});
  }, []);

  // Listen for real-time audio detections via WebSocket
  useEffect(() => {
    if (lastMessage?.type === 'audio_detection' && lastMessage.data) {
      setLatestResult(lastMessage.data);
      setLastCheckTime(new Date().toLocaleTimeString());
      if (lastMessage.data.species && lastMessage.data.species !== 'Ambient / Quiet') {
        setHistory((prev) => [
          {
            id: `aud-live-${Date.now()}`,
            source: 'audio',
            node_id: lastMessage.node_id || nodeCode,
            species: lastMessage.data.species,
            confidence: lastMessage.data.confidence,
            timestamp: new Date().toISOString(),
          },
          ...prev,
        ].slice(0, 30));
      }
    }
  }, [lastMessage]);

  const sendBufferedAudio = async () => {
    // Guard against overlapping requests
    if (sendingRef.current) return;

    const buffers = sampleBufferRef.current;
    sampleBufferRef.current = [];
    if (!buffers || buffers.length === 0) return;

    let totalLen = 0;
    for (const b of buffers) totalLen += b.length;
    if (totalLen < 8000) return; // ignore tiny buffers (< ~0.4s)

    const merged = new Float32Array(totalLen);
    let offset = 0;
    for (const b of buffers) {
      merged.set(b, offset);
      offset += b.length;
    }

    const sourceRate = audioCtxRef.current?.sampleRate || 22050;
    const targetRate = 22050;

    const resampled = resampleAudio(merged, sourceRate, targetRate);

    const wavBlob = encodeWav(resampled, targetRate);
    const fd = new FormData();
    fd.append('file', wavBlob, 'live_mic.wav');

    sendingRef.current = true;
    try {
      setAnalyzing(true);
      const res = await api.detectLiveAudio(fd, nodeCode);
      console.log('[AudioAI] Backend response:', res);
      if (res) {
        const rawSpecies = res.species || res.animal || 'Ambient / Quiet';
        const isAmbient = !res.is_wildlife || rawSpecies === 'Ambient / Quiet' || rawSpecies === 'None' || rawSpecies === 'Unknown';
        const showSpecies = isAmbient ? 'Ambient / Quiet' : rawSpecies;

        setLatestResult({ ...res, species: showSpecies });
        setLastCheckTime(new Date().toLocaleTimeString());

        // Only add to history when we have a confirmed wildlife detection
        if (!isAmbient) {
          setHistory((prev) => [
            {
              id: `aud-live-${Date.now()}`,
              source: 'audio',
              node_id: res.node_id || nodeCode,
              species: showSpecies,
              confidence: res.confidence,
              timestamp: res.timestamp || new Date().toISOString(),
            },
            ...prev,
          ].slice(0, 30));
        }
      }
    } catch (err: any) {
      console.error('Audio detection request failed:', err);
    } finally {
      sendingRef.current = false;
      setAnalyzing(false);
    }
  };

  const startLiveMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;
      setListening(true);

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      // ScriptProcessor captures raw PCM Float32 samples
      const scriptProc = audioCtx.createScriptProcessor(4096, 1, 1);
      scriptProcRef.current = scriptProc;
      sampleBufferRef.current = [];

      scriptProc.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        sampleBufferRef.current.push(new Float32Array(inputData));
      };

      source.connect(scriptProc);
      scriptProc.connect(audioCtx.destination);

      // Waveform visualization
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        if (!canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;
        analyser.getByteTimeDomainData(dataArray);
        ctx.fillStyle = '#F3F4EF';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#687442';
        ctx.beginPath();
        const sliceWidth = canvasRef.current.width / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * canvasRef.current.height) / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.lineTo(canvasRef.current.width, canvasRef.current.height / 2);
        ctx.stroke();
        animRef.current = requestAnimationFrame(draw);
      };
      draw();

      // Dispatch 3-second audio slices every 3.5s
      dispatchTimerRef.current = setInterval(() => {
        sendBufferedAudio();
      }, 3500);

      toast.success('Microphone connected. AI monitoring active!');
    } catch {
      toast.error('Microphone permission denied. Allow microphone access.');
    }
  };

  const stopLiveMic = () => {
    if (dispatchTimerRef.current) {
      clearInterval(dispatchTimerRef.current);
      dispatchTimerRef.current = null;
    }
    if (scriptProcRef.current) {
      scriptProcRef.current.disconnect();
      scriptProcRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    sampleBufferRef.current = [];
    setListening(false);
    setAnalyzing(false);
  };

  useEffect(() => {
    return () => {
      stopLiveMic();
    };
  }, []);

  const handleTestUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.detectAudioUpload(fd, nodeCode);
      setLatestResult(res);
      setLastCheckTime(new Date().toLocaleTimeString());
      if (res?.is_wildlife && res.species && res.species !== 'Ambient / Quiet') {
        setHistory((prev) => [
          {
            id: `aud-up-${Date.now()}`,
            source: 'audio',
            node_id: res.node_id || nodeCode,
            species: res.species,
            confidence: res.confidence,
            timestamp: res.timestamp || new Date().toISOString(),
          },
          ...prev,
        ].slice(0, 30));
      }
      toast.success(`Analyzed: ${res.species} (${Math.round((res.confidence || 0) * 100)}%)`);
    } catch (err: any) {
      toast.error(err.message || 'Audio analysis failed');
    } finally {
      setUploading(false);
    }
  };

  // Only display the single highest-confidence animal and ignore others
  const probs =
    latestResult?.is_wildlife && latestResult?.probabilities
      ? Object.entries(latestResult.probabilities)
          .sort((a, b) => Number(b[1]) - Number(a[1]))
          .slice(0, 1)
      : [];

  return (
    <div className="space-y-6">
      {/* Live Microphone Status */}
      <div className="bg-bk-white rounded-xl p-5 border border-bk-gray-dark/50 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${listening ? 'bg-olive text-white' : 'bg-bk-gray text-bk-black'}`}>
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-bk-black">Live Acoustic Monitoring ({nodeCode})</h3>
              <p className="text-xs text-bk-black/60">
                2-Class Acoustic AI: 🐘 Asian Elephant • 🐅 Tiger • Real-Time Firebase Sync
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {analyzing && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-olive/20 text-olive animate-pulse">
                Analyzing sound...
              </span>
            )}
            {!listening ? (
              <button
                onClick={startLiveMic}
                className="px-4 py-2 rounded-xl bg-olive text-bk-white text-xs font-semibold flex items-center gap-2 hover:bg-olive-deep transition shadow-sm"
              >
                <Mic className="w-4 h-4" /> Start Live Audio
              </button>
            ) : (
              <button
                onClick={stopLiveMic}
                className="px-4 py-2 rounded-xl bg-bk-danger text-white text-xs font-semibold flex items-center gap-2"
              >
                <MicOff className="w-4 h-4" /> Stop Audio
              </button>
            )}
          </div>
        </div>

        <canvas
          ref={canvasRef}
          width={800}
          height={110}
          className="w-full h-28 rounded-xl border border-bk-gray-dark/40 bg-bk-gray"
        />

        {listening ? (
          <div className="flex items-center justify-between text-xs text-olive font-medium pt-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-olive animate-ping" />
              Microphone streaming: Continuous 3.5s real-time AI classification active
            </span>
            {lastCheckTime && (
              <span className="text-bk-black/50">Last inference: {lastCheckTime}</span>
            )}
          </div>
        ) : (
          <p className="text-xs text-bk-black/55">
            Microphone is currently in standby. Click <strong>Start Live Audio</strong> to stream laptop microphone, or receive live audio frames from the <strong>ESP32 + INMP441</strong> hardware node.
          </p>
        )}

        {/* ESP32 Hardware & Firebase Realtime Telemetry Strip */}
        <div className="pt-2 border-t border-bk-gray-dark/30 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-bk-gray/50">
            <Cpu className="w-4 h-4 text-olive shrink-0" />
            <div>
              <p className="text-[10px] text-bk-black/50 font-medium">ESP32 Device</p>
              <p className="font-bold text-bk-black flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                HTTP Node 1
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-bk-gray/50">
            <Volume2 className="w-4 h-4 text-olive shrink-0" />
            <div>
              <p className="text-[10px] text-bk-black/50 font-medium">Microphone</p>
              <p className="font-bold text-bk-black">INMP441 I2S</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-bk-gray/50">
            <Database className="w-4 h-4 text-olive shrink-0" />
            <div>
              <p className="text-[10px] text-bk-black/50 font-medium">Cloud Database</p>
              <p className="font-bold text-bk-black">Firebase RTDB</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-bk-gray/50">
            <Wifi className="w-4 h-4 text-olive shrink-0" />
            <div>
              <p className="text-[10px] text-bk-black/50 font-medium">Sound Status</p>
              <p className={`font-bold ${latestResult?.status === 'ANIMAL_DETECTED' ? 'text-bk-danger' : 'text-olive'}`}>
                {latestResult?.status || 'MONITORING'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Classification Results + Upload & Quick Tests */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Real-time Result Card */}
        <div className="bg-bk-white rounded-xl p-5 border border-bk-gray-dark/50 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-bk-black">Real-Time Classification Result</h4>
            {latestResult && (
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                latestResult.is_wildlife ? 'bg-bk-danger-light text-bk-danger' : 'bg-olive/10 text-olive'
              }`}>
                {latestResult.is_wildlife ? '⚠️ WILDLIFE ALERT' : 'NORMAL'}
              </span>
            )}
          </div>

          {latestResult ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-bk-gray/60 flex items-center justify-between">
                <div>
                  <p className="text-xs text-bk-black/55">Detected Species</p>
                  <p className="text-xl font-bold text-bk-black flex items-center gap-2">
                    {latestResult.species}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-bk-black/55">Confidence</p>
                  <p className="text-xl font-bold text-olive">
                    {formatConfidence(latestResult.confidence)}
                  </p>
                </div>
              </div>

              {/* Status explanation */}
              <div className="p-3 rounded-lg text-xs bg-bk-gray/40 border border-bk-gray-dark/30">
                {latestResult.species === 'Ambient / Quiet' ? (
                  <p className="text-bk-black/70">
                    🌿 <strong>Ambient Sound:</strong> No significant animal call detected. The environment is quiet.
                  </p>
                ) : latestResult.is_wildlife ? (
                  <p className="text-bk-danger font-semibold">
                    🚨 <strong>Wildlife Call Detected:</strong> Acoustic signature matches {latestResult.species} with {formatConfidence(latestResult.confidence)} confidence.
                  </p>
                ) : (
                  <p className="text-bk-black/70">
                    ℹ️ Low-level acoustic activity detected. Monitoring for confirmed calls.
                  </p>
                )}
              </div>

              {probs.length > 0 && (
                <div className="space-y-2.5 pt-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-bk-black/60">
                    Model Class Probabilities
                  </p>
                  {probs.map(([cls, prob]) => {
                    const pct = Math.round(Number(prob) * 100);
                    const isTop = cls.toLowerCase().includes(latestResult.species.toLowerCase().split(' ')[0]);
                    return (
                      <div key={cls} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium">
                          <span className={isTop ? 'font-bold text-bk-black' : 'text-bk-black/70'}>
                            {cls === 'Elephant' ? '🐘 Asian Elephant' : cls === 'Tiger' ? '🐅 Tiger' : cls.toLowerCase().includes('boar') || cls.toLowerCase().includes('pig') ? '🐗 Wild Boar' : `🐾 ${cls}`}
                          </span>
                          <span className={isTop ? 'font-bold text-olive' : 'text-bk-black/60'}>
                            {(Number(prob) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-bk-gray overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${isTop ? 'bg-olive' : 'bg-bk-yellow-dark/60'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center space-y-2 text-bk-black/55">
              <Volume2 className="w-8 h-8 text-bk-black/30 mx-auto" />
              <p className="text-xs">No audio classification received yet.</p>
              <p className="text-[11px] text-bk-black/45">Click <strong>Start Live Audio</strong> to stream microphone sound to the AI model.</p>
            </div>
          )}
        </div>

        {/* Testing & Upload Card */}
        <div className="bg-bk-white rounded-xl p-5 border border-bk-gray-dark/50 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-bk-black">Audio Verification & File Upload</h4>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-bk-yellow text-bk-black">
              TESTING TOOL
            </span>
          </div>

          <p className="text-xs text-bk-black/65">
            Test the Mel-spectrogram RandomForest classifier by uploading any `.wav`, `.mp3` sample or speaking/playing an animal roar.
          </p>

          <label className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-bk-gray-dark hover:border-olive cursor-pointer transition bg-bk-gray/30">
            <Upload className="w-6 h-6 text-olive mb-2" />
            <span className="text-xs font-semibold text-bk-black">
              {uploading ? 'Analyzing audio sample...' : 'Click to upload audio file (.wav / .mp3 / .mpeg)'}
            </span>
            <input
              type="file"
              accept="audio/*,.mpeg,.mpg,.mp3,.wav,.ogg,.flac,.m4a"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleTestUpload(file);
                e.target.value = '';
              }}
            />
          </label>

          <div className="pt-2 border-t border-bk-gray-dark/30 space-y-2">
            <p className="text-xs font-bold text-bk-black/70 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-olive" /> How Live Audio Works:
            </p>
            <ul className="text-[11px] text-bk-black/60 space-y-1 pl-4 list-disc">
              <li>Microphone records continuous 3.5s acoustic slices.</li>
              <li>Slices are encoded to 22.05 kHz uncompressed PCM WAV.</li>
              <li>Backend computes Mel-spectrogram power features.</li>
              <li>RandomForest classifies across Elephant, Tiger, and Leopard.</li>
              <li>Results stream back in real time via WebSockets.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Audio History */}
      <div className="bg-bk-white rounded-xl p-5 border border-bk-gray-dark/50 shadow-sm">
        <h4 className="text-sm font-bold text-bk-black mb-3">Audio Detection History</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-bk-gray-dark/50 text-bk-black/60 uppercase">
                <th className="py-2 px-3">Species</th>
                <th className="py-2 px-3">Node</th>
                <th className="py-2 px-3">Confidence</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bk-gray-dark/30">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-bk-black/50">
                    No audio detections logged yet.
                  </td>
                </tr>
              ) : (
                history.map((h, i) => (
                  <tr key={h.id || i}>
                    <td className="py-2.5 px-3 font-semibold text-bk-black">{h.species}</td>
                    <td className="py-2.5 px-3 font-mono">{h.node_id || nodeCode}</td>
                    <td className="py-2.5 px-3 font-medium text-olive">{formatConfidence(h.confidence)}</td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-bk-black/75">
                        <CheckCircle2 className="w-3 h-3 text-olive" /> Logged
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-bk-black/60">{formatTime(h.timestamp)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
