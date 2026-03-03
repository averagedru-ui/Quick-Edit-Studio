import { useStore, type Layer } from '@/lib/store';
import { Eye, EyeOff, Lock, Unlock, Monitor, Gamepad2, Camera, LayoutGrid, Grid3X3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const layerIcons: Record<string, typeof Monitor> = {
  background: Monitor,
  gameplay: Gamepad2,
  camera: Camera,
  hud1: LayoutGrid,
  hud2: Grid3X3,
};

export default function LayerMatrix() {
  const { layers, activeLayerId, setActiveLayerId, updateLayer } = useStore();

  return (
    <div className="space-y-1" data-testid="layer-matrix">
      <div className="flex items-center justify-between gap-1 px-1 mb-3">
        <h3
          className="text-[11px] font-mono uppercase tracking-wider"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          Layer Matrix
        </h3>
        <span
          className="text-[9px] font-mono"
          style={{ color: 'rgba(190,242,100,0.3)' }}
        >
          {layers.filter(l => l.visible).length}/{layers.length}
        </span>
      </div>

      {layers.map((layer) => {
        const Icon = layerIcons[layer.type] || LayoutGrid;
        const isActive = layer.id === activeLayerId;

        return (
          <div
            key={layer.id}
            onClick={() => setActiveLayerId(layer.id)}
            className={cn(
              "flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer transition-all duration-150",
              isActive
                ? "border"
                : "border border-transparent"
            )}
            style={isActive ? {
              backgroundColor: 'rgba(190,242,100,0.06)',
              borderColor: 'rgba(190,242,100,0.12)',
            } : {
              backgroundColor: 'rgba(255,255,255,0.015)',
            }}
            data-testid={`layer-item-${layer.id}`}
          >
            <Icon
              className="w-3.5 h-3.5 shrink-0"
              style={{ color: isActive ? '#bef264' : 'rgba(255,255,255,0.35)' }}
            />

            <div className="flex-1 min-w-0">
              <span className={cn(
                "text-xs font-medium truncate block",
                isActive ? "text-white" : "text-white/60"
              )}>
                {layer.name}
              </span>
              {isActive && (
                <span
                  className="text-[8px] font-mono uppercase tracking-wider block mt-0.5"
                  style={{ color: 'rgba(190,242,100,0.4)' }}
                >
                  {layer.type}
                </span>
              )}
            </div>

            <div className="flex items-center gap-0.5">
              <Button
                size="icon"
                variant="ghost"
                className="w-6 h-6"
                onClick={(e) => {
                  e.stopPropagation();
                  updateLayer(layer.id, { visible: !layer.visible });
                }}
                data-testid={`button-visibility-${layer.id}`}
              >
                {layer.visible
                  ? <Eye className="w-3 h-3" style={{ color: 'rgba(190,242,100,0.5)' }} />
                  : <EyeOff className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.15)' }} />
                }
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="w-6 h-6"
                onClick={(e) => {
                  e.stopPropagation();
                  updateLayer(layer.id, { locked: !layer.locked });
                }}
                data-testid={`button-lock-${layer.id}`}
              >
                {layer.locked
                  ? <Lock className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.4)' }} />
                  : <Unlock className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.15)' }} />
                }
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
