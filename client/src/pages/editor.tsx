import { useState, useRef } from 'react';
import { useStore } from '@/lib/store';
import SplashScreen from '@/components/splash-screen';
import SpatialMonitor from '@/components/spatial-monitor';
import LayerMatrix from '@/components/layer-matrix';
import { TransformPanel, AudioMixer, SnippetDeck } from '@/components/control-panels';
import ExportPortal from '@/components/export-portal';
import { Button } from '@/components/ui/button';
import { Upload, Download, Layers, Move, Volume2, Scissors } from 'lucide-react';
import { cn } from '@/lib/utils';

type MobileTab = 'layers' | 'transform' | 'audio' | 'clips';

const mobileTabs: { id: MobileTab; label: string; icon: typeof Layers }[] = [
  { id: 'layers', label: 'Layers', icon: Layers },
  { id: 'transform', label: 'Transform', icon: Move },
  { id: 'audio', label: 'Audio', icon: Volume2 },
  { id: 'clips', label: 'Clips', icon: Scissors },
];

function GlassPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn("backdrop-blur-xl", className)}
      style={{
        backgroundColor: 'rgba(255,255,255,0.015)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {children}
    </div>
  );
}

export default function EditorPage() {
  const [showSplash, setShowSplash] = useState(true);
  const [mobileTab, setMobileTab] = useState<MobileTab>('layers');
  const { setVideoFile, setShowExport } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setVideoFile(file);
  };

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <div
      className="flex flex-col h-[100dvh] overflow-hidden"
      style={{ backgroundColor: '#0c0c10' }}
      data-testid="editor-page"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileChange}
        data-testid="input-file"
      />

      <header
        className="h-12 shrink-0 flex items-center justify-between px-3 md:px-5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.01)' }}
        data-testid="editor-header"
      >
        <div className="flex items-center gap-2.5">
          <h1 className="text-base md:text-lg font-black tracking-tight text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
            CLUTCH
          </h1>
          <span
            className="text-[8px] md:text-[9px] font-mono tracking-[0.25em] uppercase"
            style={{ color: 'rgba(190,242,100,0.45)' }}
          >
            Studio
          </span>
          <span
            className="hidden md:inline-block text-[8px] font-mono px-1.5 py-0.5 rounded ml-1"
            style={{
              color: 'rgba(190,242,100,0.3)',
              backgroundColor: 'rgba(190,242,100,0.05)',
              border: '1px solid rgba(190,242,100,0.08)',
            }}
          >
            v1.0
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={handleImport} data-testid="button-import">
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            <span className="hidden sm:inline text-xs">Import</span>
          </Button>
          <Button size="sm" onClick={() => setShowExport(true)} data-testid="button-export">
            <Download className="w-3.5 h-3.5 mr-1.5" />
            <span className="hidden sm:inline text-xs">Export</span>
          </Button>
        </div>
      </header>

      {/* Desktop Layout */}
      <div className="flex-1 hidden md:flex overflow-hidden">
        {/* Left Panel */}
        <GlassPanel className="w-56 lg:w-60 shrink-0 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto p-3">
            <LayerMatrix />
          </div>
          <div className="overflow-auto p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', maxHeight: '38%' }}>
            <SnippetDeck />
          </div>
        </GlassPanel>

        {/* Center - Monitor */}
        <div className="flex-1 overflow-hidden">
          <SpatialMonitor onRequestImport={handleImport} />
        </div>

        {/* Right Panel */}
        <div
          className="w-64 lg:w-72 shrink-0 overflow-auto p-3 space-y-4"
          style={{
            backgroundColor: 'rgba(255,255,255,0.015)',
            borderLeft: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <TransformPanel />
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 16 }}>
            <AudioMixer />
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="flex-1 flex flex-col md:hidden overflow-hidden">
        {/* Monitor (always visible) */}
        <div className="shrink-0" style={{ height: '48%' }}>
          <SpatialMonitor onRequestImport={handleImport} />
        </div>

        {/* Panel content */}
        <div
          className="flex-1 overflow-auto p-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          {mobileTab === 'layers' && <LayerMatrix />}
          {mobileTab === 'transform' && <TransformPanel />}
          {mobileTab === 'audio' && <AudioMixer />}
          {mobileTab === 'clips' && <SnippetDeck />}
        </div>

        {/* Bottom tab bar */}
        <div
          className="h-14 shrink-0 flex items-center justify-around px-2"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            backgroundColor: 'rgba(12,12,16,0.95)',
            backdropFilter: 'blur(12px)',
          }}
          data-testid="mobile-tab-bar"
        >
          {mobileTabs.map(tab => {
            const isActive = mobileTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setMobileTab(tab.id)}
                className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-md transition-all"
                style={{ color: isActive ? '#bef264' : 'rgba(255,255,255,0.25)' }}
                data-testid={`tab-${tab.id}`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="text-[9px] font-mono">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <ExportPortal />
    </div>
  );
}
