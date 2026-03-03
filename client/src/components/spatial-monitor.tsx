import { useRef, useEffect, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { Play, Pause, SkipBack, SkipForward, Upload } from 'lucide-react';

const CANVAS_W = 540;
const CANVAS_H = 960;

interface SpatialMonitorProps {
  onRequestImport?: () => void;
}

export default function SpatialMonitor({ onRequestImport }: SpatialMonitorProps) {
  const {
    videoUrl, videoRef, layers, isPlaying, currentTime, videoDuration,
    activeLayerId,
    setIsPlaying, setCurrentTime, setVideoDuration, setVideoFile,
  } = useStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const isDraggingRef = useRef(false);
  const lastTimeUpdateRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const panNodeRef = useRef<StereoPannerNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  useEffect(() => {
    if (!videoRef.current || !videoUrl) return;
    videoRef.current.src = videoUrl;
    videoRef.current.load();
  }, [videoUrl, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;
    if (sourceNodeRef.current) return;

    const ctx = new AudioContext();
    const source = ctx.createMediaElementSource(video);
    const gain = ctx.createGain();
    const pan = new StereoPannerNode(ctx, { pan: 0 });

    source.connect(gain).connect(pan).connect(ctx.destination);

    audioCtxRef.current = ctx;
    sourceNodeRef.current = source;
    gainNodeRef.current = gain;
    panNodeRef.current = pan;

    return () => {
      ctx.close();
      audioCtxRef.current = null;
      sourceNodeRef.current = null;
      gainNodeRef.current = null;
      panNodeRef.current = null;
    };
  }, [videoUrl, videoRef]);

  const activeLayer = layers.find(l => l.id === activeLayerId);

  useEffect(() => {
    if (!activeLayer) return;
    const audio = activeLayer.audio;

    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = audio.muted ? 0 : audio.gain / 100;
    }
    if (panNodeRef.current) {
      panNodeRef.current.pan.value = audio.pan / 100;
    }
  }, [activeLayer?.audio.gain, activeLayer?.audio.muted, activeLayer?.audio.pan, activeLayer?.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      video.play().catch(() => setIsPlaying(false));
    } else {
      video.pause();
    }
  }, [isPlaying, videoRef, setIsPlaying]);

  const renderFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      rafRef.current = requestAnimationFrame(renderFrame);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#0c0c10';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (video.readyState >= 2) {
      const vw = video.videoWidth || 1920;
      const vh = video.videoHeight || 1080;

      const visibleLayers = layers.filter(l => l.visible);

      for (const layer of visibleLayers) {
        ctx.save();
        ctx.globalAlpha = layer.opacity / 100;

        const sx = (layer.source.x / 100) * vw;
        const sy = (layer.source.y / 100) * vh;
        const sw = (layer.source.w / 100) * vw;
        const sh = (layer.source.h / 100) * vh;

        if (layer.type === 'background') {
          ctx.filter = 'blur(12px) brightness(0.35)';
          const scale = layer.target.scale / 100;
          const drawW = CANVAS_W * scale;
          const drawH = CANVAS_H * scale;
          const offsetX = (CANVAS_W - drawW) / 2;
          const offsetY = (CANVAS_H - drawH) / 2;
          ctx.drawImage(video, sx, sy, sw, sh, offsetX, offsetY, drawW, drawH);
          ctx.filter = 'none';
        } else {
          const targetX = (layer.target.x / 100) * CANVAS_W;
          const targetY = (layer.target.y / 100) * CANVAS_H;
          const scale = layer.target.scale / 100;

          const aspectRatio = sw / (sh || 1);
          let drawW = CANVAS_W * scale;
          let drawH = drawW / aspectRatio;

          if (layer.shape === 'circle') {
            const diameter = Math.min(drawW, drawH);
            drawW = diameter;
            drawH = diameter;
            ctx.beginPath();
            ctx.arc(targetX + diameter / 2, targetY + diameter / 2, diameter / 2, 0, Math.PI * 2);
            ctx.clip();
          } else if (layer.shape === 'rounded') {
            ctx.beginPath();
            const r = Math.min(drawW, drawH) * 0.08;
            ctx.roundRect(targetX, targetY, drawW, drawH, r);
            ctx.clip();
          }

          if (layer.target.rotation !== 0) {
            const cx = targetX + drawW / 2;
            const cy = targetY + drawH / 2;
            ctx.translate(cx, cy);
            ctx.rotate((layer.target.rotation * Math.PI) / 180);
            ctx.translate(-cx, -cy);
          }

          ctx.drawImage(video, sx, sy, sw, sh, targetX, targetY, drawW, drawH);
        }

        ctx.restore();
      }

      if (!isDraggingRef.current) {
        const now = performance.now();
        if (now - lastTimeUpdateRef.current > 250) {
          setCurrentTime(video.currentTime);
          lastTimeUpdateRef.current = now;
        }
      }
    }

    rafRef.current = requestAnimationFrame(renderFrame);
  }, [layers, videoRef, setCurrentTime]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [renderFrame]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const f = Math.floor((seconds % 1) * 30);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) videoRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const togglePlay = () => {
    if (!videoUrl) return;
    setIsPlaying(!isPlaying);
  };

  const skip = (delta: number) => {
    if (!videoRef.current) return;
    const t = Math.max(0, Math.min(videoDuration, videoRef.current.currentTime + delta));
    videoRef.current.currentTime = t;
    setCurrentTime(t);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
    }
  };

  const seekProgress = videoDuration > 0 ? (currentTime / videoDuration) * 100 : 0;

  return (
    <div
      className="flex flex-col items-center h-full justify-center py-2 px-2 md:py-3"
      data-testid="spatial-monitor"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <video
        ref={videoRef}
        className="hidden"
        crossOrigin="anonymous"
        playsInline
        onLoadedMetadata={() => {
          if (videoRef.current) setVideoDuration(videoRef.current.duration);
        }}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="relative flex-1 flex items-center justify-center min-h-0 w-full">
        <div className="relative h-full flex items-center justify-center">
          <div
            className="relative rounded-2xl md:rounded-[28px] border-2 border-white/[0.08] bg-black"
            style={{
              aspectRatio: '9/16',
              height: '100%',
              maxHeight: 520,
              boxShadow: '0 0 40px rgba(0,0,0,0.5), 0 0 80px rgba(190,242,100,0.03)',
            }}
          >
            <div className="rounded-[14px] md:rounded-[26px] overflow-hidden w-full h-full">
              <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                className="w-full h-full"
                data-testid="canvas-preview"
              />
            </div>

            {isPlaying && (
              <div className="absolute top-2 right-2 flex items-center gap-1 pointer-events-none">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[8px] font-mono text-red-400/80 tracking-wider">LIVE</span>
              </div>
            )}

            {!videoUrl && (
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-[14px] md:rounded-[26px]">
                <div
                  className="w-12 h-12 md:w-16 md:h-16 rounded-xl flex items-center justify-center mb-3"
                  style={{ backgroundColor: 'rgba(190,242,100,0.06)', border: '1px dashed rgba(190,242,100,0.15)' }}
                >
                  <Upload className="w-5 h-5 md:w-6 md:h-6" style={{ color: 'rgba(190,242,100,0.4)' }} />
                </div>
                <p className="text-[10px] md:text-xs font-mono tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  DROP VOD HERE
                </p>
                <p className="text-[9px] font-mono mt-1" style={{ color: 'rgba(255,255,255,0.12)' }}>
                  or use Import button
                </p>
                {onRequestImport && (
                  <button
                    className="mt-3 flex items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-wider transition-colors"
                    style={{ color: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                    onClick={onRequestImport}
                    data-testid="button-monitor-import"
                  >
                    <Upload className="w-3 h-3" />
                    Select File
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="w-full shrink-0 mt-1" style={{ maxWidth: 340 }}>
        <div className="relative mb-1">
          <input
            type="range"
            min={0}
            max={videoDuration || 1}
            step={0.033}
            value={currentTime}
            onChange={handleSeek}
            onMouseDown={() => { isDraggingRef.current = true; }}
            onMouseUp={() => { isDraggingRef.current = false; }}
            onTouchStart={() => { isDraggingRef.current = true; }}
            onTouchEnd={() => { isDraggingRef.current = false; }}
            className="neon-slider w-full"
            style={{
              background: `linear-gradient(to right, #bef264 0%, #bef264 ${seekProgress}%, rgba(255,255,255,0.06) ${seekProgress}%, rgba(255,255,255,0.06) 100%)`,
            }}
            data-testid="seek-bar"
          />
        </div>

        <div className="flex items-center justify-between">
          <span
            className="text-[9px] font-mono tabular-nums"
            style={{ color: 'rgba(190,242,100,0.6)' }}
            data-testid="text-current-time"
          >
            {formatTime(currentTime)}
          </span>

          <div className="flex items-center gap-0">
            <button
              className="w-7 h-7 flex items-center justify-center rounded transition-colors"
              onClick={() => skip(-5)}
              data-testid="button-skip-back"
            >
              <SkipBack className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.5)' }} />
            </button>
            <button
              className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
              onClick={togglePlay}
              data-testid="button-play-pause"
            >
              {isPlaying
                ? <Pause className="w-3.5 h-3.5 text-white" />
                : <Play className="w-3.5 h-3.5 text-white ml-0.5" />
              }
            </button>
            <button
              className="w-7 h-7 flex items-center justify-center rounded transition-colors"
              onClick={() => skip(5)}
              data-testid="button-skip-forward"
            >
              <SkipForward className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.5)' }} />
            </button>
          </div>

          <span
            className="text-[9px] font-mono tabular-nums"
            style={{ color: 'rgba(255,255,255,0.25)' }}
            data-testid="text-duration"
          >
            {formatTime(videoDuration)}
          </span>
        </div>
      </div>
    </div>
  );
}
