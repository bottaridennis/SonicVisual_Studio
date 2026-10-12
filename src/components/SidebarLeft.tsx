import React, { useRef, useState } from 'react';
import {
  Music,
  Waves,
  Sparkles,
  Type,
  ImageIcon,
  Shield,
  Palette,
  Layers,
  Upload,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Bookmark,
  Disc,
  X,
  Sliders,
  Check,
  RotateCcw,
} from 'lucide-react';
import {
  VisualizerConfig,
  VisualizerLayoutStyle,
  WaveStyle,
  Preset,
  AudioTrackInfo,
  TextLayer,
  SelectionTarget,
} from '../types/visualizer';
import { PRESETS } from '../visualizer/presets';
import { DEMO_TRACKS_LIST, generateProceduralTrapTrack } from '../audio/demoTracks';
import { audioEngine } from '../audio/audioEngine';
import defaultBackdrop from '../assets/images/trap_visualizer_backdrop_1791838910387.jpg';
import cyberBackdrop from '../assets/images/trap_visualizer_cyberpunk_1791838939502.jpg';
import defaultEmblem from '../assets/images/trap_central_emblem_1791838922225.jpg';

export type LeftTabId =
  | 'audio'
  | 'visualizer'
  | 'presets'
  | 'text'
  | 'particles'
  | 'background'
  | 'logo'
  | 'effects';

interface SidebarLeftProps {
  activeTab: LeftTabId;
  onSelectTab: (tab: LeftTabId) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  config: VisualizerConfig;
  onChangeConfig: (newConfig: VisualizerConfig) => void;
  currentTrack: AudioTrackInfo;
  onTrackChange: (track: AudioTrackInfo) => void;
  onUploadTrack: (file: File) => void;
  isLoadingAudio: boolean;
  customPresets: Preset[];
  onApplyPreset: (preset: Preset) => void;
  onSavePreset?: (name: string) => void;
  onDeleteCustomPreset?: (id: string) => void;
  selection: SelectionTarget;
  onSelectTarget: (target: SelectionTarget) => void;
}

