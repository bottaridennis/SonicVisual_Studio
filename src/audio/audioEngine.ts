/**
 * Web Audio API Engine
 * Handles decoding, FFT frequency analysis, bass detection,
 * transport playback, and MediaStream destination for video export.
 */

export interface FrequencyAnalysis {
  frequencyData: Uint8Array;
  timeDomainData: Uint8Array;
  subBass: number;   // 0.0 - 1.0 (20-60 Hz)
  bass: number;      // 0.0 - 1.0 (60-250 Hz)
  lowMid: number;    // 0.0 - 1.0 (250-500 Hz)
  mid: number;       // 0.0 - 1.0 (500-2000 Hz)
  treble: number;    // 0.0 - 1.0 (2000-10000 Hz)
  peakEnergy: number; // 0.0 - 1.0
  isBeatHit: boolean; // transient kick detection
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private mediaStreamDest: MediaStreamAudioDestinationNode | null = null;
  
  private sourceNode: AudioBufferSourceNode | null = null;
  private currentBuffer: AudioBuffer | null = null;
  
  private isPlaying = false;
  private startTime = 0;
  private pauseOffset = 0;
  private volume = 0.85;
  private isMuted = false;
  private loop = true;

  // Running beat detection statistics
  private bassRunningAverage = 0.2;
  private beatDecay = 0.95;
  private beatCooldown = 0;

  // Cache arrays for FFT to avoid GC pressure
  private freqArray: Uint8Array | null = null;
  private timeArray: Uint8Array | null = null;

  public onEndedCallback: (() => void) | null = null;
  public onTimeUpdateCallback: ((currentTime: number, duration: number) => void) | null = null;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private initNodes() {
    const ctx = this.ensureContext();
    if (!this.analyser) {
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.8;
      this.analyser.minDecibels = -90;
      this.analyser.maxDecibels = -10;

      this.gainNode = ctx.createGain();
      this.gainNode.gain.setValueAtTime(this.isMuted ? 0 : this.volume, ctx.currentTime);

      this.mediaStreamDest = ctx.createMediaStreamDestination();

      // Audio routing: Source -> Analyser -> Gain -> [Destination & MediaStreamDestination]
      this.analyser.connect(this.gainNode);
      this.gainNode.connect(ctx.destination);
      this.gainNode.connect(this.mediaStreamDest);

      this.freqArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeArray = new Uint8Array(this.analyser.frequencyBinCount);
    }
  }

  public async decodeAudioFile(file: File): Promise<AudioBuffer> {
    const ctx = this.ensureContext();
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    this.currentBuffer = decoded;
    this.pauseOffset = 0;
    return decoded;
  }

  public setAudioBuffer(buffer: AudioBuffer) {
    this.stop();
    this.currentBuffer = buffer;
    this.pauseOffset = 0;
  }

  public getAudioBuffer(): AudioBuffer | null {
    return this.currentBuffer;
  }

  public play(offset?: number) {
    if (!this.currentBuffer) return;
    const ctx = this.ensureContext();
    this.initNodes();

    if (this.isPlaying) {
      this.stopSource();
    }

    const seekTime = offset !== undefined ? offset : this.pauseOffset;
    const clampedSeek = Math.max(0, Math.min(seekTime, this.currentBuffer.duration));

    this.sourceNode = ctx.createBufferSource();
    this.sourceNode.buffer = this.currentBuffer;
    this.sourceNode.loop = this.loop;

    this.sourceNode.connect(this.analyser!);

    this.sourceNode.onended = () => {
      if (this.isPlaying && !this.loop) {
        this.isPlaying = false;
        this.pauseOffset = 0;
        if (this.onEndedCallback) this.onEndedCallback();
      }
    };

    this.sourceNode.start(0, clampedSeek);
    this.startTime = ctx.currentTime - clampedSeek;
    this.pauseOffset = clampedSeek;
    this.isPlaying = true;
  }

  public pause() {
    if (!this.isPlaying) return;
    const ctx = this.ensureContext();
    this.pauseOffset = (ctx.currentTime - this.startTime) % (this.currentBuffer?.duration || 1);
    this.stopSource();
    this.isPlaying = false;
  }

  public togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public stop() {
    this.stopSource();
    this.isPlaying = false;
    this.pauseOffset = 0;
  }

