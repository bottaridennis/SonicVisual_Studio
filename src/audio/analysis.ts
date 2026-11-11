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
}

/**
 * Stateful band analyser with adaptive kick detection.
 * Beat detection is time-based (ms), not frame-based, so it behaves identically at 30, 60 or 144 fps.
 */
export class BandAnalyzer {
  private freq: Uint8Array<ArrayBuffer>;
  private time: Uint8Array<ArrayBuffer>;
  private runningAverage = 0.2;
  private lastBeatAt = -Infinity;

  constructor(private analyser: AnalyserNode) {
    this.freq = new Uint8Array(analyser.frequencyBinCount);
    this.time = new Uint8Array(analyser.fftSize);
  }

  analyze(nowMs: number): FrequencyAnalysis {
    const analyser = this.analyser;
    analyser.getByteFrequencyData(this.freq);
    analyser.getByteTimeDomainData(this.time);

    const binCount = analyser.frequencyBinCount;
    const sampleRate = analyser.context.sampleRate;
    const hzPerBin = sampleRate / 2 / binCount;
    const freq = this.freq;

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
    if (
      nowMs - this.lastBeatAt > 140 &&
      bassWeight > this.runningAverage * 1.28 &&
      bassWeight > 0.38
    ) {
      isBeatHit = true;
      this.lastBeatAt = nowMs;
    }
    this.runningAverage = this.runningAverage * 0.94 + bassWeight * 0.06;

    return {
      frequencyData: this.freq,
      timeDomainData: this.time,
      sampleRate,
      subBass,
      bass,
      lowMid,
      mid,
      treble,
      bassWeight,
      peakEnergy,
      isBeatHit,
    };
  }

  reset() {
    this.runningAverage = 0.2;
    this.lastBeatAt = -Infinity;
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
