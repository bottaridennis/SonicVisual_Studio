/**
 * Web Audio playback engine: decoding, transport, FFT analysis.
 * UI components subscribe to transport state changes via `subscribe`.
 */
import {
  BandAnalyzer,
  FrequencyAnalysis,
  configureAnalyser,
  createEmptyAnalysis,
} from './analysis';

export type { FrequencyAnalysis } from './analysis';

export interface TransportState {
  isPlaying: boolean;
  isMuted: boolean;
  isLooping: boolean;
  volume: number;
  duration: number;
}

type Listener = (state: TransportState) => void;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private bandAnalyzer: BandAnalyzer | null = null;

  private sourceNode: AudioBufferSourceNode | null = null;
  private currentBuffer: AudioBuffer | null = null;

  private isPlaying = false;
  private startTime = 0;
  private pauseOffset = 0;
  private volume = 0.85;
  private isMuted = false;
  private loop = true;

  private listeners = new Set<Listener>();
  private idleAnalysis = createEmptyAnalysis();

  // ---------------------------------------------------------------- state
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): TransportState {
    return {
      isPlaying: this.isPlaying,
      isMuted: this.isMuted,
      isLooping: this.loop,
      volume: this.volume,
      duration: this.getDuration(),
    };
  }

  private emit() {
    const s = this.getState();
    this.listeners.forEach((l) => l(s));
  }

  // ---------------------------------------------------------------- graph
  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private initNodes() {
    const ctx = this.ensureContext();
    if (this.analyser) return;
    this.analyser = ctx.createAnalyser();
    configureAnalyser(this.analyser);
    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = this.isMuted ? 0 : this.volume;
    this.analyser.connect(this.gainNode);
    this.gainNode.connect(ctx.destination);
    this.bandAnalyzer = new BandAnalyzer(this.analyser);
  }

  private applyGain() {
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setTargetAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime, 0.015);
    }
  }

  // ---------------------------------------------------------------- loading
  async decodeAudioFile(file: File): Promise<AudioBuffer> {
    const ctx = this.ensureContext();
    const arrayBuffer = await file.arrayBuffer();
    return await ctx.decodeAudioData(arrayBuffer);
  }

  setAudioBuffer(buffer: AudioBuffer) {
    this.stop();
    this.currentBuffer = buffer;
    this.pauseOffset = 0;
    this.bandAnalyzer?.reset();
    this.emit();
  }

  getAudioBuffer(): AudioBuffer | null {
    return this.currentBuffer;
  }

  // ---------------------------------------------------------------- transport
  play(offset?: number) {
    if (!this.currentBuffer) return;
    const ctx = this.ensureContext();
    this.initNodes();
    this.stopSource();

    const duration = this.currentBuffer.duration;
    let seek = offset !== undefined ? offset : this.pauseOffset;
    if (seek >= duration - 0.01) seek = 0;
    seek = Math.max(0, seek);

    const src = ctx.createBufferSource();
    src.buffer = this.currentBuffer;
    src.loop = this.loop;
    src.connect(this.analyser!);
    src.onended = () => {
      if (this.sourceNode !== src) return;
      this.sourceNode = null;
      this.isPlaying = false;
      this.pauseOffset = 0;
      this.emit();
    };
    src.start(0, seek);

    this.sourceNode = src;
    this.startTime = ctx.currentTime - seek;
    this.pauseOffset = seek;
    this.isPlaying = true;
    this.emit();
  }

  pause() {
    if (!this.isPlaying) return;
    this.pauseOffset = this.getCurrentTime();
    this.stopSource();
    this.isPlaying = false;
    this.emit();
  }

  togglePlay() {
    if (this.isPlaying) this.pause();
    else this.play();
  }

  stop() {
    this.stopSource();
    this.isPlaying = false;
    this.pauseOffset = 0;
    this.emit();
  }

  private stopSource() {
    const src = this.sourceNode;
    this.sourceNode = null;
    if (src) {
      src.onended = null;
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
      src.disconnect();
    }
  }

  seek(targetSeconds: number) {
    const t = Math.max(0, Math.min(targetSeconds, this.getDuration()));
    if (this.isPlaying) {
      this.play(t);
    } else {
      this.pauseOffset = t;
      this.emit();
    }
  }

  getCurrentTime(): number {
    if (!this.currentBuffer) return 0;
    if (this.isPlaying && this.ctx) {
      const elapsed = this.ctx.currentTime - this.startTime;
      const d = this.currentBuffer.duration;
      return this.loop ? elapsed % d : Math.min(elapsed, d);
    }
    return this.pauseOffset;
  }

  getDuration(): number {
    return this.currentBuffer ? this.currentBuffer.duration : 0;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.volume > 0 && this.isMuted) this.isMuted = false;
    this.applyGain();
    this.emit();
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.applyGain();
    this.emit();
  }

  toggleLoop() {
    // Re-anchor the timeline so the playhead stays consistent when switching mode.
    const t = this.getCurrentTime();
    this.loop = !this.loop;
    if (this.sourceNode && this.ctx) {
      this.sourceNode.loop = this.loop;
      this.startTime = this.ctx.currentTime - t;
    }
    this.emit();
  }

  // ---------------------------------------------------------------- analysis
  private lastAnalysis: FrequencyAnalysis | null = null;
  private lastAnalysisAt = -1;

  /** Several components may read the analysis in the same frame: cache it briefly so beats aren't consumed twice. */
  analyze(): FrequencyAnalysis {
    if (!this.bandAnalyzer) return this.idleAnalysis;
    const now = performance.now();
    if (this.lastAnalysis && now - this.lastAnalysisAt < 6) return this.lastAnalysis;
    this.lastAnalysis = this.bandAnalyzer.analyze(now);
    this.lastAnalysisAt = now;
    return this.lastAnalysis;
  }
}

export const audioEngine = new AudioEngine();
