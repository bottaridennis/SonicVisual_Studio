import React, { useEffect, useRef, useState, useCallback } from 'react';
import { VisualizerConfig, TextLayer, SelectionTarget } from '../types/visualizer';
import { visualizerRenderer } from '../visualizer/renderer';
import { audioEngine, FrequencyAnalysis } from '../audio/audioEngine';
import {
  Maximize2,
  Minimize2,
  Move,
  Crosshair,
  Type,
  Lock,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Expand,
  Eye,
  EyeOff,
} from 'lucide-react';

interface VisualizerCanvasProps {
  config: VisualizerConfig;
  selection?: SelectionTarget;
  onSelectTarget?: (target: SelectionTarget) => void;
  selectedTextLayerId?: string;
  onSelectTextLayer?: (layerId: string) => void;
  onChangeConfig?: (newConfig: VisualizerConfig) => void;
  onAnalysisUpdate?: (analysis: FrequencyAnalysis) => void;
  isCleanView?: boolean;
}

export const VisualizerCanvas: React.FC<VisualizerCanvasProps> = ({
  config,
  selection,
  onSelectTarget,
  selectedTextLayerId,
  onSelectTextLayer,
  onChangeConfig,
  onAnalysisUpdate,
  isCleanView = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomMode, setZoomMode] = useState<'fit' | '100%' | '75%'>('fit');
  const [dragTarget, setDragTarget] = useState<'visualizer' | 'text' | null>(null);
  const [draggedTextLayerId, setDraggedTextLayerId] = useState<string | null>(null);

  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    hasMoved: boolean;
  } | null>(null);

  // Active target identification
  const activeTextLayerId =
    selection?.type === 'text' ? selection.layerId : selectedTextLayerId;
  const isVisualizerSelected = selection?.type === 'visualizer';

  // Handle Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Preload background & logo images when config changes
  useEffect(() => {
    if (config.backgroundUrl) visualizerRenderer.preloadImage(config.backgroundUrl);
    if (config.logoUrl) visualizerRenderer.preloadImage(config.logoUrl);
  }, [config.backgroundUrl, config.logoUrl]);

  // Main 60FPS render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const render = () => {
      const now = performance.now();
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;

      const width = canvas.width;
      const height = canvas.height;

      // Get real-time audio FFT data
      const analysis = audioEngine.analyze();

      // Render frame
      visualizerRenderer.renderFrame(ctx, width, height, analysis, config, delta);

      if (onAnalysisUpdate) {
        onAnalysisUpdate(analysis);
      }

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [config, onAnalysisUpdate]);

  // Resize canvas when container dimensions change
  useEffect(() => {
    const updateCanvasSize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      // 16:9 Aspect Ratio Base
      let targetWidth = Math.floor(rect.width * dpr);
      let targetHeight = Math.floor(rect.height * dpr);

      if (zoomMode === '75%') {
        targetWidth = Math.floor(targetWidth * 0.75);
        targetHeight = Math.floor(targetHeight * 0.75);
      }

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        visualizerRenderer.initParticles(config, targetWidth, targetHeight);
      }
    };

    updateCanvasSize();
    const resizeObserver = new ResizeObserver(updateCanvasSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [config, zoomMode]);

  // Canvas Mouse & Touch Interactive Position Dragging
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!onChangeConfig) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    // Check if clicked on any unlocked, visible text layer
    const textLayers = config.textLayers || [];
    let hitTextLayer: TextLayer | null = null;

    for (let i = textLayers.length - 1; i >= 0; i--) {
      const layer = textLayers[i];
      if (layer.enabled && !layer.isLocked) {
        const dx = Math.abs(clickX - layer.x);
        const dy = Math.abs(clickY - layer.y);
        // Click boundary around text
        if (dx < 16 && dy < 6) {
          hitTextLayer = layer;
          break;
        }
      }
    }

    if (hitTextLayer) {
      setDragTarget('text');
      setDraggedTextLayerId(hitTextLayer.id);
      if (onSelectTarget) {
        onSelectTarget({ type: 'text', layerId: hitTextLayer.id });
      }
      if (onSelectTextLayer) {
        onSelectTextLayer(hitTextLayer.id);
      }
      dragStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: hitTextLayer.x,
        origY: hitTextLayer.y,
        hasMoved: false,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    // Check visualizer center hit
    const vizX = config.visualizerX !== undefined ? config.visualizerX : 50;
    const vizY = config.visualizerY !== undefined ? config.visualizerY : 50;
    const distToViz = Math.sqrt(Math.pow(clickX - vizX, 2) + Math.pow(clickY - vizY, 2));

    if (distToViz < 28) {
      setDragTarget('visualizer');
      if (onSelectTarget) {
        onSelectTarget({ type: 'visualizer' });
      }
      dragStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: vizX,
        origY: vizY,
        hasMoved: false,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } else {
      dragStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: 0,
        origY: 0,
        hasMoved: false,
      };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragStartRef.current || !canvasRef.current || !onChangeConfig) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const deltaPixelX = e.clientX - dragStartRef.current.startX;
    const deltaPixelY = e.clientY - dragStartRef.current.startY;

    if (Math.abs(deltaPixelX) > 4 || Math.abs(deltaPixelY) > 4) {
      dragStartRef.current.hasMoved = true;
    }

    if (!dragStartRef.current.hasMoved) return;

    const deltaX = (deltaPixelX / rect.width) * 100;
    const deltaY = (deltaPixelY / rect.height) * 100;

    if (dragTarget === 'text' && draggedTextLayerId) {
      const newX = Math.max(2, Math.min(98, Math.round(dragStartRef.current.origX + deltaX)));
      const newY = Math.max(2, Math.min(98, Math.round(dragStartRef.current.origY + deltaY)));
      const updatedLayers = (config.textLayers || []).map((l) =>
        l.id === draggedTextLayerId ? { ...l, x: newX, y: newY } : l
      );
      onChangeConfig({
        ...config,
        textLayers: updatedLayers,
      });
    } else if (dragTarget === 'visualizer') {
      const newX = Math.max(5, Math.min(95, Math.round(dragStartRef.current.origX + deltaX)));
      const newY = Math.max(5, Math.min(95, Math.round(dragStartRef.current.origY + deltaY)));
      onChangeConfig({
        ...config,
        visualizerX: newX,
        visualizerY: newY,
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragStartRef.current && !dragStartRef.current.hasMoved) {
      // Stationary click: toggle playback
      audioEngine.togglePlay();
    }

    setDragTarget(null);
    setDraggedTextLayerId(null);
    dragStartRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignored
    }
  };

  const resetToCenter = () => {
    if (onChangeConfig) {
      onChangeConfig({
        ...config,
        visualizerX: 50,
        visualizerY: 50,
      });
    }
  };

  const activeTextLayer = (config.textLayers || []).find((l) => l.id === activeTextLayerId);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-[#06070a] overflow-hidden select-none flex items-center justify-center rounded-none group"
    >
      {/* Aspect Ratio Canvas */}
      <canvas
        ref={canvasRef}
        className={`max-w-full max-h-full aspect-video object-contain block shadow-2xl ${
          dragTarget ? 'cursor-grabbing' : 'cursor-pointer'
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      {/* Direct Manipulation Gizmo: Selected Text Layer (Hidden in Clean View) */}
      {!isCleanView && activeTextLayer && activeTextLayer.enabled && (
        <div
          className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-1/2 border border-violet-400/80 rounded px-2 py-0.5 bg-violet-500/10 text-[9px] font-mono text-violet-300 flex items-center gap-1 shadow-md shadow-violet-500/20 backdrop-blur-xs"
          style={{
            left: `${activeTextLayer.x}%`,
            top: `${activeTextLayer.y}%`,
          }}
        >
          <Type className="w-2.5 h-2.5 text-violet-300" />
          <span className="font-semibold">{activeTextLayer.label || 'Testo'}</span>
          {activeTextLayer.isLocked && <Lock className="w-2.5 h-2.5 text-amber-400 ml-1" />}
        </div>
      )}

      {/* Direct Manipulation Gizmo: Selected Visualizer Frame (Hidden in Clean View) */}
      {!isCleanView && isVisualizerSelected && (
        <div
          className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-1/2 border border-dashed border-cyan-400/50 rounded-full w-40 h-40 flex items-center justify-center bg-cyan-400/5 animate-pulse"
          style={{
            left: `${config.visualizerX !== undefined ? config.visualizerX : 50}%`,
            top: `${config.visualizerY !== undefined ? config.visualizerY : 50}%`,
          }}
        >
          <Crosshair className="w-5 h-5 text-cyan-400/80" />
        </div>
      )}

      {/* Floating Viewport Studio Toolbar (Top-Right) */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 pointer-events-auto z-20">
        {/* Zoom Mode Selector */}
        <div className="flex items-center bg-[#0d1017]/80 backdrop-blur-md border border-[#1e2436] rounded-lg p-0.5 text-[11px] font-medium text-slate-300">
          <button
            onClick={() => setZoomMode('fit')}
            className={`px-2 py-1 rounded transition-colors ${
              zoomMode === 'fit' ? 'bg-violet-600/30 text-violet-300 font-semibold' : 'hover:text-white'
            }`}
            title="Adatta allo spazio (Fit)"
          >
            Adatta
          </button>
          <button
            onClick={() => setZoomMode('75%')}
            className={`px-2 py-1 rounded transition-colors ${
              zoomMode === '75%' ? 'bg-violet-600/30 text-violet-300 font-semibold' : 'hover:text-white'
            }`}
            title="Zoom 75%"
          >
            75%
          </button>
        </div>

        {/* Reset to Center Button */}
        {(config.visualizerX !== 50 || config.visualizerY !== 50) && (
          <button
            onClick={resetToCenter}
            className="px-2 py-1 bg-[#0d1017]/80 hover:bg-[#161c2b] text-cyan-300 rounded-lg border border-[#1e2436] text-xs backdrop-blur-md transition-colors flex items-center gap-1 cursor-pointer"
            title="Ripristina posizione centrale"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">Centra</span>
          </button>
        )}

        {/* Fullscreen Button */}
        <button
          onClick={toggleFullscreen}
          className="p-1.5 bg-[#0d1017]/80 hover:bg-[#161c2b] backdrop-blur-md text-white rounded-lg border border-[#1e2436] transition-colors cursor-pointer"
          title={isFullscreen ? 'Esci da schermo intero' : 'Schermo intero'}
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Viewport Info Pill (Bottom-Left) */}
      <div className="absolute bottom-2.5 left-3 flex items-center gap-2 pointer-events-none text-[10px] text-slate-400 font-mono bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-md border border-white/5">
        <span className="text-violet-400 font-semibold">16:9 PREVIEW</span>
        <span>·</span>
        <span>Trascina per spostare elementi</span>
        <span>·</span>
        <span>Spazio per Play/Pausa</span>
      </div>
    </div>
  );
};
