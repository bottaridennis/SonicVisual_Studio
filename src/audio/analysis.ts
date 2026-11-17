/**
 * Shared spectral analysis used both by the live preview engine and by the
 * video exporter, so the exported video reacts exactly like the preview.
 */

export interface FrequencyAnalysis {
  frequencyData: Uint8Array;
  timeDomainData: Uint8Array;
  sampleRate: number;
  subBass: number; // 0–1 (20–70 Hz)
  bass: number; // 0–1 (70–250 Hz)
  lowMid: number; // 0–1 (250–600 Hz)
  mid: number; // 0–1 (600–2500 Hz)
  treble: number; // 0–1 (2.5–10 kHz)
  /** Weighted low-end energy, the main driver of "pump" effects. */
  bassWeight: number;
  peakEnergy: number;
  isBeatHit: boolean;
}

export const FFT_SIZE = 2048;

export function createEmptyAnalysis(): FrequencyAnalysis {
  return {
    frequencyData: new Uint8Array(FFT_SIZE / 2),
    timeDomainData: new Uint8Array(FFT_SIZE / 2).fill(128),
    sampleRate: 44100,
    subBass: 0,
    bass: 0,
    lowMid: 0,
    mid: 0,
    treble: 0,
    bassWeight: 0,
    peakEnergy: 0,
    isBeatHit: false,
  };
}

export function configureAnalyser(analyser: AnalyserNode) {
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = 0.55;
  analyser.minDecibels = -88;
  analyser.maxDecibels = -12;
  // keep in sync with OfflineAnalyzer constants
}

const SMOOTHING = 0.55;
const MIN_DB = -88;
const MAX_DB = -12;

/**
 * Turns raw byte spectrum/waveform data into band energies with adaptive kick detection.
 * Everything is time-based (ms), so it behaves identically at 30, 60 or 144 fps.
 */
export class BeatTracker {
  private runningAverage = 0.2;
  private lastBeatAt = -Infinity;
  private lastAt: number | null = null;

  compute(freq: Uint8Array, time: Uint8Array, sampleRate: number, nowMs: number): FrequencyAnalysis {
    const binCount = freq.length;
    const hzPerBin = sampleRate / 2 / binCount;
    const band = (startHz: number, endHz: number) => {
      const s = Math.max(0, Math.floor(startHz / hzPerBin));
      const e = Math.min(binCount - 1, Math.ceil(endHz / hzPerBin));
      if (e <= s) return 0;
      let sum = 0;
      for (let i = s; i <= e; i++) sum += freq[i];
      return sum / (e - s + 1) / 255;
    };

    const subBass = band(20, 70);
    const bass = band(70, 250);
    const lowMid = band(250, 600);
    const mid = band(600, 2500);
    const treble = band(2500, 10000);
    const bassWeight = subBass * 0.65 + bass * 0.35;
    const peakEnergy = Math.max(subBass, bass, mid);

    let isBeatHit = false;
    if (nowMs - this.lastBeatAt > 140 && bassWeight > this.runningAverage * 1.28 && bassWeight > 0.38) {
      isBeatHit = true;
      this.lastBeatAt = nowMs;
    }
    const steps = this.lastAt === null ? 1 : Math.max(0, Math.min(10, (nowMs - this.lastAt) / 16.667));
    this.lastAt = nowMs;
    const keep = Math.pow(0.94, steps);
    this.runningAverage = this.runningAverage * keep + bassWeight * (1 - keep);

    return { frequencyData: freq, timeDomainData: time, sampleRate, subBass, bass, lowMid, mid, treble, bassWeight, peakEnergy, isBeatHit };
  }

  reset() {
    this.runningAverage = 0.2;
    this.lastBeatAt = -Infinity;
    this.lastAt = null;
  }
}

/** Live analysis from a Web Audio AnalyserNode (preview). */
export class BandAnalyzer {
  private freq: Uint8Array<ArrayBuffer>;
  private time: Uint8Array<ArrayBuffer>;
  private beats = new BeatTracker();

  constructor(private analyser: AnalyserNode) {
    this.freq = new Uint8Array(analyser.frequencyBinCount);
    this.time = new Uint8Array(analyser.fftSize);
  }

  analyze(nowMs: number): FrequencyAnalysis {
    this.analyser.getByteFrequencyData(this.freq);
    this.analyser.getByteTimeDomainData(this.time);
    return this.beats.compute(this.freq, this.time, this.analyser.context.sampleRate, nowMs);
  }

  reset() {
    this.beats.reset();
  }
}

/**
 * Offline analysis straight from an AudioBuffer, reproducing what an AnalyserNode
 * (Blackman window, FFT, temporal smoothing, dB → byte mapping) would report at any instant.
 * Used by the frame-accurate exporter, so the video reacts exactly like the preview.
 */
