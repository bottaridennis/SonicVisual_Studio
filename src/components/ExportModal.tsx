import React, { useState, useEffect } from 'react';
import {
  X,
  Video,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  Play,
  RotateCcw,
} from 'lucide-react';
import {
  VisualizerConfig,
  ExportSettings,
  ExportProgress,
} from '../types/visualizer';
import { videoExporter, detectSupportedVideoFormats } from '../visualizer/videoExporter';
import { audioEngine } from '../audio/audioEngine';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: VisualizerConfig;
  exportSettings: ExportSettings;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  config,
  exportSettings,
}) => {
  const [progress, setProgress] = useState<ExportProgress>({
    isExporting: false,
    progressPercent: 0,
    currentFrame: 0,
    totalFrames: 0,
    elapsedSeconds: 0,
    etaSeconds: 0,
    statusText: 'Ready to start rendering',
  });

  const [downloadInfo, setDownloadInfo] = useState<{
    blob: Blob | null;
    url: string | null;
    filename: string;
    format: string;
  } | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const formatSupport = detectSupportedVideoFormats();

  useEffect(() => {
    if (!isOpen) {
      if (progress.isExporting) {
        videoExporter.cancel();
      }
      setDownloadInfo(null);
      setErrorMessage(null);
      setProgress({
        isExporting: false,
        progressPercent: 0,
        currentFrame: 0,
        totalFrames: 0,
        elapsedSeconds: 0,
        etaSeconds: 0,
        statusText: 'Ready to start rendering',
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartRender = async () => {
    setErrorMessage(null);
    setDownloadInfo(null);

    const audioBuffer = audioEngine.getAudioBuffer();
    if (!audioBuffer) {
      setErrorMessage('No audio track loaded. Please load or upload a track first.');
      return;
    }

    try {
      // Start offset: use current scrub position if range is a clip
      const startOffset = audioEngine.getCurrentTime();

      const result = await videoExporter.exportVideo(
        config,
        exportSettings,
        startOffset,
        (p) => setProgress(p)
      );

      const cleanTitle = (config.trackTitle || 'Visualizer').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${cleanTitle}_${exportSettings.resolution}_${exportSettings.fps}fps.${result.format}`;

      setDownloadInfo({
        blob: result.blob,
        url: result.url,
        filename,
        format: result.format,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('cancelled')) {
        setProgress((prev) => ({
          ...prev,
          isExporting: false,
          statusText: 'Export cancelled.',
        }));
      } else {
        setErrorMessage(err instanceof Error ? err.message : 'Video export failed.');
        setProgress((prev) => ({
          ...prev,
          isExporting: false,
          statusText: 'Error occurred during export.',
        }));
      }
    }
  };

  const handleCancel = () => {
    videoExporter.cancel();
    setProgress((prev) => ({
      ...prev,
      isExporting: false,
      statusText: 'Export cancelled.',
    }));
  };

  const handleDownload = () => {
    if (!downloadInfo || !downloadInfo.url) return;
    const a = document.createElement('a');
    a.href = downloadInfo.url;
    a.download = downloadInfo.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-xl bg-[#0f1422] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-[#090d16]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-400/10 text-amber-400 rounded-lg border border-amber-400/20">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Video Export Studio</h3>
              <p className="text-xs text-slate-400">
                {exportSettings.resolution.toUpperCase()} · {exportSettings.fps} FPS ·{' '}
                {exportSettings.format.toUpperCase()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Export Details Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-900/80 border border-slate-800 rounded-xl text-center">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-mono">Resolution</span>
              <div className="text-xs font-bold text-white mt-0.5">
                {exportSettings.resolution === '4k'
                  ? '3840x2160'
                  : exportSettings.resolution === '1080p'
                  ? '1920x1080'
                  : exportSettings.resolution === 'square'
                  ? '1080x1080'
                  : '1280x720'}
              </div>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-mono">Frame Rate</span>
              <div className="text-xs font-bold text-amber-400 mt-0.5">{exportSettings.fps} FPS</div>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-mono">Format</span>
              <div className="text-xs font-bold text-cyan-400 mt-0.5 uppercase">
                {exportSettings.format}
              </div>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-mono">Duration</span>
              <div className="text-xs font-bold text-emerald-400 mt-0.5 uppercase">
                {exportSettings.durationMode}
              </div>
            </div>
          </div>

          {/* Browser Codec Notice if MP4 was chosen but browser produces WebM */}
          {exportSettings.format === 'mp4' && !formatSupport.mp4Supported && (
            <div className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-xl flex items-start gap-2.5 text-xs text-cyan-200">
              <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <span>
                  Your current browser engine does not have native hardware H.264 MediaRecorder encoding.
                  The video will be generated in <strong>WebM</strong> (Full HD/4K high-bitrate), which is 100% compatible with YouTube, Premiere, VLC, and video editors.
                </span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl flex items-center gap-2.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* During Export Progress Display */}
          {progress.isExporting && (
            <div className="space-y-4 p-4 bg-slate-900/60 border border-slate-800/80 rounded-xl">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">{progress.statusText}</span>
                <span className="font-mono text-amber-400 font-bold tabular-nums">
                  {progress.progressPercent.toFixed(1)}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-300 transition-all duration-100 ease-out"
                  style={{ width: `${progress.progressPercent}%` }}
                />
              </div>

              {/* Metrics */}
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Elapsed: {progress.elapsedSeconds.toFixed(1)}s</span>
                </div>
                <span>
                  Frame {progress.currentFrame} / {progress.totalFrames}
                </span>
                <span>ETA: ~{Math.ceil(progress.etaSeconds)}s</span>
              </div>

              <button
                onClick={handleCancel}
                className="w-full py-2 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel Render
              </button>
            </div>
          )}

          {/* Completed State with Video Preview */}
          {downloadInfo && (
            <div className="space-y-4 p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-xl">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
                <CheckCircle2 className="w-5 h-5" />
                <span>Video Render Complete & Ready!</span>
              </div>

              {/* Video Player Preview */}
              <div className="rounded-lg overflow-hidden border border-slate-800 bg-black max-h-56 flex items-center justify-center">
                <video
                  src={downloadInfo.url!}
                  controls
                  className="w-full max-h-56 object-contain"
                  autoPlay
                  loop
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-mono truncate max-w-[280px] text-slate-400">
                  {downloadInfo.filename}
                </span>
                <span className="font-mono text-emerald-400 font-semibold">
                  {downloadInfo.blob ? formatFileSize(downloadInfo.blob.size) : ''}
                </span>
              </div>

              <button
                onClick={handleDownload}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-slate-950 font-bold text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4 fill-slate-950" />
                <span>Download Video File ({downloadInfo.format.toUpperCase()})</span>
              </button>
            </div>
          )}

          {/* Initial State CTA */}
          {!progress.isExporting && !downloadInfo && (
            <div className="pt-2">
              <button
                onClick={handleStartRender}
                className="w-full py-3 bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-bold text-sm rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 fill-slate-950" />
                <span>Render Video Now</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