export const SidebarLeft: React.FC<SidebarLeftProps> = ({
  activeTab,
  onSelectTab,
  isOpen,
  onToggleOpen,
  config,
  onChangeConfig,
  currentTrack,
  onTrackChange,
  onUploadTrack,
  isLoadingAudio,
  customPresets,
  onApplyPreset,
  onSavePreset,
  onDeleteCustomPreset,
  selection,
  onSelectTarget,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [newPresetName, setNewPresetName] = useState('');
  const [isSavingPreset, setIsSavingPreset] = useState(false);

  const updateConfig = (key: keyof VisualizerConfig, value: unknown) => {
    onChangeConfig({
      ...config,
      [key]: value,
    });
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

  // Text layer helpers
  const textLayers = config.textLayers || [];
  const activeTextLayerId = selection.type === 'text' ? selection.layerId : textLayers[0]?.id;

  const addNewTextLayer = () => {
    const newLayer: TextLayer = {
      id: `text-${Date.now()}`,
      enabled: true,
      label: `Testo ${textLayers.length + 1}`,
      text: 'NUOVO TESTO VIDEO',
      x: 50,
      y: 50,
      fontSize: 24,
      fontFamily: 'Outfit',
      fontWeight: '700',
      isItalic: false,
      isUppercase: true,
      letterSpacing: 2,
      align: 'center',
      color: '#ffffff',
      opacity: 1,
      glowEnabled: true,
      glowColor: config.primaryColor,
      glowBlur: 14,
      shadowOffsetX: 0,
      shadowOffsetY: 3,
      shadowColor: 'rgba(0,0,0,0.8)',
      boxEnabled: false,
      boxColor: '#000000',
      boxOpacity: 0.6,
      boxPaddingX: 12,
      boxPaddingY: 6,
      boxBorderRadius: 6,
      boxBorderWidth: 1,
      boxBorderColor: 'rgba(255,255,255,0.2)',
      animation: 'bass-pulse',
      audioReactivity: 0.2,
      isLocked: false,
    };
    updateConfig('textLayers', [...textLayers, newLayer]);
    onSelectTarget({ type: 'text', layerId: newLayer.id });
  };

  const handleDuplicateTextLayer = (layer: TextLayer) => {
    const duplicated: TextLayer = {
      ...layer,
      id: `text-${Date.now()}`,
      label: `${layer.label} (Copia)`,
      y: Math.min(95, layer.y + 6),
    };
    updateConfig('textLayers', [...textLayers, duplicated]);
    onSelectTarget({ type: 'text', layerId: duplicated.id });
  };

  const handleDeleteTextLayer = (id: string) => {
    if (textLayers.length <= 1) {
      alert('Deve rimanere almeno un livello di testo nel video.');
      return;
    }
    const filtered = textLayers.filter((l) => l.id !== id);
    updateConfig('textLayers', filtered);
    if (activeTextLayerId === id) {
      onSelectTarget({ type: 'text', layerId: filtered[0].id });
    }
  };

  const handleSaveCustomPreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim() || !onSavePreset) return;
    onSavePreset(newPresetName.trim());
    setNewPresetName('');
    setIsSavingPreset(false);
  };

  const toolTabs: { id: LeftTabId; label: string; icon: React.ReactNode }[] = [
    { id: 'audio', label: 'Audio', icon: <Music className="w-4 h-4" /> },
    { id: 'visualizer', label: 'Visualizer', icon: <Waves className="w-4 h-4" /> },
    { id: 'presets', label: 'Stili & Preset', icon: <Layers className="w-4 h-4" /> },
    { id: 'particles', label: 'Particelle', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'background', label: 'Sfondo', icon: <ImageIcon className="w-4 h-4" /> },
    { id: 'text', label: 'Testi', icon: <Type className="w-4 h-4" /> },
    { id: 'logo', label: 'Immagini & Logo', icon: <Shield className="w-4 h-4" /> },
    { id: 'effects', label: 'Effetti & Colori', icon: <Palette className="w-4 h-4" /> },
  ];

  const layoutStyles: { id: VisualizerLayoutStyle; name: string; icon: string }[] = [
    { id: 'classic-circle', name: 'Cerchio Classico', icon: '⭕' },
    { id: 'bottom-bars', name: 'Barre dal Basso', icon: '📶' },
    { id: 'mirror-bars', name: 'Barre Specchiate', icon: '🪞' },
    { id: 'horizontal-wave', name: 'Waveform Orizzontale', icon: '〰️' },
    { id: 'side-bars', name: 'Barre Laterali', icon: '↔️' },
    { id: 'full-width', name: 'Full Width', icon: '🌊' },
    { id: 'turntable-vinyl', name: 'Giradischi Vinile', icon: '💽' },
    { id: 'album-art-pulse', name: 'Album Art Pulse', icon: '🖼️' },
    { id: 'minimal', name: 'Modalità Minimal', icon: '✨' },
    { id: 'particles-only', name: 'Solo Particelle', icon: '🌌' },
  ];

  const waveStyleOptions: { id: WaveStyle; label: string }[] = [
    { id: 'bars', label: 'Barre Verticali' },
    { id: 'smooth-curve', label: 'Curva Fluida' },
    { id: 'mirror-bars', label: 'Barre Riflesse' },
    { id: 'dots', label: 'Punti Neon' },
    { id: 'radial-spikes', label: 'Picchi Radiali' },
  ];

  return (
    <div className="flex h-full border-r border-[#161b28] bg-[#0a0d14] select-none text-slate-300 z-30 shrink-0">
      {/* 1. Tool Ribbon Icon Rail (Fixed width 48px) */}
      <div className="w-12 bg-[#080a10] border-r border-[#141824] flex flex-col items-center py-2.5 gap-1 shrink-0">
        {toolTabs.map((tab) => {
          const isActive = isOpen && activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (isOpen && activeTab === tab.id) {
                  onToggleOpen();
                } else {
                  onSelectTab(tab.id);
                  if (!isOpen) onToggleOpen();
                }
              }}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer relative group ${
                isActive
                  ? 'bg-violet-600/20 text-violet-300 border border-violet-500/40 shadow-sm shadow-violet-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#121624]'
              }`}
              title={tab.label}
            >
              {tab.icon}
              {/* Active Indicator Pip */}
              {isActive && (
                <span className="absolute -left-1 top-2.5 w-1 h-4 bg-violet-400 rounded-r-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* 2. Drawer Content Panel (260px - 280px wide, collapsible) */}
      {isOpen && (
        <div className="w-64 sm:w-72 bg-[#0b0e16] flex flex-col h-full border-r border-[#161b28] overflow-hidden">
          {/* Header */}
          <div className="h-10 px-3.5 border-b border-[#161b28] flex items-center justify-between bg-[#080b12] shrink-0">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
              <span>{toolTabs.find((t) => t.id === activeTab)?.icon}</span>
              <span>{toolTabs.find((t) => t.id === activeTab)?.label}</span>
            </span>
            <button
              onClick={onToggleOpen}
              className="p-1 text-slate-500 hover:text-slate-300 hover:bg-[#141926] rounded transition-colors"
              title="Chiudi cassetto strumenti"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Drawer Body Scrollable */}
          <div className="p-3.5 overflow-y-auto flex-1 space-y-4 text-xs">
            {/* TAB: AUDIO */}
            {activeTab === 'audio' && (
              <div className="space-y-3.5">
                <div>
                  <label className="text-slate-400 font-medium block mb-1.5">File Audio Attivo</label>
                  <div className="p-2.5 bg-[#101420] rounded-lg border border-[#1b2235] space-y-1">
                    <p className="font-semibold text-white truncate text-xs">{currentTrack.title}</p>
                    <p className="text-[11px] text-slate-400 truncate">{currentTrack.artist}</p>
                    {currentTrack.bpm && (
                      <p className="text-[10px] text-cyan-400 font-mono">{currentTrack.bpm} BPM</p>
                    )}
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/mp3,audio/wav,audio/ogg,audio/flac,audio/aac,audio/m4a"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUploadTrack(file);
                  }}
                  className="hidden"
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoadingAudio}
                  className="w-full py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-violet-600/20 disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isLoadingAudio ? 'Caricamento in corso...' : 'Carica MP3 o WAV'}</span>
                </button>

                <div className="border-t border-[#161c2a] pt-3">
                  <label className="text-slate-400 font-medium block mb-1.5">Brani Demo Sintetizzati</label>
                  <div className="space-y-1.5">
                    {DEMO_TRACKS_LIST.map((demo) => (
                      <button
                        key={demo.id}
                        onClick={() => handleSelectDemo(demo.id)}
                        disabled={isLoadingAudio}
                        className={`w-full p-2 rounded-lg border text-left transition-all cursor-pointer ${
                          currentTrack.id === demo.id
                            ? 'bg-violet-600/15 border-violet-500/50 text-white ring-1 ring-violet-500/30'
                            : 'bg-[#101420] border-[#1a2133] text-slate-400 hover:text-white hover:bg-[#141926]'
                        }`}
                      >
                        <p className="font-semibold text-xs truncate">{demo.title}</p>
                        <p className="text-[10px] text-slate-500">{demo.genre} · {demo.bpm} BPM</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: VISUALIZER */}
            {activeTab === 'visualizer' && (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-400 font-medium">Stile di Layout (10 Modalità)</label>
                  <button
                    onClick={() => onSelectTarget({ type: 'visualizer' })}
                    className="text-[10px] text-violet-400 hover:underline cursor-pointer"
                  >
                    Proprietà →
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {layoutStyles.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        updateConfig('layoutStyle', item.id);
                        onSelectTarget({ type: 'visualizer' });
                      }}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                        config.layoutStyle === item.id
                          ? 'bg-violet-600/20 border-violet-500 text-white font-semibold shadow-sm shadow-violet-500/20'
                          : 'bg-[#101420] border-[#1a2133] text-slate-400 hover:text-white hover:bg-[#141926]'
                      }`}
                    >
                      <span className="text-sm block mb-0.5">{item.icon}</span>
                      <span className="text-[11px] truncate block leading-tight">{item.name}</span>
                    </button>
                  ))}
                </div>

                {/* Quick Transform Controls */}
                <div className="border-t border-[#161c2a] pt-3 space-y-3">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-400">Dimensione / Scala</span>
                      <span className="font-mono text-cyan-400">{Math.round((config.visualizerScale ?? 1) * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0.4}
                      max={2.0}
                      step={0.05}
                      value={config.visualizerScale ?? 1}
                      onChange={(e) => updateConfig('visualizerScale', parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-[#182030] rounded appearance-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-400">Pos X</span>
                        <span className="font-mono text-slate-300">{config.visualizerX ?? 50}%</span>
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={90}
                        step={1}
                        value={config.visualizerX ?? 50}
                        onChange={(e) => updateConfig('visualizerX', parseInt(e.target.value))}
                        className="w-full h-1.5 bg-[#182030] rounded appearance-none"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-400">Pos Y</span>
                        <span className="font-mono text-slate-300">{config.visualizerY ?? 50}%</span>
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={90}
                        step={1}
                        value={config.visualizerY ?? 50}
                        onChange={(e) => updateConfig('visualizerY', parseInt(e.target.value))}
                        className="w-full h-1.5 bg-[#182030] rounded appearance-none"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      updateConfig('visualizerX', 50);
                      updateConfig('visualizerY', 50);
                    }}
                    className="w-full py-1.5 bg-[#121624] hover:bg-[#181d2e] border border-[#1b2236] text-slate-300 rounded text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3 text-slate-400" />
                    <span>Centra nello Schermo</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB: PRESETS */}
            {activeTab === 'presets' && (
              <div className="space-y-3.5">
                {/* Save Current as Custom Preset */}
                {onSavePreset && (
                  <div>
                    {!isSavingPreset ? (
                      <button
                        onClick={() => setIsSavingPreset(true)}
                        className="w-full py-1.5 bg-[#121624] hover:bg-[#181e2e] border border-cyan-500/30 text-cyan-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Bookmark className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Salva Configurazione Come Preset</span>
                      </button>
                    ) : (
                      <form onSubmit={handleSaveCustomPreset} className="space-y-2 p-2 bg-[#101420] rounded-lg border border-cyan-500/40">
                        <input
                          type="text"
                          value={newPresetName}
                          onChange={(e) => setNewPresetName(e.target.value)}
                          placeholder="Nome preset..."
                          className="w-full px-2 py-1 bg-[#090b12] border border-[#1f273d] rounded text-white text-xs focus:outline-none focus:border-cyan-400"
                          autoFocus
                        />
                        <div className="flex gap-1.5">
                          <button
                            type="submit"
                            className="flex-1 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold"
                          >
                            Salva
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsSavingPreset(false)}
                            className="px-2 py-1 bg-slate-800 text-slate-300 rounded text-xs"
                          >
                            Annulla
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {/* Custom Presets list */}
                {customPresets.length > 0 && (
                  <div>
                    <label className="text-cyan-400 font-semibold block mb-1.5">Preset Personali ({customPresets.length})</label>
                    <div className="space-y-1.5">
                      {customPresets.map((cp) => (
                        <div
                          key={cp.id}
                          className="p-2 bg-[#101420] hover:bg-[#151a2a] border border-cyan-500/30 rounded-lg flex items-center justify-between gap-2 group transition-all"
                        >
                          <button
                            onClick={() => onApplyPreset(cp)}
                            className="flex-1 text-left min-w-0 cursor-pointer"
                          >
                            <span className="font-semibold text-cyan-300 truncate block text-xs">{cp.name}</span>
                            <span className="text-[10px] text-slate-400">{cp.tagline}</span>
                          </button>
                          {onDeleteCustomPreset && (
                            <button
                              onClick={() => onDeleteCustomPreset(cp.id)}
                              className="text-slate-500 hover:text-red-400 p-1 rounded"
                              title="Elimina preset"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Factory Presets */}
                <div>
                  <label className="text-slate-400 font-medium block mb-1.5">Preset Stile Trap & EDM</label>
                  <div className="space-y-1.5">
                    {PRESETS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => onApplyPreset(p)}
                        className="w-full p-2 bg-[#101420] hover:bg-[#141926] border border-[#1a2133] rounded-lg text-left transition-all cursor-pointer group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-200 group-hover:text-violet-300 text-xs truncate">
                            {p.name}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate">{p.tagline}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: PARTICLES */}
            {activeTab === 'particles' && (
              <div className="space-y-3.5">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-400">Quantità Particelle</span>
                    <span className="font-mono text-cyan-400 tabular-nums">{config.particleCount}</span>
                  </div>
                  <input
                    type="range"
                    min={40}
                    max={500}
                    step={10}
                    value={config.particleCount}
                    onChange={(e) => updateConfig('particleCount', parseInt(e.target.value))}
                    className="w-full h-1.5 bg-[#182030] rounded appearance-none"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Dispersione</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['radial', 'upward', 'ambient'] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => updateConfig('particleDispersion', d)}
                        className={`py-1.5 text-center rounded border text-[11px] capitalize cursor-pointer ${
                          (config.particleDispersion || 'radial') === d
                            ? 'bg-violet-600/20 border-violet-500 text-violet-300 font-semibold'
                            : 'bg-[#101420] border-[#1a2133] text-slate-400 hover:text-white'
                        }`}
                      >
                        {d === 'radial' ? 'Radiale' : d === 'upward' ? 'Verso Alto' : 'Ambientale'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-400">Impatto Bassi</span>
                    <span className="font-mono text-cyan-400">{config.particleBassImpact}x</span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={25}
                    step={1}
                    value={config.particleBassImpact}
                    onChange={(e) => updateConfig('particleBassImpact', parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-[#182030] rounded appearance-none"
                  />
                </div>

                <div className="flex items-center justify-between p-2 bg-[#101420] rounded-lg border border-[#1a2133]">
                  <span className="text-slate-300">Bagliore Particelle (Glow)</span>
                  <input
                    type="checkbox"
                    checked={config.particleGlow}
                    onChange={(e) => updateConfig('particleGlow', e.target.checked)}
                    className="w-4 h-4 accent-violet-500 rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-2 bg-[#101420] rounded-lg border border-[#1a2133]">
                  <span className="text-slate-300">Scintillio (Twinkle Sparkle)</span>
                  <input
                    type="checkbox"
                    checked={config.particleSparkle}
                    onChange={(e) => updateConfig('particleSparkle', e.target.checked)}
                    className="w-4 h-4 accent-violet-500 rounded cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* TAB: BACKGROUND */}
            {activeTab === 'background' && (
              <div className="space-y-3.5">
                <label className="text-slate-400 block font-medium">Sfondo Video</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => updateConfig('backgroundUrl', defaultBackdrop)}
                    className={`h-16 rounded-lg overflow-hidden border cursor-pointer relative ${
                      config.backgroundUrl === defaultBackdrop ? 'border-violet-500 ring-2 ring-violet-500/50' : 'border-[#1a2133]'
                    }`}
                  >
                    <img src={defaultBackdrop} alt="Dark Mountain" className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 left-1 text-[9px] bg-black/75 px-1 rounded text-white font-mono">Dark Peak</span>
                  </button>

                  <button
                    onClick={() => updateConfig('backgroundUrl', cyberBackdrop)}
                    className={`h-16 rounded-lg overflow-hidden border cursor-pointer relative ${
                      config.backgroundUrl === cyberBackdrop ? 'border-violet-500 ring-2 ring-violet-500/50' : 'border-[#1a2133]'
                    }`}
                  >
                    <img src={cyberBackdrop} alt="Cyber City" className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 left-1 text-[9px] bg-black/75 px-1 rounded text-white font-mono">Cyber Grid</span>
                  </button>
                </div>

                <input
                  ref={bgInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) updateConfig('backgroundUrl', URL.createObjectURL(file));
                  }}
                  className="hidden"
                />

                <button
                  onClick={() => bgInputRef.current?.click()}
                  className="w-full py-2 bg-[#121624] hover:bg-[#181d2e] border border-[#1b2236] text-slate-300 rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Carica Immagine Personalizzata</span>
                </button>

                {/* Background adjustments */}
                <div className="space-y-2.5 pt-2 border-t border-[#161c2a]">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-400">Sfocatura Sfondo</span>
                      <span className="font-mono text-cyan-400">{config.backgroundBlur}px</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={20}
                      step={1}
                      value={config.backgroundBlur}
                      onChange={(e) => updateConfig('backgroundBlur', parseInt(e.target.value))}
                      className="w-full h-1.5 bg-[#182030] rounded appearance-none"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-400">Oscuramento Dim</span>
                      <span className="font-mono text-cyan-400">{Math.round(config.backgroundDim * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={0.8}
                      step={0.05}
                      value={config.backgroundDim}
                      onChange={(e) => updateConfig('backgroundDim', parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-[#182030] rounded appearance-none"
                    />
                  </div>

                  <div className="flex items-center justify-between p-2 bg-[#101420] rounded-lg border border-[#1a2133]">
                    <span className="text-slate-300">Camera Shake sui Bassi</span>
                    <input
                      type="checkbox"
                      checked={config.bassCameraShake}
                      onChange={(e) => updateConfig('bassCameraShake', e.target.checked)}
                      className="w-4 h-4 accent-violet-500 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB: TEXT */}
            {activeTab === 'text' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-slate-400 font-medium">Livelli di Testo ({textLayers.length})</label>
                  <button
                    onClick={addNewTextLayer}
                    className="px-2 py-0.5 bg-violet-600 hover:bg-violet-500 text-white rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Aggiungi</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  {textLayers.map((layer) => {
                    const isSelected = activeTextLayerId === layer.id;
                    return (
                      <div
                        key={layer.id}
                        onClick={() => onSelectTarget({ type: 'text', layerId: layer.id })}
                        className={`p-2 rounded-lg border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-violet-600/15 border-violet-500 text-white ring-1 ring-violet-500/30'
                            : 'bg-[#101420] border-[#1a2133] text-slate-300 hover:bg-[#141926]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const updated = textLayers.map((l) =>
                                l.id === layer.id ? { ...l, enabled: !l.enabled } : l
                              );
                              updateConfig('textLayers', updated);
                            }}
                            className="text-slate-400 hover:text-white"
                          >
                            {layer.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-slate-600" />}
                          </button>
                          <span className="text-xs font-medium truncate">{layer.label || layer.text}</span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateTextLayer(layer);
                            }}
                            className="p-1 rounded text-slate-500 hover:text-slate-300"
                            title="Duplica livello"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const updated = textLayers.map((l) =>
                                l.id === layer.id ? { ...l, isLocked: !l.isLocked } : l
                              );
                              updateConfig('textLayers', updated);
                            }}
                            className={`p-1 rounded ${layer.isLocked ? 'text-amber-400' : 'text-slate-500'}`}
                            title="Blocca posizione"
                          >
                            {layer.isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTextLayer(layer.id);
                            }}
                            className="p-1 rounded text-slate-500 hover:text-red-400"
                            title="Elimina livello"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Seleziona un livello per personalizzarne font, glow, ombra, colori e animazione nel pannello destro.
                </p>
              </div>
            )}

            {/* TAB: LOGO & IMAGES */}
            {activeTab === 'logo' && (
              <div className="space-y-3.5">
                <label className="text-slate-400 block font-medium">Logo o Immagine Centrale</label>
                <div className="flex items-center gap-3">
                  <img
                    src={config.logoUrl || defaultEmblem}
                    alt="Logo"
                    className="w-14 h-14 rounded-full border border-violet-500 object-cover shadow-md"
                  />
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) updateConfig('logoUrl', URL.createObjectURL(file));
                    }}
                    className="hidden"
                  />
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    className="px-3 py-1.5 bg-[#121624] hover:bg-[#181d2e] border border-[#1b2236] text-slate-300 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Carica Immagine</span>
                  </button>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Forma del Logo</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['circle', 'ring', 'rounded-square', 'hexagon'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => updateConfig('logoShape', s)}
                        className={`py-1.5 px-2 rounded border text-xs capitalize cursor-pointer text-left ${
                          config.logoShape === s
                            ? 'bg-violet-600/20 border-violet-500 text-violet-300 font-semibold'
                            : 'bg-[#101420] border-[#1a2133] text-slate-400'
                        }`}
                      >
                        {s === 'circle' ? 'Cerchio' : s === 'ring' ? 'Anello' : s === 'rounded-square' ? 'Quadrato' : 'Esagono'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-400">Pulsazione a Ritmo di Basso</span>
                    <span className="font-mono text-cyan-400">{Math.round(config.logoPulseIntensity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={0.5}
                    step={0.02}
                    value={config.logoPulseIntensity}
                    onChange={(e) => updateConfig('logoPulseIntensity', parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-[#182030] rounded appearance-none"
                  />
                </div>
              </div>
            )}

            {/* TAB: EFFECTS & COLORS */}
            {activeTab === 'effects' && (
              <div className="space-y-3.5">
                <div>
                  <label className="text-slate-400 block mb-1">Stile dell'Onda (Wave Style)</label>
                  <div className="space-y-1">
                    {waveStyleOptions.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => updateConfig('waveStyle', opt.id)}
                        className={`w-full py-1.5 px-2.5 rounded-lg border text-xs text-left cursor-pointer transition-all ${
                          config.waveStyle === opt.id
                            ? 'bg-violet-600/20 border-violet-500 text-violet-300 font-semibold'
                            : 'bg-[#101420] border-[#1a2133] text-slate-400 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-400 block mb-1">Colore Primario</label>
                    <div className="flex items-center gap-2 bg-[#101420] p-1.5 rounded-lg border border-[#1a2133]">
                      <input
                        type="color"
                        value={config.primaryColor}
                        onChange={(e) => updateConfig('primaryColor', e.target.value)}
                        className="w-5 h-5 rounded cursor-pointer bg-transparent border-none"
                      />
                      <span className="font-mono text-[11px] uppercase truncate">{config.primaryColor}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Colore Glow</label>
                    <div className="flex items-center gap-2 bg-[#101420] p-1.5 rounded-lg border border-[#1a2133]">
                      <input
                        type="color"
                        value={config.glowColor}
                        onChange={(e) => updateConfig('glowColor', e.target.value)}
                        className="w-5 h-5 rounded cursor-pointer bg-transparent border-none"
                      />
                      <span className="font-mono text-[11px] uppercase truncate">{config.glowColor}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-400">Intensità Glow Bagliore</span>
                    <span className="font-mono text-cyan-400">{config.glowIntensity}px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    step={2}
                    value={config.glowIntensity}
                    onChange={(e) => updateConfig('glowIntensity', parseInt(e.target.value))}
                    className="w-full h-1.5 bg-[#182030] rounded appearance-none"
                  />
                </div>

                <div className="flex items-center justify-between p-2 bg-[#101420] rounded-lg border border-[#1a2133]">
                  <span className="text-slate-300">Evita Deformazioni Verso il Basso</span>
                  <input
                    type="checkbox"
                    checked={config.preventDownwardBleed}
                    onChange={(e) => updateConfig('preventDownwardBleed', e.target.checked)}
                    className="w-4 h-4 accent-violet-500 rounded cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
