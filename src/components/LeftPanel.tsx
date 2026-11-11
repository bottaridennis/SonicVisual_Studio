import React, { useRef, useState } from 'react';
import {
  Palette,
  Layers,
  AudioLines,
  Waves,
  Disc3,
  Sparkles,
  Image as ImageIcon,
  Wand2,
  Type,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Copy,
  Trash2,
  Plus,
  Upload,
  Play,
  Check,
  Bookmark,
  X,
  Keyboard,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { AudioTrackInfo, Preset, SelectionTarget, VisualizerConfig, TextLayer } from '../types/visualizer';
import { LAYOUT_OPTIONS, PRESETS } from '../visualizer/presets';
import { DEMO_TRACKS_LIST } from '../audio/demoTracks';
import { LayoutIcon } from './LayoutIcon';
import { Button, IconButton, cx } from '../ui/controls';
import { formatTime } from './Transport';

export type LeftTab = 'styles' | 'layers' | 'audio';

interface LeftPanelProps {
  tab: LeftTab;
  onTab: (t: LeftTab) => void;
  config: VisualizerConfig;
  onChangeConfig: (updater: (prev: VisualizerConfig) => VisualizerConfig, opts?: { coalesce?: boolean }) => void;
  selection: SelectionTarget;
  onSelect: (s: SelectionTarget) => void;
  customPresets: Preset[];
  activePresetId: string | null;
  onApplyPreset: (p: Preset) => void;
  onSavePreset: (name: string) => void;
  onDeletePreset: (id: string) => void;
  track: AudioTrackInfo;
  isLoadingAudio: boolean;
  onLoadDemo: (id: string) => void;
  onUploadAudio: (file: File) => void;
  onAddText: () => void;
  onDuplicateText: (id: string) => void;
  onDeleteText: (id: string) => void;
}

const TABS: { id: LeftTab; label: string; icon: React.ReactNode }[] = [
  { id: 'styles', label: 'Stili', icon: <Palette className="w-4 h-4" /> },
  { id: 'layers', label: 'Livelli', icon: <Layers className="w-4 h-4" /> },
  { id: 'audio', label: 'Audio', icon: <AudioLines className="w-4 h-4" /> },
];

export const LeftPanel: React.FC<LeftPanelProps> = (props) => {
  const { tab, onTab } = props;
  return (
    <div className="h-full flex flex-col bg-panel">
      <div className="shrink-0 p-2 border-b border-line">
        <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-bg border border-line" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => onTab(t.id)}
              className={cx(
                'h-8 rounded-md flex items-center justify-center gap-1.5 text-xs font-medium transition-colors',
                tab === t.id ? 'bg-raised text-fg shadow-[inset_0_0_0_1px_var(--color-line-strong)]' : 'text-faint hover:text-dim'
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'styles' && <StylesTab {...props} />}
        {tab === 'layers' && <LayersTab {...props} />}
        {tab === 'audio' && <AudioTab {...props} />}
      </div>
    </div>
  );
};

const Heading: React.FC<{ children: React.ReactNode; right?: React.ReactNode }> = ({ children, right }) => (
  <div className="flex items-center justify-between px-4 pt-4 pb-2">
    <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-dim">{children}</h3>
    {right}
  </div>
);

// ---------------------------------------------------------------- Styles

const StylesTab: React.FC<LeftPanelProps> = ({ config, onChangeConfig, onSelect, customPresets, activePresetId, onApplyPreset, onSavePreset, onDeletePreset }) => {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');

  const PresetCard = ({ p }: { p: Preset }) => {
    const sw = p.swatch || [p.config.primaryColor || '#fff', p.config.secondaryColor || '#888'];
    const active = activePresetId === p.id;
    return (
      <div
        className={cx(
          'group relative flex items-center gap-3 p-2 rounded-xl border transition-colors cursor-pointer',
          active ? 'border-acid/60 bg-acid/[0.06]' : 'border-line hover:border-line-strong hover:bg-raised'
        )}
        onClick={() => onApplyPreset(p)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onApplyPreset(p)}
      >
        <div
          className="w-11 h-11 rounded-lg shrink-0 flex items-center justify-center relative overflow-hidden"
          style={{ background: `radial-gradient(circle at 30% 30%, ${sw[0]}, ${sw[1]} 70%, #000 140%)` }}
        >
          <LayoutIcon layout={p.config.layoutStyle || 'classic-circle'} className="w-9 text-black/60" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-fg truncate flex items-center gap-1.5">
            {p.name}
            {active && <Check className="w-3.5 h-3.5 text-acid" />}
          </div>
          <div className="text-[11px] text-faint truncate">{p.tagline}</div>
        </div>
        {p.isCustom && (
          <IconButton
            size="sm"
            label="Elimina preset"
            className="opacity-0 group-hover:opacity-100 focus:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onDeletePreset(p.id);
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </IconButton>
        )}
      </div>
    );
  };

  return (
    <div className="pb-6">
      <Heading>Layout</Heading>
      <div className="grid grid-cols-2 gap-1.5 px-3">
        {LAYOUT_OPTIONS.map((l) => {
          const active = config.layoutStyle === l.id;
          return (
            <button
              key={l.id}
              title={l.hint}
              onClick={() => {
                onChangeConfig((p) => ({ ...p, layoutStyle: l.id }), { coalesce: false });
                onSelect({ type: 'visualizer' });
              }}
              className={cx(
                'flex flex-col items-center gap-1 pt-2 pb-1.5 rounded-xl border transition-all',
                active ? 'border-acid/70 bg-acid/[0.07] text-acid' : 'border-line text-dim hover:text-fg hover:border-line-strong hover:bg-raised'
              )}
            >
              <LayoutIcon layout={l.id} className="w-14 h-8" />
              <span className="text-[11px] font-medium">{l.name}</span>
            </button>
          );
        })}
      </div>

      <Heading
        right={
          !saving && (
            <button onClick={() => setSaving(true)} className="text-[11px] text-acid hover:underline flex items-center gap-1">
              <Bookmark className="w-3 h-3" /> Salva attuale
            </button>
          )
        }
      >
        Preset
      </Heading>
      {saving && (
        <form
          className="mx-3 mb-2 flex gap-1.5 animate-in"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            onSavePreset(name.trim());
            setName('');
            setSaving(false);
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome del preset…"
            maxLength={40}
            className="flex-1 min-w-0 h-8 px-2.5 rounded-lg bg-bg border border-line focus:border-acid/60 focus:outline-none text-xs"
          />
          <Button type="submit" variant="primary" size="md" disabled={!name.trim()}>
            Salva
          </Button>
          <IconButton label="Annulla" onClick={() => setSaving(false)}>
            <X className="w-3.5 h-3.5" />
          </IconButton>
        </form>
      )}
      <div className="px-3 space-y-1.5">
        {customPresets.length > 0 && (
          <>
            <div className="text-[10px] uppercase tracking-wider text-faint px-1 pt-1">I tuoi preset</div>
            {customPresets.map((p) => (
              <PresetCard key={p.id} p={p} />
            ))}
            <div className="text-[10px] uppercase tracking-wider text-faint px-1 pt-2">Integrati</div>
          </>
        )}
        {PRESETS.map((p) => (
          <PresetCard key={p.id} p={p} />
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- Layers

const SCENE_ITEMS: { type: Exclude<SelectionTarget['type'], 'text'>; label: string; icon: React.ReactNode }[] = [
  { type: 'visualizer', label: 'Visualizer', icon: <Waves className="w-4 h-4" /> },
  { type: 'logo', label: 'Logo / Copertina', icon: <Disc3 className="w-4 h-4" /> },
  { type: 'particles', label: 'Particelle', icon: <Sparkles className="w-4 h-4" /> },
  { type: 'effects', label: 'Effetti camera & FX', icon: <Wand2 className="w-4 h-4" /> },
  { type: 'background', label: 'Sfondo', icon: <ImageIcon className="w-4 h-4" /> },
];

const LayersTab: React.FC<LeftPanelProps> = ({ config, onChangeConfig, selection, onSelect, onAddText, onDuplicateText, onDeleteText }) => {
  const updateLayer = (id: string, patch: Partial<TextLayer>) =>
    onChangeConfig((p) => ({ ...p, textLayers: p.textLayers.map((l) => (l.id === id ? { ...l, ...patch } : l)) }), { coalesce: false });

  const move = (id: string, dir: -1 | 1) =>
    onChangeConfig(
      (p) => {
        const arr = [...p.textLayers];
        const i = arr.findIndex((l) => l.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= arr.length) return p;
        [arr[i], arr[j]] = [arr[j], arr[i]];
        return { ...p, textLayers: arr };
      },
      { coalesce: false }
    );

  // Text layers are drawn in array order; show top-most first.
  const texts = [...config.textLayers].reverse();

  return (
    <div className="pb-6">
      <Heading
        right={
          <button onClick={onAddText} className="text-[11px] text-acid hover:underline flex items-center gap-1">
            <Plus className="w-3 h-3" /> Aggiungi testo
          </button>
        }
      >
        Testi ({config.textLayers.length})
      </Heading>
      <div className="px-2 space-y-0.5">
        {texts.length === 0 && (
          <button onClick={onAddText} className="w-full p-4 rounded-xl border border-dashed border-line-strong text-xs text-faint hover:text-fg hover:border-acid/50 transition-colors">
            Nessun testo. Clicca per aggiungerne uno.
          </button>
        )}
        {texts.map((l, idx) => {
          const active = selection.type === 'text' && selection.layerId === l.id;
          return (
            <div
              key={l.id}
              onClick={() => onSelect({ type: 'text', layerId: l.id })}
              className={cx(
                'group flex items-center gap-2 h-11 pl-2.5 pr-1 rounded-lg cursor-pointer transition-colors',
                active ? 'bg-raised shadow-[inset_0_0_0_1px_var(--color-line-strong)]' : 'hover:bg-raised/60',
                !l.enabled && 'opacity-50'
              )}
            >
              <Type className={cx('w-4 h-4 shrink-0', active ? 'text-acid' : 'text-faint')} />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-fg truncate">{l.label}</div>
                <div className="text-[11px] text-faint truncate" style={{ fontFamily: l.fontFamily }}>
                  {l.text || '—'}
                </div>
              </div>
              <div className={cx('flex items-center', active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100')}>
                <IconButton size="sm" label="Sposta sopra" disabled={idx === 0} onClick={(e) => (e.stopPropagation(), move(l.id, 1))}>
                  <ChevronUp className="w-3.5 h-3.5" />
                </IconButton>
                <IconButton size="sm" label="Sposta sotto" disabled={idx === texts.length - 1} onClick={(e) => (e.stopPropagation(), move(l.id, -1))}>
                  <ChevronDown className="w-3.5 h-3.5" />
                </IconButton>
                <IconButton size="sm" label="Duplica" onClick={(e) => (e.stopPropagation(), onDuplicateText(l.id))}>
                  <Copy className="w-3.5 h-3.5" />
                </IconButton>
                <IconButton size="sm" label="Elimina" onClick={(e) => (e.stopPropagation(), onDeleteText(l.id))}>
                  <Trash2 className="w-3.5 h-3.5" />
                </IconButton>
              </div>
              <IconButton size="sm" label={l.isLocked ? 'Sblocca posizione' : 'Blocca posizione'} onClick={(e) => (e.stopPropagation(), updateLayer(l.id, { isLocked: !l.isLocked }))}>
                {l.isLocked ? <Lock className="w-3.5 h-3.5 text-acid" /> : <Unlock className="w-3.5 h-3.5" />}
              </IconButton>
              <IconButton size="sm" label={l.enabled ? 'Nascondi' : 'Mostra'} onClick={(e) => (e.stopPropagation(), updateLayer(l.id, { enabled: !l.enabled }))}>
                {l.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </IconButton>
            </div>
          );
        })}
      </div>

      <Heading>Scena</Heading>
      <div className="px-2 space-y-0.5">
        {SCENE_ITEMS.map((s) => {
          const active = selection.type === s.type;
          return (
            <button
              key={s.type}
              onClick={() => onSelect({ type: s.type } as SelectionTarget)}
              className={cx(
                'w-full flex items-center gap-2.5 h-10 px-2.5 rounded-lg text-left text-xs font-medium transition-colors',
                active ? 'bg-raised text-fg shadow-[inset_0_0_0_1px_var(--color-line-strong)]' : 'text-dim hover:bg-raised/60 hover:text-fg'
              )}
            >
              <span className={active ? 'text-acid' : 'text-faint'}>{s.icon}</span>
              {s.label}
            </button>
          );
        })}
      </div>
      <p className="px-4 pt-4 text-[11px] text-faint leading-relaxed">
        Suggerimento: clicca un elemento nell'anteprima per selezionarlo, trascinalo per spostarlo. Tieni premuto <kbd className="font-mono text-dim">Alt</kbd> per disattivare l'aggancio al centro.
      </p>
    </div>
  );
};

// ---------------------------------------------------------------- Audio

const SHORTCUTS: [string, string][] = [
  ['Spazio', 'Play / Pausa'],
  ['← →', 'Indietro / avanti 5s'],
  ['Home', "Torna all'inizio"],
  ['M', 'Muto'],
  ['L', 'Ripeti'],
  ['H', 'Vista pulita'],
  ['F', 'Schermo intero anteprima'],
  ['Ctrl Z / Ctrl ⇧ Z', 'Annulla / Ripeti modifica'],
  ['Canc', 'Elimina testo selezionato'],
  ['Ctrl E', 'Esporta video'],
];

const AudioTab: React.FC<LeftPanelProps> = ({ track, isLoadingAudio, onLoadDemo, onUploadAudio }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const buf = track.audioBuffer;
  return (
    <div className="pb-6">
      <Heading>Il tuo brano</Heading>
      <div className="px-3">
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUploadAudio(f);
            e.target.value = '';
          }}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={isLoadingAudio}
          className="w-full flex flex-col items-center gap-2 py-6 rounded-xl border border-dashed border-line-strong hover:border-acid/60 hover:bg-acid/[0.04] transition-colors group disabled:opacity-50"
        >
          <span className="w-10 h-10 rounded-full bg-raised border border-line flex items-center justify-center group-hover:text-acid transition-colors">
            <Upload className="w-4 h-4" />
          </span>
          <span className="text-xs font-medium text-fg">Carica un file audio</span>
          <span className="text-[11px] text-faint">MP3, WAV, FLAC, OGG, M4A · oppure trascinalo qui</span>
        </button>
        <p className="text-[11px] text-faint mt-2 leading-relaxed">L'audio resta nel tuo browser: niente viene caricato su server.</p>
      </div>

      <Heading>Brani demo</Heading>
      <div className="px-2 space-y-0.5">
        {DEMO_TRACKS_LIST.map((d) => {
          const active = track.id === d.id;
          return (
            <button
              key={d.id}
              onClick={() => onLoadDemo(d.id)}
              disabled={isLoadingAudio}
              className={cx(
                'w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors',
                active ? 'bg-raised shadow-[inset_0_0_0_1px_var(--color-line-strong)]' : 'hover:bg-raised/60'
              )}
            >
              <span className={cx('w-8 h-8 rounded-md flex items-center justify-center shrink-0', active ? 'bg-acid text-bg' : 'bg-raised text-dim')}>
                <Play className="w-3.5 h-3.5 fill-current" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-fg truncate">{d.title}</span>
                <span className="block text-[11px] text-faint truncate">
                  {d.genre} · {d.bpm} BPM
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {buf && (
        <>
          <Heading>Dettagli traccia</Heading>
          <dl className="mx-3 grid grid-cols-2 gap-px rounded-xl overflow-hidden border border-line bg-line text-xs">
            {[
              ['Durata', formatTime(buf.duration)],
              ['Sample rate', `${(buf.sampleRate / 1000).toFixed(1)} kHz`],
              ['Canali', buf.numberOfChannels === 1 ? 'Mono' : 'Stereo'],
              ['BPM', track.bpm ? String(track.bpm) : '—'],
            ].map(([k, v]) => (
              <div key={k} className="bg-panel px-3 py-2">
                <dt className="text-[10px] uppercase tracking-wider text-faint">{k}</dt>
                <dd className="font-mono text-fg mt-0.5">{v}</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      <Heading>
        <span className="flex items-center gap-1.5">
          <Keyboard className="w-3.5 h-3.5" /> Scorciatoie
        </span>
      </Heading>
      <ul className="px-4 space-y-1.5">
        {SHORTCUTS.map(([k, v]) => (
          <li key={k} className="flex items-center justify-between text-[11px]">
            <span className="text-dim">{v}</span>
            <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-raised border border-line text-fg/80">{k}</kbd>
          </li>
        ))}
      </ul>
    </div>
  );
};
