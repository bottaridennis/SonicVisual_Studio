import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, Crosshair, Grid3x3, Lock } from 'lucide-react';
import { AspectRatio, SelectionTarget, VisualizerConfig } from '../types/visualizer';
import { visualizerRenderer } from '../visualizer/renderer';
import { audioEngine } from '../audio/audioEngine';
import { IconButton, cx } from '../ui/controls';

interface StageProps {
  config: VisualizerConfig;
  aspect: AspectRatio;
  selection: SelectionTarget;
  onSelect: (s: SelectionTarget) => void;
  onChangeConfig: (updater: (prev: VisualizerConfig) => VisualizerConfig) => void;
  cleanView: boolean;
}

const ASPECT_VALUE: Record<AspectRatio, number> = { '16:9': 16 / 9, '1:1': 1, '9:16': 9 / 16 };
const SNAP = 1.2; // percent

type Drag =
  | { kind: 'text'; id: string; startX: number; startY: number; origX: number; origY: number; moved: boolean }
  | { kind: 'visualizer'; startX: number; startY: number; origX: number; origY: number; moved: boolean };

export const Stage: React.FC<StageProps> = ({ config, aspect, selection, onSelect, onChangeConfig, cleanView }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gizmoRef = useRef<HTMLDivElement>(null);
  const configRef = useRef(config);
  const selectionRef = useRef(selection);
  const dragRef = useRef<Drag | null>(null);
  configRef.current = config;
  selectionRef.current = selection;

  const [size, setSize] = useState({ w: 640, h: 360 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGuides, setShowGuides] = useState(false);
  const [snapLines, setSnapLines] = useState<{ v: boolean; h: boolean }>({ v: false, h: false });
  const [dragging, setDragging] = useState(false);

  // Fit the frame into the available area, keeping the export aspect ratio
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const fit = () => {
      const r = area.getBoundingClientRect();
      const pad = isFullscreen ? 0 : Math.min(32, r.width * 0.04);
      const aw = Math.max(50, r.width - pad * 2);
      const ah = Math.max(50, r.height - pad * 2);
      const ratio = ASPECT_VALUE[aspect];
      let w = aw;
      let h = w / ratio;
      if (h > ah) {
        h = ah;
        w = h * ratio;
      }
      setSize({ w: Math.floor(w), h: Math.floor(h) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(area);
    return () => ro.disconnect();
  }, [aspect, isFullscreen]);

  // Backing-store resolution
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let pw = Math.round(size.w * dpr);
    let ph = Math.round(size.h * dpr);
    const maxW = 2560;
    if (Math.max(pw, ph) > maxW) {
      const k = maxW / Math.max(pw, ph);
      pw = Math.round(pw * k);
      ph = Math.round(ph * k);
    }
    canvas.width = pw;
    canvas.height = ph;
  }, [size]);

  useEffect(() => {
    visualizerRenderer.preloadImage(config.backgroundUrl);
    visualizerRenderer.preloadImage(config.logoUrl);
  }, [config.backgroundUrl, config.logoUrl]);

  // Render loop (runs once; reads latest config from ref)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      const analysis = audioEngine.analyze();
      // While paused, show text layers fully (intro animations play only during playback/export)
      const playback = audioEngine.getIsPlaying() ? audioEngine.getCurrentTime() : Number.POSITIVE_INFINITY;
      visualizerRenderer.renderFrame(ctx, canvas.width, canvas.height, analysis, configRef.current, dt, playback);
      updateGizmo(canvas);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Positions the selection outline directly in the DOM each frame (no React re-render). */
  const updateGizmo = (canvas: HTMLCanvasElement) => {
    const g = gizmoRef.current;
    if (!g) return;
    const sel = selectionRef.current;
    const cfg = configRef.current;
    const k = canvas.clientWidth / canvas.width;
    if (sel.type === 'text') {
      const b = visualizerRenderer.lastTextBounds.find((x) => x.id === sel.layerId);
      if (!b) {
        g.style.display = 'none';
        return;
      }
      const pad = 6;
      g.style.display = 'block';
      g.style.borderRadius = '6px';
      g.style.left = `${b.x * k - pad}px`;
      g.style.top = `${b.y * k - pad}px`;
      g.style.width = `${b.w * k + pad * 2}px`;
      g.style.height = `${b.h * k + pad * 2}px`;
    } else if (sel.type === 'visualizer' || sel.type === 'logo') {
      const minDim = Math.min(canvas.width, canvas.height) * (cfg.visualizerScale ?? 1);
      const centred = ['classic-circle', 'turntable-vinyl', 'album-art-pulse', 'minimal', 'particles-only'].includes(cfg.layoutStyle);
      if (!centred) {
        g.style.display = 'none';
        return;
      }
      const r = Math.max(24 / k, minDim * (cfg.layoutStyle === 'album-art-pulse' ? 0.25 : cfg.innerRadiusRatio + (cfg.layoutStyle === 'turntable-vinyl' ? 0.1 : 0)));
      const x = ((cfg.visualizerX ?? 50) / 100) * canvas.width;
      const y = ((cfg.visualizerY ?? 50) / 100) * canvas.height;
      g.style.display = 'block';
      g.style.borderRadius = cfg.layoutStyle === 'album-art-pulse' ? '8px' : '50%';
      g.style.left = `${(x - r) * k}px`;
      g.style.top = `${(y - r) * k}px`;
      g.style.width = `${r * 2 * k}px`;
      g.style.height = `${r * 2 * k}px`;
    } else {
      g.style.display = 'none';
    }
  };

  // ------------------------------------------------------------ pointer interaction
  const toFrame = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      px: ((e.clientX - rect.left) / rect.width) * canvas.width,
      py: ((e.clientY - rect.top) / rect.height) * canvas.height,
      rect,
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { px, py } = toFrame(e);
    const cfg = configRef.current;

    // Text layers: top-most first
    const bounds = [...visualizerRenderer.lastTextBounds].reverse();
    const tol = 8 * (canvas.width / canvas.clientWidth);
    const hit = bounds.find((b) => px >= b.x - tol && px <= b.x + b.w + tol && py >= b.y - tol && py <= b.y + b.h + tol);
    if (hit) {
      const layer = cfg.textLayers.find((l) => l.id === hit.id);
      if (layer) {
        onSelect({ type: 'text', layerId: layer.id });
        if (!layer.isLocked) {
          dragRef.current = { kind: 'text', id: layer.id, startX: e.clientX, startY: e.clientY, origX: layer.x, origY: layer.y, moved: false };
          canvas.setPointerCapture(e.pointerId);
        }
        return;
      }
    }

    // Visualizer centre
    const vx = ((cfg.visualizerX ?? 50) / 100) * canvas.width;
    const vy = ((cfg.visualizerY ?? 50) / 100) * canvas.height;
    const minDim = Math.min(canvas.width, canvas.height) * (cfg.visualizerScale ?? 1);
    const radius = Math.max(minDim * (cfg.innerRadiusRatio + 0.12), minDim * 0.2);
    if (Math.hypot(px - vx, py - vy) < radius) {
      onSelect({ type: 'visualizer' });
      dragRef.current = { kind: 'visualizer', startX: e.clientX, startY: e.clientY, origX: cfg.visualizerX, origY: cfg.visualizerY, moved: false };
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    onSelect({ type: 'background' });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const dxPx = e.clientX - d.startX;
    const dyPx = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dxPx, dyPx) < 3) return;
    if (!d.moved) {
      d.moved = true;
      setDragging(true);
    }
    let nx = d.origX + (dxPx / rect.width) * 100;
    let ny = d.origY + (dyPx / rect.height) * 100;
    const snapV = !e.altKey && Math.abs(nx - 50) < SNAP;
    const snapH = !e.altKey && Math.abs(ny - 50) < SNAP;
    if (snapV) nx = 50;
    if (snapH) ny = 50;
    setSnapLines((s) => (s.v === snapV && s.h === snapH ? s : { v: snapV, h: snapH }));
    nx = Math.round(Math.max(0, Math.min(100, nx)) * 10) / 10;
    ny = Math.round(Math.max(0, Math.min(100, ny)) * 10) / 10;

    if (d.kind === 'text') {
      const id = d.id;
      onChangeConfig((prev) => ({
        ...prev,
        textLayers: prev.textLayers.map((l) => (l.id === id ? { ...l, x: nx, y: ny } : l)),
      }));
    } else {
      onChangeConfig((prev) => ({ ...prev, visualizerX: nx, visualizerY: ny }));
    }
  };

  const endDrag = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = null;
    setDragging(false);
    setSnapLines({ v: false, h: false });
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  // ------------------------------------------------------------ fullscreen
  const toggleFullscreen = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    const h = () => setIsFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  const selectedLayer = selection.type === 'text' ? config.textLayers.find((l) => l.id === selection.layerId) : undefined;
  const showChrome = !cleanView && !isFullscreen;

  return (
    <div ref={wrapRef} className={cx('relative flex-1 min-h-0 flex flex-col', isFullscreen ? 'bg-black' : 'stage-bg')}>
      {/* Stage toolbar */}
      {showChrome && (
        <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2 h-8 px-2.5 rounded-lg bg-panel/80 backdrop-blur border border-line text-[11px] font-mono text-dim">
            <span className="w-1.5 h-1.5 rounded-full bg-acid shadow-[0_0_8px_var(--color-acid)]" />
            <span>ANTEPRIMA {aspect}</span>
          </div>
          <div className="pointer-events-auto flex items-center gap-1 p-0.5 rounded-lg bg-panel/80 backdrop-blur border border-line">
            <IconButton size="sm" label="Guide area sicura" active={showGuides} onClick={() => setShowGuides(!showGuides)}>
              <Grid3x3 className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton
              size="sm"
              label="Centra visualizer"
              onClick={() => onChangeConfig((p) => ({ ...p, visualizerX: 50, visualizerY: 50 }))}
            >
              <Crosshair className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton size="sm" label={isFullscreen ? 'Esci da schermo intero' : 'Schermo intero (F)'} onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </IconButton>
          </div>
        </div>
      )}
      {isFullscreen && (
        <button
          onClick={toggleFullscreen}
          className="absolute top-4 right-4 z-10 opacity-0 hover:opacity-100 transition-opacity w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center"
          aria-label="Esci da schermo intero"
        >
          <Minimize2 className="w-4 h-4" />
        </button>
      )}

      <div ref={areaRef} className={cx('flex-1 min-h-0 flex items-center justify-center', showChrome && 'pt-12 pb-3')}>
        <div className="relative" style={{ width: size.w, height: size.h }}>
          <canvas
            ref={canvasRef}
            style={{ width: size.w, height: size.h }}
            className={cx(
              'block touch-none',
              !isFullscreen && 'rounded-md shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.06)]',
              dragging ? 'cursor-grabbing' : 'cursor-default'
            )}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDoubleClick={() => audioEngine.togglePlay()}
          />

          {/* Overlays */}
          <div className="absolute inset-0 pointer-events-none">
            {showChrome && (
              <div
                ref={gizmoRef}
                className="absolute border border-acid/90 shadow-[0_0_0_1px_rgba(0,0,0,0.5),0_0_20px_-4px_var(--color-acid)]"
                style={{ display: 'none' }}
              >
                {selectedLayer && (
                  <span className="absolute -top-5 left-0 flex items-center gap-1 px-1.5 h-4 rounded bg-acid text-bg text-[10px] font-semibold whitespace-nowrap">
                    {selectedLayer.label}
                    {selectedLayer.isLocked && <Lock className="w-2.5 h-2.5" />}
                  </span>
                )}
              </div>
            )}
            {snapLines.v && <div className="absolute top-0 bottom-0 left-1/2 w-px bg-[#ff3df5]" />}
            {snapLines.h && <div className="absolute left-0 right-0 top-1/2 h-px bg-[#ff3df5]" />}
            {showGuides && showChrome && (
              <>
                <div className="absolute inset-[5%] border border-dashed border-white/25 rounded-sm" />
                <div className="absolute inset-[10%] border border-dashed border-white/15 rounded-sm" />
                <div className="absolute top-0 bottom-0 left-1/3 w-px bg-white/10" />
                <div className="absolute top-0 bottom-0 left-2/3 w-px bg-white/10" />
                <div className="absolute left-0 right-0 top-1/3 h-px bg-white/10" />
                <div className="absolute left-0 right-0 top-2/3 h-px bg-white/10" />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
