import { useStore } from '@/lib/store';
import { X, Download, Copy, Check, Video, FileJson, Loader } from 'lucide-react';
import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

type Tab = 'video' | 'json';
type RecordState = 'idle' | 'recording' | 'processing' | 'done' | 'unsupported';

export default function ExportPortal() {
  const { showExport, setShowExport, layers, snippets, videoFile, videoRef } = useStore();
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<Tab>('video');
  const [recordState, setRecordState] = useState<RecordState>('idle');
  const [progress, setProgress] = useState(0);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [selectedSnippetId, setSelectedSnippetId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const progressIntervalRef = useRef<number | null>(null);

  if (!showExport) return null;

  const manifest = {
    project: 'CLIPR Export',
    version: '1.0.0',
    source: videoFile?.name || 'no-source-loaded',
    layers: layers.map(l => ({
      id: l.id,
      name: l.name,
      type: l.type,
      visible: l.visible,
      source: l.source,
      target: l.target,
      audio: {
        gain: l.audio.gain,
        muted: l.audio.muted,
        solo: l.audio.solo,
        pan: l.audio.pan,
        eq: { low: l.audio.eqLow, mid: l.audio.eqMid, high: l.audio.eqHigh },
      },
      shape: l.shape,
      opacity: l.opacity,
    })),
    snippets: snippets.map(s => ({
      name: s.name,
      start: s.startTime,
      end: s.endTime,
      summary: s.summary,
    })),
    exportedAt: new Date().toISOString(),
  };

  const jsonStr = JSON.stringify(manifest, null, 2);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clipr-project-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const startRecording = useCallback(async () => {
    const video = videoRef?.current;
    if (!video) return;

    const canvas = document.querySelector('[data-testid="canvas-preview"]') as HTMLCanvasElement;
    if (!canvas) return;

    if (!window.MediaRecorder) {
      setRecordState('unsupported');
      return;
    }

    const mimeTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ];
    const supported = mimeTypes.find(t => MediaRecorder.isTypeSupported(t));
    if (!supported) {
      setRecordState('unsupported');
      return;
    }

    chunksRef.current = [];
    setVideoBlob(null);
    setProgress(0);
    setRecordState('recording');

    let stream: MediaStream;
    try {
      stream = canvas.captureStream(30);
    } catch {
      setRecordState('unsupported');
      return;
    }

    // Attach audio if available
    try {
      const audioCtx = (video as any)._cliprAudioCtx as AudioContext | undefined;
      if (audioCtx) {
        const dest = audioCtx.createMediaStreamDestination();
        const gain = (video as any)._cliprGain as GainNode | undefined;
        if (gain) gain.connect(dest);
        dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
      }
    } catch { /* audio attach optional */ }

    const recorder = new MediaRecorder(stream, { mimeType: supported });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setRecordState('processing');
      const blob = new Blob(chunksRef.current, { type: supported });
      setVideoBlob(blob);
      setProgress(100);
      setRecordState('done');
    };

    const snippet = selectedSnippetId ? snippets.find(s => s.id === selectedSnippetId) : null;
    const duration = snippet ? snippet.endTime - snippet.startTime : null;

    if (snippet) {
      video.currentTime = snippet.startTime;
      await new Promise(r => setTimeout(r, 200));
    }

    recorder.start(100);
    video.play();

    if (duration) {
      const startTime = performance.now();
      progressIntervalRef.current = window.setInterval(() => {
        const elapsed = (performance.now() - startTime) / 1000;
        const pct = Math.min(99, (elapsed / duration) * 100);
        setProgress(pct);
        if (elapsed >= duration) {
          stopRecording();
        }
      }, 200);
    }
  }, [selectedSnippetId, snippets, videoRef]);

  const stopRecording = useCallback(() => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    const video = videoRef?.current;
    if (video) video.pause();
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, [videoRef]);

  const handleDownloadVideo = () => {
    if (!videoBlob) return;
    const ext = videoBlob.type.includes('mp4') ? 'mp4' : 'webm';
    const url = URL.createObjectURL(videoBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clipr-export-${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetRecorder = () => {
    setRecordState('idle');
    setProgress(0);
    setVideoBlob(null);
  };

  const tabStyle = (t: Tab) => ({
    color: tab === t ? '#bef264' : 'rgba(255,255,255,0.4)',
    backgroundColor: tab === t ? 'rgba(190,242,100,0.08)' : 'transparent',
    borderBottom: tab === t ? '1px solid rgba(190,242,100,0.3)' : '1px solid transparent',
  });

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
      onClick={() => setShowExport(false)}
      data-testid="export-portal"
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
            <h2 className="text-sm font-bold text-white">Export</h2>
            <p className="text-[9px] font-mono tracking-wider mt-0.5" style={{ color: 'rgba(190,242,100,0.4)' }}>
              THE PORTAL — Pipeline Handoff
            </p>
          </div>
          <button
            onClick={() => setShowExport(false)}
            className="w-7 h-7 flex items-center justify-center rounded transition-colors shrink-0"
            style={{ color: 'rgba(255,255,255,0.4)' }}
            data-testid="button-close-export"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            className="flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider transition-colors"
            style={tabStyle('video')}
            onClick={() => setTab('video')}
          >
            <Video className="w-3 h-3" /> Video
          </button>
          <button
            className="flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider transition-colors"
            style={tabStyle('json')}
            onClick={() => setTab('json')}
          >
            <FileJson className="w-3 h-3" /> Manifest
          </button>
        </div>

        {/* Content */}
        <div className="overflow-auto flex-1 p-4">

          {tab === 'video' && (
            <div className="space-y-4">

              {/* Snippet selector */}
              <div
                className="rounded-md p-3 space-y-2"
                style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
              >
                <h4 className="text-[9px] font-mono uppercase tracking-widest mb-2" style={{ color: 'rgba(190,242,100,0.35)' }}>
                  Clip Range
                </h4>
                <div className="space-y-1.5">
                  <button
                    className="w-full text-left px-2.5 py-2 rounded text-[11px] font-mono transition-all"
                    style={!selectedSnippetId ? {
                      backgroundColor: 'rgba(190,242,100,0.08)',
                      color: '#bef264',
                      border: '1px solid rgba(190,242,100,0.2)',
                    } : {
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      color: 'rgba(255,255,255,0.4)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                    onClick={() => setSelectedSnippetId(null)}
                  >
                    Full video
                  </button>
                  {snippets.map(s => {
                    const dur = s.endTime - s.startTime;
                    const fmt = (t: number) => `${Math.floor(t / 60).toString().padStart(2,'0')}:${Math.floor(t % 60).toString().padStart(2,'0')}`;
                    return (
                      <button
                        key={s.id}
                        className="w-full text-left px-2.5 py-2 rounded transition-all"
                        style={selectedSnippetId === s.id ? {
                          backgroundColor: 'rgba(190,242,100,0.08)',
                          border: '1px solid rgba(190,242,100,0.2)',
                        } : {
                          backgroundColor: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}
                        onClick={() => setSelectedSnippetId(s.id)}
                      >
                        <p className="text-[11px] font-medium" style={{ color: selectedSnippetId === s.id ? '#bef264' : 'rgba(255,255,255,0.6)' }}>{s.name}</p>
                        <p className="text-[9px] font-mono mt-0.5" style={{ color: 'rgba(190,242,100,0.4)' }}>
                          {fmt(s.startTime)} → {fmt(s.endTime)} · {dur.toFixed(1)}s
                        </p>
                      </button>
                    );
                  })}
                  {snippets.length === 0 && (
                    <p className="text-[10px] font-mono text-center py-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
                      No snippets — mark clips in the Snippet Deck first
                    </p>
                  )}
                </div>
              </div>

              {/* Record controls */}
              <div
                className="rounded-md p-3 space-y-3"
                style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
              >
                <h4 className="text-[9px] font-mono uppercase tracking-widest" style={{ color: 'rgba(190,242,100,0.35)' }}>
                  Render
                </h4>

                {recordState === 'unsupported' && (
                  <div className="text-center py-3 space-y-2">
                    <p className="text-[11px] font-mono" style={{ color: 'rgba(255,150,100,0.8)' }}>
                      Video recording not supported on this browser.
                    </p>
                    <p className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      Try Chrome or Firefox. iOS Safari does not support canvas recording.
                    </p>
                    <button onClick={resetRecorder} className="text-[10px] font-mono underline" style={{ color: 'rgba(190,242,100,0.5)' }}>back</button>
                  </div>
                )}

                {recordState === 'idle' && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-mono leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      Records the canvas preview directly — what you see is what you get.
                      {selectedSnippetId ? ' Will auto-stop at clip end.' : ' Press Stop when done.'}
                    </p>
                    <button
                      onClick={startRecording}
                      className="w-full py-2.5 rounded-md text-[11px] font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                      style={{ backgroundColor: 'rgba(190,242,100,0.1)', color: '#bef264', border: '1px solid rgba(190,242,100,0.2)' }}
                    >
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      Start Recording
                    </button>
                  </div>
                )}

                {recordState === 'recording' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                      <span className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.6)' }}>
                        {selectedSnippetId ? `Recording — ${progress.toFixed(0)}%` : 'Recording...'}
                      </span>
                    </div>
                    {selectedSnippetId && (
                      <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${progress}%`, backgroundColor: '#bef264' }}
                        />
                      </div>
                    )}
                    <button
                      onClick={stopRecording}
                      className="w-full py-2.5 rounded-md text-[11px] font-mono uppercase tracking-wider transition-all"
                      style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
                    >
                      Stop Recording
                    </button>
                  </div>
                )}

                {recordState === 'processing' && (
                  <div className="flex items-center justify-center gap-2 py-3">
                    <Loader className="w-4 h-4 animate-spin" style={{ color: '#bef264' }} />
                    <span className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>Processing…</span>
                  </div>
                )}

                {recordState === 'done' && videoBlob && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-mono" style={{ color: 'rgba(190,242,100,0.6)' }}>
                      ✓ Ready — {(videoBlob.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                    <button
                      onClick={handleDownloadVideo}
                      className="w-full py-2.5 rounded-md text-[11px] font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
                      style={{ backgroundColor: 'rgba(190,242,100,0.1)', color: '#bef264', border: '1px solid rgba(190,242,100,0.2)' }}
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Video
                    </button>
                    <button
                      onClick={resetRecorder}
                      className="w-full py-1.5 text-[10px] font-mono uppercase tracking-wider"
                      style={{ color: 'rgba(255,255,255,0.3)' }}
                    >
                      Record Again
                    </button>
                  </div>
                )}
              </div>

              <p className="text-[9px] font-mono text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>
                Output matches canvas resolution & quality setting · Chrome/Firefox only
              </p>
            </div>
          )}

          {tab === 'json' && (
            <div className="space-y-3">
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-2 py-1.5 rounded text-[10px] font-mono uppercase tracking-wider transition-colors"
                  style={{ color: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                  data-testid="button-copy-json"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  onClick={handleDownloadJson}
                  className="flex items-center gap-1 px-2 py-1.5 rounded text-[10px] font-mono uppercase tracking-wider transition-colors"
                  style={{ color: '#bef264', backgroundColor: 'rgba(190,242,100,0.08)', border: '1px solid rgba(190,242,100,0.15)' }}
                  data-testid="button-download-json"
                >
                  <Download className="w-3 h-3" />
                  Download
                </button>
              </div>
              <pre
                className="text-[10px] font-mono leading-relaxed rounded-lg p-3 overflow-auto"
                style={{
                  color: 'rgba(190,242,100,0.65)',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)',
                  maxHeight: '50vh',
                }}
              >
                {jsonStr}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
