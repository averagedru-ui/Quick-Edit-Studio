import { useRef, useEffect, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { Play, Pause, SkipBack, SkipForward, Upload, Smartphone, Monitor } from 'lucide-react';

const VERT_W = 540;
const VERT_H = 960;
const HORZ_W = 960;
const HORZ_H = 540;

// Quality scale factors
const QUALITY_SCALE = { low: 0.5, med: 0.75, high: 1.0 };
// Frame skip: low renders every 2nd frame, med and high render every frame
const QUALITY_FRAME_SKIP = { low: 2, med: 1, high: 1 };

interface SpatialMonitorProps {
  onRequestImport?: () => void;
}

export default function SpatialMonitor({ onRequestImport }: SpatialMonitorProps) {
  const {
    videoUrl, videoRef, layers, isPlaying, currentTime, videoDuration,
    activeLayerId, previewMode, setPreviewMode, renderQuality, setRenderQuality,
    setIsPlaying, setCurrentTime, setVideoDuration, setVideoFile,
  } = useStore();

  const isVertical = previewMode === 'vertical';
  const CANVAS_W = isVertical ? VERT_W : HORZ_W;
  const CANVAS_H = isVertical ? VERT_H : HORZ_H;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const isDraggingRef = useRef(false);
  const lastTimeUpdateRef = useRef<number>(0);
  const gainNodeRef = useRef<GainNode | null>(null);
  const panNodeRef = useRef<StereoPannerNode | null>(null);
  // Reused offscreen canvas for blur — allocated once, never thrown away
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!videoRef.current || !videoUrl) return;
    videoRef.current.src = videoUrl;
    videoRef.current.load();
  }, [videoUrl, videoRef]);

  useEffect(() => {
    const video = videoRef.current as (HTMLVideoElement & { _cliprAudioCtx?: AudioContext; _cliprGain?: GainNode; _cliprPan?: StereoPannerNode }) | null;
    if (!video || !videoUrl) return;

    if (video._cliprAudioCtx) {
      gainNodeRef.current = video._cliprGain || null;
      panNodeRef.current = video._cliprPan || null;
      return;
    }

    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaElementSource(video);
      const gain = ctx.createGain();
      const pan = new StereoPannerNode(ctx, { pan: 0 });

      source.connect(gain).connect(pan).connect(ctx.destination);

      video._cliprAudioCtx = ctx;
      video._cliprGain = gain;
      video._cliprPan = pan;
      gainNodeRef.current = gain;
      panNodeRef.current = pan;
    } catch (e) {
      console.warn('Web Audio setup skipped:', e);
    }
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
    const video = videoRef.current as (HTMLVideoElement & { _cliprAudioCtx?: AudioContext }) | null;
    if (!video) return;
    if (isPlaying) {
      if (video._cliprAudioCtx?.state === 'suspended') {
        video._cliprAudioCtx.resume();
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

    // Frame skipping for low quality
    frameCountRef.current++;
    const skipCount = QUALITY_FRAME_SKIP[renderQuality];
    if (frameCountRef.current % skipCount !== 0) {
      rafRef.current = requestAnimationFrame(renderFrame);
      return;
    }

    // Quality-based canvas resolution
    const scale = QUALITY_SCALE[renderQuality];
    const cw = Math.round(CANVAS_W * scale);
    const ch = Math.round(CANVAS_H * scale);

    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = '#0c0c10';
    ctx.fillRect(0, 0, cw, ch);

    if (video.readyState >= 2) {
      const vw = video.videoWidth || 1920;
      const vh = video.videoHeight || 1080;
      const isHorz = !isVertical;

      const visibleLayers = layers.filter(l => l.visible);

      for (const layer of visibleLayers) {
        ctx.save();
        ctx.globalAlpha = layer.opacity / 100;

        let sx: number, sy: number, sw: number, sh: number;

        if (isHorz && layer.type === 'background') {
          sx = 0; sy = 0; sw = vw; sh = vh;
        } else {
          const zoom = (layer.source.zoom ?? 100) / 100;
          const baseW = (layer.source.w / 100) * vw;
          const baseH = (layer.source.h / 100) * vh;
          sw = baseW / zoom;
          sh = baseH / zoom;
          const baseSx = (layer.source.x / 100) * vw;
          const baseSy = (layer.source.y / 100) * vh;
          sx = baseSx + (baseW - sw) / 2;
          sy = baseSy + (baseH - sh) / 2;
        }

        if (layer.type === 'background') {
          const blurPx = layer.blur ?? 12;
          const brightness = 0.55;

          if (!bgCanvasRef.current) {
            bgCanvasRef.current = document.createElement('canvas');
          }
          // Second offscreen canvas for multi-pass
          if (!(bgCanvasRef.current as any)._pass2) {
            (bgCanvasRef.current as any)._pass2 = document.createElement('canvas');
          }
          const off1 = bgCanvasRef.current;
          const off2 = (bgCanvasRef.current as any)._pass2 as HTMLCanvasElement;

          const drawBlurred = (
            srcX: number, srcY: number, srcW: number, srcH: number,
            dstX: number, dstY: number, dstW: number, dstH: number
          ) => {
            // Multi-pass blur. blurPx range 0-100.
            // p1 = tiny (most softening happens on final upscale from here)
            // p2 = ~25% of dest (second softening pass)
            // Pass 3 upscales p2 → full dest size
            const t = Math.min(blurPx / 100, 1); // 0..1
            const p1Scale = Math.max(0.015, 0.25 - t * 0.235); // 0.25 → 0.015
            const p2Scale = Math.max(0.08, 0.5 - t * 0.42);   // 0.5  → 0.08

            const p1W = Math.max(2, Math.round(dstW * p1Scale));
            const p1H = Math.max(2, Math.round(dstH * p1Scale));
            const p2W = Math.max(4, Math.round(dstW * p2Scale));
            const p2H = Math.max(4, Math.round(dstH * p2Scale));

            if (off1.width !== p1W || off1.height !== p1H) { off1.width = p1W; off1.height = p1H; }
            if (off2.width !== p2W || off2.height !== p2H) { off2.width = p2W; off2.height = p2H; }

            const c1 = off1.getContext('2d');
            const c2 = off2.getContext('2d');
            if (!c1 || !c2) return;

            // Pass 1: video → tiny
            c1.imageSmoothingEnabled = true;
            c1.imageSmoothingQuality = 'high';
            c1.clearRect(0, 0, p1W, p1H);
            c1.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, p1W, p1H);

            // Pass 2: tiny → medium
            c2.imageSmoothingEnabled = true;
            c2.imageSmoothingQuality = 'high';
            c2.clearRect(0, 0, p2W, p2H);
            c2.drawImage(off1, 0, 0, p1W, p1H, 0, 0, p2W, p2H);

            // Pass 3: medium → full destination
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(off2, 0, 0, p2W, p2H, dstX, dstY, dstW, dstH);

            // Brightness overlay
            ctx.fillStyle = `rgba(0,0,0,${1 - brightness})`;
            ctx.fillRect(dstX, dstY, dstW, dstH);
          };

          if (isHorz) {
            const videoAR = vw / vh;
            const canvasAR = cw / ch;
            let drawW: number, drawH: number;
            if (videoAR > canvasAR) {
              drawH = ch;
              drawW = ch * videoAR;
            } else {
              drawW = cw;
              drawH = cw / videoAR;
            }
            const offsetX = (cw - drawW) / 2;
            const offsetY = (ch - drawH) / 2;
            drawBlurred(0, 0, vw, vh, offsetX, offsetY, drawW, drawH);
          } else {
            // Vertical: cover canvas preserving video AR, then apply scale
            const bgScale = layer.target.scale / 100;
            const videoAR = vw / vh;
            const canvasAR = cw / ch;
            let baseW: number, baseH: number;
            if (videoAR > canvasAR) {
              baseH = ch;
              baseW = ch * videoAR;
            } else {
              baseW = cw;
              baseH = cw / videoAR;
            }
            const drawW = baseW * bgScale;
            const drawH = baseH * bgScale;
            const offsetX = (cw - drawW) / 2;
            const offsetY = (ch - drawH) / 2;
            drawBlurred(sx, sy, sw, sh, offsetX, offsetY, drawW, drawH);
          }

        } else if (isHorz && layer.type === 'gameplay') {
          const videoAR = vw / vh;
          const canvasAR = cw / ch;
          let drawW: number, drawH: number;
          if (videoAR > canvasAR) {
            drawW = cw;
            drawH = cw / videoAR;
          } else {
            drawH = ch;
            drawW = ch * videoAR;
          }
          const offsetX = (cw - drawW) / 2;
          const offsetY = (ch - drawH) / 2;
          ctx.drawImage(video, 0, 0, vw, vh, offsetX, offsetY, drawW, drawH);
        } else {
          const targetX = (layer.target.x / 100) * cw;
          const targetY = (layer.target.y / 100) * ch;
          const layerScale = layer.target.scale / 100;
          const skewX = layer.target.skewX ?? 0;
          const skewY = layer.target.skewY ?? 0;

          // For circle: force square source region centered on crop
          let drawSx = sx, drawSy = sy, drawSw = sw, drawSh = sh;
          if (layer.shape === 'circle') {
            const size = Math.min(sw, sh);
            drawSx = sx + (sw - size) / 2;
            drawSy = sy + (sh - size) / 2;
            drawSw = size;
            drawSh = size;
          }

          const aspectRatio = layer.shape === 'circle' ? 1 : drawSw / (drawSh || 1);
          let drawW = cw * layerScale;
          let drawH = drawW / aspectRatio;

          if (layer.shape === 'circle') drawH = drawW;

          const centerX = targetX + drawW / 2;
          const centerY = targetY + drawH / 2;
          const hasTransform = layer.target.rotation !== 0 || skewX !== 0 || skewY !== 0;

          if (hasTransform) {
            ctx.translate(centerX, centerY);
            if (layer.target.rotation !== 0) {
              ctx.rotate((layer.target.rotation * Math.PI) / 180);
            }
            if (skewX !== 0 || skewY !== 0) {
              const skxRad = (skewX * Math.PI) / 180;
              const skyRad = (skewY * Math.PI) / 180;
              ctx.transform(1, Math.tan(skyRad), Math.tan(skxRad), 1, 0, 0);
            }
            ctx.translate(-centerX, -centerY);
          }

          if (layer.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(targetX + drawW / 2, targetY + drawH / 2, drawW / 2, 0, Math.PI * 2);
            ctx.clip();
          } else if (layer.shape === 'rounded') {
            ctx.beginPath();
            const r = Math.min(drawW, drawH) * 0.08;
            ctx.roundRect(targetX, targetY, drawW, drawH, r);
            ctx.clip();
          }

          ctx.drawImage(video, drawSx, drawSy, drawSw, drawSh, targetX, targetY, drawW, drawH);
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
  }, [layers, videoRef, setCurrentTime, isVertical, renderQuality, CANVAS_W, CANVAS_H]);

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
  const aspectRatio = isVertical ? '9/16' : '16/9';
  const borderRadius = isVertical ? 'rounded-2xl md:rounded-[28px]' : 'rounded-xl md:rounded-2xl';
  const innerRadius = isVertical ? 'rounded-[14px] md:rounded-[26px]' : 'rounded-[10px] md:rounded-[14px]';

  const qualityLevels = ['low', 'med', 'high'] as const;
  const qualityColors = {
    low: 'rgba(255,180,50,0.8)',
    med: 'rgba(100,200,255,0.8)',
    high: 'rgba(190,242,100,0.8)',
  };

  return (
    <div
      className="flex flex-col items-center h-full justify-center py-2 px-3 md:py-3 gap-2"
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
        <div
          className={`relative ${borderRadius} border-2 border-white/[0.08] bg-black`}
          style={{
            aspectRatio,
            maxHeight: '100%',
            maxWidth: '100%',
            ...(isVertical ? { height: '100%' } : { width: '100%' }),
            boxShadow: '0 0 40px rgba(0,0,0,0.5), 0 0 80px rgba(190,242,100,0.03)',
          }}
        >
          <div className={`${innerRadius} overflow-hidden w-full h-full`}>
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="w-full h-full"
              style={{ imageRendering: renderQuality === 'low' ? 'pixelated' : 'auto' }}
              data-testid="canvas-preview"
            />
          </div>

          {isPlaying && (
            <div className="absolute top-2 right-2 flex items-center gap-1 pointer-events-none">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[8px] font-mono text-red-400/80 tracking-wider">LIVE</span>
            </div>
          )}

          {/* Top-left: preview mode toggle */}
          <div className="absolute top-2 left-2 flex items-center gap-1">
            <button
              onClick={() => setPreviewMode(isVertical ? 'horizontal' : 'vertical')}
              className="flex items-center gap-1 px-1.5 py-1 rounded-md text-[8px] font-mono uppercase tracking-wider transition-colors"
              style={{
                color: 'rgba(190,242,100,0.7)',
                backgroundColor: 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(190,242,100,0.15)',
              }}
              data-testid="button-preview-mode"
            >
              {isVertical ? <Monitor className="w-3 h-3" /> : <Smartphone className="w-3 h-3" />}
              {isVertical ? '16:9' : '9:16'}
            </button>

            {/* Quality toggle */}
            <div
              className="flex items-center rounded-md overflow-hidden"
              style={{ border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
            >
              {qualityLevels.map((q) => (
                <button
                  key={q}
                  onClick={() => setRenderQuality(q)}
                  className="px-1.5 py-1 text-[8px] font-mono uppercase tracking-wider transition-colors"
                  style={{
                    color: renderQuality === q ? qualityColors[q] : 'rgba(255,255,255,0.3)',
                    backgroundColor: renderQuality === q ? 'rgba(255,255,255,0.08)' : 'transparent',
                  }}
                  data-testid={`button-quality-${q}`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {!videoUrl && (
            <div className={`absolute inset-0 flex flex-col items-center justify-center ${innerRadius} px-6`}>
              <div
                className="w-14 h-14 md:w-16 md:h-16 rounded-xl flex items-center justify-center mb-4"
                style={{ backgroundColor: 'rgba(190,242,100,0.06)', border: '1px dashed rgba(190,242,100,0.15)' }}
              >
                <Upload className="w-6 h-6" style={{ color: 'rgba(190,242,100,0.4)' }} />
              </div>
              <p className="text-sm md:text-base font-mono tracking-wider text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
                DROP VOD HERE
              </p>
              <p className="text-[11px] font-mono mt-1.5 text-center" style={{ color: 'rgba(255,255,255,0.15)' }}>
                or use Import button
              </p>
              {onRequestImport && (
                <button
                  className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-md text-[11px] font-mono uppercase tracking-wider transition-colors"
                  style={{ color: 'rgba(255,255,255,0.6)', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  onClick={onRequestImport}
                  data-testid="button-monitor-import"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Select File
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="w-full shrink-0" style={{ maxWidth: isVertical ? 340 : 480 }}>
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
