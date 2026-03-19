import { useState, useRef } from 'react';
import { useStore } from '@/lib/store';
import SplashScreen from '@/components/splash-screen';
import SpatialMonitor from '@/components/spatial-monitor';
import LayerMatrix from '@/components/layer-matrix';
import { TransformPanel, AudioMixer, SnippetDeck } from '@/components/control-panels';
import ExportPortal from '@/components/export-portal';
import AiClipper from '@/components/ai-clipper';
import { Upload, Download, Sparkles, Layers, Move, Volume2, Scissors, ChevronUp, ChevronDown } from 'lucide-react';

type MobileTab = 'layers' | 'transform' | 'audio' | 'clips';

const mobileTabs: { id: MobileTab; label: string; icon: typeof Layers }[] = [
  { id: 'layers', label: 'Layers', icon: Layers },
  { id: 'transform', label: 'Transform', icon: Move },
  { id: 'audio', label: 'Audio', icon: Volume2 },
  { id: 'clips', label: 'Clips', icon: Scissors },
];

export default function EditorPage() {
  const [showSplash, setShowSplash] = useState(true);
  const [mobileTab, setMobileTab] = useState<MobileTab>('layers');
  const [panelExpanded, setPanelExpanded] = useState(false);
  const { setVideoFile, setShowExport, setShowAiClipper, previewMode } = useStore();
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
        className="h-11 shrink-0 flex items-center justify-between px-3 md:px-5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.01)' }}
        data-testid="editor-header"
      >
        <div className="flex items-center gap-2">
          <h1 className="text-sm md:text-lg font-black tracking-tight text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
            CLIPR
          </h1>
          <span
            className="text-[8px] font-mono tracking-[0.25em] uppercase"
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
        <div className="flex items-center gap-1">
          <button
            onClick={handleImport}
            className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-wider transition-colors"
            style={{ color: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            data-testid="button-import"
          >
            <Upload className="w-3 h-3" />
            <span className="hidden sm:inline">Import</span>
          </button>
          <button
            onClick={() => setShowAiClipper(true)}
            className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-wider transition-colors"
            style={{ color: 'rgba(190,242,100,0.8)', backgroundColor: 'rgba(190,242,100,0.05)', border: '1px solid rgba(190,242,100,0.1)' }}
            data-testid="button-ai-clipper"
          >
            <Sparkles className="w-3 h-3" />
            <span className="hidden sm:inline">AI Clip</span>
          </button>
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-wider transition-colors"
            style={{ color: '#bef264', backgroundColor: 'rgba(190,242,100,0.08)', border: '1px solid rgba(190,242,100,0.15)' }}
            data-testid="button-export"
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </header>

      {/* Desktop Layout */}
      <div className="flex-1 hidden md:flex overflow-hidden">
        <div
          className="w-56 lg:w-60 shrink-0 flex flex-col overflow-hidden backdrop-blur-xl"
          style={{
            backgroundColor: 'rgba(255,255,255,0.015)',
            borderRight: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <div className="flex-1 overflow-auto p-3">
            <LayerMatrix />
          </div>
          <div className="overflow-auto p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', maxHeight: '38%' }}>
            <SnippetDeck />
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <SpatialMonitor onRequestImport={handleImport} />
        </div>

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
        <div
          className="shrink-0 transition-all duration-200"
          style={{ flex: panelExpanded ? '0 0 35%' : '1 1 0%', minHeight: panelExpanded ? 180 : 0 }}
        >
          <SpatialMonitor onRequestImport={handleImport} />
        </div>

        <div
          className="flex flex-col overflow-hidden transition-all duration-200"
          style={{
            flex: panelExpanded ? '1 1 0%' : '0 0 auto',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <button
            onClick={() => setPanelExpanded(!panelExpanded)}
            className="shrink-0 flex items-center justify-center gap-1 py-1.5"
            style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
            data-testid="button-toggle-panel"
          >
            {panelExpanded
              ? <ChevronDown className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
              : <ChevronUp className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
            }
            <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {panelExpanded ? 'Collapse' : 'Controls'}
            </span>
          </button>

          {panelExpanded && (
            <div className="flex-1 overflow-auto px-3 py-2">
              {mobileTab === 'layers' && <LayerMatrix />}
              {mobileTab === 'transform' && <TransformPanel />}
              {mobileTab === 'audio' && <AudioMixer />}
              {mobileTab === 'clips' && <SnippetDeck />}
            </div>
          )}
        </div>

        <div
          className="shrink-0 flex items-stretch justify-around"
          style={{
            height: 48,
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
                onClick={() => {
                  setMobileTab(tab.id);
                  setPanelExpanded(true);
                }}
                className="flex flex-col items-center justify-center flex-1 transition-all"
                style={{
                  color: isActive && panelExpanded ? '#bef264' : 'rgba(255,255,255,0.25)',
                  borderTop: isActive && panelExpanded ? '2px solid #bef264' : '2px solid transparent',
                }}
                data-testid={`tab-${tab.id}`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="text-[9px] font-mono mt-0.5">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <ExportPortal />
      <AiClipper />
    </div>
  );
}
