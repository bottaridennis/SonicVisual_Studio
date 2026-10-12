import { VisualizerConfig, TextLayer } from '../types/visualizer';
import { FrequencyAnalysis } from '../audio/audioEngine';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseSize: number;
  alpha: number;
  maxAlpha: number;
  color: string;
  life: number;
  maxLife: number;
  twinkleSpeed: number;
}

export class VisualizerRenderer {
  private particles: Particle[] = [];
  private imageCache: Map<string, HTMLImageElement> = new Map();
  private smoothedBars: number[] = [];
  private shakeX = 0;
  private shakeY = 0;
  private currentScale = 1;
  private totalTimeMs = 0;
  private vinylRotationAngle = 0;

  public initParticles(config: VisualizerConfig, width: number, height: number) {
    this.particles = [];
    const count = config.particleCount || 200;
    for (let i = 0; i < count; i++) {
      this.particles.push(this.createParticle(config, width, height, true));
    }
  }

  private getCenter(config: VisualizerConfig, width: number, height: number) {
    const cx = ((config.visualizerX !== undefined ? config.visualizerX : 50) / 100) * width;
    const cy = ((config.visualizerY !== undefined ? config.visualizerY : 50) / 100) * height;
    const scale = config.visualizerScale !== undefined ? config.visualizerScale : 1.0;
    const minDim = Math.min(width, height) * scale;
    return { cx, cy, scale, minDim };
  }

  private createParticle(config: VisualizerConfig, width: number, height: number, randomStart = false): Particle {
    const { cx, cy, minDim } = this.getCenter(config, width, height);
    const innerRadius = minDim * config.innerRadiusRatio;
    const dispersion = config.particleDispersion || 'radial';

    let x = cx;
    let y = cy;
    let vx = 0;
    let vy = 0;
    const speed = (config.particleMinSpeed + Math.random() * (config.particleMaxSpeed - config.particleMinSpeed)) * (minDim / 800);

    if (dispersion === 'upward') {
      x = Math.random() * width;
      y = randomStart ? Math.random() * height : height + 20;
      vx = (Math.random() - 0.5) * speed * 0.5;
      vy = -speed * (0.8 + Math.random() * 0.8);
    } else if (dispersion === 'ambient') {
      x = Math.random() * width;
      y = Math.random() * height;
      vx = (Math.random() - 0.5) * speed * 0.4;
      vy = (Math.random() - 0.5) * speed * 0.4;
    } else {
      // Radial from center
      const angle = Math.random() * Math.PI * 2;
      const distance = randomStart 
        ? innerRadius + Math.random() * (minDim * 0.45)
        : innerRadius + Math.random() * 15;
      x = cx + Math.cos(angle) * distance;
      y = cy + Math.sin(angle) * distance;
      vx = Math.cos(angle) * speed;
      vy = Math.sin(angle) * speed;
    }

    const baseSize = config.particleSize * (0.6 + Math.random() * 0.8) * (minDim / 800);

    return {
      x,
      y,
      vx,
      vy,
      size: baseSize,
      baseSize,
      alpha: 0.1 + Math.random() * 0.7,
      maxAlpha: 0.4 + Math.random() * 0.6,
      color: config.particleColor,
      life: 0,
      maxLife: 140 + Math.random() * 220,
      twinkleSpeed: 2 + Math.random() * 4,
    };
  }

