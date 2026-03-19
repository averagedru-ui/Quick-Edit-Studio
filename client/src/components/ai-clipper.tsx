import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/lib/store';
import { X, Sparkles, Plus, CheckCheck, AlertCircle, Gamepad2 } from 'lucide-react';

interface GeminiHighlight {
  type: string;
  label: string;
  description: string;
  startTime: number;
  endTime: number;
}

interface GeminiResult {
  game: string;
  gameMode: string | null;
  highlights: GeminiHighlight[];
}

type ClipperState = 'idle' | 'uploading' | 'analyzing' | 'done' | 'error';

const TYPE_COLORS: Record<string, string> = {
  kill:        '#ef4444',
  'multi-kill':'#f97316',
  clutch:      '#eab308',
  objective:   '#3b82f6',
  reaction:    '#a855f7',
  funny:       '#22c55e',
  ability:     '#06b6d4',
  death:       '#6b7280',
  other:       '#6b7280',
};

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

export default function AiClipper() {
  const { showAiClipper, setShowAiClipper, videoFile, addSnippet, snippets } = useStore();

  const [state, setState] = useState<ClipperState>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<GeminiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  if (!showAiClipper) return null;

  const reset = () => {
    setState('idle');
    setUploadProgress(0);
    setResult(null);
    setError(null);
    setAddedIds(new Set());
  };

  const close = () => {
    if (xhrRef.current && (state === 'uploading' || state === 'analyzing')) {
      xhrRef.current.abort();
    }
    setShowAiClipper(false);
    reset();
  };

  const analyze = () => {
    if (!videoFile) return;

    setState('uploading');
    setUploadProgress(0);
    setError(null);
    setResult(null);
    setAddedIds(new Set());

    const formData = new FormData();
    formData.append('video', videoFile);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        setUploadProgress((e.loaded / e.total) * 100);
      }
    });

    xhr.upload.addEventListener('load', () => {
      setState('analyzing');
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        try {
          const data: GeminiResult = JSON.parse(xhr.responseText);
          setResult(data);
          setState('done');
        } catch {
          setError('Could not parse the AI response.');
          setState('error');
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          setError(err.error || 'Analysis failed.');
        } catch {
          setError('Server error. Check that GEMINI_API_KEY is set.');
        }
        setState('error');
      }
    });

    xhr.addEventListener('error', () => {
      setError('Network error. Is the server running?');
      setState('error');
    });

    xhr.addEventListener('abort', () => {
      setState('idle');
    });

    xhr.open('POST', '/api/analyze');
    xhr.timeout = 900_000;
    xhr.send(formData);
  };

  const addHighlight = (h: GeminiHighlight, idx: number) => {
    addSnippet({
      name: h.label,
      startTime: h.startTime,
      endTime: h.endTime,
      summary: h.description,
    });
    setAddedIds(prev => new Set(prev).add(idx));
  };

  const addAll = () => {
    if (!result) return;
    result.highlights.forEach((h, idx) => {
      if (!addedIds.has(idx)) addHighlight(h, idx);
    });
  };

  const allAdded = result ? addedIds.size === result.highlights.length : false;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
      onClick={close}
    >
      <div
        className="w-full md:max-w-2xl max-h-[90vh] overflow-hidden rounded-t-xl md:rounded-xl flex flex-col"
        style={{
          backgroundColor: '#0e0e14',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between gap-2 px-4 py-3 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" style={{ color: '#bef264' }} />
              <h2 className="text-sm font-bold text-white">AI Clipper</h2>
            </div>
            <p className="text-[9px] font-mono tracking-wider mt-0.5" style={{ color: 'rgba(190,242,100,0.4)' }}>
              GEMINI 1.5 FLASH — Highlight Detection + Game Recognition
            </p>
          </div>
          <button
            onClick={close}
            className="w-7 h-7 flex items-center justify-center rounded transition-colors shrink-0"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-auto flex-1 p-4 space-y-4">

          {/* Video info */}
          <div
            className="rounded-md px-3 py-2.5 flex items-center gap-2"
            style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
          >
            <span className="text-[9px] font-mono uppercase tracking-widest shrink-0" style={{ color: 'rgba(190,242,100,0.35)' }}>
              Source
            </span>
            <span className="text-[11px] font-mono truncate" style={{ color: videoFile ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)' }}>
              {videoFile ? videoFile.name : 'No video loaded — import a file first'}
            </span>
            {videoFile && (
              <span className="text-[9px] font-mono shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }}>
                {(videoFile.size / 1024 / 1024).toFixed(1)} MB
              </span>
            )}
          </div>

          {/* Game result banner */}
          {result && (
            <div
              className="rounded-md px-3 py-2.5 flex items-center gap-2.5"
              style={{ backgroundColor: 'rgba(190,242,100,0.05)', border: '1px solid rgba(190,242,100,0.12)' }}
            >
              <Gamepad2 className="w-4 h-4 shrink-0" style={{ color: '#bef264' }} />
              <div className="min-w-0">
                <p className="text-[12px] font-bold" style={{ color: '#bef264' }}>{result.game}</p>
                {result.gameMode && (
                  <p className="text-[9px] font-mono" style={{ color: 'rgba(190,242,100,0.5)' }}>{result.gameMode}</p>
                )}
              </div>
              <div className="ml-auto shrink-0">
                <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {result.highlights.length} highlight{result.highlights.length !== 1 ? 's' : ''} found
                </span>
              </div>
            </div>
          )}

          {/* States */}
          {state === 'idle' && (
            <div className="space-y-3">
              <p className="text-[10px] font-mono leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Gemini will scan your video, detect what game you're playing, and find the best highlight moments automatically.
                Results are added directly to your Snippet Deck.
              </p>
              <p className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>
                Long VODs may take several minutes to process. The tab must stay open.
              </p>
              <button
                onClick={analyze}
                disabled={!videoFile}
                className="w-full py-3 rounded-md text-[11px] font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: 'rgba(190,242,100,0.1)',
                  color: '#bef264',
                  border: '1px solid rgba(190,242,100,0.2)',
                }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Analyze Video
              </button>
            </div>
          )}

          {state === 'uploading' && (
            <div className="space-y-3">
              <p className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Sending to server…
              </p>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%`, backgroundColor: '#bef264' }}
                />
              </div>
              <p className="text-[9px] font-mono text-right" style={{ color: 'rgba(190,242,100,0.4)' }}>
                {uploadProgress.toFixed(0)}%
              </p>
              <button onClick={close} className="text-[10px] font-mono underline" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Cancel
              </button>
            </div>
          )}

          {state === 'analyzing' && (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-3">
                <div
                  className="w-5 h-5 rounded-full border-2 animate-spin shrink-0"
                  style={{ borderColor: 'rgba(190,242,100,0.2)', borderTopColor: '#bef264' }}
                />
                <div>
                  <p className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    Gemini is analyzing your VOD…
                  </p>
                  <p className="text-[9px] font-mono mt-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    This can take 1–5 minutes for long recordings. Keep this tab open.
                  </p>
                </div>
              </div>
              <button onClick={close} className="text-[10px] font-mono underline" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Cancel
              </button>
            </div>
          )}

          {state === 'error' && (
            <div className="space-y-3">
              <div
                className="rounded-md p-3 flex items-start gap-2.5"
                style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                <p className="text-[11px] font-mono" style={{ color: 'rgba(255,100,100,0.9)' }}>{error}</p>
              </div>
              <button
                onClick={reset}
                className="text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 rounded"
                style={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                Try Again
              </button>
            </div>
          )}

          {state === 'done' && result && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-[9px] font-mono uppercase tracking-widest" style={{ color: 'rgba(190,242,100,0.35)' }}>
                  Highlights
                </h4>
                {!allAdded ? (
                  <button
                    onClick={addAll}
                    className="flex items-center gap-1 text-[9px] font-mono uppercase px-2 py-1 rounded transition-all"
                    style={{
                      color: '#bef264',
                      backgroundColor: 'rgba(190,242,100,0.08)',
                      border: '1px solid rgba(190,242,100,0.15)',
                    }}
                  >
                    <Plus className="w-2.5 h-2.5" />
                    Add All
                  </button>
                ) : (
                  <span className="flex items-center gap-1 text-[9px] font-mono" style={{ color: 'rgba(190,242,100,0.5)' }}>
                    <CheckCheck className="w-3 h-3" />
                    All added
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                {result.highlights.map((h, idx) => {
                  const color = TYPE_COLORS[h.type] ?? TYPE_COLORS.other;
                  const added = addedIds.has(idx);
                  const dur = h.endTime - h.startTime;
                  return (
                    <div
                      key={idx}
                      className="rounded-md p-2.5 flex items-start gap-2.5 transition-all"
                      style={{
                        backgroundColor: added ? 'rgba(190,242,100,0.04)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${added ? 'rgba(190,242,100,0.1)' : 'rgba(255,255,255,0.04)'}`,
                      }}
                    >
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className="text-[8px] font-mono uppercase px-1.5 py-0.5 rounded shrink-0"
                            style={{ color, backgroundColor: `${color}18`, border: `1px solid ${color}30` }}
                          >
                            {h.type}
                          </span>
                          <span className="text-[11px] font-semibold truncate" style={{ color: added ? '#bef264' : 'rgba(255,255,255,0.8)' }}>
                            {h.label}
                          </span>
                        </div>
                        <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          {h.description}
                        </p>
                        <p className="text-[9px] font-mono" style={{ color: 'rgba(190,242,100,0.4)' }}>
                          {fmt(h.startTime)} → {fmt(h.endTime)} · {dur.toFixed(1)}s
                        </p>
                      </div>

                      <button
                        onClick={() => !added && addHighlight(h, idx)}
                        disabled={added}
                        className="shrink-0 flex items-center gap-1 text-[9px] font-mono uppercase px-2 py-1.5 rounded transition-all disabled:opacity-40"
                        style={added ? {
                          color: 'rgba(190,242,100,0.6)',
                          border: '1px solid rgba(190,242,100,0.12)',
                        } : {
                          color: 'rgba(255,255,255,0.5)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          backgroundColor: 'rgba(255,255,255,0.03)',
                        }}
                      >
                        {added ? <CheckCheck className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                        {added ? 'Added' : 'Add'}
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={reset}
                className="w-full py-1.5 text-[9px] font-mono uppercase tracking-wider mt-1"
                style={{ color: 'rgba(255,255,255,0.2)' }}
              >
                Analyze Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
