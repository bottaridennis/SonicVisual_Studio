import { ExportSettings, ExportProgress, VisualizerConfig } from '../types/visualizer';
import { VisualizerRenderer } from './renderer';
import { audioEngine } from '../audio/audioEngine';

export interface SupportedFormatInfo {
  format: 'mp4' | 'webm';
  mimeType: string;
  isNativelySupported: boolean;
}

export function detectSupportedVideoFormats(): {
  mp4Supported: boolean;
  bestMp4Mime: string | null;
  bestWebmMime: string;
} {
  const mp4Types = [
    'video/mp4;codecs=avc1.4d401f,mp4a.40.2',
    'video/mp4;codecs=avc1',
    'video/mp4;codecs=h264,aac',
    'video/mp4',
  ];

  const webmTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=h264,opus',
    'video/webm',
  ];

  let bestMp4Mime: string | null = null;
  for (const type of mp4Types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      bestMp4Mime = type;
      break;
    }
  }

  let bestWebmMime = 'video/webm';
  for (const type of webmTypes) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      bestWebmMime = type;
      break;
    }
  }

  return {
    mp4Supported: !!bestMp4Mime,
    bestMp4Mime,
    bestWebmMime,
  };
}

export class VideoExporter {
  private isCancelled = false;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  public cancel() {
    this.isCancelled = true;
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        // Ignored
      }
    }
  }

  public async exportVideo(
    config: VisualizerConfig,
    settings: ExportSettings,
    startOffsetSeconds = 0,
    onProgress: (progress: ExportProgress) => void
  ): Promise<{ blob: Blob; url: string; format: string }> {
    this.isCancelled = false;
    this.recordedChunks = [];

    const audioBuffer = audioEngine.getAudioBuffer();
    if (!audioBuffer) {
      throw new Error('No audio buffer loaded. Please select or upload a song first.');
    }

    // Determine target resolution dimensions
    let width = 1920;
    let height = 1080;
    if (settings.resolution === '4k') {
      width = 3840;
      height = 2160;
    } else if (settings.resolution === '720p') {
      width = 1280;
      height = 720;
    } else if (settings.resolution === 'square') {
      width = 1080;
      height = 1080;
    }

    // Calculate duration in seconds
    const audioDuration = audioBuffer.duration;
    let durationSeconds = audioDuration;
    if (settings.durationMode === '15s') durationSeconds = Math.min(15, audioDuration);
    else if (settings.durationMode === '30s') durationSeconds = Math.min(30, audioDuration);
    else if (settings.durationMode === '60s') durationSeconds = Math.min(60, audioDuration);
    else if (settings.durationMode === 'custom' && settings.customDurationSeconds) {
      durationSeconds = Math.min(settings.customDurationSeconds, audioDuration);
    }

    const clampedStart = Math.min(startOffsetSeconds, Math.max(0, audioDuration - durationSeconds));

    // Determine target MIME type
    const formatSupport = detectSupportedVideoFormats();
    let chosenMime = formatSupport.bestWebmMime;
    let finalFormat = 'webm';

    if (settings.format === 'mp4' && formatSupport.mp4Supported && formatSupport.bestMp4Mime) {
      chosenMime = formatSupport.bestMp4Mime;
      finalFormat = 'mp4';
    } else if (settings.format === 'mp4' && !formatSupport.mp4Supported) {
      // Browser does not support direct MP4 encoding via MediaRecorder, gracefully fallback to WebM
      chosenMime = formatSupport.bestWebmMime;
      finalFormat = 'webm';
    }

    // Create high-res offscreen rendering canvas
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = width;
    exportCanvas.height = height;
    const ctx = exportCanvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('Failed to create 2D canvas context for export.');
    }

    // Create fresh renderer instance for export
    const renderer = new VisualizerRenderer();
    renderer.initParticles(config, width, height);

    // Preload background and logo images so they are ready at full resolution
    if (config.backgroundUrl) await renderer.preloadImage(config.backgroundUrl);
    if (config.logoUrl) await renderer.preloadImage(config.logoUrl);

    // Audio setup for export: create dedicated Offline/Live WebAudio playback stream
    const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const audioSource = audioCtx.createBufferSource();
    audioSource.buffer = audioBuffer;

    const exportAnalyser = audioCtx.createAnalyser();
    exportAnalyser.fftSize = 1024;
    exportAnalyser.smoothingTimeConstant = config.smoothing;

    const audioStreamDest = audioCtx.createMediaStreamDestination();
    audioSource.connect(exportAnalyser);
    audioSource.connect(audioStreamDest);

    // Capture canvas stream at specified FPS
    const canvasStream = exportCanvas.captureStream(settings.fps);

    // Combine video track and audio track
    const combinedTracks = [
      ...canvasStream.getVideoTracks(),
      ...audioStreamDest.stream.getAudioTracks(),
    ];
    const combinedStream = new MediaStream(combinedTracks);

    // Bitrate calculation
    const videoBitsPerSecond = (settings.bitrateMbps || 20) * 1_000_000;

    let mediaRecorder: MediaRecorder;
    try {
      mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: chosenMime,
        videoBitsPerSecond,
      });
    } catch {
      // Fallback to default WebM if exact codec string fails
      mediaRecorder = new MediaRecorder(combinedStream, {
        videoBitsPerSecond,
      });
      chosenMime = mediaRecorder.mimeType || 'video/webm';
      finalFormat = chosenMime.includes('mp4') ? 'mp4' : 'webm';
    }
    this.mediaRecorder = mediaRecorder;

    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    const freqData = new Uint8Array(exportAnalyser.frequencyBinCount);
    const timeData = new Uint8Array(exportAnalyser.frequencyBinCount);
    const hzPerBin = (audioCtx.sampleRate / 2) / exportAnalyser.frequencyBinCount;

    const getRangeEnergy = (startHz: number, endHz: number): number => {
      const startBin = Math.max(0, Math.floor(startHz / hzPerBin));
      const endBin = Math.min(exportAnalyser.frequencyBinCount - 1, Math.ceil(endHz / hzPerBin));
      if (startBin >= endBin) return 0;
      let sum = 0;
      for (let i = startBin; i <= endBin; i++) {
        sum += freqData[i];
      }
      return (sum / (endBin - startBin + 1)) / 255;
    };

    // Helper to get real-time FFT frequency analysis
    const analyzeExport = () => {
      exportAnalyser.getByteFrequencyData(freqData);
      exportAnalyser.getByteTimeDomainData(timeData);

      const subBass = getRangeEnergy(20, 70);
      const bass = getRangeEnergy(70, 250);
      const lowMid = getRangeEnergy(250, 600);
      const mid = getRangeEnergy(600, 2500);
      const treble = getRangeEnergy(2500, 10000);
      const peakEnergy = Math.max(subBass, bass, mid);
      const isBeatHit = (subBass * 0.7 + bass * 0.3) > 0.55;

      return {
        frequencyData: freqData,
        timeDomainData: timeData,
        subBass,
        bass,
        lowMid,
        mid,
        treble,
        peakEnergy,
        isBeatHit,
      };
    };

    const totalFrames = Math.ceil(durationSeconds * settings.fps);
    const startTimeStamp = performance.now();

    return new Promise<{ blob: Blob; url: string; format: string }>((resolve, reject) => {
      mediaRecorder.onstop = () => {
        audioSource.stop();
        audioCtx.close();

        if (this.isCancelled) {
          reject(new Error('Export cancelled by user.'));
          return;
        }

        const finalBlob = new Blob(chunks, { type: chosenMime });
        const finalUrl = URL.createObjectURL(finalBlob);

        onProgress({
          isExporting: false,
          progressPercent: 100,
          currentFrame: totalFrames,
          totalFrames,
          elapsedSeconds: (performance.now() - startTimeStamp) / 1000,
          etaSeconds: 0,
          statusText: 'Export completed successfully!',
          completedBlobUrl: finalUrl,
        });

        resolve({
          blob: finalBlob,
          url: finalUrl,
          format: finalFormat,
        });
      };

      mediaRecorder.onerror = (err) => {
        audioSource.stop();
        audioCtx.close();
        reject(err);
      };

      // Start recording
      mediaRecorder.start(250); // collect chunk slices
      audioSource.start(0, clampedStart, durationSeconds);

      let frameCounter = 0;
      const frameIntervalMs = 1000 / settings.fps;
      let lastFrameTime = performance.now();

      const renderLoop = () => {
        if (this.isCancelled) {
          mediaRecorder.stop();
          return;
        }

        const now = performance.now();
        const delta = now - lastFrameTime;

        if (delta >= frameIntervalMs - 2) {
          lastFrameTime = now;
          frameCounter++;

          // Analyze audio and render high-res frame
          const analysis = analyzeExport();
          renderer.renderFrame(ctx, width, height, analysis, config, frameIntervalMs);

          // Update progress metrics
          const progressPercent = Math.min(99.5, (frameCounter / totalFrames) * 100);
          const elapsedSec = (now - startTimeStamp) / 1000;
          const framesRemaining = totalFrames - frameCounter;
          const fpsActual = frameCounter / Math.max(0.1, elapsedSec);
          const etaSec = Math.max(0, framesRemaining / Math.max(1, fpsActual));

          onProgress({
            isExporting: true,
            progressPercent,
            currentFrame: frameCounter,
            totalFrames,
            elapsedSeconds: elapsedSec,
            etaSeconds: etaSec,
            statusText: `Rendering ${settings.resolution.toUpperCase()} (${frameCounter}/${totalFrames} frames)`,
          });

          if (frameCounter >= totalFrames) {
            onProgress({
              isExporting: true,
              progressPercent: 99.9,
              currentFrame: totalFrames,
              totalFrames,
              elapsedSeconds: elapsedSec,
              etaSeconds: 0,
              statusText: 'Finalizing video stream & audio muxing...',
            });
            mediaRecorder.stop();
            return;
          }
        }

        requestAnimationFrame(renderLoop);
      };

      // Kick off render loop
      requestAnimationFrame(renderLoop);
    });
  }
}

export const videoExporter = new VideoExporter();
