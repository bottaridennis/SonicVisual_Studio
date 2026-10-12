import React, { useRef } from 'react';
import {
  Video,
  Disc3,
  FolderOpen,
  Save,
  RotateCcw,
  Sparkles,
  PanelLeftClose,
  PanelLeft,
  PanelRightClose,
  PanelRight,
  Eye,
  EyeOff,
  Edit2,
  BookmarkPlus,
} from 'lucide-react';
import { ProjectData, VisualizerConfig, ExportSettings } from '../types/visualizer';

interface HeaderProps {
  projectName: string;
  onProjectNameChange: (name: string) => void;
  config: VisualizerConfig;
  exportSettings: ExportSettings;
  onLoadProject: (project: ProjectData) => void;
  onResetProject: () => void;
  onOpenExport: () => void;
  isLeftPanelOpen: boolean;
  onToggleLeftPanel: () => void;
  isRightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  isCleanView: boolean;
  onToggleCleanView: () => void;
  onQuickSavePreset?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  projectName,
  onProjectNameChange,
  config,
  exportSettings,
  onLoadProject,
  onResetProject,
  onOpenExport,
  isLeftPanelOpen,
  onToggleLeftPanel,
  isRightPanelOpen,
  onToggleRightPanel,
  isCleanView,
  onToggleCleanView,
  onQuickSavePreset,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle Export Project JSON (.sonic)
  const handleSaveProjectFile = () => {
    const projectData: ProjectData = {
      version: '1.0.0',
      projectName: projectName || 'SonicVusual_Project',
      savedAt: new Date().toISOString(),
      config,
      exportSettings,
    };

    const blob = new Blob([JSON.stringify(projectData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(projectName || 'Progetto').replace(/[^a-zA-Z0-9_-]/g, '_')}.sonic`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle Load Project JSON (.sonic or .json)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string) as ProjectData;
        if (parsed && parsed.config) {
          onLoadProject(parsed);
        } else {
          alert('Il file selezionato non è un file di progetto valido per SonicVusual Studio.');
        }
      } catch {
        alert('Errore durante la lettura del file di progetto JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <header className="h-13 bg-[#0a0d14] border-b border-[#181d2c] px-3 sm:px-4 flex items-center justify-between gap-3 select-none text-slate-200 shrink-0 z-40">
      {/* Left Section: Sidebar Toggle + Brand Logo + Editable Project Title */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
        <button
          onClick={onToggleLeftPanel}
          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
            isLeftPanelOpen
              ? 'bg-[#141926] border-[#222a3f] text-violet-400 hover:text-white'
              : 'bg-transparent border-transparent text-slate-400 hover:bg-[#141926] hover:text-white'
          }`}
          title={isLeftPanelOpen ? 'Nascondi Pannello Strumenti' : 'Mostra Pannello Strumenti'}
        >
          {isLeftPanelOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
        </button>

        {/* Brand Logo & Name */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-sm shadow-violet-500/25">
            <Disc3 className="w-4 h-4" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-bold text-sm tracking-tight text-white font-['Outfit']">
              SonicVusual
            </span>
            <span className="text-[10px] uppercase font-bold text-violet-400 tracking-wider">
              Studio
            </span>
          </div>
        </div>

        <div className="hidden md:block w-px h-4 bg-[#1f2638]" />

        {/* Editable Project Name */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#111522] hover:bg-[#161c2d] border border-[#1b2235] hover:border-[#27324c] transition-colors group">
          <Edit2 className="w-3 h-3 text-slate-500 group-hover:text-violet-400 shrink-0" />
          <input
            type="text"
            value={projectName}
            onChange={(e) => onProjectNameChange(e.target.value)}
            placeholder="Nome Progetto..."
            className="bg-transparent text-xs text-slate-200 font-medium focus:outline-none w-32 sm:w-44 truncate focus:w-56 transition-all"
            title="Clicca per rinominare il progetto"
          />
        </div>
      </div>

      {/* Center Section: Workspace Actions (Save, Open, Reset, Preset, Clean View) */}
      <div className="flex items-center gap-1 bg-[#101420] p-0.5 rounded-lg border border-[#1a2133] text-xs">
        <input
          ref={fileInputRef}
          type="file"
          accept=".sonic,.json"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          onClick={handleSaveProjectFile}
          className="flex items-center gap-1.5 px-2.5 py-1 text-slate-300 hover:text-white hover:bg-[#181f31] rounded-md transition-colors text-[11px] font-medium cursor-pointer"
          title="Salva progetto (.sonic)"
        >
          <Save className="w-3.5 h-3.5 text-violet-400" />
          <span className="hidden md:inline">Salva</span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-2.5 py-1 text-slate-300 hover:text-white hover:bg-[#181f31] rounded-md transition-colors text-[11px] font-medium cursor-pointer"
          title="Apri file progetto (.sonic o .json)"
        >
          <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden md:inline">Apri</span>
        </button>

        {onQuickSavePreset && (
          <button
            onClick={onQuickSavePreset}
            className="hidden lg:flex items-center gap-1.5 px-2 py-1 text-slate-300 hover:text-white hover:bg-[#181f31] rounded-md transition-colors text-[11px] font-medium cursor-pointer"
            title="Salva configurazione come preset veloce"
          >
            <BookmarkPlus className="w-3.5 h-3.5 text-amber-400" />
            <span>Preset</span>
          </button>
        )}

        <button
          onClick={onResetProject}
          className="flex items-center gap-1.5 px-2 py-1 text-slate-400 hover:text-slate-200 hover:bg-[#181f31] rounded-md transition-colors text-[11px] font-medium cursor-pointer"
          title="Ripristina configurazione iniziale"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
          <span className="hidden lg:inline">Reset</span>
        </button>

        <div className="w-px h-3.5 bg-[#1e263a] mx-0.5" />

        {/* Clean View Toggle */}
        <button
          onClick={onToggleCleanView}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors text-[11px] font-medium cursor-pointer ${
            isCleanView
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-white hover:bg-[#181f31]'
          }`}
          title={isCleanView ? 'Disattiva Vista Pulita (mostra gizmo)' : 'Attiva Vista Pulita (nascondi gizmo/overlay)'}
        >
          {isCleanView ? <EyeOff className="w-3.5 h-3.5 text-cyan-400" /> : <Eye className="w-3.5 h-3.5" />}
          <span className="hidden xl:inline">{isCleanView ? 'Clean ON' : 'Vista'}</span>
        </button>
      </div>

      {/* Right Section: Inspector Toggle + Export Format Badge + Primary Export CTA */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#101420] border border-[#1a2133] text-[11px] font-mono text-slate-400">
          <span className="text-violet-400 font-semibold">{exportSettings.resolution.toUpperCase()}</span>
          <span>·</span>
          <span>{exportSettings.fps} FPS</span>
          <span>·</span>
          <span className="uppercase text-cyan-400 font-semibold">{exportSettings.format}</span>
        </div>

        {/* Inspector Panel Toggle Button */}
        <button
          onClick={onToggleRightPanel}
          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
            isRightPanelOpen
              ? 'bg-[#141926] border-[#222a3f] text-violet-400 hover:text-white'
              : 'bg-transparent border-transparent text-slate-400 hover:bg-[#141926] hover:text-white'
          }`}
          title={isRightPanelOpen ? 'Nascondi Pannello Proprietà' : 'Mostra Pannello Proprietà'}
        >
          {isRightPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
        </button>

        {/* Prominent Export CTA Button */}
        <button
          onClick={onOpenExport}
          className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 hover:from-violet-500 hover:via-indigo-500 hover:to-cyan-500 rounded-lg shadow-md shadow-violet-600/25 border border-violet-400/30 transition-all cursor-pointer active:scale-95"
          title="Apri finestra di rendering e scarica il video"
        >
          <Video className="w-3.5 h-3.5" />
          <span>Esporta Video</span>
        </button>
      </div>
    </header>
  );
};
