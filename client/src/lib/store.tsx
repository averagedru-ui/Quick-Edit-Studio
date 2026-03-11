import { createContext, useContext, useState, useCallback, useRef, type ReactNode, type RefObject } from 'react';

export interface SourceCrop {
  x: number;
  y: number;
  w: number;
  h: number;
  zoom: number;
}

export interface TargetTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  skewX: number;
  skewY: number;
}

export interface AudioSettings {
  gain: number;
  muted: boolean;
  solo: boolean;
  pan: number;
  eqLow: number;
  eqMid: number;
  eqHigh: number;
}

export interface Layer {
  id: string;
  name: string;
  type: 'background' | 'gameplay' | 'camera' | 'hud1' | 'hud2';
  visible: boolean;
  locked: boolean;
  source: SourceCrop;
  target: TargetTransform;
  audio: AudioSettings;
  shape: 'rect' | 'circle' | 'rounded';
  opacity: number;
  blur: number;
}

export interface Snippet {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  summary: string;
}

const defaultLayers: Layer[] = [
  {
    id: 'bg',
    name: 'Background',
    type: 'background',
    visible: true,
    locked: false,
    source: { x: 0, y: 0, w: 100, h: 100, zoom: 100 },
    target: { x: 0, y: 0, scale: 120, rotation: 0, skewX: 0, skewY: 0 },
    audio: { gain: 0, muted: true, solo: false, pan: 0, eqLow: 0, eqMid: 0, eqHigh: 0 },
    shape: 'rect',
    opacity: 50,
    blur: 12,
  },
  {
    id: 'gameplay',
    name: 'Gameplay',
    type: 'gameplay',
    visible: true,
    locked: false,
    source: { x: 15, y: 0, w: 70, h: 100, zoom: 100 },
    target: { x: 0, y: 25, scale: 100, rotation: 0, skewX: 0, skewY: 0 },
    audio: { gain: 80, muted: false, solo: false, pan: 0, eqLow: 0, eqMid: 0, eqHigh: 0 },
    shape: 'rect',
    opacity: 100,
    blur: 0,
  },
  {
    id: 'camera',
    name: 'Camera',
    type: 'camera',
    visible: true,
    locked: false,
    source: { x: 0, y: 70, w: 20, h: 30, zoom: 100 },
    target: { x: 5, y: 3, scale: 28, rotation: 0, skewX: 0, skewY: 0 },
    audio: { gain: 100, muted: false, solo: false, pan: 0, eqLow: 2, eqMid: 0, eqHigh: 1 },
    shape: 'circle',
    opacity: 100,
    blur: 0,
  },
  {
    id: 'hud1',
    name: 'HUD 1',
    type: 'hud1',
    visible: false,
    locked: false,
    source: { x: 0, y: 85, w: 20, h: 15, zoom: 100 },
    target: { x: 5, y: 88, scale: 35, rotation: 0, skewX: 0, skewY: 0 },
    audio: { gain: 0, muted: true, solo: false, pan: 0, eqLow: 0, eqMid: 0, eqHigh: 0 },
    shape: 'rounded',
    opacity: 100,
    blur: 0,
  },
  {
    id: 'hud2',
    name: 'HUD 2',
    type: 'hud2',
    visible: false,
    locked: false,
    source: { x: 80, y: 85, w: 20, h: 15, zoom: 100 },
    target: { x: 62, y: 88, scale: 35, rotation: 0, skewX: 0, skewY: 0 },
    audio: { gain: 0, muted: true, solo: false, pan: 0, eqLow: 0, eqMid: 0, eqHigh: 0 },
    shape: 'rounded',
    opacity: 100,
    blur: 0,
  },
];

export type PreviewMode = 'vertical' | 'horizontal';
export type RenderQuality = 'low' | 'med' | 'high';

interface StoreContextType {
  videoFile: File | null;
  videoUrl: string | null;
  videoDuration: number;
  currentTime: number;
  isPlaying: boolean;
  layers: Layer[];
  snippets: Snippet[];
  activeLayerId: string;
  showExport: boolean;
  previewMode: PreviewMode;
  renderQuality: RenderQuality;
  videoRef: RefObject<HTMLVideoElement | null>;

