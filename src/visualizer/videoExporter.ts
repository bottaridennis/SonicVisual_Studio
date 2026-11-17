import { ExportSettings, ExportProgress, VisualizerConfig, RESOLUTION_SIZES } from '../types/visualizer';
import { VisualizerRenderer } from './renderer';
import { audioEngine } from '../audio/audioEngine';
import { BandAnalyzer, OfflineAnalyzer, configureAnalyser } from '../audio/analysis';

export interface FormatSupport {
  mp4Supported: boolean;
  bestMp4Mime: string | null;
  bestWebmMime: string | null;
  recorderAvailable: boolean;
}

function pickMime(candidates: string[]): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const type of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(type)) return type;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function detectSupportedVideoFormats(highRes = false): FormatSupport {
  // High profile level 5.1 is required for 4K; level 4.0 covers up to 1080p60.
  const mp4 = highRes
    ? ['video/mp4;codecs=avc1.640033,mp4a.40.2', 'video/mp4;codecs=avc1.4d0033,mp4a.40.2']
    : ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.4d0028,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2'];
  mp4.push('video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1,opus', 'video/mp4');
  const webm = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  const bestMp4Mime = pickMime(mp4);
  const bestWebmMime = pickMime(webm);
  return {
    mp4Supported: !!bestMp4Mime,
    bestMp4Mime,
    bestWebmMime,
    recorderAvailable: typeof MediaRecorder !== 'undefined',
  };
}

export function getExportDuration(settings: ExportSettings, audioDuration: number, startAt: number): number {
  const remaining = Math.max(0, audioDuration - startAt);
  switch (settings.durationMode) {
    case '15s':
      return Math.min(15, remaining);
    case '30s':
      return Math.min(30, remaining);
    case '60s':
      return Math.min(60, remaining);
    case 'custom':
      return Math.min(Math.max(1, settings.customDurationSeconds || 10), remaining);
    default:
      return remaining;
  }
}


// ---------------------------------------------------------------------------------------------
// Frame-accurate offline export (WebCodecs)
// ---------------------------------------------------------------------------------------------

export type ExportMode = 'offline' | 'realtime';

export interface EncoderPlan {
  mode: ExportMode;
  container: 'mp4' | 'webm';
  videoCodec: 'avc' | 'vp9' | 'vp8' | 'av1' | null;
  audioCodec: 'aac' | 'opus' | 'vorbis' | null;
}

export function hasWebCodecs(): boolean {
  return typeof VideoEncoder !== 'undefined' && typeof AudioEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';
}

/** Chooses the best container/codecs the browser can actually encode for these settings. */
export async function planEncoding(settings: ExportSettings): Promise<EncoderPlan> {
  const fallback: EncoderPlan = { mode: 'realtime', container: settings.format, videoCodec: null, audioCodec: null };
  if (!hasWebCodecs()) return fallback;
  try {
    const { getFirstEncodableVideoCodec, getFirstEncodableAudioCodec, Quality } = await import('mediabunny');
    const { width, height } = RESOLUTION_SIZES[settings.resolution];
    const vOpts = { width, height, frameRate: settings.fps, quality: new Quality({ bitrate: settings.bitrateMbps * 1_000_000 }) };
    const aOpts = { numberOfChannels: 2, sampleRate: 48000, quality: new Quality({ bitrate: 192_000 }) };

    if (settings.format === 'mp4') {
      const v = await getFirstEncodableVideoCodec(['avc'], vOpts);
      const a = v ? await getFirstEncodableAudioCodec(['aac', 'opus'], aOpts) : null;
      if (v && a) return { mode: 'offline', container: 'mp4', videoCodec: 'avc', audioCodec: a as 'aac' | 'opus' };
    }
    const v = await getFirstEncodableVideoCodec(['vp9', 'vp8', 'av1'], vOpts);
    const a = v ? await getFirstEncodableAudioCodec(['opus', 'vorbis'], aOpts) : null;
    if (v && a) return { mode: 'offline', container: 'webm', videoCodec: v as 'vp9' | 'vp8' | 'av1', audioCodec: a as 'opus' | 'vorbis' };
  } catch (e) {
    console.warn('WebCodecs export unavailable, falling back to real-time capture:', e);
  }
  return fallback;
}

