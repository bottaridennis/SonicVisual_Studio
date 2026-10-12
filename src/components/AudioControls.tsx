import React, { useEffect, useState, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Repeat,
  Upload,
  Music2,
  Sparkles,
  FastForward,
  Rewind,
} from 'lucide-react';
import { audioEngine } from '../audio/audioEngine';
import { AudioTrackInfo } from '../types/visualizer';
import { DEMO_TRACKS_LIST, generateProceduralTrapTrack } from '../audio/demoTracks';

interface AudioControlsProps {
  currentTrack: AudioTrackInfo;
  onTrackChange: (track: AudioTrackInfo) => void;
  onUploadTrack: (file: File) => void;
  isLoadingAudio: boolean;
}

export const AudioControls: React.FC<AudioControlsProps> = ({
  currentTrack,
  onTrackChange,
  onUploadTrack,
  isLoadingAudio,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoop, setIsLoop] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state with audio engine
  useEffect(() => {
    const interval = setInterval(() => {
      setIsPlaying(audioEngine.getIsPlaying());
      setCurrentTime(audioEngine.getCurrentTime());
      setDuration(audioEngine.getDuration());
      setVolume(audioEngine.getVolume());
      setIsMuted(audioEngine.getIsMuted());
      setIsLoop(audioEngine.getIsLoop());
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayToggle = () => {
    audioEngine.togglePlay();
    setIsPlaying(audioEngine.getIsPlaying());
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = parseFloat(e.target.value);
    audioEngine.seek(target);
    setCurrentTime(target);
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

  const handleSelectDemo = async (demoId: string) => {
    const demo = DEMO_TRACKS_LIST.find((d) => d.id === demoId);
    if (!demo) return;
    const buffer = await generateProceduralTrapTrack(demoId);
    audioEngine.setAudioBuffer(buffer);
    onTrackChange({
      id: demo.id,
      title: demo.title,
      artist: demo.artist,
      duration: buffer.duration,
      isCustom: false,
      bpm: demo.bpm,
      audioBuffer: buffer,
    });
    audioEngine.play(0);
  };

  return (
    <div className="w-full bg-[#0d111c] border border-slate-800/80 rounded-xl p-3 sm:p-4 shadow-xl flex flex-col gap-3">
      {/* Upper row: Track title and track switches */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/60 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400">
            <Music2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate flex items-center gap-2">
              <span>{currentTrack.title}</span>
              {currentTrack.isCustom && (
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 rounded">
                  Custom Audio
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 truncate">
              {currentTrack.artist} {currentTrack.bpm ? `· ${currentTrack.bpm} BPM` : ''}
            </div>
          </div>
        </div>

        {/* Demo track selector and Upload File button */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-slate-900/90 rounded-lg p-0.5 border border-slate-800">
            {DEMO_TRACKS_LIST.map((demo) => (
              <button
                key={demo.id}
                onClick={() => handleSelectDemo(demo.id)}
                disabled={isLoadingAudio}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  currentTrack.id === demo.id
                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {demo.id === 'trap-overdrive' ? 'Demo Trap 808' : 'Demo Cyber Beat'}
              </button>
            ))}
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-semibold text-xs rounded-lg transition-all shadow-md shadow-amber-500/10 cursor-pointer disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isLoadingAudio ? 'Loading...' : 'Upload MP3 / WAV'}</span>
          </button>
        </div>
      </div>

      {/* Timeline Scrubber */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-slate-400 w-11 text-right select-none tabular-nums">
          {formatTime(currentTime)}
        </span>
        <div className="relative flex-1 group flex items-center">
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400 focus:outline-none"
          />
        </div>
        <span className="text-xs font-mono text-slate-400 w-11 select-none tabular-nums">
          {formatTime(duration)}
        </span>
      </div>

      {/* Transport Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left transport controls */}
        <div className="flex items-center gap-2">
          {/* Rewind 5s */}
          <button
            onClick={() => audioEngine.seek(Math.max(0, currentTime - 5))}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors"
            title="Rewind 5s"
          >
            <Rewind className="w-4 h-4" />
          </button>

          {/* Primary Play / Pause button */}
          <button
            onClick={handlePlayToggle}
            className="w-10 h-10 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-amber-400/25"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-slate-950" />
            ) : (
              <Play className="w-5 h-5 fill-slate-950 ml-0.5" />
            )}
          </button>

          {/* Forward 5s */}
          <button
            onClick={() => audioEngine.seek(Math.min(duration, currentTime + 5))}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors"
            title="Forward 5s"
          >
            <FastForward className="w-4 h-4" />
          </button>

          {/* Loop toggle */}
          <button
            onClick={handleLoopToggle}
            className={`p-2 rounded-lg transition-colors ${
              isLoop
                ? 'text-amber-400 bg-amber-400/10'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
            }`}
            title={isLoop ? 'Loop Enabled' : 'Loop Disabled'}
          >
            <Repeat className="w-4 h-4" />
          </button>
        </div>

        {/* Volume controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleMuteToggle}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-20 sm:w-24 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
};
