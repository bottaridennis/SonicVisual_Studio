import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, SkipBack, Repeat, Volume2, VolumeX, Loader2, Music2 } from 'lucide-react';
import { audioEngine, TransportState } from '../audio/audioEngine';
import { computeWaveformPeaks } from '../audio/analysis';
import { AudioTrackInfo } from '../types/visualizer';
import { IconButton, cx } from '../ui/controls';

export function formatTime(s: number) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.floor((s % 1) * 10);
  return `${m}:${sec.toString().padStart(2, '0')}.${cs}`;
}

export function useTransport(): TransportState {
  const [state, setState] = useState<TransportState>(audioEngine.getState());
  useEffect(() => audioEngine.subscribe(setState), []);
  return state;
}

interface TransportProps {
  track: AudioTrackInfo;
  isLoading: boolean;
  accent: string;
}

export const Transport: React.FC<TransportProps> = ({ track, isLoading, accent }) => {
  const transport = useTransport();
  const waveRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const meterRef = useRef<HTMLDivElement>(null);
  const scrubbing = useRef(false);

  const peaks = useMemo(() => (track.audioBuffer ? computeWaveformPeaks(track.audioBuffer, 900) : null), [track.audioBuffer]);

  // Draw waveform + playhead every frame (cheap: 900 columns)
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const canvas = waveRef.current;
      if (canvas) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = Math.round(canvas.clientWidth * dpr);
        const h = Math.round(canvas.clientHeight * dpr);
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, w, h);
        const dur = audioEngine.getDuration();
        const t = audioEngine.getCurrentTime();
        const progress = dur ? t / dur : 0;
        if (peaks) {
          const n = peaks.length / 2;
          const colW = w / n;
          const mid = h / 2;
          for (let i = 0; i < n; i++) {
            const x = i * colW;
            const lo = peaks[i * 2];
            const hi = peaks[i * 2 + 1];
            const played = i / n < progress;
            ctx.fillStyle = played ? accent : 'rgba(255,255,255,0.22)';
            const top = mid - hi * mid * 0.92;
            const bot = mid - lo * mid * 0.92;
            ctx.fillRect(x, top, Math.max(1, colW * 0.62), Math.max(1 * dpr, bot - top));
          }
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.1)';
          ctx.fillRect(0, h / 2 - 1, w, 2);
        }
        // playhead
        const px = progress * w;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px - dpr, 0, 2 * dpr, h);
      }
      if (timeRef.current) timeRef.current.textContent = formatTime(audioEngine.getCurrentTime());
      if (meterRef.current) {
        const a = audioEngine.analyze();
        meterRef.current.style.setProperty('--lvl', `${Math.min(1, a.peakEnergy * 1.1) * 100}%`);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [peaks, accent]);

  const seekFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioEngine.seek(p * audioEngine.getDuration());
  };

  return (
    <footer className="shrink-0 h-[72px] border-t border-line bg-panel flex items-center gap-3 sm:gap-4 px-3 sm:px-4 z-20">
      {/* Track info */}
      <div className="hidden md:flex items-center gap-3 w-56 shrink-0 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-raised border border-line flex items-center justify-center shrink-0 relative overflow-hidden">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-acid animate-spin" />
          ) : transport.isPlaying ? (
            <div className="flex items-end gap-[2px] h-4">
              {[0, 0.2, 0.4, 0.1].map((d, i) => (
                <span key={i} className="eq-bar w-[3px] h-full bg-acid rounded-sm" style={{ animationDelay: `${d}s` }} />
              ))}
            </div>
          ) : (
            <Music2 className="w-4 h-4 text-faint" />
          )}
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-fg truncate">{track.title}</div>
          <div className="text-[11px] text-faint truncate">{track.artist}</div>
        </div>
      </div>

      {/* Transport buttons */}
      <div className="flex items-center gap-1 shrink-0">
        <IconButton label="Torna all'inizio (Home)" onClick={() => audioEngine.seek(0)}>
          <SkipBack className="w-4 h-4" />
        </IconButton>
        <button
          type="button"
          onClick={() => audioEngine.togglePlay()}
          disabled={isLoading || !track.audioBuffer}
          aria-label={transport.isPlaying ? 'Pausa (Spazio)' : 'Riproduci (Spazio)'}
          title={transport.isPlaying ? 'Pausa (Spazio)' : 'Riproduci (Spazio)'}
          className="w-10 h-10 rounded-full bg-acid text-bg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform disabled:opacity-40 shadow-[0_0_24px_-6px_var(--color-acid)]"
        >
          {transport.isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
        </button>
        <IconButton label="Ripeti (L)" active={transport.isLooping} onClick={() => audioEngine.toggleLoop()}>
          <Repeat className="w-4 h-4" />
        </IconButton>
      </div>

      {/* Timeline */}
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <span ref={timeRef} className="font-mono text-[11px] text-fg tabular-nums w-12 text-right shrink-0">
          0:00.0
        </span>
        <canvas
          ref={waveRef}
          className="flex-1 min-w-0 h-10 cursor-pointer touch-none"
          aria-label="Timeline del brano: clicca o trascina per spostarti"
          onPointerDown={(e) => {
            scrubbing.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            seekFromEvent(e);
          }}
          onPointerMove={(e) => scrubbing.current && seekFromEvent(e)}
          onPointerUp={() => (scrubbing.current = false)}
          onPointerCancel={() => (scrubbing.current = false)}
        />
        <span className="font-mono text-[11px] text-faint tabular-nums w-12 shrink-0">{formatTime(transport.duration)}</span>
      </div>

      {/* Volume + meter */}
      <div className="hidden sm:flex items-center gap-2 shrink-0">
        <IconButton label={transport.isMuted ? 'Riattiva audio (M)' : 'Muto (M)'} onClick={() => audioEngine.toggleMute()}>
          {transport.isMuted || transport.volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </IconButton>
        <input
          type="range"
          className="sv-range w-20"
          min={0}
          max={1}
          step={0.01}
          aria-label="Volume"
          value={transport.isMuted ? 0 : transport.volume}
          style={{ ['--fill' as string]: `${(transport.isMuted ? 0 : transport.volume) * 100}%` }}
          onChange={(e) => audioEngine.setVolume(parseFloat(e.target.value))}
        />
        <div
          ref={meterRef}
          className="w-1.5 h-9 rounded-full bg-line relative overflow-hidden"
          title="Livello"
          style={{ ['--lvl' as string]: '0%' }}
        >
          <div className={cx('absolute bottom-0 left-0 right-0 rounded-full bg-gradient-to-t from-acid to-white transition-[height] duration-75')} style={{ height: 'var(--lvl)' }} />
        </div>
      </div>
    </footer>
  );
};
