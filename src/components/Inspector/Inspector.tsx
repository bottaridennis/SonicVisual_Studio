import React, { useState, useRef } from 'react';
import {
  VisualizerConfig,
  VisualizerLayoutStyle,
  WaveStyle,
  LogoShape,
  ExportSettings,
  TextLayer,
  TextFontFamily,
  TextAlign,
  TextAnimation,
  TextEnterAnimation,
  Preset,
} from '../../types/visualizer';
import {
  Sliders,
  Palette,
  Sparkles,
  Image as ImageIcon,
  Type,
  Video,
  Upload,
  Move,
  Plus,
  Trash2,
  Copy,
  Zap,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Disc,
  Layers,
  Save,
  Bookmark,
  ShieldCheck,
} from 'lucide-react';
import defaultBackdrop from '../../assets/images/trap_visualizer_backdrop_1791838910387.jpg';
import cyberBackdrop from '../../assets/images/trap_visualizer_cyberpunk_1791838939502.jpg';
import defaultEmblem from '../../assets/images/trap_central_emblem_1791838922225.jpg';
import { detectSupportedVideoFormats } from '../../visualizer/videoExporter';

import { SelectionTarget } from '../../types/visualizer';
import { X } from 'lucide-react';

interface InspectorProps {
  config: VisualizerConfig;
  selectedTextLayerId?: string;
  onSelectTextLayer?: (layerId: string) => void;
  selection?: SelectionTarget;
  onSelectTarget?: (target: SelectionTarget) => void;
  onChangeConfig: (newConfig: VisualizerConfig) => void;
  exportSettings: ExportSettings;
  onChangeExportSettings: (newSettings: ExportSettings) => void;
  onOpenExportModal: () => void;
  customPresets: Preset[];
  onSavePreset: (name: string) => void;
  onDeleteCustomPreset: (id: string) => void;
  onClose?: () => void;
}

type TabKey = 'layout' | 'text' | 'waves' | 'particles' | 'colors' | 'background' | 'export';