export class OfflineAnalyzer {
  private readonly n = FFT_SIZE;
  private mono: Float32Array;
  private window: Float32Array;
  private re: Float32Array;
  private im: Float32Array;
  private rev: Uint32Array;
  private cos: Float32Array;
  private sin: Float32Array;
  private smoothed: Float32Array;
  private freq: Uint8Array;
  private time: Uint8Array;
  private beats = new BeatTracker();
  private lastT: number | null = null;
  readonly sampleRate: number;

  constructor(buffer: AudioBuffer) {
    const n = this.n;
    this.sampleRate = buffer.sampleRate;
    // Down-mix to mono like the AnalyserNode does
    const chans = buffer.numberOfChannels;
    this.mono = new Float32Array(buffer.length);
    for (let c = 0; c < chans; c++) {
      const d = buffer.getChannelData(c);
      for (let i = 0; i < d.length; i++) this.mono[i] += d[i] / chans;
    }
    this.window = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = i / n;
      this.window[i] = 0.42 - 0.5 * Math.cos(2 * Math.PI * x) + 0.08 * Math.cos(4 * Math.PI * x);
    }
    this.re = new Float32Array(n);
    this.im = new Float32Array(n);
    this.rev = new Uint32Array(n);
    const bits = Math.log2(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      this.rev[i] = r;
    }
    this.cos = new Float32Array(n / 2);
    this.sin = new Float32Array(n / 2);
    for (let i = 0; i < n / 2; i++) {
      this.cos[i] = Math.cos((-2 * Math.PI * i) / n);
      this.sin[i] = Math.sin((-2 * Math.PI * i) / n);
    }
    this.smoothed = new Float32Array(n / 2);
    this.freq = new Uint8Array(n / 2);
    this.time = new Uint8Array(n);
  }

  /** Analysis of the window of samples ending at `timeSec`. */
  analyze(timeSec: number): FrequencyAnalysis {
    const n = this.n;
    const end = Math.round(timeSec * this.sampleRate);
    const startIdx = end - n;
    const { re, im, mono, rev } = this;

    for (let i = 0; i < n; i++) {
      const idx = startIdx + i;
      const v = idx >= 0 && idx < mono.length ? mono[idx] : 0;
      this.time[i] = Math.max(0, Math.min(255, Math.round(128 * (1 + v))));
      const j = rev[i];
      re[j] = v * this.window[i];
      im[j] = 0;
    }

    // In-place iterative radix-2 FFT
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1;
      const step = n / size;
      for (let s = 0; s < n; s += size) {
        for (let k = 0; k < half; k++) {
          const wr = this.cos[k * step];
          const wi = this.sin[k * step];
          const a = s + k;
          const b = a + half;
          const tr = re[b] * wr - im[b] * wi;
          const ti = re[b] * wi + im[b] * wr;
          re[b] = re[a] - tr;
          im[b] = im[a] - ti;
          re[a] += tr;
          im[a] += ti;
        }
      }
    }

    // Smoothing is per-call in the AnalyserNode; normalise it to a 60 Hz call rate.
    const dt = this.lastT === null ? 1 / 60 : Math.max(0, timeSec - this.lastT);
    this.lastT = timeSec;
    const tau = Math.pow(SMOOTHING, Math.max(0.25, Math.min(4, dt * 60)));
    const range = MAX_DB - MIN_DB;
    for (let k = 0; k < n / 2; k++) {
      const mag = Math.hypot(re[k], im[k]) / n;
      const sm = tau * this.smoothed[k] + (1 - tau) * mag;
      this.smoothed[k] = sm;
      const db = sm > 0 ? 20 * Math.log10(sm) : -Infinity;
      this.freq[k] = Math.max(0, Math.min(255, Math.floor((255 / range) * (db - MIN_DB))));
    }

    return this.beats.compute(this.freq, this.time, this.sampleRate, timeSec * 1000);
  }
}

/** Downsamples an AudioBuffer into min/max peak pairs for drawing a waveform overview. */
export function computeWaveformPeaks(buffer: AudioBuffer, buckets = 1200): Float32Array {
  const peaks = new Float32Array(buckets * 2);
  const channels = Math.min(buffer.numberOfChannels, 2);
  const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  const samplesPerBucket = Math.max(1, Math.floor(buffer.length / buckets));
  for (let b = 0; b < buckets; b++) {
    let min = 1;
    let max = -1;
    const start = b * samplesPerBucket;
    const end = Math.min(buffer.length, start + samplesPerBucket);
    const stride = Math.max(1, Math.floor((end - start) / 256));
    for (let i = start; i < end; i += stride) {
      for (let c = 0; c < channels; c++) {
        const v = data[c][i];
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    peaks[b * 2] = min === 1 ? 0 : min;
    peaks[b * 2 + 1] = max === -1 ? 0 : max;
  }
  return peaks;
}
