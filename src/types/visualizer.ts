export type WaveStyle = 'bars' | 'smooth-curve' | 'mirror-bars' | 'dots' | 'radial-spikes';
export type LogoShape = 'circle' | 'ring' | 'rounded-square' | 'hexagon';
export type ExportResolution = '1080p' | '4k' | '720p' | 'square';
export type ExportDurationMode = 'full' | '15s' | '30s' | '60s' | 'custom';
export type ExportFormat = 'mp4' | 'webm';

export type VisualizerLayoutStyle =
  | 'classic-circle'       // 1. Cerchio centrale classico attorno a logo o immagine
  | 'bottom-bars'          // 2. Barre dal basso verticali che salgono come un equalizzatore
  | 'mirror-bars'          // 3. Barre specchiate che si riflettono simmetricamente
  | 'horizontal-wave'      // 4. Waveform orizzontale posizionabile in basso, al centro o in alto
  | 'side-bars'            // 5. Barre laterali disposte sui bordi dello schermo
  | 'full-width'           // 6. Visualizzatore full width a tutta larghezza
  | 'turntable-vinyl'      // 7. Modalità giradischi con vinile centrale animato e rotante
  | 'album-art-pulse'      // 8. Modalità album art pulse con artwork che pulsa a tempo
  | 'minimal'              // 9. Modalità minimal elegante e discreta
  | 'particles-only';      // 10. Modalità solo particelle e glow senza barre invasive

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
  // Position as percentage across canvas (0 to 100%)
  x: number;
  y: number;
  // Typography
  fontSize: number;
  fontFamily: TextFontFamily;
  fontWeight: '400' | '600' | '700' | '800';
  isItalic: boolean;
  isUppercase: boolean;
  letterSpacing: number; // in px
  align: TextAlign;
  color: string;
  opacity: number; // 0 to 1
  // Text outline / stroke
  textStrokeWidth?: number;
  textStrokeColor?: string;
  // Glow / Shadow
  glowEnabled: boolean;
  glowColor: string;
  glowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowColor: string;
  // Background Box
  boxEnabled: boolean;
  boxColor: string;
  boxOpacity: number;
  boxPaddingX: number;
  boxPaddingY: number;
  boxBorderRadius: number;
  boxBorderWidth: number;
  boxBorderColor: string;
  // Animation / Audio Reactivity
  animation: TextAnimation;
  enterAnimation?: TextEnterAnimation;
  audioReactivity: number; // 0 to 1
  isLocked?: boolean;
}

export interface VisualizerConfig {
  // Layout Style (The 10 main visualizer modes)
  layoutStyle: VisualizerLayoutStyle;

  // Wave options
  waveStyle: WaveStyle;
  barCount: number;
  innerRadiusRatio: number; // 0.15 to 0.45 of canvas min-dimension
  barHeightMultiplier: number;
  barWidth: number;
  smoothing: number; // 0.5 to 0.95
  mirrorWave: boolean;

  // Cleanliness & Boundary Constraints (Prevents unwanted deformities/bleed)
  preventDownwardBleed: boolean; // Cleans circular wave, prevents dipping underneath
  clampingMode: 'outward-only' | 'symmetric' | 'contained';
  maxBarHeightRatio: number; // 0.1 to 0.6 of screen height
  bottomOffsetPercent: number; // 0% to 35% distance from bottom for bottom/horizontal modes
  waveVerticalPosition: 'bottom' | 'center' | 'top';

  // Turntable Vinyl Mode Settings
  turntableRotationSpeed: number; // RPM multiplier
  turntableGrooveGlow: boolean;

  // Visualizer Transform (Size & Position)
  visualizerScale: number; // 0.4 to 2.2
  visualizerX: number; // 0 to 100% (center is 50%)
  visualizerY: number; // 0 to 100% (center is 50%)

  // Colors & Glow
  primaryColor: string;
  secondaryColor: string;
  glowColor: string;
  glowIntensity: number; // 0 to 40 px shadowBlur

  // Logo & Central Element
  logoUrl: string;
  logoShape: LogoShape;
  logoPulseIntensity: number; // 0 to 0.5 scale boost on bass
  logoBorderWidth: number;
  logoBorderColor: string;

  // Particles & Effects
  particleCount: number;
  particleMinSpeed: number;
  particleMaxSpeed: number;
  particleSize: number;
  particleBassImpact: number; // velocity impulse on bass drop
  particleColor: string;
  particleGlow: boolean;
  particleSparkle: boolean;
  particleDispersion: 'radial' | 'upward' | 'ambient';
  particleOpacity: number;

  // Background & Camera
  backgroundUrl: string;
  backgroundBlur: number;
  backgroundVignette: number;
  backgroundDim: number; // 0 (bright) to 0.8 (dark)
  bassCameraShake: boolean;
  bassZoomIntensity: number;

  // Dedicated Video Text Layers
  textLayers: TextLayer[];

  // Legacy compatibility fields
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
  blobUrl?: string;
}

export interface ExportSettings {
  resolution: ExportResolution;
  fps: 30 | 60;
  format: ExportFormat;
  durationMode: ExportDurationMode;
  customDurationSeconds?: number;
  bitrateMbps: number;
}

export interface ExportProgress {
  isExporting: boolean;
  progressPercent: number; // 0 to 100
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
  | { type: 'logo' };

export interface ProjectData {
  version: string;
  projectName: string;
  savedAt: string;
  config: VisualizerConfig;
  exportSettings: ExportSettings;
}

