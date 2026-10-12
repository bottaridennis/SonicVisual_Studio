/**
 * Procedural Audio Synthesizer for high-energy Trap / EDM Demo Tracks
 * Uses OfflineAudioContext to generate punchy 808 sub-bass, hi-hat rolls,
 * atmospheric chords, and epic drops without requiring external network downloads.
 */

export interface DemoTrackMeta {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  genre: string;
  durationSeconds: number;
}

export const DEMO_TRACKS_LIST: DemoTrackMeta[] = [
  {
    id: 'trap-overdrive',
    title: 'NATION OVERDRIVE (808 DROP)',
    artist: 'CYBER GHOST // TRAP BEATS',
    bpm: 140,
    genre: 'Trap / Phonk',
    durationSeconds: 32,
  },
  {
    id: 'cyber-drop',
    title: 'NEON VELOCITY (SUB SURGE)',
    artist: 'SYNTH RUNNER // BASS EDM',
    bpm: 130,
    genre: 'Midtempo / Cyber Bass',
    durationSeconds: 28,
  },
];

export async function generateProceduralTrapTrack(trackId: string): Promise<AudioBuffer> {
  const sampleRate = 44100;
  const isTrap = trackId === 'trap-overdrive';
  const bpm = isTrap ? 140 : 130;
  const duration = isTrap ? 32 : 28;
  const offlineCtx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);

  const secondsPerBeat = 60 / bpm;
  const secondsPerBar = secondsPerBeat * 4;
  const totalBars = Math.floor(duration / secondsPerBar);

  // Master compressor / limiter for maximum punch
  const compressor = offlineCtx.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-12, 0);
  compressor.knee.setValueAtTime(10, 0);
  compressor.ratio.setValueAtTime(8, 0);
  compressor.attack.setValueAtTime(0.003, 0);
  compressor.release.setValueAtTime(0.15, 0);
  compressor.connect(offlineCtx.destination);

  // Master gain
  const masterGain = offlineCtx.createGain();
  masterGain.gain.setValueAtTime(0.85, 0);
  masterGain.connect(compressor);

  // Helper: Synthesize punchy 808 sub kick
  function trigger808(time: number, pitch = 45, decay = 0.65) {
    const osc = offlineCtx.createOscillator();
    const gain = offlineCtx.createGain();

    osc.type = 'sine';
    // Frequency drop for sub punch
    osc.frequency.setValueAtTime(pitch * 3.5, time);
    osc.frequency.exponentialRampToValueAtTime(pitch, time + 0.08);

    gain.gain.setValueAtTime(1.0, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

    // Subtle distortion / saturation for harmonics
    const waveshaper = offlineCtx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i * 2) / 256 - 1;
      curve[i] = (Math.PI + 3) * x / (Math.PI + 3 * Math.abs(x));
    }
    waveshaper.curve = curve;

    osc.connect(waveshaper);
    waveshaper.connect(gain);
    gain.connect(masterGain);

    osc.start(time);
    osc.stop(time + decay);
  }

  // Helper: Synthesize Trap Snare / Clap
  function triggerSnare(time: number) {
    const noiseBuffer = offlineCtx.createBuffer(1, sampleRate * 0.25, sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = offlineCtx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = offlineCtx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(1200, time);

    const noiseGain = offlineCtx.createGain();
    noiseGain.gain.setValueAtTime(0.7, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);

    // Body tone
    const toneOsc = offlineCtx.createOscillator();
    const toneGain = offlineCtx.createGain();
    toneOsc.frequency.setValueAtTime(220, time);
    toneOsc.frequency.exponentialRampToValueAtTime(80, time + 0.1);
    toneGain.gain.setValueAtTime(0.6, time);
    toneGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    toneOsc.connect(toneGain);
    toneGain.connect(masterGain);

    noise.start(time);
    noise.stop(time + 0.25);
    toneOsc.start(time);
    toneOsc.stop(time + 0.1);
  }

  // Helper: Synthesize Trap Hi-Hat (Metallic filtered click)
  function triggerHiHat(time: number, isAccent = false) {
    const noiseBuffer = offlineCtx.createBuffer(1, sampleRate * 0.05, sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = (Math.random() * 2 - 1);
    }
    const noise = offlineCtx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = offlineCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7500, time);

    const gain = offlineCtx.createGain();
    gain.gain.setValueAtTime(isAccent ? 0.35 : 0.18, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    noise.start(time);
    noise.stop(time + 0.05);
  }

  // Helper: Lead Synth Arpeggio / Chord Stab
  function triggerSynthNote(time: number, freq: number, duration: number, cutoff = 1800) {
    const osc1 = offlineCtx.createOscillator();
    const osc2 = offlineCtx.createOscillator();
    const filter = offlineCtx.createBiquadFilter();
    const gain = offlineCtx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, time);

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(freq * 1.008, time); // detune for fat width

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, time);
    filter.frequency.exponentialRampToValueAtTime(400, time + duration);

    gain.gain.setValueAtTime(0.25, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    osc1.start(time);
    osc1.stop(time + duration);
    osc2.start(time);
    osc2.stop(time + duration);
  }

  // Generate track structure:
  // Bars 0-2: Atmospheric intro / buildup
  // Bars 2-6: Massive 808 Trap Drop!
  // Bars 6-8: High-energy climax
  const scale = [220, 261.63, 293.66, 329.63, 392, 440, 523.25]; // A minor pentatonic / EDM
  const bassNotes = [55, 65.4, 73.4, 82.4]; // A1, C2, D2, E2

  for (let bar = 0; bar < totalBars; bar++) {
    const barStartTime = bar * secondsPerBar;
    const isDrop = bar >= 2 && bar < totalBars - 1;

    // Melody / Arps
    for (let step = 0; step < 8; step++) {
      const stepTime = barStartTime + (step * secondsPerBeat) / 2;
      const noteIdx = (bar * 3 + step * 2) % scale.length;
      triggerSynthNote(stepTime, scale[noteIdx], 0.28, isDrop ? 2800 : 1200);
    }

    // Hi-hats
    for (let hat = 0; hat < 16; hat++) {
      const hatTime = barStartTime + (hat * secondsPerBeat) / 4;
      const isAccent = hat % 4 === 0;
      triggerHiHat(hatTime, isAccent);
      // Trap hi-hat rolls on 14th beat
      if (hat === 14 && isDrop) {
        triggerHiHat(hatTime + secondsPerBeat / 8, true);
        triggerHiHat(hatTime + (secondsPerBeat * 3) / 16, true);
      }
    }

    // Snares / Claps on beat 2 and 4 (or half-time on beat 3 for heavy Trap!)
    if (isDrop) {
      triggerSnare(barStartTime + secondsPerBeat * 2); // Half-time trap beat 3
    } else {
      triggerSnare(barStartTime + secondsPerBeat);
      triggerSnare(barStartTime + secondsPerBeat * 3);
    }

    // 808 Sub-Bass Kicks
    if (isDrop) {
      const currentBassRoot = bassNotes[bar % bassNotes.length];
      // Beat 1 kick
      trigger808(barStartTime, currentBassRoot, 0.7);
      // Syncopated kicks
      trigger808(barStartTime + secondsPerBeat * 1.5, currentBassRoot, 0.5);
      trigger808(barStartTime + secondsPerBeat * 2.75, currentBassRoot * 1.12, 0.6);
      if (bar % 2 === 1) {
        trigger808(barStartTime + secondsPerBeat * 3.5, currentBassRoot * 1.33, 0.4);
      }
    } else if (bar === 1) {
      // Buildup quick hits
      trigger808(barStartTime, 55, 0.4);
      trigger808(barStartTime + secondsPerBeat * 2, 55, 0.4);
      trigger808(barStartTime + secondsPerBeat * 3, 55, 0.3);
      trigger808(barStartTime + secondsPerBeat * 3.5, 65.4, 0.3);
    }
  }

  // Render to raw buffer
  return await offlineCtx.startRendering();
}