  setVideoFile: (file: File) => void;
  setVideoDuration: (d: number) => void;
  setCurrentTime: (t: number) => void;
  setIsPlaying: (p: boolean) => void;
  updateLayer: (id: string, updates: Partial<Layer>) => void;
  updateLayerSource: (id: string, source: Partial<SourceCrop>) => void;
  updateLayerTarget: (id: string, target: Partial<TargetTransform>) => void;
  updateLayerAudio: (id: string, audio: Partial<AudioSettings>) => void;
  resetLayerSource: (id: string) => void;
  resetLayerTarget: (id: string) => void;
  resetLayerAppearance: (id: string) => void;
  resetLayerAudio: (id: string) => void;
  setActiveLayerId: (id: string) => void;
  addSnippet: (snippet: Omit<Snippet, 'id'>) => void;
  removeSnippet: (id: string) => void;
  setShowExport: (show: boolean) => void;
  setPreviewMode: (mode: PreviewMode) => void;
  setRenderQuality: (q: RenderQuality) => void;
  seekTo: (time: number) => void;
}

const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [videoFile, setVideoFileState] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [layers, setLayers] = useState<Layer[]>(defaultLayers);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [activeLayerId, setActiveLayerId] = useState('gameplay');
  const [showExport, setShowExport] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('vertical');
  const [renderQuality, setRenderQuality] = useState<RenderQuality>('med');
  const videoRef = useRef<HTMLVideoElement>(null);

  const setVideoFile = useCallback((file: File) => {
    setVideoUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setVideoFileState(file);
    setCurrentTime(0);
    setIsPlaying(false);
  }, []);

  const updateLayer = useCallback((id: string, updates: Partial<Layer>) => {
    setLayers(prev => prev.map(l => {
      if (l.id !== id) return l;
      const metaKeys = ['visible', 'locked'] as const;
      const isMeta = Object.keys(updates).every(k => (metaKeys as readonly string[]).includes(k));
      if (l.locked && !isMeta) return l;
      return { ...l, ...updates };
    }));
  }, []);

  const updateLayerSource = useCallback((id: string, source: Partial<SourceCrop>) => {
    setLayers(prev => prev.map(l => {
      if (l.id !== id || l.locked) return l;
      return { ...l, source: { ...l.source, ...source } };
    }));
  }, []);

  const updateLayerTarget = useCallback((id: string, target: Partial<TargetTransform>) => {
    setLayers(prev => prev.map(l => {
      if (l.id !== id || l.locked) return l;
      return { ...l, target: { ...l.target, ...target } };
    }));
  }, []);

  const updateLayerAudio = useCallback((id: string, audio: Partial<AudioSettings>) => {
    setLayers(prev => prev.map(l => {
      if (l.id !== id || l.locked) return l;
      return { ...l, audio: { ...l.audio, ...audio } };
    }));
  }, []);

  const resetLayerSource = useCallback((id: string) => {
    setLayers(prev => prev.map(l => {
      if (l.id !== id || l.locked) return l;
      const original = defaultLayers.find(d => d.id === id);
      if (!original) return l;
      return { ...l, source: { ...original.source } };
    }));
  }, []);

  const resetLayerTarget = useCallback((id: string) => {
    setLayers(prev => prev.map(l => {
      if (l.id !== id || l.locked) return l;
      const original = defaultLayers.find(d => d.id === id);
      if (!original) return l;
      return { ...l, target: { ...original.target } };
    }));
  }, []);

  const resetLayerAppearance = useCallback((id: string) => {
    setLayers(prev => prev.map(l => {
      if (l.id !== id || l.locked) return l;
      const original = defaultLayers.find(d => d.id === id);
      if (!original) return l;
      return { ...l, opacity: original.opacity, shape: original.shape, blur: original.blur };
    }));
  }, []);

  const resetLayerAudio = useCallback((id: string) => {
    setLayers(prev => prev.map(l => {
      if (l.id !== id || l.locked) return l;
      const original = defaultLayers.find(d => d.id === id);
      if (!original) return l;
      return { ...l, audio: { ...original.audio } };
    }));
  }, []);

  const addSnippet = useCallback((snippet: Omit<Snippet, 'id'>) => {
    const id = `snippet-${Date.now()}`;
    setSnippets(prev => [...prev, { ...snippet, id }]);
  }, []);

  const removeSnippet = useCallback((id: string) => {
    setSnippets(prev => prev.filter(s => s.id !== id));
  }, []);

  const seekTo = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
    setCurrentTime(time);
  }, []);

  return (
    <StoreContext.Provider value={{
      videoFile, videoUrl, videoDuration, currentTime, isPlaying,
      layers, snippets, activeLayerId, showExport, previewMode, renderQuality, videoRef,
      setVideoFile, setVideoDuration, setCurrentTime, setIsPlaying,
      updateLayer, updateLayerSource, updateLayerTarget, updateLayerAudio,
      resetLayerSource, resetLayerTarget, resetLayerAppearance, resetLayerAudio,
      setActiveLayerId, addSnippet, removeSnippet, setShowExport, setPreviewMode, setRenderQuality, seekTo,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
