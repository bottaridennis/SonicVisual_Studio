import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Repeat,
  Upload,
  Music2,
  FastForward,
  Rewind,
  Sparkles,
  Radio,
} from 'lucide-react';
import { audioEngine, FrequencyAnalysis } from '../audio/audioEngine';
import { AudioTrackInfo } from '../types/visualizer';
import { DEMO_TRACKS_LIST, generateProceduralTrapTrack } from '../audio/demoTracks';

interface TimelineBottomProps {
  currentTrack: AudioTrackInfo;
  onTrackChange: (track: AudioTrackInfo) => void;
  onUploadTrack: (file: File) => void;
  isLoadingAudio: boolean;
  onOpenAudioDrawer?: () => void;
}

export const TimelineBottom: React.FC<TimelineBottomProps> = ({
  currentTrack,
  onTrackChange,
  onUploadTrack,
  isLoadingAudio,
  onOpenAudioDrawer,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoop, setIsLoop] = useState(true);

  // Peak Meters for Left & Right audio channels (DAW FL Studio style)
  const [meterL, setMeterL] = useState(0);
  const [meterR, setMeterR] = useState(0);
  const [peakClip, setPeakClip] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  // Sync state with audio engine
  useEffect(() => {
    let animId: number;

    const updateLoop = () => {
      setIsPlaying(audioEngine.getIsPlaying());
      setCurrentTime(audioEngine.getCurrentTime());
      setDuration(audioEngine.getDuration());
      setVolume(audioEngine.getVolume());
      setIsMuted(audioEngine.getIsMuted());
      setIsLoop(audioEngine.getIsLoop());

      if (audioEngine.getIsPlaying()) {
        const analysis = audioEngine.analyze();
        const baseLevel = analysis.peakEnergy;
        // Stereo variation simulation from subBass & mid
        const l = Math.min(1, Math.max(0, baseLevel * 0.95 + analysis.subBass * 0.15));
        const r = Math.min(1, Math.max(0, baseLevel * 0.92 + analysis.mid * 0.18));
        setMeterL(l);
        setMeterR(r);
        if (baseLevel > 0.92) {
          setPeakClip(true);
        } else {
          setPeakClip(false);
        }
      } else {
        setMeterL(0);
        setMeterR(0);
        setPeakClip(false);
      }

      animId = requestAnimationFrame(updateLoop);
    };

    animId = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Format professional timecode: MM:SS.ms
  const formatTimecode = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '00:00.00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const handlePlayToggle = () => {
    audioEngine.togglePlay();
    setIsPlaying(audioEngine.getIsPlaying());
  };

  const handleSeek = (newTime: number) => {
    const clamped = Math.max(0, Math.min(newTime, duration || 1));
    audioEngine.seek(clamped);
    setCurrentTime(clamped);
  };

  const handleSeekInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleSeek(parseFloat(e.target.value));
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !duration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    handleSeek(ratio * duration);
  };

  const handleTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !duration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(ratio * duration);
  };

  const handleTimelineMouseLeave = () => {
    setHoverTime(null);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    audioEngine.setVolume(val);
    setVolume(val);
  };

  const handleMuteToggle = () => {
    const muted = audioEngine.toggleMute();
    setIsMuted(muted);
  };

  const handleLoopToggle = () => {
    const looped = audioEngine.toggleLoop();
    setIsLoop(looped);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      onUploadTrack(files[0]);
    }
  };

  // Generate waveform preview bars based on audio buffer or pseudo-random rhythm
  const waveformBars = useMemo(() => {
    const barsCount = 120;
    const buffer = currentTrack.audioBuffer;
    if (buffer && buffer.numberOfChannels > 0) {
      const channelData = buffer.getChannelData(0);
      const step = Math.floor(channelData.length / barsCount);
      const heights: number[] = [];
      for (let i = 0; i < barsCount; i++) {
        let sum = 0;
        const start = i * step;
        const end = Math.min(start + step, channelData.length);
        for (let j = start; j < end; j += 10) {
          sum += Math.abs(channelData[j]);
        }
        const avg = sum / ((end - start) / 10 || 1);
        heights.push(Math.min(1, Math.max(0.12, avg * 3.2)));
      }
      return heights;
    }

    // Default stylized waveform
    return Array.from({ length: barsCount }, (_, idx) => {
      const x = idx / barsCount;
      const base = 0.2 + 0.6 * Math.sin(x * Math.PI) * Math.abs(Math.sin(x * 16));
      return Math.min(0.95, Math.max(0.15, base));
    });
  }, [currentTrack.audioBuffer]);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <footer className="h-20 bg-[#090b10] border-t border-[#181d2c] px-3 sm:px-4 flex flex-col justify-between py-2 select-none shrink-0 z-40 text-slate-200">
      {/* 1. Interactive Timeline Scrubber with Waveform Backdrop */}
      <div
        ref={timelineRef}
        onClick={handleTimelineClick}
        onMouseMove={handleTimelineMouseMove}
        onMouseLeave={handleTimelineMouseLeave}
        className="relative h-6 w-full bg-[#0e121c] rounded-md border border-[#1b2235] cursor-pointer overflow-hidden flex items-center group"
      >
        {/* Waveform Visualization Bars */}
        <div className="absolute inset-0 flex items-center justify-between px-1 pointer-events-none gap-0.5 opacity-60">
          {waveformBars.map((heightRatio, i) => {
            const barProgress = (i / waveformBars.length) * 100;
            const isPlayed = barProgress <= progressPercent;
            return (
              <div
                key={i}
                className={`w-full rounded-xs transition-colors duration-75 ${
                  isPlayed ? 'bg-violet-400' : 'bg-slate-700'
                }`}
                style={{
                  height: `${heightRatio * 100}%`,
                }}
              />
            );
          })}
        </div>

        {/* Played Progress Tint Overlay */}
        <div
          className="absolute top-0 bottom-0 left-0 bg-violet-600/20 pointer-events-none border-r border-violet-400"
          style={{ width: `${progressPercent}%` }}
        />

        {/* Scrubber Playhead Thumb */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-white shadow-md shadow-violet-500/80 pointer-events-none transform -translate-x-1/2 flex items-center justify-center z-10"
          style={{ left: `${progressPercent}%` }}
        >
          <div className="w-2.5 h-2.5 bg-violet-400 rounded-full border border-white" />
        </div>

        {/* Hover Time Tooltip */}
        {hoverTime !== null && (
          <div
            className="absolute -top-7 transform -translate-x-1/2 px-1.5 py-0.5 bg-[#141926] border border-[#2b354f] rounded text-[10px] font-mono text-cyan-300 pointer-events-none shadow-lg z-20"
            style={{
              left: `${Math.max(5, Math.min(95, (hoverTime / (duration || 1)) * 100))}%`,
            }}
          >
            {formatTimecode(hoverTime)}
          </div>
        )}

        {/* Hidden Range Input for Accessibility / Dragging */}
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.05}
          value={currentTime}
          onChange={handleSeekInput}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
          title="Scorri la timeline"
        />
      </div>

      {/* 2. Lower Control Bar (3 Columns: Track Info, Transport Controls, Audio Engine Level & Volume) */}
      <div className="flex items-center justify-between gap-3 h-9">
        {/* Left Column: Track Badge & Upload */}
        <div className="flex items-center gap-2.5 min-w-0 max-w-[280px] sm:max-w-[340px]">
          <div className="w-8 h-8 rounded-lg bg-[#141926] border border-[#222a3d] flex items-center justify-center shrink-0 text-violet-400 shadow-inner">
            <Music2 className="w-4 h-4" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-white truncate max-w-[150px] sm:max-w-[200px]">
                {currentTrack.title}
              </span>
              {currentTrack.isCustom ? (
                <span className="text-[9px] uppercase font-mono px-1 py-0.2 bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 rounded shrink-0">
                  Custom
                </span>
              ) : (
                <span className="text-[9px] uppercase font-mono px-1 py-0.2 bg-violet-500/15 border border-violet-500/30 text-violet-400 rounded shrink-0">
                  Demo
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 truncate flex items-center gap-1.5">
              <span>{currentTrack.artist}</span>
              {currentTrack.bpm && (
                <>
                  <span>·</span>
                  <span className="text-cyan-400 font-mono font-medium">{currentTrack.bpm} BPM</span>
                </>
              )}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mp3,audio/wav,audio/ogg,audio/flac,audio/aac,audio/m4a"
            onChange={handleFileSelect}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoadingAudio}
            className="hidden sm:flex items-center gap-1 px-2 py-1 bg-[#131724] hover:bg-[#1a2032] border border-[#1f273d] text-slate-300 rounded text-[10px] font-medium transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            title="Carica un nuovo file audio MP3 o WAV"
          >
            <Upload className="w-3 h-3 text-cyan-400" />
            <span>{isLoadingAudio ? '...' : 'Audio'}</span>
          </button>
        </div>

        {/* Center Column: DAW / Video Transport Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Rewind 5s */}
          <button
            onClick={() => handleSeek(Math.max(0, currentTime - 5))}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-[#161c2b] rounded-lg transition-colors cursor-pointer"
            title="Indietro di 5s (←)"
          >
            <Rewind className="w-3.5 h-3.5" />
          </button>

          {/* Primary Play / Pause Button with electric glow */}
          <button
            onClick={handlePlayToggle}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md ${
              isPlaying
                ? 'bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-violet-500/30 ring-2 ring-violet-400/40'
                : 'bg-white text-slate-950 hover:bg-slate-200 shadow-white/10'
            }`}
            title="Riproduci / Pausa (Spacebar)"
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            )}
          </button>

          {/* Fast Forward 5s */}
          <button
            onClick={() => handleSeek(Math.min(duration, currentTime + 5))}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-[#161c2b] rounded-lg transition-colors cursor-pointer"
            title="Avanti di 5s (→)"
          >
            <FastForward className="w-3.5 h-3.5" />
          </button>

          {/* Loop Toggle */}
          <button
            onClick={handleLoopToggle}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isLoop
                ? 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/30'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            title={isLoop ? 'Loop attivo' : 'Loop disattivato'}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>

          {/* Stop / Return to Zero */}
          <button
            onClick={() => handleSeek(0)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-[#161c2b] rounded-lg transition-colors cursor-pointer"
            title="Torna all'inizio"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Precision Timecode Display */}
          <div className="hidden md:flex items-center gap-1 px-2.5 py-0.5 bg-[#101420] border border-[#1b2236] rounded text-[11px] font-mono tabular-nums text-slate-300">
            <span className="text-violet-400 font-semibold">{formatTimecode(currentTime)}</span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-400">{formatTimecode(duration)}</span>
          </div>
        </div>

        {/* Right Column: Dual Stereo Peak Meter & Master Volume */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Real-time Stereo Peak Level Meter (FL Studio style) */}
          <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 bg-[#101420] border border-[#1a2134] rounded-lg">
            <span className="text-[9px] font-mono text-slate-500 font-semibold">VU</span>
            <div className="flex flex-col gap-0.5">
              {/* Left Channel */}
              <div className="w-14 h-1.5 bg-[#182030] rounded-xs overflow-hidden flex items-center">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-violet-500 transition-all duration-75"
                  style={{ width: `${meterL * 100}%` }}
                />
              </div>
              {/* Right Channel */}
              <div className="w-14 h-1.5 bg-[#182030] rounded-xs overflow-hidden flex items-center">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-violet-500 transition-all duration-75"
                  style={{ width: `${meterR * 100}%` }}
                />
              </div>
            </div>

            {/* Clip Warning LED */}
            <div
              className={`w-2 h-2 rounded-full transition-colors ${
                peakClip ? 'bg-red-500 shadow-sm shadow-red-500' : 'bg-red-950/60'
              }`}
              title="Peak Clip Indicator"
            />
          </div>

          {/* Master Volume Controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleMuteToggle}
              className={`p-1 rounded transition-colors cursor-pointer ${
                isMuted ? 'text-red-400 bg-red-500/10' : 'text-slate-400 hover:text-white'
              }`}
              title={isMuted ? 'Riattiva Audio (M)' : 'Muta Audio (M)'}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>

            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-16 sm:w-20 h-1 bg-[#1c2336] rounded appearance-none cursor-pointer accent-violet-400"
              title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
            />
          </div>
        </div>
      </div>
    </footer>
  );
};