/** Yields to the event loop so the UI can repaint (MessageChannel is not throttled like timers in background tabs). */
function yieldToUI(): Promise<void> {
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => resolve();
    ch.port2.postMessage(null);
  });
}

function sliceAudioBuffer(buffer: AudioBuffer, start: number, duration: number): AudioBuffer {
  const sr = buffer.sampleRate;
  const s0 = Math.max(0, Math.floor(start * sr));
  const len = Math.max(1, Math.min(buffer.length - s0, Math.round(duration * sr)));
  const channels = Math.min(2, buffer.numberOfChannels);
  const out = new AudioBuffer({ length: len, numberOfChannels: channels, sampleRate: sr });
  for (let c = 0; c < channels; c++) out.copyToChannel(buffer.getChannelData(c).subarray(s0, s0 + len), c);
  return out;
}

export interface ExportResult {
  blob: Blob;
  url: string;
  format: 'mp4' | 'webm';
  mimeType: string;
}

/**
 * Video exporter.
 *
 * Preferred path (WebCodecs): every frame is rendered and encoded with its exact timestamp, faster or slower
 * than real time depending on the machine, so the result is perfectly smooth whatever the CPU/GPU load.
 *
 * Fallback (browsers without WebCodecs): real-time capture with MediaRecorder driven by the audio clock.
 */
export class VideoExporter {
  private cancelled = false;
  private recorder: MediaRecorder | null = null;
  private cancelOutput: (() => Promise<void>) | null = null;

  cancel() {
    this.cancelled = true;
    this.cancelOutput?.().catch(() => {});
    if (this.recorder && this.recorder.state !== 'inactive') {
      try {
        this.recorder.stop();
      } catch {
        /* ignore */
      }
    }
  }

  async exportVideo(
    config: VisualizerConfig,
    settings: ExportSettings,
    startOffsetSeconds: number,
    onProgress: (progress: ExportProgress) => void
  ): Promise<ExportResult> {
    this.cancelled = false;
    const plan = await planEncoding(settings);
    if (plan.mode === 'offline') return this.exportOffline(config, settings, startOffsetSeconds, onProgress, plan);
    return this.exportRealtime(config, settings, startOffsetSeconds, onProgress);
  }

