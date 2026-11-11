export type WaveStyle = 'bars' | 'smooth-curve' | 'mirror-bars' | 'dots' | 'radial-spikes';
export type LogoShape = 'circle' | 'ring' | 'rounded-square' | 'hexagon';
export type ExportResolution = '1080p' | '4k' | '720p' | 'square' | 'vertical';
export type ExportDurationMode = 'full' | '15s' | '30s' | '60s' | 'custom';
export type ExportFormat = 'mp4' | 'webm';
export type AspectRatio = '16:9' | '1:1' | '9:16';

export type VisualizerLayoutStyle =
  | 'classic-circle'
  | 'bottom-bars'
  | 'mirror-bars'
  | 'horizontal-wave'
  | 'side-bars'
  | 'full-width'
  | 'turntable-vinyl'
  | 'album-art-pulse'
  | 'minimal'
  | 'particles-only';

export type TextFontFamily =
  | 'Outfit'
  | 'Montserrat'
  | 'Oswald'
  | 'JetBrains Mono'
  | 'Cinzel'
  | 'Bricolage Grotesque';

export type TextAlign = 'left' | 'center' | 'right';
export type TextAnimation = 'none' | 'bass-pulse' | 'gentle-float' | 'glow-breath';
export type TextEnterAnimation = 'none' | 'fade-in' | 'slide-up' | 'scale-up';

export interface TextLayer {
  id: string;
  enabled: boolean;
  label: string;
  text: string;
  /** Position as percentage of the frame (0–100). */
  x: number;
  y: number;
  /** Font size in px relative to a 1080px-tall frame. */
  fontSize: number;
  fontFamily: TextFontFamily;
  fontWeight: '400' | '600' | '700' | '800';
  isItalic: boolean;
  isUppercase: boolean;
  letterSpacing: number;
  align: TextAlign;
  color: string;
  opacity: number;
  textStrokeWidth?: number;
  textStrokeColor?: string;
  glowEnabled: boolean;
  glowColor: string;
  glowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowColor: string;
  boxEnabled: boolean;
  boxColor: string;
  boxOpacity: number;
  boxPaddingX: number;
  boxPaddingY: number;
  boxBorderRadius: number;
  boxBorderWidth: number;
  boxBorderColor: string;
  animation: TextAnimation;
  enterAnimation?: TextEnterAnimation;
  audioReactivity: number;
  isLocked?: boolean;
}

export interface VisualizerConfig {
  layoutStyle: VisualizerLayoutStyle;

  waveStyle: WaveStyle;
  barCount: number;
  innerRadiusRatio: number;
  barHeightMultiplier: number;
  barWidth: number;
  smoothing: number;
  mirrorWave: boolean;

  preventDownwardBleed: boolean;
  clampingMode: 'outward-only' | 'symmetric' | 'contained';
  maxBarHeightRatio: number;
  bottomOffsetPercent: number;
  waveVerticalPosition: 'bottom' | 'center' | 'top';

  turntableRotationSpeed: number;
  turntableGrooveGlow: boolean;

  visualizerScale: number;
  visualizerX: number;
  visualizerY: number;

  primaryColor: string;
  secondaryColor: string;
  glowColor: string;
  glowIntensity: number;
  /** Degrees per second of automatic hue rotation (0 = off). */
  colorCycleSpeed: number;

  logoUrl: string;
  logoShape: LogoShape;
  logoPulseIntensity: number;
  logoBorderWidth: number;
  logoBorderColor: string;
  logoSpin: boolean;

  particleCount: number;
  particleMinSpeed: number;
  particleMaxSpeed: number;
  particleSize: number;
  particleBassImpact: number;
  particleColor: string;
  particleGlow: boolean;
  particleSparkle: boolean;
  particleDispersion: 'radial' | 'upward' | 'ambient';
  particleOpacity: number;

  backgroundUrl: string;
  backgroundBlur: number;
  backgroundVignette: number;
  backgroundDim: number;
  backgroundParallax: boolean;
  bassCameraShake: boolean;
  bassZoomIntensity: number;

  /** Brief bright flash on detected kicks. */
  beatFlash: boolean;
  /** Expanding rings emitted on detected kicks. */
  shockwaveRings: boolean;
  /** Subtle analog film grain overlay (0–1). */
  filmGrain: number;
  /** Chromatic RGB split on bass (0–1). */
  chromaticAberration: number;

  textLayers: TextLayer[];

  // Legacy fields kept for project compatibility
  showTrackInfo?: boolean;
  trackTitle?: string;
  artistName?: string;
  watermarkText?: string;
  typographyPosition?: 'bottom' | 'top' | 'hidden';
}

export interface Preset {
  id: string;
  name: string;
  tagline: string;
  isCustom?: boolean;
  /** Two-color swatch used for preview chips. */
  swatch?: [string, string];
  config: Partial<VisualizerConfig>;
}

export interface AudioTrackInfo {
  id: string;
  title: string;
  artist: string;
  duration: number;
  isCustom: boolean;
  bpm?: number;
  audioBuffer?: AudioBuffer;
}

export interface ExportSettings {
  resolution: ExportResolution;
  fps: 30 | 60;
  format: ExportFormat;
  durationMode: ExportDurationMode;
  customDurationSeconds?: number;
  /** Start from the current playhead instead of 0. */
  startFromPlayhead?: boolean;
  bitrateMbps: number;
}

export interface ExportProgress {
  isExporting: boolean;
  progressPercent: number;
  currentFrame: number;
  totalFrames: number;
  elapsedSeconds: number;
  etaSeconds: number;
  statusText: string;
  completedBlobUrl?: string;
  error?: string;
}

export type SelectionTarget =
  | { type: 'visualizer' }
  | { type: 'text'; layerId: string }
  | { type: 'particles' }
  | { type: 'background' }
  | { type: 'logo' }
  | { type: 'effects' };

export interface ProjectData {
  version: string;
  projectName: string;
  savedAt: string;
  config: VisualizerConfig;
  exportSettings: ExportSettings;
}

export const RESOLUTION_SIZES: Record<ExportResolution, { width: number; height: number; label: string }> = {
  '720p': { width: 1280, height: 720, label: 'HD 720p' },
  '1080p': { width: 1920, height: 1080, label: 'Full HD 1080p' },
  '4k': { width: 3840, height: 2160, label: '4K Ultra HD' },
  square: { width: 1080, height: 1080, label: 'Quadrato 1:1' },
  vertical: { width: 1080, height: 1920, label: 'Verticale 9:16' },
};

export function aspectOfResolution(res: ExportResolution): AspectRatio {
  if (res === 'square') return '1:1';
  if (res === 'vertical') return '9:16';
  return '16:9';
}
