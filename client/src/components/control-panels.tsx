import { useState } from 'react';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

function NeonSlider({
  value, min, max, step = 1, onChange, label, displayValue, disabled = false,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  label: string;
  displayValue?: string;
  disabled?: boolean;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={`space-y-1.5 ${disabled ? 'opacity-35 pointer-events-none' : ''}`}>
      <div className="flex items-center justify-between gap-1">
        <span
          className="text-[10px] font-mono uppercase tracking-wider"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          {label}
        </span>
        <span
          className="text-[10px] font-mono tabular-nums"
          style={{ color: 'rgba(190,242,100,0.6)' }}
        >
          {displayValue ?? value.toFixed(step < 1 ? 1 : 0)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="neon-slider w-full"
        style={{
          background: `linear-gradient(to right, #bef264 0%, #bef264 ${pct}%, rgba(255,255,255,0.06) ${pct}%, rgba(255,255,255,0.06) 100%)`,
        }}
        data-testid={`slider-${label.toLowerCase().replace(/\s/g, '-')}`}
      />
    </div>
  );
}

export function TransformPanel() {
  const { layers, activeLayerId, updateLayerSource, updateLayerTarget, updateLayer } = useStore();
  const activeLayer = layers.find(l => l.id === activeLayerId);

  if (!activeLayer) return null;
  const isLocked = activeLayer.locked;

  return (
    <div className="space-y-4" data-testid="transform-panel">
      <div className="flex items-center justify-between gap-1 mb-1">
        <h3
          className="text-[11px] font-mono uppercase tracking-wider"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          HUD Cropper
        </h3>
        <div className="flex items-center gap-1.5">
          <span
            className="text-[9px] font-mono px-1.5 py-0.5 rounded"
            style={{ color: '#bef264', backgroundColor: 'rgba(190,242,100,0.08)' }}
          >
            {activeLayer.name}
          </span>
          {isLocked && (
            <span
              className="text-[8px] font-mono px-1.5 py-0.5 rounded"
              style={{ color: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.05)' }}
            >
              LOCKED
            </span>
          )}
        </div>
      </div>

      <div
        className="rounded-md p-3 space-y-2.5"
        style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
      >
        <h4
          className="text-[9px] font-mono uppercase tracking-widest mb-2"
          style={{ color: 'rgba(190,242,100,0.35)' }}
        >
          Source Crop
        </h4>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <NeonSlider label="sX" value={activeLayer.source.x} min={0} max={100} disabled={isLocked}
            onChange={(v) => updateLayerSource(activeLayer.id, { x: v })} />
          <NeonSlider label="sY" value={activeLayer.source.y} min={0} max={100} disabled={isLocked}
            onChange={(v) => updateLayerSource(activeLayer.id, { y: v })} />
          <NeonSlider label="sW" value={activeLayer.source.w} min={1} max={100} disabled={isLocked}
            onChange={(v) => updateLayerSource(activeLayer.id, { w: v })} />
          <NeonSlider label="sH" value={activeLayer.source.h} min={1} max={100} disabled={isLocked}
            onChange={(v) => updateLayerSource(activeLayer.id, { h: v })} />
        </div>
      </div>

      <div
        className="rounded-md p-3 space-y-2.5"
        style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
      >
        <h4
          className="text-[9px] font-mono uppercase tracking-widest mb-2"
          style={{ color: 'rgba(190,242,100,0.35)' }}
        >
          Target Transform
        </h4>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <NeonSlider label="tX" value={activeLayer.target.x} min={-50} max={100} disabled={isLocked}
            onChange={(v) => updateLayerTarget(activeLayer.id, { x: v })} />
          <NeonSlider label="tY" value={activeLayer.target.y} min={-50} max={100} disabled={isLocked}
            onChange={(v) => updateLayerTarget(activeLayer.id, { y: v })} />
          <NeonSlider label="Scale" value={activeLayer.target.scale} min={1} max={200} disabled={isLocked}
            displayValue={`${activeLayer.target.scale}%`}
            onChange={(v) => updateLayerTarget(activeLayer.id, { scale: v })} />
          <NeonSlider label="Rot" value={activeLayer.target.rotation} min={-180} max={180} disabled={isLocked}
            displayValue={`${activeLayer.target.rotation}\u00B0`}
            onChange={(v) => updateLayerTarget(activeLayer.id, { rotation: v })} />
        </div>
      </div>

      <div
        className="rounded-md p-3"
        style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
      >
        <NeonSlider
          label="Opacity"
          value={activeLayer.opacity}
          min={0}
          max={100}
          disabled={isLocked}
          displayValue={`${activeLayer.opacity}%`}
          onChange={(v) => updateLayer(activeLayer.id, { opacity: v })}
        />

        <div className="mt-3">
          <span
            className="text-[10px] font-mono uppercase tracking-wider block mb-1.5"
            style={{ color: 'rgba(255,255,255,0.35)' }}
          >
            Shape
          </span>
          <div className="flex items-center gap-1">
            {(['rect', 'rounded', 'circle'] as const).map(shape => (
              <button
                key={shape}
                className="text-[9px] font-mono uppercase px-2.5 py-1 rounded transition-all"
                style={activeLayer.shape === shape ? {
                  backgroundColor: 'rgba(190,242,100,0.12)',
                  color: '#bef264',
                  border: '1px solid rgba(190,242,100,0.2)',
                } : {
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  color: 'rgba(255,255,255,0.4)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
                onClick={() => !isLocked && updateLayer(activeLayer.id, { shape })}
                disabled={isLocked}
                data-testid={`button-shape-${shape}`}
              >
                {shape}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AudioMixer() {
  const { layers, activeLayerId, updateLayerAudio } = useStore();
  const activeLayer = layers.find(l => l.id === activeLayerId);

  if (!activeLayer) return null;
  const isLocked = activeLayer.locked;

  return (
    <div className="space-y-3" data-testid="audio-mixer">
      <div className="flex items-center justify-between gap-1">
        <h3
          className="text-[11px] font-mono uppercase tracking-wider"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          Pro Audio Mixer
        </h3>
        <div className="flex items-center gap-1.5">
          <span
            className="text-[9px] font-mono px-1.5 py-0.5 rounded"
            style={{ color: '#bef264', backgroundColor: 'rgba(190,242,100,0.08)' }}
          >
            {activeLayer.name}
          </span>
          {isLocked && (
            <span
              className="text-[8px] font-mono px-1.5 py-0.5 rounded"
              style={{ color: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.05)' }}
            >
              LOCKED
            </span>
          )}
        </div>
      </div>

      <div
        className="rounded-md p-3 space-y-3"
        style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
      >
        <NeonSlider
          label="Gain"
          value={activeLayer.audio.gain}
          min={0}
          max={100}
          displayValue={`${activeLayer.audio.gain}%`}
          disabled={isLocked}
          onChange={(v) => updateLayerAudio(activeLayer.id, { gain: v })}
        />

        <div className={`flex items-center gap-1.5 ${isLocked ? 'opacity-35 pointer-events-none' : ''}`}>
          <button
            className="flex-1 text-[10px] font-mono uppercase py-1.5 rounded transition-all"
            style={activeLayer.audio.muted ? {
              backgroundColor: 'rgba(239,68,68,0.15)',
              color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.2)',
            } : {
              backgroundColor: 'rgba(255,255,255,0.03)',
              color: 'rgba(255,255,255,0.4)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
            onClick={() => updateLayerAudio(activeLayer.id, { muted: !activeLayer.audio.muted })}
            disabled={isLocked}
            data-testid="button-mute"
          >
            {activeLayer.audio.muted ? 'Muted' : 'Mute'}
          </button>
          <button
            className="flex-1 text-[10px] font-mono uppercase py-1.5 rounded transition-all"
            style={activeLayer.audio.solo ? {
              backgroundColor: 'rgba(190,242,100,0.12)',
              color: '#bef264',
              border: '1px solid rgba(190,242,100,0.2)',
            } : {
              backgroundColor: 'rgba(255,255,255,0.03)',
              color: 'rgba(255,255,255,0.4)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
            onClick={() => updateLayerAudio(activeLayer.id, { solo: !activeLayer.audio.solo })}
            disabled={isLocked}
            data-testid="button-solo"
          >
            {activeLayer.audio.solo ? 'Solo On' : 'Solo'}
          </button>
        </div>
      </div>

      <div
        className="rounded-md p-3 space-y-2.5"
        style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
      >
        <h4
          className="text-[9px] font-mono uppercase tracking-widest mb-1"
          style={{ color: 'rgba(190,242,100,0.35)' }}
        >
          3-Band EQ
        </h4>
        <NeonSlider label="Low" value={activeLayer.audio.eqLow} min={-12} max={12} step={0.5} disabled={isLocked}
          displayValue={`${activeLayer.audio.eqLow > 0 ? '+' : ''}${activeLayer.audio.eqLow} dB`}
          onChange={(v) => updateLayerAudio(activeLayer.id, { eqLow: v })} />
        <NeonSlider label="Mid" value={activeLayer.audio.eqMid} min={-12} max={12} step={0.5} disabled={isLocked}
          displayValue={`${activeLayer.audio.eqMid > 0 ? '+' : ''}${activeLayer.audio.eqMid} dB`}
          onChange={(v) => updateLayerAudio(activeLayer.id, { eqMid: v })} />
        <NeonSlider label="High" value={activeLayer.audio.eqHigh} min={-12} max={12} step={0.5} disabled={isLocked}
          displayValue={`${activeLayer.audio.eqHigh > 0 ? '+' : ''}${activeLayer.audio.eqHigh} dB`}
          onChange={(v) => updateLayerAudio(activeLayer.id, { eqHigh: v })} />
      </div>

      <div
        className="rounded-md p-3"
        style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
      >
        <NeonSlider
          label="Stereo Pan"
          value={activeLayer.audio.pan}
          min={-100}
          max={100}
          disabled={isLocked}
          displayValue={activeLayer.audio.pan === 0 ? 'C' : activeLayer.audio.pan < 0 ? `L${Math.abs(activeLayer.audio.pan)}` : `R${activeLayer.audio.pan}`}
          onChange={(v) => updateLayerAudio(activeLayer.id, { pan: v })}
        />
      </div>
    </div>
  );
}

export function SnippetDeck() {
  const { snippets, currentTime, addSnippet, removeSnippet, seekTo } = useStore();
  const [markIn, setMarkIn] = useState<number | null>(null);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const handleMarkIn = () => setMarkIn(currentTime);

  const handleMarkOut = () => {
    if (markIn === null) return;
    addSnippet({
      name: `Clip ${snippets.length + 1}`,
      startTime: Math.min(markIn, currentTime),
      endTime: Math.max(markIn, currentTime),
      summary: '',
    });
    setMarkIn(null);
  };

  return (
    <div className="space-y-2" data-testid="snippet-deck">
      <div className="flex items-center justify-between gap-1 mb-1">
        <h3
          className="text-[11px] font-mono uppercase tracking-wider"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          Snippet Deck
        </h3>
        <div className="flex items-center gap-1">
          <button
            className="text-[9px] font-mono uppercase px-2 py-1 rounded transition-all"
            style={markIn !== null ? {
              backgroundColor: 'rgba(190,242,100,0.12)',
              color: '#bef264',
              border: '1px solid rgba(190,242,100,0.2)',
            } : {
              backgroundColor: 'rgba(255,255,255,0.03)',
              color: 'rgba(255,255,255,0.4)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
            onClick={handleMarkIn}
            data-testid="button-mark-in"
          >
            IN
          </button>
          <button
            className="text-[9px] font-mono uppercase px-2 py-1 rounded transition-all disabled:opacity-30"
            style={{
              backgroundColor: 'rgba(255,255,255,0.03)',
              color: 'rgba(255,255,255,0.4)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
            onClick={handleMarkOut}
            disabled={markIn === null}
            data-testid="button-mark-out"
          >
            OUT
          </button>
        </div>
      </div>

      {markIn !== null && (
        <div
          className="flex items-center gap-2 px-2.5 py-1.5 rounded text-[10px] font-mono"
          style={{
            backgroundColor: 'rgba(190,242,100,0.04)',
            border: '1px solid rgba(190,242,100,0.08)',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>Recording from</span>
          <span style={{ color: '#bef264' }}>{formatTime(markIn)}</span>
        </div>
      )}

      {snippets.length === 0 && markIn === null && (
        <p
          className="text-[10px] font-mono text-center py-6"
          style={{ color: 'rgba(255,255,255,0.15)' }}
        >
          No clips marked yet
        </p>
      )}

      <div className="space-y-1">
        {snippets.map((snippet) => (
          <div
            key={snippet.id}
            className="flex items-center gap-2 px-2.5 py-2 rounded cursor-pointer group transition-all"
            style={{
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.04)',
            }}
            onClick={() => seekTo(snippet.startTime)}
            data-testid={`snippet-${snippet.id}`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-white/70 truncate">{snippet.name}</p>
              <p className="text-[9px] font-mono" style={{ color: 'rgba(190,242,100,0.4)' }}>
                {formatTime(snippet.startTime)} {'\u2192'} {formatTime(snippet.endTime)}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                removeSnippet(snippet.id);
              }}
              data-testid={`button-remove-snippet-${snippet.id}`}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