  private stopSource() {
    if (this.sourceNode) {
      try {
        this.sourceNode.onended = null;
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch {
        // Source already stopped
      }
      this.sourceNode = null;
    }
  }

  public seek(targetSeconds: number) {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) {
      this.pause();
    }
    this.pauseOffset = Math.max(0, Math.min(targetSeconds, this.getDuration()));
    if (wasPlaying) {
      this.play(this.pauseOffset);
    }
  }

  public getCurrentTime(): number {
    if (!this.currentBuffer) return 0;
    if (this.isPlaying && this.ctx) {
      const elapsed = this.ctx.currentTime - this.startTime;
      return this.loop ? elapsed % this.currentBuffer.duration : Math.min(elapsed, this.currentBuffer.duration);
    }
    return this.pauseOffset;
  }

  public getDuration(): number {
    return this.currentBuffer ? this.currentBuffer.duration : 0;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public toggleLoop(): boolean {
    this.loop = !this.loop;
    if (this.sourceNode) {
      this.sourceNode.loop = this.loop;
    }
    return this.loop;
  }

  public getIsLoop(): boolean {
    return this.loop;
  }

  public setSmoothing(smoothing: number) {
    if (this.analyser) {
      this.analyser.smoothingTimeConstant = Math.max(0.1, Math.min(0.95, smoothing));
    }
  }

  public getMediaStreamDestination(): MediaStreamAudioDestinationNode | null {
    this.initNodes();
    return this.mediaStreamDest;
  }

  /**
   * Performs real-time audio FFT frequency decomposition
   * Separates sub-bass (20-60 Hz) and bass (60-250 Hz) for heavy reactive visuals.
   */
  public analyze(): FrequencyAnalysis {
    if (!this.analyser || !this.freqArray || !this.timeArray) {
      const empty = new Uint8Array(128);
      return {
        frequencyData: empty,
        timeDomainData: empty,
        subBass: 0,
        bass: 0,
        lowMid: 0,
        mid: 0,
        treble: 0,
        peakEnergy: 0,
        isBeatHit: false,
      };
    }

    this.analyser.getByteFrequencyData(this.freqArray as unknown as Uint8Array<ArrayBuffer>);
    this.analyser.getByteTimeDomainData(this.timeArray as unknown as Uint8Array<ArrayBuffer>);

    const binCount = this.analyser.frequencyBinCount;
    const nyquist = (this.ctx?.sampleRate || 44100) / 2;
    const hzPerBin = nyquist / binCount;

    // Helper to calculate average energy across Hz frequency range
    const getRangeEnergy = (startHz: number, endHz: number): number => {
      const startBin = Math.max(0, Math.floor(startHz / hzPerBin));
      const endBin = Math.min(binCount - 1, Math.ceil(endHz / hzPerBin));
      if (startBin >= endBin) return 0;
      let sum = 0;
      for (let i = startBin; i <= endBin; i++) {
        sum += this.freqArray![i];
      }
      return (sum / (endBin - startBin + 1)) / 255;
    };

    const subBass = getRangeEnergy(20, 70);
    const bass = getRangeEnergy(70, 250);
    const lowMid = getRangeEnergy(250, 600);
    const mid = getRangeEnergy(600, 2500);
    const treble = getRangeEnergy(2500, 10000);

    const bassWeight = subBass * 0.7 + bass * 0.3;
    const peakEnergy = Math.max(subBass, bass, mid);

    // Dynamic Kick / Beat Drop detection
    let isBeatHit = false;
    if (this.beatCooldown > 0) {
      this.beatCooldown--;
    } else if (bassWeight > this.bassRunningAverage * 1.38 && bassWeight > 0.45) {
      isBeatHit = true;
      this.beatCooldown = 8; // prevent rapid flutter triggers
    }

    // Adapt running average
    this.bassRunningAverage = this.bassRunningAverage * this.beatDecay + bassWeight * (1 - this.beatDecay);

    return {
      frequencyData: this.freqArray,
      timeDomainData: this.timeArray,
      subBass,
      bass,
      lowMid,
      mid,
      treble,
      peakEnergy,
      isBeatHit,
    };
  }

  public getContext(): AudioContext | null {
    return this.ctx;
  }
}

export const audioEngine = new AudioEngine();
