import { ExportSettings, ExportProgress, VisualizerConfig, RESOLUTION_SIZES } from '../types/visualizer';
import { VisualizerRenderer } from './renderer';
import { audioEngine } from '../audio/audioEngine';
import { BandAnalyzer, configureAnalyser } from '../audio/analysis';

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

export interface ExportResult {
  blob: Blob;
  url: string;
  format: 'mp4' | 'webm';
  mimeType: string;
}

/**
 * Real-time exporter: plays the track through a private AudioContext, renders each frame
 * driven by the audio clock (so video and audio can never drift) and records both with MediaRecorder.
 */
export class VideoExporter {
  private cancelled = false;
  private recorder: MediaRecorder | null = null;

  cancel() {
    this.cancelled = true;
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
