import React, { useEffect, useRef, useState } from 'react';
import {
  Undo2,
  Redo2,
  PanelLeft,
  PanelRight,
  Eye,
  EyeOff,
  Film,
  FolderOpen,
  Save,
  FilePlus2,
  ChevronDown,
  Check,
} from 'lucide-react';
import { IconButton, Button, cx } from '../ui/controls';

interface TopBarProps {
  projectName: string;
  onProjectName: (n: string) => void;
  savedAt: number | null;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  leftOpen: boolean;
  rightOpen: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  cleanView: boolean;
  onToggleClean: () => void;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onExport: () => void;
}

export const Logo: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
    <rect width="32" height="32" rx="9" fill="#c6ff3a" />
    <g fill="#070709">
      <rect x="7" y="13" width="3" height="6" rx="1.5" />
      <rect x="12" y="8" width="3" height="16" rx="1.5" />
      <rect x="17" y="11" width="3" height="10" rx="1.5" />
      <rect x="22" y="14.5" width="3" height="3" rx="1.5" />
    </g>
  </svg>
);

export const TopBar: React.FC<TopBarProps> = (p) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const item = (icon: React.ReactNode, label: string, kbd: string | null, fn: () => void) => (
    <button
      role="menuitem"
      onClick={() => {
        setMenuOpen(false);
        fn();
      }}
      className="w-full flex items-center gap-2.5 h-8 px-2.5 rounded-md text-xs text-fg/90 hover:bg-hover"
    >
      <span className="text-faint">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {kbd && <span className="text-[10px] font-mono text-faint">{kbd}</span>}
    </button>
  );

  return (
    <header className="shrink-0 h-14 border-b border-line bg-panel flex items-center gap-2 px-2 sm:px-3 z-30">
      <IconButton label={p.leftOpen ? 'Nascondi pannello stili' : 'Mostra pannello stili'} active={p.leftOpen} onClick={p.onToggleLeft}>
        <PanelLeft className="w-4 h-4" />
      </IconButton>

      <div className="flex items-center gap-2.5 pl-1 pr-2">
        <Logo className="w-7 h-7 shrink-0" />
        <div className="hidden sm:block leading-none">
          <div className="font-display font-extrabold text-[15px] tracking-tight">SonicVisual</div>
          <div className="text-[9px] uppercase tracking-[0.28em] text-faint mt-0.5">Studio</div>
        </div>
      </div>

      <div className="hidden md:block w-px h-6 bg-line mx-1" />

      {/* Project menu + name */}
      <div className="relative min-w-0" ref={menuRef}>
        <div className="flex items-center rounded-lg hover:bg-hover transition-colors min-w-0">
          <input
            value={p.projectName}
            onChange={(e) => p.onProjectName(e.target.value)}
            aria-label="Nome progetto"
            className="bg-transparent h-8 pl-2.5 pr-1 text-[13px] font-medium text-fg focus:outline-none w-28 sm:w-48 truncate"
          />
          <button onClick={() => setMenuOpen(!menuOpen)} className="h-8 px-1.5 text-faint hover:text-fg" aria-haspopup="menu" aria-expanded={menuOpen} aria-label="Menu progetto">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
        {menuOpen && (
          <div role="menu" className="animate-in absolute top-full left-0 mt-1.5 w-56 p-1 rounded-xl bg-raised border border-line-strong shadow-2xl shadow-black/60 z-50">
            {item(<FilePlus2 className="w-3.5 h-3.5" />, 'Nuovo progetto', null, p.onNew)}
            {item(<FolderOpen className="w-3.5 h-3.5" />, 'Apri progetto…', 'Ctrl O', p.onOpen)}
            {item(<Save className="w-3.5 h-3.5" />, 'Salva su file (.sonic)', 'Ctrl S', p.onSave)}
          </div>
        )}
      </div>
      <span className="hidden lg:flex items-center gap-1 text-[11px] text-faint whitespace-nowrap">
        {p.savedAt && (
          <>
            <Check className="w-3 h-3" /> Salvato in automatico
          </>
        )}
      </span>

      <div className="flex-1" />

      <div className="flex items-center gap-0.5">
        <IconButton label="Annulla (Ctrl+Z)" disabled={!p.canUndo} onClick={p.onUndo}>
          <Undo2 className="w-4 h-4" />
        </IconButton>
        <IconButton label="Ripeti (Ctrl+Shift+Z)" disabled={!p.canRedo} onClick={p.onRedo}>
          <Redo2 className="w-4 h-4" />
        </IconButton>
        <div className="w-px h-5 bg-line mx-1 hidden sm:block" />
        <IconButton label={p.cleanView ? 'Mostra guide (H)' : 'Vista pulita (H)'} active={p.cleanView} onClick={p.onToggleClean} className="hidden sm:inline-flex">
          {p.cleanView ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </IconButton>
        <IconButton label={p.rightOpen ? 'Nascondi proprietà' : 'Mostra proprietà'} active={p.rightOpen} onClick={p.onToggleRight}>
          <PanelRight className="w-4 h-4" />
        </IconButton>
      </div>

      <Button variant="primary" className={cx('ml-1 h-9 px-3.5')} onClick={p.onExport}>
        <Film className="w-4 h-4" />
        <span className="hidden sm:inline">Esporta</span>
      </Button>
    </header>
  );
};