  public preloadImage(url: string): Promise<HTMLImageElement> {
    if (this.imageCache.has(url)) {
      return Promise.resolve(this.imageCache.get(url)!);
    }
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.imageCache.set(url, img);
        resolve(img);
      };
      img.onerror = () => {
        resolve(img);
      };
      img.src = url;
    });
  }

  public getImage(url: string): HTMLImageElement | null {
    if (!url) return null;
    if (this.imageCache.has(url)) {
      return this.imageCache.get(url)!;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    this.imageCache.set(url, img);
    return img;
  }

  /**
   * Main render method: draws one visualizer frame onto the specified canvas 2D context.
   */
  public renderFrame(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    analysis: FrequencyAnalysis,
    config: VisualizerConfig,
    deltaTimeMs = 16
  ) {
    this.totalTimeMs += deltaTimeMs;

    const { cx, cy, minDim } = this.getCenter(config, width, height);
    const bassWeight = analysis.subBass * 0.7 + analysis.bass * 0.3;

    // Turntable rotation accumulator
    const rotationSpeed = config.turntableRotationSpeed ?? 1.0;
    this.vinylRotationAngle += (deltaTimeMs / 1000) * (Math.PI * 0.6) * rotationSpeed;

    // 1. Camera Shake & Bass Zoom calculation
    let targetShakeX = 0;
    let targetShakeY = 0;
    let targetScale = 1.0;

    if (config.bassCameraShake && bassWeight > 0.45) {
      const shakeMagnitude = (bassWeight - 0.45) * 16 * (minDim / 1000);
      targetShakeX = (Math.random() - 0.5) * shakeMagnitude;
      targetShakeY = (Math.random() - 0.5) * shakeMagnitude;
    }

    if (config.bassZoomIntensity > 0) {
      targetScale = 1.0 + bassWeight * config.bassZoomIntensity;
    }

    // Smooth camera interpolation
    this.shakeX += (targetShakeX - this.shakeX) * 0.25;
    this.shakeY += (targetShakeY - this.shakeY) * 0.25;
    this.currentScale += (targetScale - this.currentScale) * 0.2;

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Apply global camera transform centered on visualizer position
    ctx.translate(cx + this.shakeX, cy + this.shakeY);
    ctx.scale(this.currentScale, this.currentScale);
    ctx.translate(-cx, -cy);

    // 2. Render Background Image & Dimming
    this.renderBackground(ctx, width, height, config, bassWeight);

    // 3. Render Particles with Bass Explosion Impulse
    this.renderParticles(ctx, width, height, config, analysis, bassWeight);

    // 4. Render Main Audio Visualizer by Selected Layout Style
    this.renderVisualizerByStyle(ctx, width, height, config, analysis, bassWeight);

    ctx.restore();

    // 5. Render Advanced Video Text Layers (crisp, high-resolution overlays)
    this.renderTypography(ctx, width, height, config, bassWeight);
  }

  private renderBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    config: VisualizerConfig,
    bassWeight: number
  ) {
    const bgImg = this.getImage(config.backgroundUrl);

    if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
      const hRatio = width / bgImg.naturalWidth;
      const vRatio = height / bgImg.naturalHeight;
      const ratio = Math.max(hRatio, vRatio);
      const drawW = bgImg.naturalWidth * ratio;
      const drawH = bgImg.naturalHeight * ratio;
      const drawX = (width - drawW) / 2;
      const drawY = (height - drawH) / 2;

      ctx.save();
      if (config.backgroundBlur > 0) {
        ctx.filter = `blur(${config.backgroundBlur}px)`;
      }
      ctx.drawImage(bgImg, drawX, drawY, drawW, drawH);
      ctx.restore();
    } else {
      const grad = ctx.createRadialGradient(width / 2, height / 2, 100, width / 2, height / 2, width);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(1, '#020617');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    // Background Dimming Overlay
    if (config.backgroundDim > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.9, config.backgroundDim + bassWeight * 0.05)})`;
      ctx.fillRect(0, 0, width, height);
    }

    // Heavy Radial Vignette
    if (config.backgroundVignette > 0) {
      const radius = Math.max(width, height) * 0.75;
      const { cx, cy } = this.getCenter(config, width, height);
      const vignetteGrad = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
      vignetteGrad.addColorStop(0, 'rgba(0,0,0,0)');
      vignetteGrad.addColorStop(0.7, `rgba(0,0,0,${config.backgroundVignette * 0.5})`);
      vignetteGrad.addColorStop(1, `rgba(0,0,0,${config.backgroundVignette})`);
      ctx.fillStyle = vignetteGrad;
      ctx.fillRect(0, 0, width, height);
    }
  }

  private renderParticles(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    config: VisualizerConfig,
    analysis: FrequencyAnalysis,
    bassWeight: number
  ) {
    if (this.particles.length !== config.particleCount) {
      this.initParticles(config, width, height);
    }

    const { cx, cy, minDim } = this.getCenter(config, width, height);
    const dispersion = config.particleDispersion || 'radial';
    const isParticlesOnly = config.layoutStyle === 'particles-only';

    // Bass impulse multiplier: kicks push particles outward violently
    const bassPush = analysis.isBeatHit 
      ? config.particleBassImpact * 1.5 * (minDim / 800)
      : (bassWeight > 0.4 ? config.particleBassImpact * bassWeight * 0.5 * (minDim / 800) : 0);

    ctx.save();
    if (config.particleGlow) {
      ctx.shadowBlur = config.glowIntensity * 0.6;
      ctx.shadowColor = config.particleColor;
    }

    const timeSec = this.totalTimeMs / 1000;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      // Update position according to dispersion mode
      if (dispersion === 'upward') {
        p.x += p.vx;
        p.y += p.vy - (analysis.isBeatHit ? bassPush * 0.8 : 0);
      } else if (dispersion === 'ambient') {
        p.x += p.vx + Math.sin(timeSec + i) * 0.4;
        p.y += p.vy + Math.cos(timeSec + i) * 0.4;
      } else {
        // Radial from center
        const dx = p.x - cx;
        const dy = p.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / dist;
        const ny = dy / dist;
        p.x += p.vx + nx * bassPush;
        p.y += p.vy + ny * bassPush;
      }

      p.life++;

      // Particle size reacts slightly to bass
      let renderSize = p.baseSize * (1 + bassWeight * (isParticlesOnly ? 1.0 : 0.6));

      // Sparkle twinkle effect
      let alpha = p.alpha;
      if (config.particleSparkle) {
        alpha *= 0.6 + Math.sin(timeSec * p.twinkleSpeed + i) * 0.4;
        if (analysis.treble > 0.4) {
          alpha = Math.min(1.0, alpha * 1.3);
          renderSize *= 1.2;
        }
      }

      // Fade in and out
      if (p.life < 20) {
        alpha = (p.life / 20) * p.maxAlpha;
      } else if (p.life > p.maxLife - 30) {
        alpha = ((p.maxLife - p.life) / 30) * p.maxAlpha;
      }

      // Draw particle
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha * (config.particleOpacity ?? 1)));
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, renderSize), 0, Math.PI * 2);
      ctx.fill();

      // Recycle if outside boundaries or dead
      if (
        p.life >= p.maxLife ||
        p.x < -100 ||
        p.x > width + 100 ||
        p.y < -100 ||
        p.y > height + 100
      ) {
        this.particles[i] = this.createParticle(config, width, height, false);
      }
    }

    ctx.restore();
  }

  /**
   * Delegates rendering to the chosen visualizer layout style
   */
  private renderVisualizerByStyle(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    config: VisualizerConfig,
    analysis: FrequencyAnalysis,
    bassWeight: number
  ) {
    const layout = config.layoutStyle || 'classic-circle';

    switch (layout) {
      case 'bottom-bars':
        this.renderBottomBars(ctx, width, height, config, analysis, bassWeight);
        break;
      case 'mirror-bars':
        this.renderMirrorBarsLayout(ctx, width, height, config, analysis, bassWeight);
        break;
      case 'horizontal-wave':
        this.renderHorizontalWave(ctx, width, height, config, analysis, bassWeight);
        break;
      case 'side-bars':
        this.renderSideBars(ctx, width, height, config, analysis, bassWeight);
        break;
      case 'full-width':
        this.renderFullWidth(ctx, width, height, config, analysis, bassWeight);
        break;
      case 'turntable-vinyl':
        this.renderTurntableVinyl(ctx, width, height, config, analysis, bassWeight);
        break;
      case 'album-art-pulse':
        this.renderAlbumArtPulse(ctx, width, height, config, analysis, bassWeight);
        break;
      case 'minimal':
        this.renderMinimalMode(ctx, width, height, config, analysis, bassWeight);
        break;
      case 'particles-only':
        this.renderParticlesOnlyCore(ctx, width, height, config, analysis, bassWeight);
        break;
      case 'classic-circle':
      default:
        this.renderClassicCircle(ctx, width, height, config, analysis, bassWeight);
        break;
    }
  }

  /**
   * Helper: Smooths frequency bins into target size
   */
  private getProcessedFrequencies(barCount: number, freqData: Uint8Array, smoothing: number): number[] {
    if (this.smoothedBars.length !== barCount) {
      this.smoothedBars = new Array(barCount).fill(0);
    }
    const dataLen = freqData.length;
    for (let i = 0; i < barCount; i++) {
      const normIdx = i / barCount;
      const logIdx = Math.pow(normIdx, 1.4);
      const binIndex = Math.min(dataLen - 1, Math.floor(logIdx * (dataLen * 0.7)));
      const rawVal = freqData[binIndex] / 255.0;
      this.smoothedBars[i] = this.smoothedBars[i] * smoothing + rawVal * (1 - smoothing);
    }
    return this.smoothedBars;
  }

  // -------------------------------------------------------------
  // 1. CERCHIO CENTRALE CLASSICO (Cleaned, No Downward Bleed)
  // -------------------------------------------------------------
  private renderClassicCircle(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    config: VisualizerConfig,
    analysis: FrequencyAnalysis,
    bassWeight: number
  ) {
    const { cx, cy, minDim } = this.getCenter(config, width, height);
    const baseRadius = minDim * config.innerRadiusRatio;
    const dynamicRadius = baseRadius * (1 + bassWeight * config.logoPulseIntensity);

    const barCount = config.barCount;
    const bars = this.getProcessedFrequencies(barCount, analysis.frequencyData, config.smoothing);
    const halfCount = Math.floor(barCount / 2);

    // Max bar height clamp (prevents clipping & bleeds)
    const maxBarHeight = Math.min(
      height * (config.maxBarHeightRatio || 0.38),
      minDim * 0.35 * config.barHeightMultiplier
    );

    ctx.save();
    if (config.glowIntensity > 0) {
      ctx.shadowBlur = config.glowIntensity * (minDim / 800);
      ctx.shadowColor = config.glowColor;
    }

    const gradient = ctx.createRadialGradient(cx, cy, dynamicRadius, cx, cy, dynamicRadius + maxBarHeight);
    gradient.addColorStop(0, config.primaryColor);
    gradient.addColorStop(0.85, config.secondaryColor);
    gradient.addColorStop(1, '#ffffff');
    ctx.strokeStyle = gradient;
    ctx.fillStyle = gradient;

    const angleStep = (Math.PI * 2) / barCount;
    const startAngle = Math.PI / 2;

    ctx.lineWidth = Math.max(1.5, config.barWidth * (minDim / 800));
    ctx.lineCap = 'round';

    for (let i = 0; i < barCount; i++) {
      let mappedIdx = i < halfCount ? i : barCount - 1 - (i - halfCount);
      if (!config.mirrorWave) mappedIdx = i;

      let barVal = bars[mappedIdx];

      // PREVENTION OF DOWNWARD DEFORMITIES:
      // If preventDownwardBleed is enabled, taper bars pointing directly downwards
      const angle = startAngle + i * angleStep;
      if (config.preventDownwardBleed) {
        // angle near Math.PI / 2 is bottom center
        const diffFromBottom = Math.abs(((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI / 2);
        if (diffFromBottom < 0.25) {
          barVal *= (diffFromBottom / 0.25) * 0.85; // clean bottom curve
        }
      }

      const heightOffset = Math.max(2, barVal * maxBarHeight);
      const x1 = cx + Math.cos(angle) * dynamicRadius;
      const y1 = cy + Math.sin(angle) * dynamicRadius;
      const x2 = cx + Math.cos(angle) * (dynamicRadius + heightOffset);
      const y2 = cy + Math.sin(angle) * (dynamicRadius + heightOffset);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    ctx.restore();

    // Render central logo
    this.renderLogo(ctx, width, height, config, bassWeight);
  }

  // -------------------------------------------------------------
  // 2. BARRE DAL BASSO (Bottom Equalizer)
  // -------------------------------------------------------------
  private renderBottomBars(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    config: VisualizerConfig,
    analysis: FrequencyAnalysis,
    bassWeight: number
  ) {
    const barCount = config.barCount || 80;
    const bars = this.getProcessedFrequencies(barCount, analysis.frequencyData, config.smoothing);
    const bottomY = height - (height * ((config.bottomOffsetPercent ?? 8) / 100));
    const maxHeight = Math.min(height * 0.55, height * (config.maxBarHeightRatio || 0.4) * config.barHeightMultiplier);

    const availableWidth = width * 0.88;
    const startX = (width - availableWidth) / 2;
    const spacing = availableWidth / barCount;
    const barW = Math.max(2, Math.min(spacing * 0.75, config.barWidth * 1.8));

    ctx.save();
    if (config.glowIntensity > 0) {
      ctx.shadowBlur = config.glowIntensity;
      ctx.shadowColor = config.glowColor;
    }

    const grad = ctx.createLinearGradient(0, bottomY, 0, bottomY - maxHeight);
    grad.addColorStop(0, config.secondaryColor);
    grad.addColorStop(0.7, config.primaryColor);
    grad.addColorStop(1, '#ffffff');

    ctx.fillStyle = grad;

    for (let i = 0; i < barCount; i++) {
      const val = bars[i];
      const h = Math.max(4, val * maxHeight);
      const x = startX + i * spacing + (spacing - barW) / 2;
      const y = bottomY - h;

      ctx.beginPath();
      ctx.roundRect(x, y, barW, h, [barW / 2, barW / 2, 0, 0]);
      ctx.fill();
    }

    ctx.restore();
  }

  // -------------------------------------------------------------
  // 3. BARRE SPECCHIATE (Dual Mirrored Center Bars)
  // -------------------------------------------------------------
  private renderMirrorBarsLayout(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    config: VisualizerConfig,
    analysis: FrequencyAnalysis,
    bassWeight: number
  ) {
    const barCount = config.barCount || 90;
    const bars = this.getProcessedFrequencies(barCount, analysis.frequencyData, config.smoothing);
    const { cy } = this.getCenter(config, width, height);
    const maxHeight = Math.min(height * 0.35, height * (config.maxBarHeightRatio || 0.3) * config.barHeightMultiplier);

    const availableWidth = width * 0.85;
    const startX = (width - availableWidth) / 2;
    const spacing = availableWidth / barCount;
    const barW = Math.max(2, Math.min(spacing * 0.75, config.barWidth * 1.5));

    ctx.save();
    if (config.glowIntensity > 0) {
      ctx.shadowBlur = config.glowIntensity;
      ctx.shadowColor = config.glowColor;
    }

    const grad = ctx.createLinearGradient(0, cy - maxHeight, 0, cy + maxHeight);
    grad.addColorStop(0, config.secondaryColor);
    grad.addColorStop(0.5, config.primaryColor);
    grad.addColorStop(1, config.secondaryColor);

    ctx.fillStyle = grad;

    for (let i = 0; i < barCount; i++) {
      const val = bars[i];
      const h = Math.max(3, val * maxHeight);
      const x = startX + i * spacing + (spacing - barW) / 2;

      // Draw top bar & bottom mirrored bar
      ctx.beginPath();
      ctx.roundRect(x, cy - h, barW, h * 2, barW / 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // -------------------------------------------------------------
  // 4. WAVEFORM ORIZZONTALE (Linear Oscilloscope Wave)
  // -------------------------------------------------------------
  private renderHorizontalWave(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    config: VisualizerConfig,
    analysis: FrequencyAnalysis,
    bassWeight: number
  ) {
    const pointCount = config.barCount || 120;
    const bars = this.getProcessedFrequencies(pointCount, analysis.frequencyData, config.smoothing);
    let baseY = height * 0.6;
    if (config.waveVerticalPosition === 'top') baseY = height * 0.25;
    else if (config.waveVerticalPosition === 'center') baseY = height * 0.5;
    else if (config.waveVerticalPosition === 'bottom') baseY = height * 0.8;

    const maxHeight = Math.min(height * 0.35, height * 0.25 * config.barHeightMultiplier);
    const stepX = width / (pointCount - 1);

    ctx.save();
    if (config.glowIntensity > 0) {
      ctx.shadowBlur = config.glowIntensity * 1.2;
      ctx.shadowColor = config.glowColor;
    }

    ctx.strokeStyle = config.primaryColor;
    ctx.lineWidth = Math.max(2, config.barWidth * 1.2);
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(0, baseY);

    for (let i = 0; i < pointCount; i++) {
      const sign = i % 2 === 0 ? 1 : -1;
      const val = bars[i];
      const x = i * stepX;
      const y = baseY + sign * val * maxHeight;
      ctx.lineTo(x, y);
    }

    ctx.stroke();

    // Subtle glowing fill underneath
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fillStyle = config.secondaryColor;
    ctx.globalAlpha = 0.08;
    ctx.fill();

    ctx.restore();
  }

  // -------------------------------------------------------------
  // 5. BARRE LATERALI (Side Studio Bars)
  // -------------------------------------------------------------
  private renderSideBars(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    config: VisualizerConfig,
    analysis: FrequencyAnalysis,
    bassWeight: number
  ) {
    const barCount = Math.floor((config.barCount || 60) / 2);
    const bars = this.getProcessedFrequencies(barCount * 2, analysis.frequencyData, config.smoothing);
    const maxBarW = Math.min(width * 0.25, width * 0.2 * config.barHeightMultiplier);
    const availableH = height * 0.75;
    const startY = (height - availableH) / 2;
    const spacing = availableH / barCount;
    const barH = Math.max(2, spacing * 0.65);

    ctx.save();
    if (config.glowIntensity > 0) {
      ctx.shadowBlur = config.glowIntensity;
      ctx.shadowColor = config.glowColor;
    }

    ctx.fillStyle = config.primaryColor;

    for (let i = 0; i < barCount; i++) {
      const valL = bars[i];
      const valR = bars[barCount + i];
      const wL = Math.max(4, valL * maxBarW);
      const wR = Math.max(4, valR * maxBarW);
      const y = startY + i * spacing;

      // Left bar coming inward
      ctx.beginPath();
      ctx.roundRect(0, y, wL, barH, [0, barH / 2, barH / 2, 0]);
      ctx.fill();

      // Right bar coming inward
      ctx.beginPath();
      ctx.roundRect(width - wR, y, wR, barH, [barH / 2, 0, 0, barH / 2]);
      ctx.fill();
    }

    ctx.restore();
  }

  // -------------------------------------------------------------
  // 6. VISUALIZZATORE FULL WIDTH (Expansive Horizon Wave)
  // -------------------------------------------------------------
  private renderFullWidth(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    config: VisualizerConfig,
    analysis: FrequencyAnalysis,
    bassWeight: number
  ) {
    const barCount = config.barCount || 100;
    const bars = this.getProcessedFrequencies(barCount, analysis.frequencyData, config.smoothing);
    const baseY = height - (height * ((config.bottomOffsetPercent ?? 6) / 100));
    const maxHeight = Math.min(height * 0.45, height * 0.35 * config.barHeightMultiplier);
    const stepX = width / (barCount - 1);

    ctx.save();
    if (config.glowIntensity > 0) {
      ctx.shadowBlur = config.glowIntensity * 1.5;
      ctx.shadowColor = config.glowColor;
    }

    // Draw liquid smooth spline across full width
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < barCount; i++) {
      const val = bars[i];
      points.push({
        x: i * stepX,
        y: baseY - val * maxHeight,
      });
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
      const mx = (points[i].x + points[i + 1].x) / 2;
      const my = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my);
    }
    ctx.lineTo(width, baseY);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, baseY - maxHeight, 0, height);
    grad.addColorStop(0, config.primaryColor);
    grad.addColorStop(0.5, config.secondaryColor);
    grad.addColorStop(1, 'rgba(0,0,0,0.85)');

    ctx.fillStyle = grad;
    ctx.globalAlpha = 0.85;
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, config.barWidth);
    ctx.globalAlpha = 1.0;
    ctx.stroke();

    ctx.restore();
  }

  // -------------------------------------------------------------
  // 7. MODALITÀ GIRADISCHI (Vinyl Record Turntable)
  // -------------------------------------------------------------
  private renderTurntableVinyl(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    config: VisualizerConfig,
    analysis: FrequencyAnalysis,
    bassWeight: number
  ) {
    const { cx, cy, minDim } = this.getCenter(config, width, height);
    const vinylRadius = minDim * (config.innerRadiusRatio + 0.12) * (1 + bassWeight * 0.08);

    ctx.save();

    // 1. Vinyl Ambient Drop Shadow
    ctx.shadowBlur = 35;
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.beginPath();
    ctx.arc(cx, cy, vinylRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#08090d';
    ctx.fill();

    // 2. Vinyl Grooves (Realistic concentric circles with audio reactive sheen)
    ctx.shadowBlur = 0;
    for (let r = vinylRadius * 0.45; r < vinylRadius * 0.95; r += 5) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = r % 10 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 3. Rotating Stylus Specular Sheen (Vinyl Light Reflection)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.vinylRotationAngle);

    const sheenGrad = ctx.createLinearGradient(-vinylRadius, -vinylRadius, vinylRadius, vinylRadius);
    sheenGrad.addColorStop(0, 'rgba(255,255,255,0.06)');
    sheenGrad.addColorStop(0.5, 'rgba(255,255,255,0)');
    sheenGrad.addColorStop(1, 'rgba(255,255,255,0.06)');
    ctx.fillStyle = sheenGrad;
    ctx.beginPath();
    ctx.arc(0, 0, vinylRadius, 0, Math.PI * 2);
    ctx.fill();

    // 4. Center Label & Logo
    const labelRadius = vinylRadius * 0.38;
    ctx.beginPath();
    ctx.arc(0, 0, labelRadius, 0, Math.PI * 2);
    ctx.fillStyle = config.primaryColor;
    ctx.fill();

    // Logo image in center label
    const logoImg = this.getImage(config.logoUrl);
    if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, labelRadius * 0.85, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(logoImg, -labelRadius * 0.85, -labelRadius * 0.85, labelRadius * 1.7, labelRadius * 1.7);
      ctx.restore();
    }

    // Center Spindle Hole
    ctx.beginPath();
    ctx.arc(0, 0, labelRadius * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = '#05070a';
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();

    // 5. Outer Audio Reactive Rim Glow & Sparks
    if (config.turntableGrooveGlow) {
      ctx.shadowBlur = config.glowIntensity * 1.2;
      ctx.shadowColor = config.glowColor;
      ctx.strokeStyle = config.glowColor;
      ctx.lineWidth = Math.max(2, 2 + bassWeight * 5);
      ctx.beginPath();
      ctx.arc(cx, cy, vinylRadius + 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  // -------------------------------------------------------------
  // 8. MODALITÀ ALBUM ART PULSE (Modern Floating Card)
  // -------------------------------------------------------------
  private renderAlbumArtPulse(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    config: VisualizerConfig,
    analysis: FrequencyAnalysis,
    bassWeight: number
  ) {
    const { cx, cy, minDim } = this.getCenter(config, width, height);
    const pulseBoost = 1.0 + bassWeight * (config.logoPulseIntensity || 0.25);
    const cardSize = minDim * 0.52 * pulseBoost;
    const radius = 16 * (minDim / 800);

    ctx.save();

    // Heavy Drop Shadow
    ctx.shadowBlur = 40 + bassWeight * 20;
    ctx.shadowColor = config.glowColor;

    // Glowing rim
    ctx.strokeStyle = config.primaryColor;
    ctx.lineWidth = Math.max(3, 4 * (minDim / 800));

    const x = cx - cardSize / 2;
    const y = cy - cardSize / 2;

    ctx.beginPath();
    ctx.roundRect(x, y, cardSize, cardSize, radius);
    ctx.stroke();

    // Image Fill
    ctx.save();
    ctx.clip();
    const logoImg = this.getImage(config.logoUrl);
    if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
      ctx.drawImage(logoImg, x, y, cardSize, cardSize);
    } else {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(x, y, cardSize, cardSize);
    }
    ctx.restore();

    ctx.restore();
  }

  // -------------------------------------------------------------
  // 9. MODALITÀ MINIMAL (Refined Discreet Dots / Thin Line)
  // -------------------------------------------------------------
  private renderMinimalMode(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    config: VisualizerConfig,
    analysis: FrequencyAnalysis,
    bassWeight: number
  ) {
    const { cx, cy, minDim } = this.getCenter(config, width, height);
    const count = 48;
    const bars = this.getProcessedFrequencies(count, analysis.frequencyData, 0.9);
    const r = minDim * 0.22;

    ctx.save();
    ctx.fillStyle = config.primaryColor;
    if (config.glowIntensity > 0) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = config.glowColor;
    }

    const angleStep = (Math.PI * 2) / count;
    for (let i = 0; i < count; i++) {
      const a = i * angleStep;
      const dist = r + bars[i] * (minDim * 0.08);
      const px = cx + Math.cos(a) * dist;
      const py = cy + Math.sin(a) * dist;

      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // -------------------------------------------------------------
  // 10. MODALITÀ SOLO PARTICELLE (No Bars, Pure Energy Core)
  // -------------------------------------------------------------
  private renderParticlesOnlyCore(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    config: VisualizerConfig,
    analysis: FrequencyAnalysis,
    bassWeight: number
  ) {
    const { cx, cy, minDim } = this.getCenter(config, width, height);
    const coreRadius = minDim * 0.12 * (1 + bassWeight * 0.35);

    ctx.save();
    ctx.shadowBlur = config.glowIntensity * 2;
    ctx.shadowColor = config.glowColor;

    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius);
    coreGrad.addColorStop(0, '#ffffff');
    coreGrad.addColorStop(0.4, config.primaryColor);
    coreGrad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Central Logo Helper (for circular mode)
  private renderLogo(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    config: VisualizerConfig,
    bassWeight: number
  ) {
    const { cx, cy, minDim } = this.getCenter(config, width, height);
    const baseRadius = minDim * config.innerRadiusRatio;
    const dynamicRadius = baseRadius * (1 + bassWeight * config.logoPulseIntensity);

    ctx.save();
    ctx.beginPath();
    if (config.logoShape === 'rounded-square') {
      const size = dynamicRadius * 1.8;
      const r = dynamicRadius * 0.35;
      ctx.roundRect(cx - size / 2, cy - size / 2, size, size, r);
    } else {
      ctx.arc(cx, cy, dynamicRadius, 0, Math.PI * 2);
    }
    ctx.fillStyle = '#05070d';
    ctx.fill();

    const logoImg = this.getImage(config.logoUrl);
    if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
      ctx.save();
      ctx.clip();
      ctx.drawImage(logoImg, cx - dynamicRadius, cy - dynamicRadius, dynamicRadius * 2, dynamicRadius * 2);
      ctx.restore();
    }

    if (config.logoBorderWidth > 0) {
      ctx.shadowBlur = config.glowIntensity * 1.2;
      ctx.shadowColor = config.logoBorderColor;
      ctx.strokeStyle = config.logoBorderColor;
      ctx.lineWidth = Math.max(2, config.logoBorderWidth * (minDim / 800));
      ctx.beginPath();
      ctx.arc(cx, cy, dynamicRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Renders dedicated advanced text layers with custom positioning,
   * fonts, weights, alignments, animations, glows, and background boxes.
   */
  private renderTypography(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    config: VisualizerConfig,
    bassWeight: number
  ) {
    const scaleRatio = height / 1080;
    const timeSec = this.totalTimeMs / 1000;
    const layers: TextLayer[] = config.textLayers || [];

    for (const layer of layers) {
      if (!layer.enabled || !layer.text || !layer.text.trim()) continue;

      ctx.save();

      let tx = (layer.x / 100) * width;
      let ty = (layer.y / 100) * height;

      const scaledFontSize = Math.max(10, Math.round(layer.fontSize * scaleRatio));
      const textContent = layer.isUppercase ? layer.text.toUpperCase() : layer.text;

      const italicStr = layer.isItalic ? 'italic' : 'normal';
      const weightStr = layer.fontWeight || '700';
      const familyStr = layer.fontFamily || 'Outfit';
      ctx.font = `${italicStr} ${weightStr} ${scaledFontSize}px '${familyStr}', sans-serif`;

      // Animation & Audio reactivity transforms
      let textPulse = 1.0;
      if (layer.animation === 'bass-pulse') {
        textPulse = 1.0 + bassWeight * (layer.audioReactivity !== undefined ? layer.audioReactivity : 0.2);
      } else if (layer.animation === 'gentle-float') {
        ty += Math.sin(timeSec * 2.2) * 5 * scaleRatio;
      }

      ctx.translate(tx, ty);
      if (textPulse !== 1.0) {
        ctx.scale(textPulse, textPulse);
      }

      if (layer.letterSpacing) {
        try {
          (ctx as unknown as { letterSpacing: string }).letterSpacing = `${layer.letterSpacing * scaleRatio}px`;
        } catch {
          // Fallback
        }
      }

      ctx.textAlign = layer.align || 'center';
      ctx.textBaseline = 'middle';

      // 1. Draw Optional Background Box Behind Text
      if (layer.boxEnabled) {
        ctx.save();
        const metrics = ctx.measureText(textContent);
        const padX = (layer.boxPaddingX || 12) * scaleRatio;
        const padY = (layer.boxPaddingY || 6) * scaleRatio;
        const boxW = metrics.width + padX * 2;
        const boxH = scaledFontSize + padY * 2;
        const radius = (layer.boxBorderRadius || 6) * scaleRatio;

        let boxX = -boxW / 2;
        if (layer.align === 'left') boxX = -padX;
        else if (layer.align === 'right') boxX = -boxW + padX;
        const boxY = -boxH / 2;

        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, radius);
        ctx.fillStyle = layer.boxColor || '#000000';
        ctx.globalAlpha = layer.boxOpacity !== undefined ? layer.boxOpacity : 0.6;
        ctx.fill();

        if (layer.boxBorderWidth && layer.boxBorderWidth > 0) {
          ctx.strokeStyle = layer.boxBorderColor || 'rgba(255,255,255,0.2)';
          ctx.lineWidth = layer.boxBorderWidth * scaleRatio;
          ctx.stroke();
        }
        ctx.restore();
      }

      // 2. Setup Glow & Shadows
      if (layer.glowEnabled) {
        let currentGlowBlur = (layer.glowBlur || 14) * scaleRatio;
        if (layer.animation === 'glow-breath') {
          const breath = 1.0 + Math.sin(timeSec * 3) * 0.4 + bassWeight * 0.5;
          currentGlowBlur *= breath;
        }
        ctx.shadowColor = layer.glowColor || layer.color;
        ctx.shadowBlur = currentGlowBlur;
      } else if (layer.shadowColor) {
        ctx.shadowColor = layer.shadowColor;
        ctx.shadowBlur = 8 * scaleRatio;
        ctx.shadowOffsetX = (layer.shadowOffsetX || 0) * scaleRatio;
        ctx.shadowOffsetY = (layer.shadowOffsetY || 0) * scaleRatio;
      }

      // 3. Optional Text Stroke / Outline
      if (layer.textStrokeWidth && layer.textStrokeWidth > 0) {
        ctx.strokeStyle = layer.textStrokeColor || '#000000';
        ctx.lineWidth = layer.textStrokeWidth * scaleRatio;
        ctx.strokeText(textContent, 0, 0);
      }

      // 4. Render Text Fill
      ctx.fillStyle = layer.color || '#ffffff';
      ctx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1;
      ctx.fillText(textContent, 0, 0);

      ctx.restore();
    }
  }
}

export const visualizerRenderer = new VisualizerRenderer();
