import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Download, AlertTriangle, CheckCircle2, Film, Loader2, RotateCcw, Info } from 'lucide-react';
import { ExportProgress, ExportSettings, ExportResolution, RESOLUTION_SIZES, VisualizerConfig } from '../types/visualizer';
import { videoExporter, detectSupportedVideoFormats, getExportDuration } from '../visualizer/videoExporter';
import { audioEngine } from '../audio/audioEngine';
import { Button, Segmented, Slider, Toggle, FieldLabel, cx } from '../ui/controls';
import { formatTime } from './Transport';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  config: VisualizerConfig;
  settings: ExportSettings;
  onChangeSettings: (s: ExportSettings) => void;
  projectName: string;
}

const IDLE: ExportProgress = {
  isExporting: false,
  progressPercent: 0,
  currentFrame: 0,
  totalFrames: 0,
  elapsedSeconds: 0,
  etaSeconds: 0,
  statusText: '',
};

const RES_ORDER: ExportResolution[] = ['720p', '1080p', '4k', 'square', 'vertical'];

export const ExportDialog: React.FC<ExportDialogProps> = ({ open, onClose, config, settings, onChangeSettings, projectName }) => {
  const [progress, setProgress] = useState<ExportProgress>(IDLE);
  const [result, setResult] = useState<{ url: string; size: number; filename: string; format: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultUrl = useRef<string | null>(null);

  const support = useMemo(() => detectSupportedVideoFormats(settings.resolution === '4k'), [settings.resolution]);
  const buffer = audioEngine.getAudioBuffer();
  const playhead = open ? audioEngine.getCurrentTime() : 0;
  const start = settings.startFromPlayhead ? playhead : 0;
  const duration = buffer ? getExportDuration(settings, buffer.duration, start) : 0;
  const estMB = (duration * (settings.bitrateMbps + 0.25)) / 8;

  const up = (patch: Partial<ExportSettings>) => onChangeSettings({ ...settings, ...patch });

  // Abort a running export if the dialog closes; free the previous video blob
  useEffect(() => {
    if (!open && progress.isExporting) videoExporter.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(
    () => () => {
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
    },
    []
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !progress.isExporting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, progress.isExporting]);

  if (!open) return null;

  const begin = async () => {
    setError(null);
    if (resultUrl.current) {
      URL.revokeObjectURL(resultUrl.current);
      resultUrl.current = null;
    }
    setResult(null);
    audioEngine.pause();
    try {
      const r = await videoExporter.exportVideo(config, settings, start, setProgress);
      resultUrl.current = r.url;
      const base = (projectName || 'SonicVisual').replace(/[^\w\-]+/g, '_').replace(/_+/g, '_');
      setResult({ url: r.url, size: r.blob.size, filename: `${base}_${settings.resolution}_${settings.fps}fps.${r.format}`, format: r.format });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Esportazione non riuscita.';
      if (!/annullata/i.test(msg)) setError(msg);
      setProgress(IDLE);
    }
  };

  const download = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const busy = progress.isExporting;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="export-title" className="animate-in w-full max-w-2xl max-h-full overflow-y-auto rounded-2xl bg-panel border border-line-strong shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)]">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 h-14 border-b border-line sticky top-0 bg-panel z-10">
          <span className="w-8 h-8 rounded-lg bg-acid text-bg flex items-center justify-center">
            <Film className="w-4 h-4" />
          </span>
          <div className="flex-1">
            <h2 id="export-title" className="text-sm font-semibold">Esporta video</h2>
            <p className="text-[11px] text-faint">Registrazione in tempo reale con audio sincronizzato</p>
          </div>
          <button onClick={onClose} disabled={busy} className="w-8 h-8 rounded-lg flex items-center justify-center text-dim hover:text-fg hover:bg-hover disabled:opacity-30" aria-label="Chiudi">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Result */}
        {result && !busy && (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-acid">
              <CheckCircle2 className="w-4 h-4" /> Il tuo video è pronto
            </div>
            <video src={result.url} controls autoPlay loop className="w-full max-h-[45vh] rounded-xl bg-black border border-line" />
            <div className="flex items-center justify-between text-xs text-dim font-mono">
              <span className="truncate">{result.filename}</span>
              <span className="shrink-0 ml-3">{(result.size / 1048576).toFixed(1)} MB</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="lg" onClick={() => setResult(null)}>
                <RotateCcw className="w-4 h-4" /> Nuovo export
              </Button>
              <Button variant="primary" size="lg" className="flex-1" onClick={download}>
                <Download className="w-4 h-4" /> Scarica {result.format.toUpperCase()}
              </Button>
            </div>
          </div>
        )}

        {/* Progress */}
        {busy && (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-fg">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-acid" /> {progress.statusText}
              </span>
              <span className="font-mono text-acid tabular-nums">{progress.progressPercent.toFixed(0)}%</span>
            </div>
            <div className="h-2 rounded-full bg-line overflow-hidden">
              <div className="h-full bg-acid transition-[width] duration-150" style={{ width: `${progress.progressPercent}%` }} />
            </div>
            <div className="grid grid-cols-3 text-[11px] font-mono text-faint">
              <span>Trascorso {formatTime(progress.elapsedSeconds)}</span>
              <span className="text-center">
                Frame {progress.currentFrame}/{progress.totalFrames}
              </span>
              <span className="text-right">Restano ~{Math.ceil(progress.etaSeconds)}s</span>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-raised border border-line text-[11px] text-dim">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              La registrazione avviene in tempo reale: tieni questa scheda aperta e in primo piano per il risultato più fluido.
            </div>
            <Button variant="danger" className="w-full" onClick={() => videoExporter.cancel()}>
              Annulla esportazione
            </Button>
          </div>
        )}

        {/* Settings */}
        {!busy && !result && (
          <div className="p-5 space-y-5">
            <div>
              <FieldLabel label="Formato & risoluzione" />
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                {RES_ORDER.map((r) => {
                  const s = RESOLUTION_SIZES[r];
                  const active = settings.resolution === r;
                  const ratio = s.width / s.height;
                  return (
                    <button
                      key={r}
                      onClick={() => up({ resolution: r })}
                      className={cx(
                        'flex flex-col items-center gap-2 py-3 rounded-xl border transition-colors',
                        active ? 'border-acid bg-acid/[0.06]' : 'border-line hover:border-line-strong hover:bg-raised'
                      )}
                    >
                      <span className="h-8 flex items-center">
                        <span className={cx('block rounded-[3px] border-2', active ? 'border-acid' : 'border-faint')} style={{ width: ratio >= 1 ? 32 : 32 * ratio, height: ratio >= 1 ? 32 / ratio : 32 }} />
                      </span>
                      <span className="text-xs font-medium">{s.label}</span>
                      <span className="text-[10px] font-mono text-faint">
                        {s.width}×{s.height}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-faint mt-1.5">Il rapporto d'aspetto dell'anteprima segue la risoluzione scelta.</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Segmented
                label="File"
                value={settings.format}
                options={[
                  { value: 'mp4', label: 'MP4 (H.264)' },
                  { value: 'webm', label: 'WebM' },
                ]}
                onChange={(v) => up({ format: v })}
              />
              <Segmented
                label="Fotogrammi al secondo"
                value={settings.fps}
                options={[
                  { value: 30, label: '30 fps' },
                  { value: 60, label: '60 fps' },
                ]}
                onChange={(v) => up({ fps: v })}
              />
            </div>

            {settings.format === 'mp4' && !support.mp4Supported && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-raised border border-line text-[11px] text-dim">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-acid" />
                Questo browser non può registrare MP4: il video verrà salvato in WebM (compatibile con YouTube, Premiere, DaVinci e VLC). Per MP4 nativo usa Chrome o Edge aggiornati.
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <Segmented
                label="Durata"
                size="sm"
                value={settings.durationMode}
                options={[
                  { value: 'full', label: 'Intero' },
                  { value: '15s', label: '15s' },
                  { value: '30s', label: '30s' },
                  { value: '60s', label: '60s' },
                  { value: 'custom', label: 'Altro' },
                ]}
                onChange={(v) => up({ durationMode: v })}
              />
              <Slider label="Qualità (bitrate)" value={settings.bitrateMbps} min={4} max={80} step={1} format={(v) => `${v} Mbps`} onChange={(v) => up({ bitrateMbps: v })} />
            </div>
            {settings.durationMode === 'custom' && (
              <Slider
                label="Durata personalizzata"
                value={settings.customDurationSeconds || 20}
                min={3}
                max={Math.max(3, Math.ceil(buffer?.duration || 60))}
                format={(v) => `${v}s`}
                onChange={(v) => up({ customDurationSeconds: v })}
              />
            )}
            <Toggle
              label={`Parti dalla testina (${formatTime(playhead)})`}
              hint="Altrimenti l'export parte dall'inizio del brano"
              checked={!!settings.startFromPlayhead}
              onChange={(v) => up({ startFromPlayhead: v })}
            />

            <div className="grid grid-cols-3 gap-px rounded-xl overflow-hidden border border-line bg-line">
              {[
                ['Durata video', formatTime(duration)],
                ['Dimensione stimata', `~${estMB.toFixed(0)} MB`],
                ['Tempo richiesto', `~${Math.ceil(duration)}s`],
              ].map(([k, v]) => (
                <div key={k} className="bg-panel px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-faint">{k}</div>
                  <div className="font-mono text-sm text-fg mt-0.5">{v}</div>
                </div>
              ))}
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-danger/40 bg-danger/10 text-xs text-danger">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}
            {!support.recorderAvailable && (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-danger/40 bg-danger/10 text-xs text-danger">
                <AlertTriangle className="w-4 h-4 shrink-0" /> Il browser non supporta la registrazione video (MediaRecorder).
              </div>
            )}

            <Button variant="primary" size="lg" className="w-full" disabled={!buffer || duration < 0.5 || !support.recorderAvailable} onClick={begin}>
              <Film className="w-4 h-4" /> Avvia rendering
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
