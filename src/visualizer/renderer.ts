import { VisualizerConfig, TextLayer } from '../types/visualizer';
import { FrequencyAnalysis } from '../audio/analysis';
import { shiftHue, withAlpha } from './color';

/**
 * Resolution-independent canvas renderer.
 *
 * All geometry is expressed relative to the frame (u = min(width,height)/1000),
 * and all motion is time-based, so the live preview and a 4K export look identical
 * whatever the frame rate.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseSize: number;
  maxAlpha: number;
  life: number; // seconds
  maxLife: number; // seconds
  twinkle: number;
  phase: number;
}

interface Ring {
  r: number;
  alpha: number;
  width: number;
}

export interface TextBounds {
  id: string;
  /** Bounding box in frame pixels (unrotated). */
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Palette {
  primary: string;
  secondary: string;
  glow: string;
  particle: string;
  logoBorder: string;
}

type Ctx = CanvasRenderingContext2D;

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function drawImageCover(ctx: Ctx, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number) {
  const iw = (img as HTMLImageElement).naturalWidth || img.width;
  const ih = (img as HTMLImageElement).naturalHeight || img.height;
  if (!iw || !ih) return;
  const r = Math.max(w / iw, h / ih);
  const sw = w / r;
  const sh = h / r;
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
}

function hexPath(ctx: Ctx, cx: number, cy: number, r: number, rotation = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = rotation + (i * Math.PI) / 3;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** Smooth closed/open curve through points using quadratic mid-point interpolation. */
function smoothPath(ctx: Ctx, pts: { x: number; y: number }[], closed: boolean) {
  const n = pts.length;
  if (n < 2) return;
  if (closed) {
    const last = pts[n - 1];
    const first = pts[0];
    ctx.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2);
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % n];
      ctx.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2);
    }
    ctx.closePath();
  } else {
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < n - 1; i++) {
      const p = pts[i];
      const q = pts[i + 1];
      ctx.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2);
    }
    ctx.lineTo(pts[n - 1].x, pts[n - 1].y);
  }
}

export class VisualizerRenderer {
  private particles: Particle[] = [];
  private particleKey = '';
  private imageCache = new Map<string, HTMLImageElement>();
  private spectrumState = new Map<number, Float32Array>();
  private peakState = new Map<number, Float32Array>();
  private rings: Ring[] = [];
  private flash = 0;
  private shakeX = 0;
  private shakeY = 0;
  private zoom = 1;
  private timeSec = 0;
  private vinylAngle = 0;
  private logoAngle = 0;
  private bassSmooth = 0;

  // Offscreen buffers
  private layer: HTMLCanvasElement | null = null;
  private tint: HTMLCanvasElement | null = null;
  private bgCache: { key: string; canvas: HTMLCanvasElement } | null = null;
  private grain: HTMLCanvasElement | null = null;
  private sprites = new Map<string, HTMLCanvasElement>();

  /** Text layer bounding boxes from the last rendered frame (for hit-testing & gizmos). */
  public lastTextBounds: TextBounds[] = [];

  // ------------------------------------------------------------------ public API

  reset() {
    this.particles = [];
    this.particleKey = '';
    this.spectrumState.clear();
    this.peakState.clear();
    this.rings = [];
    this.flash = 0;
    this.shakeX = this.shakeY = 0;
    this.zoom = 1;
    this.timeSec = 0;
    this.vinylAngle = 0;
    this.logoAngle = 0;
    this.bassSmooth = 0;
  }

  preloadImage(url: string): Promise<HTMLImageElement | null> {
    if (!url) return Promise.resolve(null);
    const cached = this.imageCache.get(url);
    if (cached && cached.complete && cached.naturalWidth > 0) return Promise.resolve(cached);
    return new Promise((resolve) => {
      const img = cached || new Image();
      if (!cached) {
        if (!url.startsWith('data:') && !url.startsWith('blob:')) img.crossOrigin = 'anonymous';
        this.imageCache.set(url, img);
      }
      const done = () => resolve(img.naturalWidth > 0 ? img : null);
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', () => resolve(null), { once: true });
      if (!cached) img.src = url;
      else if (img.complete) done();
    });
  }

  private getImage(url: string): HTMLImageElement | null {
    if (!url) return null;
    let img = this.imageCache.get(url);
    if (!img) {
      img = new Image();
      if (!url.startsWith('data:') && !url.startsWith('blob:')) img.crossOrigin = 'anonymous';
      img.src = url;
      this.imageCache.set(url, img);
    }
    return img.complete && img.naturalWidth > 0 ? img : null;
  }

  /**
   * Draws one frame.
   * @param dtMs  elapsed real time since previous frame
   * @param playbackTime  current position in the track (seconds), used for text intro animations
   */
  renderFrame(
    ctx: Ctx,
    width: number,
    height: number,
    analysis: FrequencyAnalysis,
    config: VisualizerConfig,
    dtMs = 16.67,
    playbackTime = 0
  ) {
    const dt = Math.max(0, Math.min(0.1, dtMs / 1000));
    const k = dt * 60; // frame-normalised step
    this.timeSec += dt;

    const u = Math.min(width, height) / 1000;
    const bass = analysis.bassWeight;
    this.bassSmooth += (bass - this.bassSmooth) * Math.min(1, dt * 14);

    const hue = config.colorCycleSpeed ? (this.timeSec * config.colorCycleSpeed) % 360 : 0;
    const pal: Palette = {
      primary: shiftHue(config.primaryColor, hue),
      secondary: shiftHue(config.secondaryColor, hue),
      glow: shiftHue(config.glowColor, hue),
      particle: shiftHue(config.particleColor, hue),
      logoBorder: shiftHue(config.logoBorderColor, hue),
    };

    // ---- beat-driven state
    if (analysis.isBeatHit) {
      if (config.beatFlash) this.flash = Math.min(1, 0.55 + bass * 0.5);
      if (config.shockwaveRings && this.rings.length < 8) {
        const { minDim } = this.center(config, width, height);
        this.rings.push({ r: minDim * config.innerRadiusRatio, alpha: 0.75, width: 6 * u });
      }
    }
    this.flash = Math.max(0, this.flash - dt * 3.2);

    // ---- camera
    let tsx = 0;
    let tsy = 0;
    if (config.bassCameraShake && bass > 0.42) {
      const mag = (bass - 0.42) * 26 * u;
      tsx = (Math.random() - 0.5) * mag;
      tsy = (Math.random() - 0.5) * mag;
    }
    const easing = Math.min(1, dt * 15);
    this.shakeX += (tsx - this.shakeX) * easing;
    this.shakeY += (tsy - this.shakeY) * easing;
    const targetZoom = 1 + this.bassSmooth * (config.bassZoomIntensity || 0);
    this.zoom += (targetZoom - this.zoom) * Math.min(1, dt * 12);

    const { cx, cy } = this.center(config, width, height);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';

    // ---- 1. background (with its own gentle parallax)
    this.renderBackground(ctx, width, height, config, u);

    // ---- 2. visualizer + particles into a layer (for chromatic split)
    const layer = this.ensureLayer(width, height);
    const lctx = layer.getContext('2d')!;
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.clearRect(0, 0, width, height);
    lctx.translate(cx + this.shakeX, cy + this.shakeY);
    lctx.scale(this.zoom, this.zoom);
    lctx.translate(-cx, -cy);

    this.renderRings(lctx, config, width, height, pal, u, k);
    this.renderParticles(lctx, width, height, config, analysis, pal, u, dt, k);
    this.renderByLayout(lctx, width, height, config, analysis, pal, u, dt);
    lctx.setTransform(1, 0, 0, 1, 0, 0);

    const chroma = (config.chromaticAberration || 0) * Math.max(0, this.bassSmooth - 0.25) * 1.6;
    if (chroma > 0.02) {
      const off = chroma * 14 * u;
      const tint = this.ensureTint(width, height);
      const tctx = tint.getContext('2d')!;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(0.55, chroma);
      for (const [color, dx] of [
        ['#ff2a55', -off],
        ['#22e1ff', off],
      ] as const) {
        tctx.globalCompositeOperation = 'source-over';
        tctx.clearRect(0, 0, width, height);
        tctx.drawImage(layer, 0, 0);
        tctx.globalCompositeOperation = 'source-in';
        tctx.fillStyle = color;
        tctx.fillRect(0, 0, width, height);
        ctx.drawImage(tint, dx, 0);
      }
      ctx.restore();
    }
    ctx.drawImage(layer, 0, 0);

    // ---- 3. beat flash
    if (this.flash > 0.01) {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.75);
      g.addColorStop(0, withAlpha(pal.glow, this.flash * 0.35));
      g.addColorStop(0.5, withAlpha(pal.glow, this.flash * 0.12));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    // ---- 4. text layers
    this.renderTypography(ctx, width, height, config, bass, playbackTime);

    // ---- 5. film grain
    if (config.filmGrain > 0) this.renderGrain(ctx, width, height, config.filmGrain, u);

    ctx.restore();
  }