  private async exportOffline(
    config: VisualizerConfig,
    settings: ExportSettings,
    startOffsetSeconds: number,
    onProgress: (progress: ExportProgress) => void,
    plan: EncoderPlan
  ): Promise<ExportResult> {
    const buffer = audioEngine.getAudioBuffer();
    if (!buffer) throw new Error('Nessun audio caricato. Carica un brano prima di esportare.');
    const { width, height, label } = RESOLUTION_SIZES[settings.resolution];
    const start = Math.max(0, Math.min(startOffsetSeconds, buffer.duration - 0.5));
    const duration = getExportDuration(settings, buffer.duration, start);
    if (duration < 0.5) throw new Error('La durata da esportare è troppo breve. Sposta la testina più indietro.');

    const fps = settings.fps;
    const totalFrames = Math.max(1, Math.round(duration * fps));
    const wallStart = performance.now();
    const report = (frame: number, status: string, done = false) => {
      const elapsed = (performance.now() - wallStart) / 1000;
      const rate = frame / Math.max(0.001, elapsed);
      onProgress({
        isExporting: !done,
        progressPercent: (frame / totalFrames) * 100,
        currentFrame: frame,
        totalFrames,
        elapsedSeconds: elapsed,
        etaSeconds: frame > 5 ? (totalFrames - frame) / rate : duration,
        statusText: status,
      });
    };
    report(0, 'Preparazione risorse…');

    const mb = await import('mediabunny');
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Impossibile creare il canvas di rendering.');

    const renderer = new VisualizerRenderer();
    await Promise.all([
      renderer.preloadImage(config.backgroundUrl),
      renderer.preloadImage(config.logoUrl),
      document.fonts?.ready ?? Promise.resolve(),
    ]);
    if (this.cancelled) throw new Error('Esportazione annullata.');

    const analyzer = new OfflineAnalyzer(buffer);
    const target = new mb.BufferTarget();
    const output = new mb.Output({
      format: plan.container === 'mp4' ? new mb.Mp4OutputFormat({ fastStart: 'in-memory' }) : new mb.WebMOutputFormat(),
      target,
    });
    const videoSource = new mb.CanvasSource(canvas, {
      codec: plan.videoCodec!,
      quality: new mb.Quality({ bitrate: Math.round(settings.bitrateMbps * 1_000_000) }),
      keyFrameInterval: 2,
      latencyMode: 'quality',
    });
    const audioSource = new mb.AudioBufferSource({ codec: plan.audioCodec!, quality: new mb.Quality({ bitrate: 192_000 }) });
    output.addVideoTrack(videoSource, { frameRate: fps });
    output.addAudioTrack(audioSource);
    this.cancelOutput = () => output.cancel();

    const status = `Rendering ${label} · ${fps} fps · ${plan.container.toUpperCase()}`;
    try {
      await output.start();
      await audioSource.add(sliceAudioBuffer(buffer, start, duration));
      audioSource.close();

      const frameDur = 1 / fps;
      let lastYield = performance.now();
      for (let i = 0; i < totalFrames; i++) {
        if (this.cancelled) throw new Error('Esportazione annullata.');
        const t = i * frameDur;
        const analysis = analyzer.analyze(start + t);
        renderer.renderFrame(ctx, width, height, analysis, config, i === 0 ? 0 : frameDur * 1000, start + t);
        await videoSource.add(t, frameDur);

        if (performance.now() - lastYield > 40) {
          report(i + 1, status);
          await yieldToUI();
          lastYield = performance.now();
        }
      }
      videoSource.close();
      report(totalFrames, 'Finalizzazione del file…');
      await output.finalize();
    } catch (e) {
      if (output.state !== 'canceled' && output.state !== 'finalized') await output.cancel().catch(() => {});
      if (this.cancelled) throw new Error('Esportazione annullata.');
      throw e instanceof Error ? e : new Error('Errore durante la codifica del video.');
    } finally {
      this.cancelOutput = null;
    }

    if (!target.buffer) throw new Error('Il file video risulta vuoto.');
    const mimeType = plan.container === 'mp4' ? 'video/mp4' : 'video/webm';
    const blob = new Blob([target.buffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    report(totalFrames, 'Video pronto!', true);
    return { blob, url, format: plan.container, mimeType };
  }

  private async exportRealtime(
    config: VisualizerConfig,
    settings: ExportSettings,
    startOffsetSeconds: number,
    onProgress: (progress: ExportProgress) => void
  ): Promise<ExportResult> {
    const buffer = audioEngine.getAudioBuffer();
    if (!buffer) throw new Error('Nessun audio caricato. Carica un brano prima di esportare.');
    if (typeof MediaRecorder === 'undefined') {
      throw new Error('Questo browser non supporta MediaRecorder: usa Chrome, Edge o Firefox aggiornati.');
    }

    const { width, height } = RESOLUTION_SIZES[settings.resolution];
    const start = Math.max(0, Math.min(startOffsetSeconds, buffer.duration - 0.5));
    const duration = getExportDuration(settings, buffer.duration, start);
    if (duration < 0.5) throw new Error('La durata da esportare è troppo breve. Sposta la testina più indietro.');

    const support = detectSupportedVideoFormats(settings.resolution === '4k');
    let mime: string | null = null;
    let format: 'mp4' | 'webm' = 'webm';
    if (settings.format === 'mp4' && support.bestMp4Mime) {
      mime = support.bestMp4Mime;
      format = 'mp4';
    } else if (support.bestWebmMime) {
      mime = support.bestWebmMime;
    } else if (support.bestMp4Mime) {
      mime = support.bestMp4Mime;
      format = 'mp4';
    }

    onProgress({
      isExporting: true,
      progressPercent: 0,
      currentFrame: 0,
      totalFrames: Math.ceil(duration * settings.fps),
      elapsedSeconds: 0,
      etaSeconds: duration,
      statusText: 'Preparazione risorse…',
    });

    // Canvas & renderer
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Impossibile creare il canvas di rendering.');

    const renderer = new VisualizerRenderer();
    await Promise.all([
      renderer.preloadImage(config.backgroundUrl),
      renderer.preloadImage(config.logoUrl),
      document.fonts?.ready ?? Promise.resolve(),
    ]);
    if (this.cancelled) throw new Error('Esportazione annullata.');

    // Private audio graph: source -> analyser -> recorder stream (silent to speakers)
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioCtx = new Ctor();
    await audioCtx.resume().catch(() => {});
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    const analyser = audioCtx.createAnalyser();
    configureAnalyser(analyser);
    const dest = audioCtx.createMediaStreamDestination();
    source.connect(analyser);
    analyser.connect(dest);
    const bands = new BandAnalyzer(analyser);

    const stream = new MediaStream([...canvas.captureStream(settings.fps).getVideoTracks(), ...dest.stream.getAudioTracks()]);

    const options: MediaRecorderOptions = {
      videoBitsPerSecond: Math.round((settings.bitrateMbps || 16) * 1_000_000),
      audioBitsPerSecond: 256_000,
    };
    if (mime) options.mimeType = mime;
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, options);
    } catch {
      recorder = new MediaRecorder(stream);
    }
    this.recorder = recorder;
    const finalMime = recorder.mimeType || mime || 'video/webm';
    if (finalMime.includes('mp4')) format = 'mp4';
    else format = 'webm';

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    const totalFrames = Math.ceil(duration * settings.fps);
    const wallStart = performance.now();

    // Prime first frame so the video doesn't start black
    renderer.renderFrame(ctx, width, height, bands.analyze(0), config, 0, start);

    return new Promise<ExportResult>((resolve, reject) => {
      let finished = false;
      let timer: number | null = null;

      const cleanup = () => {
        if (timer !== null) {
          cancelAnimationFrame(timer);
          clearTimeout(timer);
        }
        try {
          source.stop();
        } catch {
          /* ignore */
        }
        stream.getTracks().forEach((t) => t.stop());
        audioCtx.close().catch(() => {});
        this.recorder = null;
      };

      recorder.onstop = () => {
        cleanup();
        if (this.cancelled) {
          reject(new Error('Esportazione annullata.'));
          return;
        }
        const blob = new Blob(chunks, { type: finalMime.split(';')[0] });
        if (!blob.size) {
          reject(new Error('Il browser non ha prodotto dati video. Riprova con WebM o una risoluzione inferiore.'));
          return;
        }
        const url = URL.createObjectURL(blob);
        onProgress({
          isExporting: false,
          progressPercent: 100,
          currentFrame: totalFrames,
          totalFrames,
          elapsedSeconds: (performance.now() - wallStart) / 1000,
          etaSeconds: 0,
          statusText: 'Video pronto!',
          completedBlobUrl: url,
        });
        resolve({ blob, url, format, mimeType: finalMime });
      };

      recorder.onerror = (ev) => {
        cleanup();
        const err = (ev as unknown as { error?: Error }).error;
        reject(new Error(err?.message || 'Errore del registratore video.'));
      };

      recorder.start(500);
      const startAt = audioCtx.currentTime + 0.12;
      source.start(startAt, start, duration);

      let lastAudioTime = 0;
      const tick = () => {
        if (finished) return;
        if (this.cancelled) {
          finished = true;
          if (recorder.state !== 'inactive') recorder.stop();
          return;
        }
        const t = Math.max(0, audioCtx.currentTime - startAt);
        const dtMs = (t - lastAudioTime) * 1000;
        lastAudioTime = t;
        renderer.renderFrame(ctx, width, height, bands.analyze(t * 1000), config, dtMs, start + t);

        const progress = Math.min(1, t / duration);
        const elapsed = (performance.now() - wallStart) / 1000;
        onProgress({
          isExporting: true,
          progressPercent: progress * 100,
          currentFrame: Math.min(totalFrames, Math.floor(t * settings.fps)),
          totalFrames,
          elapsedSeconds: elapsed,
          etaSeconds: Math.max(0, duration - t),
          statusText: `Registrazione ${RESOLUTION_SIZES[settings.resolution].label} · ${settings.fps} fps`,
        });

        if (t >= duration + 0.05) {
          finished = true;
          onProgress({
            isExporting: true,
            progressPercent: 100,
            currentFrame: totalFrames,
            totalFrames,
            elapsedSeconds: elapsed,
            etaSeconds: 0,
            statusText: 'Finalizzazione del file…',
          });
          // small tail so the encoder flushes the last frames
          setTimeout(() => recorder.state !== 'inactive' && recorder.stop(), 150);
          return;
        }
        // rAF pauses in background tabs; fall back to timers so the export keeps going.
        timer = document.hidden ? window.setTimeout(tick, 1000 / settings.fps) : requestAnimationFrame(tick);
      };
      timer = requestAnimationFrame(tick);
    });
  }
}

export const videoExporter = new VideoExporter();
