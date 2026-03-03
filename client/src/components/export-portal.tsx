import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { X, Download, Copy, Check } from 'lucide-react';
import { useState } from 'react';

export default function ExportPortal() {
  const { showExport, setShowExport, layers, snippets, videoFile } = useStore();
  const [copied, setCopied] = useState(false);

  if (!showExport) return null;

  const manifest = {
    project: 'CLUTCH Studio Export',
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

  const handleDownload = () => {
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clutch-project-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={() => setShowExport(false)}
      data-testid="export-portal"
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-xl"
        style={{
          backgroundColor: '#0e0e14',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between gap-2 px-5 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div>
            <h2 className="text-base font-bold text-white">Project Manifest</h2>
            <p className="text-[10px] font-mono tracking-wider mt-0.5" style={{ color: 'rgba(190,242,100,0.4)' }}>
              THE PORTAL &mdash; Pipeline Handoff
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={handleCopy} data-testid="button-copy-json">
              {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
              <span className="text-xs">{copied ? 'Copied' : 'Copy'}</span>
            </Button>
            <Button size="sm" onClick={handleDownload} data-testid="button-download-json">
              <Download className="w-3.5 h-3.5 mr-1" />
              <span className="text-xs">Download</span>
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setShowExport(false)} data-testid="button-close-export">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="p-5 overflow-auto" style={{ maxHeight: 'calc(85vh - 80px)' }}>
          <pre
            className="text-[11px] font-mono leading-relaxed rounded-lg p-4 overflow-auto"
            style={{
              color: 'rgba(190,242,100,0.65)',
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.04)',
            }}
          >
            {jsonStr}
          </pre>
        </div>
      </div>
    </div>
  );
}