  // ------------------------------------------------------------------ helpers

  private center(config: VisualizerConfig, width: number, height: number) {
    const cx = ((config.visualizerX ?? 50) / 100) * width;
    const cy = ((config.visualizerY ?? 50) / 100) * height;
    const scale = config.visualizerScale ?? 1;
    const minDim = Math.min(width, height) * scale;
    return { cx, cy, scale, minDim };
  }

  private ensureLayer(w: number, h: number) {
    if (!this.layer || this.layer.width !== w || this.layer.height !== h) this.layer = makeCanvas(w, h);
    return this.layer;
  }

  private ensureTint(w: number, h: number) {
    if (!this.tint || this.tint.width !== w || this.tint.height !== h) this.tint = makeCanvas(w, h);
    return this.tint;
  }

  /** Soft radial sprite used for glowing particles (much cheaper than shadowBlur). */
  private sprite(color: string, glow: boolean): HTMLCanvasElement {
    const key = `${color}|${glow}`;
    let s = this.sprites.get(key);
    if (s) return s;
    const size = 64;
    s = makeCanvas(size, size);
    const c = s.getContext('2d')!;
    const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    if (glow) {
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.12, withAlpha(color, 1));
      g.addColorStop(0.35, withAlpha(color, 0.35));
      g.addColorStop(1, withAlpha(color, 0));
    } else {
      g.addColorStop(0, withAlpha(color, 1));
      g.addColorStop(0.3, withAlpha(color, 1));
      g.addColorStop(0.42, withAlpha(color, 0));
      g.addColorStop(1, withAlpha(color, 0));
    }
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
    if (this.sprites.size > 48) this.sprites.clear();
    this.sprites.set(key, s);
    return s;
  }

  /** Log-spaced, attack/decay-smoothed spectrum with `count` bands (0–1). */
  private spectrum(count: number, analysis: FrequencyAnalysis, smoothing: number): Float32Array {
    let state = this.spectrumState.get(count);
    if (!state) {
      state = new Float32Array(count);
      this.spectrumState.set(count, state);
    }
    const data = analysis.frequencyData;
    const bins = data.length;
    const hzPerBin = analysis.sampleRate / 2 / bins;
    const fMin = 32;
    const fMax = Math.min(15000, analysis.sampleRate / 2);
    const logMin = Math.log(fMin);
    const logRange = Math.log(fMax) - logMin;
    const decay = Math.max(0, Math.min(0.97, smoothing));

    for (let i = 0; i < count; i++) {
      const f0 = Math.exp(logMin + (i / count) * logRange);
      const f1 = Math.exp(logMin + ((i + 1) / count) * logRange);
      let b0 = Math.floor(f0 / hzPerBin);
      let b1 = Math.max(b0, Math.floor(f1 / hzPerBin));
      b0 = Math.min(bins - 1, b0);
      b1 = Math.min(bins - 1, b1);
      let max = 0;
      for (let b = b0; b <= b1; b++) if (data[b] > max) max = data[b];
      // gentle tilt so highs are visible next to heavy lows
      const tilt = 0.8 + Math.pow(i / count, 0.8) * 0.55;
      let v = Math.min(1, (max / 255) * tilt);
      v = v * v * (3 - 2 * v) * 0.85 + v * 0.15; // soft contrast curve
      const prev = state[i];
      state[i] = v > prev ? prev + (v - prev) * 0.65 : prev * decay + v * (1 - decay);
    }
    return state;
  }

  private peaks(values: Float32Array, dt: number): Float32Array {
    let p = this.peakState.get(values.length);
    if (!p) {
      p = new Float32Array(values.length);
      this.peakState.set(values.length, p);
    }
    for (let i = 0; i < values.length; i++) {
      p[i] = values[i] >= p[i] ? values[i] : Math.max(values[i], p[i] - dt * 0.55);
    }
    return p;
  }

  /** Returns value for bar i, optionally mirrored so lows sit at both ends. */
  private mirrored(values: Float32Array, i: number, total: number, mirror: boolean) {
    if (!mirror) return values[Math.floor((i / total) * values.length)];
    const half = total / 2;
    const idx = i < half ? i : total - 1 - i;
    return values[Math.min(values.length - 1, Math.floor((idx / half) * values.length))];
  }

  private applyGlow(ctx: Ctx, config: VisualizerConfig, color: string, u: number, mult = 1) {
    if (config.glowIntensity > 0) {
      ctx.shadowBlur = config.glowIntensity * u * 1.4 * mult;
      ctx.shadowColor = color;
    } else {
      ctx.shadowBlur = 0;
    }
  }

  // ------------------------------------------------------------------ background

  private renderBackground(ctx: Ctx, width: number, height: number, config: VisualizerConfig, u: number) {
    const img = this.getImage(config.backgroundUrl);
    if (img) {
      const margin = config.backgroundParallax ? 0.06 : 0;
      const bw = Math.round(width * (1 + margin));
      const bh = Math.round(height * (1 + margin));
      const blurPx = (config.backgroundBlur || 0) * u * 0.9;
      const key = `${config.backgroundUrl.length}|${config.backgroundUrl.slice(-48)}|${bw}x${bh}|${blurPx.toFixed(1)}`;
      if (!this.bgCache || this.bgCache.key !== key) {
        const c = makeCanvas(bw, bh);
        const cctx = c.getContext('2d')!;
        if (blurPx > 0) {
          // draw slightly larger to hide blurred transparent edges
          const pad = blurPx * 2.5;
          cctx.filter = `blur(${blurPx}px)`;
          drawImageCover(cctx, img, -pad, -pad, bw + pad * 2, bh + pad * 2);
          cctx.filter = 'none';
        } else {
          drawImageCover(cctx, img, 0, 0, bw, bh);
        }
        this.bgCache = { key, canvas: c };
      }
      let ox = (width - bw) / 2;
      let oy = (height - bh) / 2;
      if (config.backgroundParallax) {
        ox += Math.sin(this.timeSec * 0.13) * width * margin * 0.35 - this.shakeX * 0.3;
        oy += Math.cos(this.timeSec * 0.11) * height * margin * 0.35 - this.shakeY * 0.3;
      }
      const z = 1 + (this.zoom - 1) * 0.4;
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.scale(z, z);
      ctx.translate(-width / 2, -height / 2);
      ctx.drawImage(this.bgCache.canvas, ox, oy);
      ctx.restore();
    } else {
      const g = ctx.createRadialGradient(width / 2, height * 0.45, 0, width / 2, height / 2, Math.max(width, height) * 0.8);
      g.addColorStop(0, '#1b1530');
      g.addColorStop(0.55, '#0b0a14');
      g.addColorStop(1, '#030305');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
    }

    if (config.backgroundDim > 0) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(0.95, config.backgroundDim)})`;
      ctx.fillRect(0, 0, width, height);
    }

    if (config.backgroundVignette > 0) {
      const { cx, cy } = this.center(config, width, height);
      const radius = Math.hypot(width, height) * 0.6;
      const v = ctx.createRadialGradient(cx, cy, radius * 0.25, cx, cy, radius);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(0.65, `rgba(0,0,0,${config.backgroundVignette * 0.45})`);
      v.addColorStop(1, `rgba(0,0,0,${Math.min(1, config.backgroundVignette * 1.05)})`);
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, width, height);
    }
  }

  private renderGrain(ctx: Ctx, width: number, height: number, amount: number, u: number) {
    if (!this.grain) {
      const size = 200;
      this.grain = makeCanvas(size, size);
      const g = this.grain.getContext('2d')!;
      const img = g.createImageData(size, size);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    }
    const pattern = ctx.createPattern(this.grain, 'repeat');
    if (!pattern) return;
    const scale = Math.max(1, u * 1.2);
    const ox = Math.random() * 200;
    const oy = Math.random() * 200;
    pattern.setTransform(new DOMMatrix([scale, 0, 0, scale, ox, oy]));
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = Math.min(0.5, amount * 0.35);
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // ------------------------------------------------------------------ rings & particles

  private renderRings(ctx: Ctx, config: VisualizerConfig, width: number, height: number, pal: Palette, u: number, k: number) {
    if (!this.rings.length) return;
    const { cx, cy, minDim } = this.center(config, width, height);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const ring of this.rings) {
      ring.r += minDim * 0.009 * k;
      ring.alpha *= Math.pow(0.95, k);
      ring.width *= Math.pow(0.985, k);
      ctx.strokeStyle = withAlpha(pal.glow, ring.alpha * 0.8);
      ctx.lineWidth = Math.max(0.5, ring.width);
      ctx.beginPath();
      if (config.layoutStyle === 'album-art-pulse') {
        const s = ring.r * 2.1;
        ctx.roundRect(cx - s / 2, cy - s / 2, s, s, s * 0.06);
      } else {
        ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
      }
      ctx.stroke();
    }
    ctx.restore();
    this.rings = this.rings.filter((r) => r.alpha > 0.02 && r.r < Math.hypot(width, height));
  }

  private spawnParticle(config: VisualizerConfig, width: number, height: number, initial: boolean): Particle {
    const { cx, cy, minDim } = this.center(config, width, height);
    const u = Math.min(width, height) / 1000;
    const speed =
      (config.particleMinSpeed + Math.random() * Math.max(0, config.particleMaxSpeed - config.particleMinSpeed)) * u * 1.25;
    const mode = config.particleDispersion || 'radial';
    let x: number;
    let y: number;
    let vx: number;
    let vy: number;
    if (mode === 'upward') {
      x = Math.random() * width;
      y = initial ? Math.random() * height : height + 10 * u;
      vx = (Math.random() - 0.5) * speed * 0.5;
      vy = -speed * (0.7 + Math.random() * 0.8);
    } else if (mode === 'ambient') {
      x = Math.random() * width;
      y = Math.random() * height;
      const a = Math.random() * Math.PI * 2;
      vx = Math.cos(a) * speed * 0.35;
      vy = Math.sin(a) * speed * 0.35;
    } else {
      const a = Math.random() * Math.PI * 2;
      const r0 = minDim * config.innerRadiusRatio;
      const dist = initial ? r0 + Math.random() * minDim * 0.6 : r0 * (0.95 + Math.random() * 0.15);
      x = cx + Math.cos(a) * dist;
      y = cy + Math.sin(a) * dist;
      vx = Math.cos(a) * speed;
      vy = Math.sin(a) * speed;
    }
    const maxLife = 3 + Math.random() * 4.5;
    return {
      x,
      y,
      vx,
      vy,
      baseSize: config.particleSize * (0.5 + Math.random() * 0.9) * u * 1.15,
      maxAlpha: 0.35 + Math.random() * 0.65,
      life: initial ? Math.random() * maxLife : 0,
      maxLife,
      twinkle: 1.5 + Math.random() * 4,
      phase: Math.random() * Math.PI * 2,
    };
  }

  private renderParticles(
    ctx: Ctx,
    width: number,
    height: number,
    config: VisualizerConfig,
    analysis: FrequencyAnalysis,
    pal: Palette,
    u: number,
    dt: number,
    k: number
  ) {
    const count = Math.max(0, Math.round(config.particleCount || 0));
    const key = `${count}|${config.particleDispersion}|${width}x${height}`;
    if (key !== this.particleKey) {
      this.particleKey = key;
      this.particles = Array.from({ length: count }, () => this.spawnParticle(config, width, height, true));
    }
    if (!count) return;

    const { cx, cy } = this.center(config, width, height);
    const bass = analysis.bassWeight;
    const impact = config.particleBassImpact * u * 0.22;
    const push = analysis.isBeatHit ? impact * 6 : bass > 0.35 ? impact * (bass - 0.35) * 2.4 : 0;
    const mode = config.particleDispersion || 'radial';
    const sprite = this.sprite(pal.particle, config.particleGlow);
    const opacity = config.particleOpacity ?? 1;
    const sizeBoost = 1 + bass * (config.layoutStyle === 'particles-only' ? 1.2 : 0.6);
    const t = this.timeSec;

    ctx.save();
    ctx.globalCompositeOperation = config.particleGlow ? 'lighter' : 'source-over';
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (mode === 'upward') {
        p.x += (p.vx + Math.sin(t * 0.8 + p.phase) * 0.25 * u) * k;
        p.y += (p.vy - push * 0.6) * k;
      } else if (mode === 'ambient') {
        p.x += (p.vx + Math.sin(t * 0.6 + p.phase) * 0.3 * u) * k;
        p.y += (p.vy + Math.cos(t * 0.5 + p.phase) * 0.3 * u) * k;
        if (push) {
          const dx = p.x - cx;
          const dy = p.y - cy;
          const d = Math.hypot(dx, dy) || 1;
          p.x += (dx / d) * push * 0.5 * k;
          p.y += (dy / d) * push * 0.5 * k;
        }
      } else {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const d = Math.hypot(dx, dy) || 1;
        p.x += (p.vx + (dx / d) * push) * k;
        p.y += (p.vy + (dy / d) * push) * k;
      }
      p.life += dt;

      let alpha = p.maxAlpha;
      const fadeIn = Math.min(1, p.life / 0.4);
      const fadeOut = Math.min(1, (p.maxLife - p.life) / 0.6);
      alpha *= Math.max(0, Math.min(fadeIn, fadeOut));
      let size = p.baseSize * sizeBoost;
      if (config.particleSparkle) {
        alpha *= 0.55 + Math.sin(t * p.twinkle + p.phase) * 0.45;
        if (analysis.treble > 0.35) size *= 1 + (analysis.treble - 0.35);
      }
      alpha *= opacity;

      if (alpha > 0.01) {
        const s = size * (config.particleGlow ? 7 : 4.8);
        ctx.globalAlpha = Math.min(1, alpha);
        ctx.drawImage(sprite, p.x - s / 2, p.y - s / 2, s, s);
      }

      const m = 60 * u;
      if (p.life >= p.maxLife || p.x < -m || p.x > width + m || p.y < -m || p.y > height + m) {
        this.particles[i] = this.spawnParticle(config, width, height, false);
      }
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ layouts

  private renderByLayout(
    ctx: Ctx,
    width: number,
    height: number,
    config: VisualizerConfig,
    analysis: FrequencyAnalysis,
    pal: Palette,
    u: number,
    dt: number
  ) {
    switch (config.layoutStyle) {
      case 'bottom-bars':
        return this.renderBottomBars(ctx, width, height, config, analysis, pal, u, dt);
      case 'mirror-bars':
        return this.renderMirrorBars(ctx, width, height, config, analysis, pal, u);
      case 'horizontal-wave':
        return this.renderWave(ctx, width, height, config, analysis, pal, u);
      case 'side-bars':
        return this.renderSideBars(ctx, width, height, config, analysis, pal, u);
      case 'full-width':
        return this.renderFullWidth(ctx, width, height, config, analysis, pal, u);
      case 'turntable-vinyl':
        return this.renderVinyl(ctx, width, height, config, analysis, pal, u, dt);
      case 'album-art-pulse':
        return this.renderAlbumArt(ctx, width, height, config, analysis, pal, u);
      case 'minimal':
        return this.renderMinimal(ctx, width, height, config, analysis, pal, u);
      case 'particles-only':
        return this.renderCore(ctx, width, height, config, analysis, pal, u);
      case 'classic-circle':
      default:
        return this.renderCircle(ctx, width, height, config, analysis, pal, u, dt);
    }
  }

  // 1. Classic circle ----------------------------------------------------------
  private renderCircle(
    ctx: Ctx,
    width: number,
    height: number,
    config: VisualizerConfig,
    analysis: FrequencyAnalysis,
    pal: Palette,
    u: number,
    dt: number
  ) {
    const { cx, cy, minDim } = this.center(config, width, height);
    const bass = this.bassSmooth;
    const radius = minDim * config.innerRadiusRatio * (1 + bass * config.logoPulseIntensity);
    const count = Math.max(16, Math.round(config.barCount));
    const spec = this.spectrum(Math.ceil(count / (config.mirrorWave ? 2 : 1)), analysis, config.smoothing);

    let maxH = Math.min(height * config.maxBarHeightRatio, minDim * 0.3 * config.barHeightMultiplier);
    if (config.clampingMode === 'contained') maxH *= 0.6;
    const scaleU = minDim / 1000;

    const values = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      let v = this.mirrored(spec, i, count, config.mirrorWave);
      if (config.preventDownwardBleed) {
        // smooth cosine taper around the bottom of the circle (angle = PI/2)
        const angle = Math.PI / 2 + (i / count) * Math.PI * 2;
        const diff = Math.abs(Math.atan2(Math.sin(angle - Math.PI / 2), Math.cos(angle - Math.PI / 2)));
        if (diff < 0.45) v *= 0.15 + 0.85 * (0.5 - 0.5 * Math.cos((diff / 0.45) * Math.PI));
      }
      values[i] = v;
    }

    const angleAt = (i: number) => Math.PI / 2 + (i / count) * Math.PI * 2;
    const inward = config.clampingMode === 'symmetric' ? 0.35 : 0;

    ctx.save();
    // Faint guide ring
    ctx.strokeStyle = withAlpha(pal.primary, 0.18);
    ctx.lineWidth = Math.max(1, 1.5 * scaleU);
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 6 * scaleU, 0, Math.PI * 2);
    ctx.stroke();

    const grad = ctx.createRadialGradient(cx, cy, radius, cx, cy, radius + maxH);
    grad.addColorStop(0, pal.primary);
    grad.addColorStop(0.7, pal.secondary);
    grad.addColorStop(1, '#ffffff');

    const style = config.waveStyle;
    const lw = Math.max(1, config.barWidth * scaleU * 1.2);

    if (style === 'smooth-curve') {
      const layers: [number, string, number][] = [
        [1.18, pal.secondary, 0.35],
        [1.0, pal.primary, 0.9],
      ];
      for (const [mult, color, alpha] of layers) {
        const pts = Array.from({ length: count }, (_, i) => {
          const a = angleAt(i);
          const r = radius + 4 * scaleU + values[i] * maxH * mult;
          return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
        });
        ctx.beginPath();
        smoothPath(ctx, pts, true);
        ctx.fillStyle = withAlpha(color, alpha * 0.25);
        ctx.fill();
        this.applyGlow(ctx, config, pal.glow, scaleU);
        ctx.strokeStyle = withAlpha(color, alpha);
        ctx.lineWidth = lw;
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
    } else if (style === 'radial-spikes') {
      this.applyGlow(ctx, config, pal.glow, scaleU);
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const a0 = angleAt(i);
        const a1 = angleAt(i + 0.5);
        const rBase = radius + 4 * scaleU;
        const rTip = rBase + Math.max(2 * scaleU, values[i] * maxH);
        if (i === 0) ctx.moveTo(cx + Math.cos(a0) * rBase, cy + Math.sin(a0) * rBase);
        ctx.lineTo(cx + Math.cos(a1) * rTip, cy + Math.sin(a1) * rTip);
        const a2 = angleAt(i + 1);
        ctx.lineTo(cx + Math.cos(a2) * rBase, cy + Math.sin(a2) * rBase);
      }
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.9;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = withAlpha('#ffffff', 0.6);
      ctx.lineWidth = Math.max(1, scaleU);
      ctx.stroke();
    } else if (style === 'dots') {
      this.applyGlow(ctx, config, pal.glow, scaleU, 0.6);
      const dot = Math.max(1.2, config.barWidth * scaleU * 0.8);
      const step = dot * 3;
      ctx.fillStyle = grad;
      for (let i = 0; i < count; i++) {
        const a = angleAt(i);
        const h = values[i] * maxH;
        const n = Math.max(1, Math.floor(h / step) + 1);
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        ctx.beginPath();
        for (let j = 0; j < n; j++) {
          const r = radius + 8 * scaleU + j * step;
          ctx.moveTo(cx + cos * r + dot, cy + sin * r);
          ctx.arc(cx + cos * r, cy + sin * r, dot * (1 - j / (n + 2) * 0.5), 0, Math.PI * 2);
        }
        ctx.fill();
      }
    } else {
      // 'bars' and 'mirror-bars' (double ring)
      ctx.lineCap = 'round';
      if (style === 'mirror-bars') {
        ctx.strokeStyle = withAlpha(pal.secondary, 0.45);
        ctx.lineWidth = lw * 1.6;
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const a = angleAt(i + 0.5);
          const r0 = radius + 6 * scaleU;
          const r1 = r0 + Math.max(2 * scaleU, values[(i + Math.floor(count / 2)) % count] * maxH * 1.15);
          ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
          ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        }
        ctx.stroke();
      }
      this.applyGlow(ctx, config, pal.glow, scaleU);
      ctx.strokeStyle = grad;
      ctx.lineWidth = lw;
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const a = angleAt(i);
        const h = Math.max(2 * scaleU, values[i] * maxH);
        const r0 = radius + 6 * scaleU - h * inward;
        const r1 = radius + 6 * scaleU + h;
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      }
      ctx.stroke();
    }
    ctx.restore();

    this.renderLogo(ctx, cx, cy, radius, config, pal, scaleU, dt);
  }

  private renderLogo(
    ctx: Ctx,
    cx: number,
    cy: number,
    radius: number,
    config: VisualizerConfig,
    pal: Palette,
    scaleU: number,
    dt: number
  ) {
    if (config.logoSpin) this.logoAngle += dt * 0.6;
    const img = this.getImage(config.logoUrl);
    const shape = config.logoShape;
    const pathFor = (r: number) => {
      if (shape === 'rounded-square') {
        const s = r * 1.8;
        ctx.beginPath();
        ctx.roundRect(-s / 2, -s / 2, s, s, s * 0.22);
      } else if (shape === 'hexagon') {
        hexPath(ctx, 0, 0, r * 1.05);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
      }
    };

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(config.logoSpin ? this.logoAngle : 0);

    const inner = shape === 'ring' ? radius * 0.82 : radius;
    // Base disc with soft glow
    this.applyGlow(ctx, config, pal.glow, scaleU, 1.2);
    pathFor(inner);
    ctx.fillStyle = '#07070b';
    ctx.fill();
    ctx.shadowBlur = 0;

    if (img) {
      ctx.save();
      pathFor(inner);
      ctx.clip();
      drawImageCover(ctx, img, -inner, -inner, inner * 2, inner * 2);
      // inner shading for depth
      const shade = ctx.createRadialGradient(0, -inner * 0.3, inner * 0.2, 0, 0, inner);
      shade.addColorStop(0, 'rgba(255,255,255,0.06)');
      shade.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = shade;
      ctx.fillRect(-inner, -inner, inner * 2, inner * 2);
      ctx.restore();
    }

    if (config.logoBorderWidth > 0) {
      const bw = Math.max(1, config.logoBorderWidth * scaleU * 1.3);
      this.applyGlow(ctx, config, pal.logoBorder, scaleU, 0.8);
      ctx.strokeStyle = pal.logoBorder;
      ctx.lineWidth = bw;
      pathFor(inner);
      ctx.stroke();
      if (shape === 'ring') {
        ctx.lineWidth = bw * 0.6;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  // 2. Bottom equaliser --------------------------------------------------------
  private renderBottomBars(
    ctx: Ctx,
    width: number,
    height: number,
    config: VisualizerConfig,
    analysis: FrequencyAnalysis,
    pal: Palette,
    u: number,
    dt: number
  ) {
    const count = Math.max(8, Math.round(config.barCount));
    const spec = this.spectrum(count, analysis, config.smoothing);
    const peaks = this.peaks(spec, dt);
    const scale = config.visualizerScale ?? 1;
    const baseY = height * (1 - (config.bottomOffsetPercent ?? 10) / 100);
    const maxH = Math.min(baseY * 0.92, height * config.maxBarHeightRatio * config.barHeightMultiplier * 1.2 * scale);
    const avail = width * Math.min(0.96, 0.86 * scale);
    const startX = ((config.visualizerX ?? 50) / 100) * width - avail / 2;
    const spacing = avail / count;
    const barW = Math.max(1, Math.min(spacing * 0.78, config.barWidth * u * 2.2));
    const led = config.waveStyle === 'dots';

    const grad = ctx.createLinearGradient(0, baseY, 0, baseY - maxH);
    grad.addColorStop(0, pal.secondary);
    grad.addColorStop(0.65, pal.primary);
    grad.addColorStop(1, '#ffffff');

    const drawBars = (alphaMul: number) => {
      ctx.fillStyle = grad;
      ctx.globalAlpha = alphaMul;
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const h = Math.max(3 * u, spec[i] * maxH);
        const x = startX + i * spacing + (spacing - barW) / 2;
        if (led) {
          const seg = barW * 0.7;
          const gap = seg * 0.45;
          for (let y = 0; y < h; y += seg + gap) ctx.rect(x, baseY - y - seg, barW, seg);
        } else {
          ctx.roundRect(x, baseY - h, barW, h, [barW / 2, barW / 2, 0, 0]);
        }
      }
      ctx.fill();
    };

    ctx.save();
    this.applyGlow(ctx, config, pal.glow, u);
    drawBars(1);
    ctx.shadowBlur = 0;

    // Peak caps
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const x = startX + i * spacing + (spacing - barW) / 2;
      const y = baseY - Math.max(3 * u, peaks[i] * maxH) - 6 * u;
      ctx.rect(x, y, barW, Math.max(1, 2.2 * u));
    }
    ctx.fill();

    // Reflection
    const reflH = height - baseY;
    if (reflH > 8 * u) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, baseY + 2 * u, width, reflH);
      ctx.clip();
      ctx.translate(0, baseY * 2 + 4 * u);
      ctx.scale(1, -1);
      drawBars(0.22);
      ctx.restore();
      const fade = ctx.createLinearGradient(0, baseY, 0, height);
      fade.addColorStop(0, 'rgba(0,0,0,0)');
      fade.addColorStop(1, 'rgba(0,0,0,0.85)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = fade;
      ctx.fillRect(0, baseY, width, reflH);
    }

    // Base line
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = pal.primary;
    ctx.fillRect(startX, baseY + 1 * u, avail, Math.max(1, 1.5 * u));
    ctx.restore();
  }

  // 3. Mirror bars --------------------------------------------------------------
  private renderMirrorBars(
    ctx: Ctx,
    width: number,
    height: number,
    config: VisualizerConfig,
    analysis: FrequencyAnalysis,
    pal: Palette,
    u: number
  ) {
    const count = Math.max(8, Math.round(config.barCount));
    const spec = this.spectrum(Math.ceil(count / (config.mirrorWave ? 2 : 1)), analysis, config.smoothing);
    const { cy, scale } = this.center(config, width, height);
    const cx = ((config.visualizerX ?? 50) / 100) * width;
    const maxH = Math.min(height * 0.42, height * config.maxBarHeightRatio * config.barHeightMultiplier * scale);
    const avail = width * Math.min(0.96, 0.84 * scale);
    const startX = cx - avail / 2;
    const spacing = avail / count;
    const barW = Math.max(1, Math.min(spacing * 0.72, config.barWidth * u * 2));

    const grad = ctx.createLinearGradient(0, cy - maxH, 0, cy + maxH);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.2, pal.secondary);
    grad.addColorStop(0.5, pal.primary);
    grad.addColorStop(0.8, pal.secondary);
    grad.addColorStop(1, '#ffffff');

    ctx.save();
    this.applyGlow(ctx, config, pal.glow, u);
    ctx.fillStyle = grad;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      // lows in the middle when mirrored
      let v: number;
      if (config.mirrorWave) {
        const half = count / 2;
        const d = Math.abs(i + 0.5 - half) / half;
        v = spec[Math.min(spec.length - 1, Math.floor(d * spec.length))];
      } else {
        v = spec[Math.floor((i / count) * spec.length)];
      }
      const h = Math.max(2 * u, v * maxH);
      const x = startX + i * spacing + (spacing - barW) / 2;
      ctx.roundRect(x, cy - h, barW, h * 2, barW / 2);
    }
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = withAlpha('#ffffff', 0.5);
    ctx.fillRect(startX, cy - 0.75 * u, avail, Math.max(1, 1.5 * u));
    ctx.restore();
  }

  // 4. Oscilloscope wave --------------------------------------------------------
  private renderWave(
    ctx: Ctx,
    width: number,
    height: number,
    config: VisualizerConfig,
    analysis: FrequencyAnalysis,
    pal: Palette,
    u: number
  ) {
    const pos = config.waveVerticalPosition;
    const baseY =
      pos === 'top' ? height * 0.28 : pos === 'bottom' ? height * 0.74 : ((config.visualizerY ?? 50) / 100) * height;
    const scale = config.visualizerScale ?? 1;
    const amp = height * 0.22 * config.barHeightMultiplier * scale;
    const points = Math.max(32, Math.round(config.barCount));
    const td = analysis.timeDomainData;
    const n = td.length;
    // Use a zero-crossing trigger to keep the waveform stable (like a real oscilloscope)
    let trigger = 0;
    for (let i = 1; i < n / 2; i++) {
      if (td[i - 1] < 128 && td[i] >= 128) {
        trigger = i;
        break;
      }
    }
    const span = Math.floor(n / 2);
    const sample = (t: number) => {
      const idx = trigger + Math.floor(t * (span - 1));
      return (td[Math.min(n - 1, idx)] - 128) / 128;
    };
    const margin = width * (1 - Math.min(1, 0.92 * scale)) / 2;
    const w = width - margin * 2;

    const build = (ampMul: number, phase: number) =>
      Array.from({ length: points }, (_, i) => {
        const t = i / (points - 1);
        const env = Math.sin(t * Math.PI); // taper ends
        const v = sample(Math.min(1, t + phase));
        return { x: margin + t * w, y: baseY + v * amp * ampMul * (0.25 + env * 0.75) };
      });

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const lw = Math.max(1, config.barWidth * u * 1.1);

    // Filled ghost layer
    const ghost = build(1.35, 0.03);
    ctx.beginPath();
    smoothPath(ctx, ghost, false);
    ctx.lineTo(margin + w, baseY);
    ctx.lineTo(margin, baseY);
    ctx.closePath();
    const fill = ctx.createLinearGradient(0, baseY - amp, 0, baseY + amp);
    fill.addColorStop(0, withAlpha(pal.secondary, 0.25));
    fill.addColorStop(0.5, withAlpha(pal.secondary, 0.05));
    fill.addColorStop(1, withAlpha(pal.secondary, 0.25));
    ctx.fillStyle = fill;
    ctx.fill();

    const lineGrad = ctx.createLinearGradient(margin, 0, margin + w, 0);
    lineGrad.addColorStop(0, withAlpha(pal.secondary, 0));
    lineGrad.addColorStop(0.15, pal.secondary);
    lineGrad.addColorStop(0.5, pal.primary);
    lineGrad.addColorStop(0.85, pal.secondary);
    lineGrad.addColorStop(1, withAlpha(pal.secondary, 0));

    this.applyGlow(ctx, config, pal.glow, u, 1.2);
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = lw * 2.2;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    smoothPath(ctx, ghost, false);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.lineWidth = lw;
    ctx.beginPath();
    smoothPath(ctx, build(1, 0), false);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = withAlpha('#ffffff', 0.85);
    ctx.lineWidth = Math.max(0.75, lw * 0.35);
    ctx.beginPath();
    smoothPath(ctx, build(1, 0), false);
    ctx.stroke();
    ctx.restore();
  }

  // 5. Side bars ----------------------------------------------------------------
  private renderSideBars(
    ctx: Ctx,
    width: number,
    height: number,
    config: VisualizerConfig,
    analysis: FrequencyAnalysis,
    pal: Palette,
    u: number
  ) {
    const rows = Math.max(8, Math.round(config.barCount / 2));
    const spec = this.spectrum(Math.ceil(rows / 2), analysis, config.smoothing);
    const scale = config.visualizerScale ?? 1;
    const maxW = width * 0.22 * config.barHeightMultiplier * scale;
    const availH = height * Math.min(0.94, 0.8 * scale);
    const startY = ((config.visualizerY ?? 50) / 100) * height - availH / 2;
    const spacing = availH / rows;
    const barH = Math.max(1, Math.min(spacing * 0.7, config.barWidth * u * 1.8));

    ctx.save();
    this.applyGlow(ctx, config, pal.glow, u);
    for (const side of [0, 1]) {
      const grad = side === 0 ? ctx.createLinearGradient(0, 0, maxW, 0) : ctx.createLinearGradient(width, 0, width - maxW, 0);
      grad.addColorStop(0, pal.secondary);
      grad.addColorStop(0.7, pal.primary);
      grad.addColorStop(1, '#ffffff');
      ctx.fillStyle = grad;
      ctx.beginPath();
      for (let i = 0; i < rows; i++) {
        const half = rows / 2;
        const d = Math.abs(i + 0.5 - half) / half; // lows at vertical centre
        const v = spec[Math.min(spec.length - 1, Math.floor(d * spec.length))];
        const w = Math.max(3 * u, v * maxW);
        const y = startY + i * spacing + (spacing - barH) / 2;
        if (side === 0) ctx.roundRect(0, y, w, barH, [0, barH / 2, barH / 2, 0]);
        else ctx.roundRect(width - w, y, w, barH, [barH / 2, 0, 0, barH / 2]);
      }
      ctx.fill();
    }
    ctx.restore();
  }

  // 6. Full width horizon ---------------------------------------------------------
  private renderFullWidth(
    ctx: Ctx,
    width: number,
    height: number,
    config: VisualizerConfig,
    analysis: FrequencyAnalysis,
    pal: Palette,
    u: number
  ) {
    const count = Math.max(16, Math.round(config.barCount));
    const spec = this.spectrum(count, analysis, config.smoothing);
    const scale = config.visualizerScale ?? 1;
    const baseY = height * (1 - (config.bottomOffsetPercent ?? 0) / 100);
    const maxH = Math.min(baseY * 0.9, height * 0.38 * config.barHeightMultiplier * scale);

    const layer = (mult: number, shift: number) => {
      const pts = [{ x: -10 * u, y: baseY }];
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        const idx = Math.min(count - 1, Math.max(0, i + shift));
        const env = 0.35 + 0.65 * Math.sin(Math.min(1, t * 1.05) * Math.PI * 0.5 + 0.25);
        pts.push({ x: t * width, y: baseY - spec[idx] * maxH * mult * env });
      }
      pts.push({ x: width + 10 * u, y: baseY });
      return pts;
    };

    ctx.save();
    const back = layer(1.25, 3);
    ctx.beginPath();
    smoothPath(ctx, back, false);
    ctx.lineTo(width + 10 * u, height + 10 * u);
    ctx.lineTo(-10 * u, height + 10 * u);
    ctx.closePath();
    const g1 = ctx.createLinearGradient(0, baseY - maxH * 1.25, 0, baseY);
    g1.addColorStop(0, withAlpha(pal.secondary, 0.55));
    g1.addColorStop(1, withAlpha(pal.secondary, 0.05));
    ctx.fillStyle = g1;
    ctx.fill();

    const front = layer(1, 0);
    ctx.beginPath();
    smoothPath(ctx, front, false);
    ctx.lineTo(width + 10 * u, height + 10 * u);
    ctx.lineTo(-10 * u, height + 10 * u);
    ctx.closePath();
    const g2 = ctx.createLinearGradient(0, baseY - maxH, 0, baseY);
    g2.addColorStop(0, withAlpha(pal.primary, 0.9));
    g2.addColorStop(0.6, withAlpha(pal.secondary, 0.45));
    g2.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = g2;
    ctx.fill();

    this.applyGlow(ctx, config, pal.glow, u, 1.3);
    ctx.beginPath();
    smoothPath(ctx, front, false);
    ctx.strokeStyle = withAlpha('#ffffff', 0.9);
    ctx.lineWidth = Math.max(1, config.barWidth * u * 0.8);
    ctx.stroke();
    ctx.restore();
  }

  // 7. Turntable vinyl ----------------------------------------------------------------
  private renderVinyl(
    ctx: Ctx,
    width: number,
    height: number,
    config: VisualizerConfig,
    analysis: FrequencyAnalysis,
    pal: Palette,
    u: number,
    dt: number
  ) {
    const { cx, cy, minDim } = this.center(config, width, height);
    const s = minDim / 1000;
    const R = minDim * (config.innerRadiusRatio + 0.1) * (1 + this.bassSmooth * 0.03);
    // 33⅓ rpm ≈ 3.49 rad/s; scaled down for a calmer look
    this.vinylAngle += dt * 1.6 * (config.turntableRotationSpeed ?? 1);

    // Spectrum ring around the record
    const count = Math.max(32, Math.round(config.barCount));
    const spec = this.spectrum(Math.ceil(count / 2), analysis, config.smoothing);
    const maxH = minDim * 0.12 * config.barHeightMultiplier;
    ctx.save();
    this.applyGlow(ctx, config, pal.glow, s);
    ctx.strokeStyle = pal.primary;
    ctx.lineWidth = Math.max(1, config.barWidth * s);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (i / count) * Math.PI * 2;
      const v = this.mirrored(spec, i, count, true);
      const r0 = R + 14 * s;
      const r1 = r0 + Math.max(2 * s, v * maxH);
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    }
    ctx.stroke();
    ctx.restore();

    // Record body
    ctx.save();
    ctx.shadowBlur = 50 * s;
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowOffsetY = 12 * s;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    const body = ctx.createRadialGradient(cx, cy, R * 0.3, cx, cy, R);
    body.addColorStop(0, '#16161c');
    body.addColorStop(1, '#0a0a0e');
    ctx.fillStyle = body;
    ctx.fill();
    ctx.restore();

    // Grooves
    ctx.save();
    ctx.lineWidth = Math.max(0.5, 1 * s);
    let idx = 0;
    for (let r = R * 0.42; r < R * 0.97; r += Math.max(2, 4.5 * s)) {
      ctx.strokeStyle = idx++ % 3 === 0 ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Rotating light sheen (two opposite cones)
    ctx.translate(cx, cy);
    ctx.rotate(this.vinylAngle * 0.15);
    for (const base of [0, Math.PI]) {
      const g = ctx.createConicGradient ? ctx.createConicGradient(base, 0, 0) : null;
      if (g) {
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.06, 'rgba(255,255,255,0.10)');
        g.addColorStop(0.12, 'rgba(255,255,255,0)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.97, 0, Math.PI * 2);
        ctx.arc(0, 0, R * 0.4, 0, Math.PI * 2, true);
        ctx.fill();
      }
    }
    ctx.restore();

    // Label (rotating)
    const labelR = R * 0.36;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.vinylAngle);
    ctx.beginPath();
    ctx.arc(0, 0, labelR, 0, Math.PI * 2);
    const lg = ctx.createLinearGradient(-labelR, -labelR, labelR, labelR);
    lg.addColorStop(0, pal.primary);
    lg.addColorStop(1, pal.secondary);
    ctx.fillStyle = lg;
    ctx.fill();
    const img = this.getImage(config.logoUrl);
    if (img) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, labelR * 0.92, 0, Math.PI * 2);
      ctx.clip();
      drawImageCover(ctx, img, -labelR, -labelR, labelR * 2, labelR * 2);
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, labelR * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = '#d4d4d8';
    ctx.fill();
    ctx.restore();

    // Rim glow
    if (config.turntableGrooveGlow) {
      ctx.save();
      this.applyGlow(ctx, config, pal.glow, s, 1.4);
      ctx.strokeStyle = withAlpha(pal.glow, 0.6 + this.bassSmooth * 0.4);
      ctx.lineWidth = Math.max(1, (2 + this.bassSmooth * 5) * s);
      ctx.beginPath();
      ctx.arc(cx, cy, R + 2 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Tonearm
    ctx.save();
    const px = cx + R * 1.08;
    const py = cy - R * 0.92;
    const armAngle = 2.05 + Math.sin(this.timeSec * 0.5) * 0.006;
    ctx.translate(px, py);
    ctx.fillStyle = '#3f3f46';
    ctx.beginPath();
    ctx.arc(0, 0, 26 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a1a1aa';
    ctx.beginPath();
    ctx.arc(0, 0, 12 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(armAngle);
    ctx.strokeStyle = '#d4d4d8';
    ctx.lineWidth = Math.max(1, 7 * s);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(R * 1.05, 0);
    ctx.stroke();
    ctx.fillStyle = '#e4e4e7';
    ctx.fillRect(R * 1.02, -12 * s, 46 * s, 24 * s);
    ctx.restore();
  }

  // 8. Album art pulse ---------------------------------------------------------------
  private renderAlbumArt(
    ctx: Ctx,
    width: number,
    height: number,
    config: VisualizerConfig,
    analysis: FrequencyAnalysis,
    pal: Palette,
    u: number
  ) {
    const { cx, cy, minDim } = this.center(config, width, height);
    const s = minDim / 1000;
    const size = minDim * 0.46 * (1 + this.bassSmooth * (config.logoPulseIntensity || 0.15));
    const x = cx - size / 2;
    const y = cy - size / 2;
    const r = size * 0.05;

    ctx.save();
    // Glow + drop shadow
    ctx.shadowBlur = (40 + this.bassSmooth * 40) * s;
    ctx.shadowColor = withAlpha(pal.glow, 0.85);
    ctx.fillStyle = '#0b0b10';
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, r);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.save();
    ctx.clip();
    const img = this.getImage(config.logoUrl);
    if (img) drawImageCover(ctx, img, x, y, size, size);
    const sheen = ctx.createLinearGradient(x, y, x + size, y + size);
    sheen.addColorStop(0, 'rgba(255,255,255,0.14)');
    sheen.addColorStop(0.45, 'rgba(255,255,255,0)');
    sheen.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = sheen;
    ctx.fillRect(x, y, size, size);
    ctx.restore();

    ctx.strokeStyle = withAlpha(pal.primary, 0.8);
    ctx.lineWidth = Math.max(1, 2.5 * s);
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, r);
    ctx.stroke();

    // Spectrum strip beneath the cover
    const count = 48;
    const spec = this.spectrum(count / 2, analysis, config.smoothing);
    const stripY = y + size + 34 * s;
    const spacing = size / count;
    const bw = spacing * 0.55;
    const maxH = 70 * s * config.barHeightMultiplier;
    this.applyGlow(ctx, config, pal.glow, s, 0.7);
    ctx.fillStyle = pal.primary;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const v = this.mirrored(spec, i, count, true);
      const h = Math.max(3 * s, v * maxH);
      ctx.roundRect(x + i * spacing + (spacing - bw) / 2, stripY - h / 2, bw, h, bw / 2);
    }
    ctx.fill();
    ctx.restore();
  }

  // 9. Minimal ------------------------------------------------------------------------
  private renderMinimal(
    ctx: Ctx,
    width: number,
    height: number,
    config: VisualizerConfig,
    analysis: FrequencyAnalysis,
    pal: Palette,
    u: number
  ) {
    const { cx, cy, minDim } = this.center(config, width, height);
    const s = minDim / 1000;
    const count = Math.max(24, Math.round(config.barCount / 2));
    const spec = this.spectrum(Math.ceil(count / 2), analysis, Math.max(0.8, config.smoothing));
    const r = minDim * Math.max(0.14, config.innerRadiusRatio * 0.85);
    const amp = minDim * 0.07 * config.barHeightMultiplier;

    const pts = Array.from({ length: count }, (_, i) => {
      const a = -Math.PI / 2 + (i / count) * Math.PI * 2 + this.timeSec * 0.05;
      const d = r + this.mirrored(spec, i, count, true) * amp;
      return { x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d };
    });

    ctx.save();
    ctx.strokeStyle = withAlpha(pal.secondary, 0.35);
    ctx.lineWidth = Math.max(0.6, 1 * s);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = withAlpha(pal.primary, 0.55);
    ctx.beginPath();
    smoothPath(ctx, pts, true);
    ctx.stroke();

    this.applyGlow(ctx, config, pal.glow, s, 0.6);
    ctx.fillStyle = pal.primary;
    ctx.beginPath();
    for (const p of pts) {
      ctx.moveTo(p.x + 2.5 * s, p.y);
      ctx.arc(p.x, p.y, Math.max(1, 2.5 * s), 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
  }

  // 10. Particles-only energy core ---------------------------------------------------
  private renderCore(
    ctx: Ctx,
    width: number,
    height: number,
    config: VisualizerConfig,
    analysis: FrequencyAnalysis,
    pal: Palette,
    u: number
  ) {
    const { cx, cy, minDim } = this.center(config, width, height);
    const bass = this.bassSmooth;
    const core = minDim * 0.1 * (1 + bass * 0.6);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // light rays
    ctx.translate(cx, cy);
    ctx.rotate(this.timeSec * 0.12);
    const rays = 12;
    for (let i = 0; i < rays; i++) {
      ctx.rotate((Math.PI * 2) / rays);
      const len = core * (3 + analysis.mid * 3);
      const g = ctx.createLinearGradient(0, 0, len, 0);
      g.addColorStop(0, withAlpha(pal.glow, 0.25 + bass * 0.2));
      g.addColorStop(1, withAlpha(pal.glow, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(len, -core * 0.18);
      ctx.lineTo(len, core * 0.18);
      ctx.closePath();
      ctx.fill();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [mult, alpha, color] of [
      [3.2, 0.18, pal.secondary],
      [1.8, 0.35, pal.primary],
      [1, 0.95, '#ffffff'],
    ] as const) {
      const rr = core * mult;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
      g.addColorStop(0, withAlpha(color, alpha));
      g.addColorStop(0.45, withAlpha(color === '#ffffff' ? pal.primary : color, alpha * 0.5));
      g.addColorStop(1, withAlpha(color === '#ffffff' ? pal.primary : color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ typography

  private renderTypography(
    ctx: Ctx,
    width: number,
    height: number,
    config: VisualizerConfig,
    bass: number,
    playbackTime: number
  ) {
    const S = Math.min(width, height) / 1080;
    const t = this.timeSec;
    const bounds: TextBounds[] = [];
    const layers = config.textLayers || [];

    layers.forEach((layer: TextLayer, index) => {
      if (!layer.enabled || !layer.text || !layer.text.trim()) return;

      const content = layer.isUppercase ? layer.text.toUpperCase() : layer.text;
      const fontSize = Math.max(6, layer.fontSize * S);
      let x = (layer.x / 100) * width;
      let y = (layer.y / 100) * height;

      // Intro animation driven by the track playhead (so exports start with it)
      let introAlpha = 1;
      let introScale = 1;
      const enter = layer.enterAnimation || 'none';
      if (enter !== 'none') {
        const delay = 0.25 + index * 0.18;
        const p = Math.max(0, Math.min(1, (playbackTime - delay) / 0.9));
        const e = 1 - Math.pow(1 - p, 3);
        introAlpha = e;
        if (enter === 'slide-up') y += (1 - e) * 40 * S;
        if (enter === 'scale-up') introScale = 0.6 + 0.4 * e;
      }
      if (introAlpha <= 0.001) return;

      let pulse = 1;
      if (layer.animation === 'bass-pulse') pulse = 1 + bass * (layer.audioReactivity ?? 0.2);
      else if (layer.animation === 'gentle-float') y += Math.sin(t * 2.2 + index) * 6 * S;

      ctx.save();
      ctx.font = `${layer.isItalic ? 'italic ' : ''}${layer.fontWeight || '700'} ${fontSize}px "${layer.fontFamily || 'Outfit'}", sans-serif`;
      const spacing = (layer.letterSpacing || 0) * S;
      const ls = ctx as unknown as { letterSpacing?: string };
      if ('letterSpacing' in ctx) ls.letterSpacing = `${spacing}px`;
      ctx.textAlign = layer.align || 'center';
      ctx.textBaseline = 'middle';

      const metrics = ctx.measureText(content);
      const textW = metrics.width;
      const padX = layer.boxEnabled ? (layer.boxPaddingX || 0) * S : 0;
      const padY = layer.boxEnabled ? (layer.boxPaddingY || 0) * S : 0;
      const boxW = textW + padX * 2;
      const boxH = fontSize * 1.15 + padY * 2;
      let left = -boxW / 2;
      if (layer.align === 'left') left = -padX;
      else if (layer.align === 'right') left = -textW - padX;

      const totalScale = pulse * introScale;
      bounds.push({
        id: layer.id,
        x: x + left * totalScale,
        y: y - (boxH / 2) * totalScale,
        w: boxW * totalScale,
        h: boxH * totalScale,
      });

      ctx.translate(x, y);
      if (totalScale !== 1) ctx.scale(totalScale, totalScale);
      const baseAlpha = (layer.opacity ?? 1) * introAlpha;

      if (layer.boxEnabled) {
        ctx.save();
        ctx.globalAlpha = (layer.boxOpacity ?? 0.6) * introAlpha;
        ctx.fillStyle = layer.boxColor || '#000';
        ctx.beginPath();
        ctx.roundRect(left, -boxH / 2, boxW, boxH, Math.min(boxH / 2, (layer.boxBorderRadius || 0) * S));
        ctx.fill();
        if (layer.boxBorderWidth > 0) {
          ctx.globalAlpha = introAlpha;
          ctx.strokeStyle = layer.boxBorderColor || 'rgba(255,255,255,0.2)';
          ctx.lineWidth = layer.boxBorderWidth * S;
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.globalAlpha = baseAlpha;
      if (layer.glowEnabled) {
        let blur = (layer.glowBlur || 14) * S;
        if (layer.animation === 'glow-breath') blur *= 1 + Math.sin(t * 3) * 0.35 + bass * 0.6;
        ctx.shadowColor = layer.glowColor || layer.color;
        ctx.shadowBlur = blur;
      } else if (layer.shadowColor && (layer.shadowOffsetX || layer.shadowOffsetY)) {
        ctx.shadowColor = layer.shadowColor;
        ctx.shadowBlur = 10 * S;
        ctx.shadowOffsetX = (layer.shadowOffsetX || 0) * S;
        ctx.shadowOffsetY = (layer.shadowOffsetY || 0) * S;
      }

      // Text x anchor (letterSpacing adds trailing space; compensate when centred)
      const anchorX = layer.align === 'center' ? spacing / 2 : 0;

      if (layer.textStrokeWidth && layer.textStrokeWidth > 0) {
        ctx.strokeStyle = layer.textStrokeColor || '#000';
        ctx.lineWidth = layer.textStrokeWidth * S * 2;
        ctx.lineJoin = 'round';
        ctx.strokeText(content, anchorX, 0);
      }
      ctx.fillStyle = layer.color || '#fff';
      ctx.fillText(content, anchorX, 0);
      ctx.restore();
    });

    this.lastTextBounds = bounds;
  }
}

/** Shared instance used by the live preview. The exporter creates its own. */
export const visualizerRenderer = new VisualizerRenderer();