export const Inspector: React.FC<InspectorProps> = ({
  config,
  selectedTextLayerId,
  onSelectTextLayer,
  selection,
  onSelectTarget,
  onChangeConfig,
  exportSettings,
  onChangeExportSettings,
  onOpenExportModal,
  customPresets,
  onSavePreset,
  onDeleteCustomPreset,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('layout');

  React.useEffect(() => {
    if (selection?.type === 'text') {
      setActiveTab('text');
    } else if (selection?.type === 'visualizer') {
      setActiveTab('layout');
    } else if (selection?.type === 'particles') {
      setActiveTab('particles');
    } else if (selection?.type === 'background' || selection?.type === 'logo') {
      setActiveTab('background');
    }
  }, [selection]);
  const [newPresetName, setNewPresetName] = useState('');
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const formatSupport = detectSupportedVideoFormats();

  const updateConfig = (key: keyof VisualizerConfig, value: unknown) => {
    onChangeConfig({
      ...config,
      [key]: value,
    });
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      updateConfig('backgroundUrl', url);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      updateConfig('logoUrl', url);
    }
  };

  // Text Layers manipulation
  const textLayers = config.textLayers || [];
  const activeLayerIndex = Math.max(
    0,
    textLayers.findIndex((l) => l.id === selectedTextLayerId)
  );
  const activeLayer = textLayers[activeLayerIndex] || textLayers[0];

  const updateActiveLayer = (updates: Partial<TextLayer>) => {
    const newLayers = [...textLayers];
    if (newLayers[activeLayerIndex]) {
      newLayers[activeLayerIndex] = {
        ...newLayers[activeLayerIndex],
        ...updates,
      };
      updateConfig('textLayers', newLayers);
    }
  };

  const addNewTextLayer = () => {
    const newLayer: TextLayer = {
      id: `text-layer-${Date.now()}`,
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
    const newLayers = [...textLayers, newLayer];
    updateConfig('textLayers', newLayers);
    if (onSelectTextLayer) onSelectTextLayer(newLayer.id);
  };

  const duplicateActiveLayer = () => {
    if (!activeLayer) return;
    const duplicated: TextLayer = {
      ...activeLayer,
      id: `text-layer-${Date.now()}`,
      label: `${activeLayer.label} (Copia)`,
      y: Math.min(95, activeLayer.y + 6),
      isLocked: false,
    };
    const newLayers = [...textLayers, duplicated];
    updateConfig('textLayers', newLayers);
    if (onSelectTextLayer) onSelectTextLayer(duplicated.id);
  };

  const deleteActiveLayer = (index: number) => {
    if (textLayers.length <= 1) return;
    const deletedId = textLayers[index]?.id;
    const newLayers = textLayers.filter((_, idx) => idx !== index);
    updateConfig('textLayers', newLayers);
    if (onSelectTextLayer && deletedId === selectedTextLayerId) {
      onSelectTextLayer(newLayers[0].id);
    }
  };

  const handleSavePresetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;
    onSavePreset(newPresetName.trim());
    setNewPresetName('');
    setIsSavingPreset(false);
  };

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'layout', label: 'Stile Visual', icon: <Layers className="w-4 h-4" /> },
    { key: 'text', label: 'Testi nel Video', icon: <Type className="w-4 h-4" /> },
    { key: 'waves', label: 'Onde & Forma', icon: <Sliders className="w-4 h-4" /> },
    { key: 'particles', label: 'Particelle', icon: <Sparkles className="w-4 h-4" /> },
    { key: 'colors', label: 'Colori & Glow', icon: <Palette className="w-4 h-4" /> },
    { key: 'background', label: 'Sfondo & Logo', icon: <ImageIcon className="w-4 h-4" /> },
    { key: 'export', label: 'Esporta Video', icon: <Video className="w-4 h-4" /> },
  ];

  const layoutStyles: { id: VisualizerLayoutStyle; name: string; desc: string; icon: string }[] = [
    { id: 'classic-circle', name: 'Cerchio Classico', desc: 'Spettro circolare attorno al logo', icon: '⭕' },
    { id: 'bottom-bars', name: 'Barre dal Basso', desc: 'Equalizzatore verticale da studio', icon: '📶' },
    { id: 'mirror-bars', name: 'Barre Specchiate', desc: 'Riflesso simmetrico centrale', icon: '🪞' },
    { id: 'horizontal-wave', name: 'Waveform Orizzontale', desc: 'Onda continua lineare posizionabile', icon: '〰️' },
    { id: 'side-bars', name: 'Barre Laterali', desc: 'Spettro sui bordi sinistro e destro', icon: '↔️' },
    { id: 'full-width', name: 'Full Width', desc: 'Spettro a tutta larghezza schermo', icon: '🌊' },
    { id: 'turntable-vinyl', name: 'Giradischi Vinile', desc: 'Disco in vinile rotante animato', icon: '💽' },
    { id: 'album-art-pulse', name: 'Album Art Pulse', desc: 'Artwork squadrato reattivo ai bassi', icon: '🖼️' },
    { id: 'minimal', name: 'Modalità Minimal', desc: 'Costellazione discreta ed elegante', icon: '✨' },
    { id: 'particles-only', name: 'Solo Particelle', desc: 'Nessuna barra, solo particelle cosmiche', icon: '🌌' },
  ];

  return (
    <div className="w-full h-full bg-[#0b0e16] border-l border-[#161b28] flex flex-col select-none text-slate-300 overflow-hidden">
      {/* Studio Inspector Header */}
      <div className="h-10 px-3.5 border-b border-[#161b28] bg-[#080b12] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sliders className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200 shrink-0">
            Proprietà
          </span>
          <span className="text-[10px] text-cyan-400 font-mono bg-[#101420] px-1.5 py-0.5 rounded border border-[#1a2133] truncate">
            {selection?.type === 'text'
              ? 'Testo'
              : selection?.type === 'visualizer'
              ? 'Visualizer'
              : 'Studio'}
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-slate-300 hover:bg-[#141926] rounded transition-colors cursor-pointer"
            title="Chiudi pannello proprietà"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center overflow-x-auto border-b border-[#161b28] bg-[#080b12] p-1 gap-1 scrollbar-none">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-violet-600/25 text-violet-200 font-semibold border border-violet-500/40 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Body */}
      <div className="p-4 overflow-y-auto flex-1 text-xs text-slate-300 space-y-4">
        {/* TAB 1: STILE VISUALIZZATORE (I 10 LAYOUT PRINCIPALI) */}
        {activeTab === 'layout' && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-slate-300 font-bold text-xs">
                  Seleziona Stile Visualizzatore (10 Modalità)
                </label>
                <span className="text-[10px] text-violet-400 font-mono uppercase">
                  {config.layoutStyle}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {layoutStyles.map((item) => {
                  const isSelected = config.layoutStyle === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => updateConfig('layoutStyle', item.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-400/15 border-violet-500 text-violet-300 font-semibold shadow-md shadow-violet-500/10 ring-1 ring-violet-500/50'
                          : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/70'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">{item.icon}</span>
                        <span className="text-xs font-bold text-white truncate">{item.name}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">{item.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Posizione & Scala Globale */}
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Move className="w-4 h-4 text-violet-400" />
                  Dimensione e Posizione del Visualizzatore
                </span>
                <button
                  onClick={() => onChangeConfig({ ...config, visualizerX: 50, visualizerY: 50, visualizerScale: 1.0 })}
                  className="px-2 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-violet-300 rounded font-mono cursor-pointer"
                >
                  Centra (50%, 50%)
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-400">Dimensione</span>
                    <span className="font-mono text-violet-400 tabular-nums">
                      {Math.round((config.visualizerScale ?? 1.0) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.4}
                    max={1.8}
                    step={0.05}
                    value={config.visualizerScale ?? 1.0}
                    onChange={(e) => updateConfig('visualizerScale', parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-violet-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-400">Posizione X</span>
                    <span className="font-mono text-violet-400 tabular-nums">{config.visualizerX ?? 50}%</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={95}
                    step={1}
                    value={config.visualizerX ?? 50}
                    onChange={(e) => updateConfig('visualizerX', parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-violet-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-400">Posizione Y</span>
                    <span className="font-mono text-violet-400 tabular-nums">{config.visualizerY ?? 50}%</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={95}
                    step={1}
                    value={config.visualizerY ?? 50}
                    onChange={(e) => updateConfig('visualizerY', parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-violet-500"
                  />
                </div>
              </div>
            </div>

            {/* Custom Presets Management */}
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Bookmark className="w-3.5 h-3.5 text-violet-400" />
                  I Tuoi Preset Personalizzati
                </span>
                {!isSavingPreset && (
                  <button
                    onClick={() => setIsSavingPreset(true)}
                    className="px-2 py-1 bg-amber-500/15 text-violet-300 border border-violet-500/30 rounded text-[11px] font-semibold flex items-center gap-1 hover:bg-cyan-500/25 cursor-pointer"
                  >
                    <Save className="w-3 h-3" />
                    <span>Salva Questo Stile</span>
                  </button>
                )}
              </div>

              {isSavingPreset && (
                <form onSubmit={handleSavePresetSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    placeholder="Nome preset personalizzato..."
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-violet-500"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-3 py-1 bg-violet-600 text-white font-semibold rounded-lg text-xs hover:bg-amber-300 cursor-pointer"
                  >
                    Salva
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSavingPreset(false)}
                    className="px-2 py-1 text-slate-400 hover:text-white text-xs"
                  >
                    Annulla
                  </button>
                </form>
              )}

              {customPresets && customPresets.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {customPresets.map((cp) => (
                    <div
                      key={cp.id}
                      className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs"
                    >
                      <button
                        onClick={() => onChangeConfig({ ...config, ...cp.config })}
                        className="text-violet-300 font-medium hover:underline text-left cursor-pointer"
                      >
                        {cp.name}
                      </button>
                      <button
                        onClick={() => onDeleteCustomPreset(cp.id)}
                        className="text-slate-500 hover:text-red-400 ml-1 p-0.5"
                        title="Elimina preset"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500">Nessun preset salvato. Personalizza e premi "Salva Questo Stile".</p>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: SEZIONE DEDICATA AI TESTI NEL VIDEO */}
        {activeTab === 'text' && activeLayer && (
          <div className="space-y-4">
            {/* Layer Selection, Add, Duplicate & Delete */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                {textLayers.map((layer) => (
                  <button
                    key={layer.id}
                    onClick={() => onSelectTextLayer && onSelectTextLayer(layer.id)}
                    className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                      activeLayer.id === layer.id
                        ? 'bg-violet-600 text-white font-semibold shadow'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {!layer.enabled && <EyeOff className="w-3 h-3 opacity-60" />}
                    {layer.isLocked && <Lock className="w-3 h-3 text-amber-600" />}
                    <span>{layer.label || 'Testo'}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={duplicateActiveLayer}
                  className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors cursor-pointer"
                  title="Duplica questo testo"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={addNewTextLayer}
                  className="px-2 py-1 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nuovo</span>
                </button>
              </div>
            </div>

            {/* Active Layer Header with Visibility and Lock */}
            <div className="flex items-center justify-between p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateActiveLayer({ enabled: !activeLayer.enabled })}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeLayer.enabled ? 'text-violet-400 bg-amber-400/10' : 'text-slate-500 bg-slate-800'
                  }`}
                  title={activeLayer.enabled ? 'Nascondi Testo' : 'Mostra Testo'}
                >
                  {activeLayer.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => updateActiveLayer({ isLocked: !activeLayer.isLocked })}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeLayer.isLocked ? 'text-violet-400 bg-amber-400/10' : 'text-slate-500 hover:text-white'
                  }`}
                  title={activeLayer.isLocked ? 'Sblocca Posizione' : 'Blocca Posizione'}
                >
                  {activeLayer.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                </button>

                <input
                  type="text"
                  value={activeLayer.label}
                  onChange={(e) => updateActiveLayer({ label: e.target.value })}
                  className="bg-transparent font-semibold text-white border-b border-transparent hover:border-slate-700 focus:border-violet-500 focus:outline-none text-xs w-36"
                />
              </div>

              {textLayers.length > 1 && (
                <button
                  onClick={() => deleteActiveLayer(activeLayerIndex)}
                  className="p-1.5 text-red-400 hover:bg-red-500/15 rounded-lg transition-colors cursor-pointer"
                  title="Elimina questo layer di testo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Text Content Input */}
            <div>
              <label className="block text-slate-400 font-medium mb-1">Contenuto Testo</label>
              <input
                type="text"
                value={activeLayer.text}
                onChange={(e) => updateActiveLayer({ text: e.target.value })}
                placeholder="Scrivi il testo qui..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white font-semibold focus:outline-none focus:border-violet-500"
              />
            </div>

            {/* Free Positioning Sliders & Quick Alignment */}
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-300">Posizione Libera nel Video</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => updateActiveLayer({ x: 50, y: 12, align: 'center' })}
                    className="px-1.5 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
                  >
                    Alto
                  </button>
                  <button
                    onClick={() => updateActiveLayer({ x: 50, y: 50, align: 'center' })}
                    className="px-1.5 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
                  >
                    Centro
                  </button>
                  <button
                    onClick={() => updateActiveLayer({ x: 50, y: 86, align: 'center' })}
                    className="px-1.5 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
                  >
                    Basso
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-400">Coordinata X (Orizzontale)</span>
                    <span className="font-mono text-violet-400 tabular-nums">{Math.round(activeLayer.x)}%</span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={98}
                    step={1}
                    value={activeLayer.x}
                    disabled={activeLayer.isLocked}
                    onChange={(e) => updateActiveLayer({ x: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-violet-500 disabled:opacity-40"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-400">Coordinata Y (Verticale)</span>
                    <span className="font-mono text-violet-400 tabular-nums">{Math.round(activeLayer.y)}%</span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={98}
                    step={1}
                    value={activeLayer.y}
                    disabled={activeLayer.isLocked}
                    onChange={(e) => updateActiveLayer({ y: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-violet-500 disabled:opacity-40"
                  />
                </div>
              </div>
            </div>

            {/* Typography & Font Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Font Family</label>
                <select
                  value={activeLayer.fontFamily}
                  onChange={(e) => updateActiveLayer({ fontFamily: e.target.value as TextFontFamily })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white font-medium focus:outline-none focus:border-violet-500 cursor-pointer"
                >
                  <option value="Outfit">Outfit (Modern Clean)</option>
                  <option value="Montserrat">Montserrat (Geometric Pro)</option>
                  <option value="Oswald">Oswald (Punchy Bold Condensed)</option>
                  <option value="JetBrains Mono">JetBrains Mono (Tech / Code)</option>
                  <option value="Cinzel">Cinzel (Cinematic Epic Serif)</option>
                  <option value="Bricolage Grotesque">Bricolage Grotesque (Bold Character)</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400 font-medium">Dimensione Font</span>
                  <span className="font-mono text-violet-400 tabular-nums">{activeLayer.fontSize}px</span>
                </div>
                <input
                  type="range"
                  min={12}
                  max={84}
                  step={1}
                  value={activeLayer.fontSize}
                  onChange={(e) => updateActiveLayer({ fontSize: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-violet-500 mt-2.5"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Stile & Allineamento</label>
                <div className="flex items-center gap-1.5">
                  <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-800">
                    {(['left', 'center', 'right'] as TextAlign[]).map((align) => (
                      <button
                        key={align}
                        onClick={() => updateActiveLayer({ align })}
                        className={`p-1.5 rounded cursor-pointer ${
                          activeLayer.align === align ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                        title={`Allinea ${align}`}
                      >
                        {align === 'left' ? <AlignLeft className="w-3.5 h-3.5" /> : align === 'center' ? <AlignCenter className="w-3.5 h-3.5" /> : <AlignRight className="w-3.5 h-3.5" />}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => updateActiveLayer({ fontWeight: activeLayer.fontWeight === '800' ? '400' : '800' })}
                    className={`p-1.5 rounded-lg border cursor-pointer ${
                      activeLayer.fontWeight === '800' || activeLayer.fontWeight === '700'
                        ? 'bg-amber-400/20 border-violet-500 text-violet-300'
                        : 'border-slate-800 text-slate-400'
                    }`}
                    title="Grassetto"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => updateActiveLayer({ isItalic: !activeLayer.isItalic })}
                    className={`p-1.5 rounded-lg border cursor-pointer ${
                      activeLayer.isItalic ? 'bg-amber-400/20 border-violet-500 text-violet-300' : 'border-slate-800 text-slate-400'
                    }`}
                    title="Corsivo"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => updateActiveLayer({ isUppercase: !activeLayer.isUppercase })}
                    className={`px-2 py-1 rounded-lg border text-[11px] font-bold cursor-pointer ${
                      activeLayer.isUppercase ? 'bg-amber-400/20 border-violet-500 text-violet-300' : 'border-slate-800 text-slate-400'
                    }`}
                    title="Tutto Maiuscolo"
                  >
                    AA
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400 font-medium">Spaziatura Lettere</span>
                  <span className="font-mono text-violet-400 tabular-nums">{activeLayer.letterSpacing}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={16}
                  step={1}
                  value={activeLayer.letterSpacing}
                  onChange={(e) => updateActiveLayer({ letterSpacing: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-violet-500 mt-2.5"
                />
              </div>
            </div>

            {/* Colors, Stroke & Opacity */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-800 pt-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Colore Testo</label>
                <div className="flex items-center gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <input
                    type="color"
                    value={activeLayer.color}
                    onChange={(e) => updateActiveLayer({ color: e.target.value })}
                    className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
                  />
                  <span className="font-mono text-slate-200 text-xs uppercase">{activeLayer.color}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Contorno (Stroke)</label>
                <div className="flex items-center gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <input
                    type="color"
                    value={activeLayer.textStrokeColor || '#000000'}
                    onChange={(e) => updateActiveLayer({ textStrokeColor: e.target.value })}
                    className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
                  />
                  <input
                    type="range"
                    min={0}
                    max={6}
                    step={1}
                    value={activeLayer.textStrokeWidth || 0}
                    onChange={(e) => updateActiveLayer({ textStrokeWidth: parseInt(e.target.value) })}
                    className="w-16 h-1.5 bg-slate-800 rounded accent-violet-500"
                    title="Spessore contorno"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400 font-medium">Opacità</span>
                  <span className="font-mono text-violet-400 tabular-nums">{Math.round((activeLayer.opacity ?? 1) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  value={activeLayer.opacity ?? 1}
                  onChange={(e) => updateActiveLayer({ opacity: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-violet-500 mt-2.5"
                />
              </div>
            </div>

            {/* Shadow & Glow Effects */}
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-300">Ombra & Neon Glow</span>
                  <p className="text-[10px] text-slate-500">Effetto luminescenza o ombra profonda</p>
                </div>
                <input
                  type="checkbox"
                  checked={activeLayer.glowEnabled}
                  onChange={(e) => updateActiveLayer({ glowEnabled: e.target.checked })}
                  className="w-4 h-4 accent-violet-500 rounded cursor-pointer"
                />
              </div>

              {activeLayer.glowEnabled && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Colore Glow</label>
                    <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                      <input
                        type="color"
                        value={activeLayer.glowColor}
                        onChange={(e) => updateActiveLayer({ glowColor: e.target.value })}
                        className="w-6 h-6 rounded border-none cursor-pointer bg-transparent"
                      />
                      <span className="font-mono text-slate-200 text-[11px] uppercase">{activeLayer.glowColor}</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-400 font-medium">Intensità Glow</span>
                      <span className="font-mono text-violet-400 tabular-nums">{activeLayer.glowBlur}px</span>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={40}
                      step={2}
                      value={activeLayer.glowBlur}
                      onChange={(e) => updateActiveLayer({ glowBlur: parseInt(e.target.value) })}
                      className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-violet-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Animation & Audio Reactivity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-800 pt-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Animazione Reattiva</label>
                <select
                  value={activeLayer.animation}
                  onChange={(e) => updateActiveLayer({ animation: e.target.value as TextAnimation })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white font-medium focus:outline-none focus:border-violet-500 cursor-pointer"
                >
                  <option value="none">Nessuna (Statico)</option>
                  <option value="bass-pulse">Bass Pulse (Rimbalzo a tempo di cassa)</option>
                  <option value="gentle-float">Gentle Float (Fluttuazione morbida)</option>
                  <option value="glow-breath">Glow Breath (Respiro neon dinamico)</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400 font-medium">Reattività al Basso</span>
                  <span className="font-mono text-violet-400 tabular-nums">
                    {Math.round((activeLayer.audioReactivity ?? 0) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={0.5}
                  step={0.05}
                  value={activeLayer.audioReactivity ?? 0.2}
                  onChange={(e) => updateActiveLayer({ audioReactivity: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-violet-500 mt-2.5"
                />
              </div>
            </div>

            {/* Background Box Behind Text */}
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-300">Box o Sfondo Dietro al Testo</span>
                  <p className="text-[10px] text-slate-500">Cornice e contrasto per massima leggibilità</p>
                </div>
                <input
                  type="checkbox"
                  checked={activeLayer.boxEnabled}
                  onChange={(e) => updateActiveLayer({ boxEnabled: e.target.checked })}
                  className="w-4 h-4 accent-violet-500 rounded cursor-pointer"
                />
              </div>

              {activeLayer.boxEnabled && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Colore Box</label>
                    <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                      <input
                        type="color"
                        value={activeLayer.boxColor}
                        onChange={(e) => updateActiveLayer({ boxColor: e.target.value })}
                        className="w-6 h-6 rounded border-none cursor-pointer bg-transparent"
                      />
                      <span className="font-mono text-slate-200 text-[11px] uppercase">{activeLayer.boxColor}</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-400 font-medium">Opacità Box</span>
                      <span className="font-mono text-violet-400 tabular-nums">
                        {Math.round((activeLayer.boxOpacity ?? 0.6) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={1.0}
                      step={0.05}
                      value={activeLayer.boxOpacity ?? 0.6}
                      onChange={(e) => updateActiveLayer({ boxOpacity: parseFloat(e.target.value) })}
                      className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-violet-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-400 font-medium">Raggio Angoli</span>
                      <span className="font-mono text-violet-400 tabular-nums">{activeLayer.boxBorderRadius}px</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={24}
                      step={2}
                      value={activeLayer.boxBorderRadius}
                      onChange={(e) => updateActiveLayer({ boxBorderRadius: parseInt(e.target.value) })}
                      className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-violet-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-400 font-medium">Padding Orizzontale</span>
                      <span className="font-mono text-violet-400 tabular-nums">{activeLayer.boxPaddingX}px</span>
                    </div>
                    <input
                      type="range"
                      min={4}
                      max={36}
                      step={2}
                      value={activeLayer.boxPaddingX}
                      onChange={(e) => updateActiveLayer({ boxPaddingX: parseInt(e.target.value) })}
                      className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-violet-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: ONDE, FORMA & CONTROLLO CONTENIMENTO */}
        {activeTab === 'waves' && (
          <div className="space-y-4">
            {/* Contenimento e pulizia grafica richiesta */}
            <div className="p-3 bg-amber-500/10 border border-violet-500/30 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-violet-300 font-bold text-xs">
                <ShieldCheck className="w-4 h-4 text-violet-400" />
                <span>Controllo Contenimento & Anti-Deformazione</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Impedisce colature o estensioni indesiderate sotto il cerchio e controlla i confini massimi del visualizzatore.
              </p>

              <div className="flex items-center justify-between p-2 bg-slate-900/80 rounded-lg border border-slate-800">
                <div>
                  <span className="font-medium text-white">Blocca Colature Inferiori</span>
                  <p className="text-[10px] text-slate-400">Arrotonda e pulisce le barre nella parte inferiore</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.preventDownwardBleed}
                  onChange={(e) => updateConfig('preventDownwardBleed', e.target.checked)}
                  className="w-4 h-4 accent-violet-500 rounded cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Altezza Massima Barre (Clamp)</span>
                  <span className="font-mono text-violet-400 tabular-nums">
                    {Math.round((config.maxBarHeightRatio || 0.38) * 100)}% altezza
                  </span>
                </div>
                <input
                  type="range"
                  min={0.15}
                  max={0.55}
                  step={0.02}
                  value={config.maxBarHeightRatio || 0.38}
                  onChange={(e) => updateConfig('maxBarHeightRatio', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-violet-500"
                />
              </div>
            </div>

            {/* Wave Parameters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Numero di Barre / Punti</span>
                  <span className="font-mono text-violet-400 tabular-nums">{config.barCount}</span>
                </div>
                <input
                  type="range"
                  min={32}
                  max={240}
                  step={4}
                  value={config.barCount}
                  onChange={(e) => updateConfig('barCount', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-violet-500"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Sensibilità & Moltiplicatore Altezza</span>
                  <span className="font-mono text-violet-400 tabular-nums">{config.barHeightMultiplier.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={2.5}
                  step={0.1}
                  value={config.barHeightMultiplier}
                  onChange={(e) => updateConfig('barHeightMultiplier', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-violet-500"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Raggio Cerchio Interno</span>
                  <span className="font-mono text-violet-400 tabular-nums">{Math.round(config.innerRadiusRatio * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.15}
                  max={0.42}
                  step={0.01}
                  value={config.innerRadiusRatio}
                  onChange={(e) => updateConfig('innerRadiusRatio', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-violet-500"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Spessore Barre</span>
                  <span className="font-mono text-violet-400 tabular-nums">{config.barWidth}px</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={0.5}
                  value={config.barWidth}
                  onChange={(e) => updateConfig('barWidth', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-violet-500"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Smoothing / Reattività</span>
                  <span className="font-mono text-violet-400 tabular-nums">{Math.round(config.smoothing * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={0.96}
                  step={0.02}
                  value={config.smoothing}
                  onChange={(e) => updateConfig('smoothing', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-violet-500"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Distanza dal Fondo (Offset)</span>
                  <span className="font-mono text-violet-400 tabular-nums">{config.bottomOffsetPercent ?? 12}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={30}
                  step={1}
                  value={config.bottomOffsetPercent ?? 12}
                  onChange={(e) => updateConfig('bottomOffsetPercent', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-violet-500"
                />
              </div>
            </div>

            {/* Turntable settings if in vinyl mode */}
            {config.layoutStyle === 'turntable-vinyl' && (
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-white font-bold">
                  <Disc className="w-4 h-4 text-violet-400" />
                  <span>Impostazioni Vinile Giradischi</span>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-400">Velocità Rotazione Vinile</span>
                    <span className="font-mono text-violet-400 tabular-nums">{config.turntableRotationSpeed.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={3.0}
                    step={0.2}
                    value={config.turntableRotationSpeed}
                    onChange={(e) => updateConfig('turntableRotationSpeed', parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-violet-500"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: PARTICELLE ED EFFETTI */}
        {activeTab === 'particles' && (
          <div className="space-y-4">
            <div>
              <label className="block text-slate-400 font-medium mb-1.5">Movimento & Dispersione Particelle</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'radial', label: 'Radiale (Centro)' },
                  { id: 'upward', label: 'Verso l\'Alto' },
                  { id: 'ambient', label: 'Fluttuazione Cosmica' },
                ].map((d) => (
                  <button
                    key={d.id}
                    onClick={() => updateConfig('particleDispersion', d.id)}
                    className={`py-2 px-1 text-center rounded-lg border text-xs cursor-pointer ${
                      (config.particleDispersion || 'radial') === d.id
                        ? 'bg-amber-400/20 border-violet-500 text-violet-300 font-semibold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400 font-medium">Quantità Particelle</span>
                  <span className="font-mono text-violet-400 tabular-nums">{config.particleCount}</span>
                </div>
                <input
                  type="range"
                  min={40}
                  max={500}
                  step={10}
                  value={config.particleCount}
                  onChange={(e) => updateConfig('particleCount', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-violet-500"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400 font-medium">Impatto Esplosione Basso</span>
                  <span className="font-mono text-violet-400 tabular-nums">{config.particleBassImpact.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={25}
                  step={0.5}
                  value={config.particleBassImpact}
                  onChange={(e) => updateConfig('particleBassImpact', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-violet-500"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400 font-medium">Dimensione Particelle</span>
                  <span className="font-mono text-violet-400 tabular-nums">{config.particleSize}px</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={6}
                  step={0.2}
                  value={config.particleSize}
                  onChange={(e) => updateConfig('particleSize', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-violet-500"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400 font-medium">Opacità Particelle</span>
                  <span className="font-mono text-violet-400 tabular-nums">{Math.round((config.particleOpacity ?? 0.85) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={1.0}
                  step={0.05}
                  value={config.particleOpacity ?? 0.85}
                  onChange={(e) => updateConfig('particleOpacity', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-violet-500"
                />
              </div>

              <div className="flex items-center justify-between p-2 bg-slate-900/60 rounded-lg border border-slate-800">
                <div>
                  <span className="font-medium text-slate-300">Effetto Scintillio (Sparkle)</span>
                  <p className="text-[10px] text-slate-500">Twinkle reattivo alle frequenze alte</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.particleSparkle}
                  onChange={(e) => updateConfig('particleSparkle', e.target.checked)}
                  className="w-4 h-4 accent-violet-500 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-2 bg-slate-900/60 rounded-lg border border-slate-800">
                <div>
                  <span className="font-medium text-slate-300">Neon Glow Diffuso</span>
                  <p className="text-[10px] text-slate-500">Bagliore luminoso</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.particleGlow}
                  onChange={(e) => updateConfig('particleGlow', e.target.checked)}
                  className="w-4 h-4 accent-violet-500 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: COLORI & GLOW */}
        {activeTab === 'colors' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Colore Primario</label>
                <div className="flex items-center gap-3 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <input
                    type="color"
                    value={config.primaryColor}
                    onChange={(e) => updateConfig('primaryColor', e.target.value)}
                    className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                  />
                  <span className="font-mono text-slate-300 uppercase">{config.primaryColor}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Colore Secondario Gradiente</label>
                <div className="flex items-center gap-3 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <input
                    type="color"
                    value={config.secondaryColor}
                    onChange={(e) => updateConfig('secondaryColor', e.target.value)}
                    className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                  />
                  <span className="font-mono text-slate-300 uppercase">{config.secondaryColor}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Colore Glow Esterno</label>
                <div className="flex items-center gap-3 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <input
                    type="color"
                    value={config.glowColor}
                    onChange={(e) => updateConfig('glowColor', e.target.value)}
                    className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                  />
                  <span className="font-mono text-slate-300 uppercase">{config.glowColor}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Colore Particelle</label>
                <div className="flex items-center gap-3 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <input
                    type="color"
                    value={config.particleColor}
                    onChange={(e) => updateConfig('particleColor', e.target.value)}
                    className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                  />
                  <span className="font-mono text-slate-300 uppercase">{config.particleColor}</span>
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-400 font-medium">Intensità Neon Glow</span>
                <span className="font-mono text-violet-400 tabular-nums">{config.glowIntensity}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={45}
                step={1}
                value={config.glowIntensity}
                onChange={(e) => updateConfig('glowIntensity', parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-violet-500"
              />
            </div>
          </div>
        )}

        {/* TAB 6: SFONDO & LOGO */}
        {activeTab === 'background' && (
          <div className="space-y-4">
            <div>
              <label className="block text-slate-400 font-medium mb-1.5">Sfondo del Video</label>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => updateConfig('backgroundUrl', defaultBackdrop)}
                  className={`relative w-24 h-14 rounded-lg overflow-hidden border shrink-0 cursor-pointer ${
                    config.backgroundUrl === defaultBackdrop ? 'border-violet-500 ring-2 ring-violet-500/40' : 'border-slate-800'
                  }`}
                >
                  <img src={defaultBackdrop} alt="Dark Mountain" className="w-full h-full object-cover" />
                  <span className="absolute bottom-1 left-1 text-[9px] bg-black/70 px-1 rounded text-white font-mono">Dark Peak</span>
                </button>

                <button
                  onClick={() => updateConfig('backgroundUrl', cyberBackdrop)}
                  className={`relative w-24 h-14 rounded-lg overflow-hidden border shrink-0 cursor-pointer ${
                    config.backgroundUrl === cyberBackdrop ? 'border-violet-500 ring-2 ring-violet-500/40' : 'border-slate-800'
                  }`}
                >
                  <img src={cyberBackdrop} alt="Cyber City" className="w-full h-full object-cover" />
                  <span className="absolute bottom-1 left-1 text-[9px] bg-black/70 px-1 rounded text-white font-mono">Cyber Grid</span>
                </button>

                <input ref={bgInputRef} type="file" accept="image/*" onChange={handleBgUpload} className="hidden" />
                <button
                  onClick={() => bgInputRef.current?.click()}
                  className="w-24 h-14 rounded-lg border border-dashed border-slate-700 bg-slate-900/60 hover:bg-slate-800 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-white shrink-0 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span className="text-[10px]">Carica Foto</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400 font-medium">Sfocatura Sfondo (Blur)</span>
                  <span className="font-mono text-violet-400 tabular-nums">{config.backgroundBlur}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={15}
                  step={1}
                  value={config.backgroundBlur}
                  onChange={(e) => updateConfig('backgroundBlur', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-violet-500"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400 font-medium">Vignettatura Scura</span>
                  <span className="font-mono text-violet-400 tabular-nums">{Math.round(config.backgroundVignette * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={config.backgroundVignette}
                  onChange={(e) => updateConfig('backgroundVignette', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-violet-500"
                />
              </div>

              <div className="flex items-center justify-between p-2 bg-slate-900/60 rounded-lg border border-slate-800">
                <div>
                  <span className="font-medium text-slate-300">Bass Camera Shake</span>
                  <p className="text-[10px] text-slate-500">Scuotimento sui bassi</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.bassCameraShake}
                  onChange={(e) => updateConfig('bassCameraShake', e.target.checked)}
                  className="w-4 h-4 accent-violet-500 rounded cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400 font-medium">Zoom sui Bassi</span>
                  <span className="font-mono text-violet-400 tabular-nums">{(config.bassZoomIntensity * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={0.12}
                  step={0.01}
                  value={config.bassZoomIntensity}
                  onChange={(e) => updateConfig('bassZoomIntensity', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-violet-500"
                />
              </div>
            </div>

            {/* Central Logo */}
            <div className="border-t border-slate-800 pt-3">
              <label className="block text-slate-400 font-medium mb-1.5">Logo o Copertina Centrale</label>
              <div className="flex items-center gap-3 mb-3">
                <button
                  onClick={() => updateConfig('logoUrl', defaultEmblem)}
                  className={`relative w-12 h-12 rounded-full overflow-hidden border shrink-0 cursor-pointer ${
                    config.logoUrl === defaultEmblem ? 'border-violet-500 ring-2 ring-violet-500/40' : 'border-slate-800'
                  }`}
                >
                  <img src={defaultEmblem} alt="Cyber Wolf" className="w-full h-full object-cover" />
                </button>

                <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="px-3 py-2 rounded-lg border border-dashed border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-300 flex items-center gap-2 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Carica Logo Personalizzato</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="block text-slate-400 font-medium mb-1">Forma Immagine</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'circle', name: 'Cerchio' },
                      { id: 'rounded-square', name: 'Squadrato (Card)' },
                    ].map((shape) => (
                      <button
                        key={shape.id}
                        onClick={() => updateConfig('logoShape', shape.id as LogoShape)}
                        className={`px-2.5 py-1.5 text-xs rounded border text-center cursor-pointer ${
                          config.logoShape === shape.id
                            ? 'bg-amber-400/15 border-violet-500 text-violet-300 font-semibold'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400'
                        }`}
                      >
                        {shape.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-400 font-medium">Pulsazione al Beat</span>
                    <span className="font-mono text-violet-400 tabular-nums">+{Math.round(config.logoPulseIntensity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.05}
                    max={0.4}
                    step={0.02}
                    value={config.logoPulseIntensity}
                    onChange={(e) => updateConfig('logoPulseIntensity', parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-violet-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: ESPORTAZIONE VIDEO */}
        {activeTab === 'export' && (
          <div className="space-y-4">
            <div className="p-3 bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent rounded-lg border border-violet-500/20">
              <div className="flex items-center gap-2 text-violet-400 font-semibold text-xs mb-1">
                <Zap className="w-4 h-4" />
                <span>Studio di Rendering Video Full HD & 4K</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Esporta il visualizzatore, i testi sincronizzati, il logo e l'audio originale con codifica video di livello broadcast.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 font-medium mb-1.5">Risoluzione</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: '1080p', label: '1080p Full HD', desc: '1920x1080' },
                    { id: '4k', label: '4K Ultra HD', desc: '3840x2160' },
                    { id: '720p', label: '720p HD', desc: '1280x720' },
                    { id: 'square', label: '1:1 Quadrato', desc: '1080x1080' },
                  ].map((res) => (
                    <button
                      key={res.id}
                      onClick={() => onChangeExportSettings({ ...exportSettings, resolution: res.id as any })}
                      className={`p-2 rounded-lg border text-left cursor-pointer ${
                        exportSettings.resolution === res.id
                          ? 'bg-amber-400/15 border-violet-500 text-violet-300 font-semibold'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="text-xs font-semibold">{res.label}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{res.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1.5">Frame Rate</label>
                  <div className="flex gap-2">
                    {[
                      { fps: 60, label: '60 FPS (Ultra Fluido)' },
                      { fps: 30, label: '30 FPS (Standard)' },
                    ].map((f) => (
                      <button
                        key={f.fps}
                        onClick={() => onChangeExportSettings({ ...exportSettings, fps: f.fps as any })}
                        className={`flex-1 py-1.5 px-2 rounded-lg border text-xs text-center cursor-pointer ${
                          exportSettings.fps === f.fps
                            ? 'bg-amber-400/15 border-violet-500 text-violet-300 font-semibold'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1.5">Formato Output</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onChangeExportSettings({ ...exportSettings, format: 'mp4' })}
                      className={`flex-1 py-1.5 px-2 rounded-lg border text-xs text-center cursor-pointer ${
                        exportSettings.format === 'mp4'
                          ? 'bg-amber-400/15 border-violet-500 text-violet-300 font-semibold'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400'
                      }`}
                    >
                      <span>Video MP4</span>
                      {formatSupport.mp4Supported && (
                        <span className="block text-[9px] text-emerald-400 font-mono">Hardware H.264</span>
                      )}
                    </button>

                    <button
                      onClick={() => onChangeExportSettings({ ...exportSettings, format: 'webm' })}
                      className={`flex-1 py-1.5 px-2 rounded-lg border text-xs text-center cursor-pointer ${
                        exportSettings.format === 'webm'
                          ? 'bg-amber-400/15 border-violet-500 text-violet-300 font-semibold'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400'
                      }`}
                    >
                      <span>Video WebM</span>
                      <span className="block text-[9px] text-slate-500 font-mono">VP9 Alta Qualità</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1.5">Durata Esportazione</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: '15s', label: 'Clip 15s' },
                  { id: '30s', label: 'Drop 30s' },
                  { id: '60s', label: 'Anteprima 60s' },
                  { id: 'full', label: 'Brano Intero' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => onChangeExportSettings({ ...exportSettings, durationMode: mode.id as any })}
                    className={`py-1.5 px-2 rounded-lg border text-xs text-center cursor-pointer ${
                      exportSettings.durationMode === mode.id
                        ? 'bg-amber-400/15 border-violet-500 text-violet-300 font-semibold'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={onOpenExportModal}
              className="w-full py-3 bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-bold text-sm rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer mt-4"
            >
              <Video className="w-4 h-4 fill-slate-950" />
              <span>Avvia Rendering Video ({exportSettings.resolution.toUpperCase()})</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
