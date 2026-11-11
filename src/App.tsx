import React, { useCallback, useEffect, useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { AudioTrackInfo, ExportSettings, Preset, ProjectData, SelectionTarget, VisualizerConfig, aspectOfResolution } from './types/visualizer';
import { DEFAULT_CONFIG, createTextLayer, normalizeConfig } from './visualizer/presets';
import { audioEngine } from './audio/audioEngine';
import { DEMO_TRACKS_LIST, generateProceduralTrapTrack } from './audio/demoTracks';
import { useHistory } from './state/useHistory';
import { useToast } from './ui/toast';
import { cx } from './ui/controls';
import { TopBar } from './components/TopBar';
import { LeftPanel, LeftTab } from './components/LeftPanel';
import { Inspector } from './components/Inspector';
import { Stage } from './components/Stage';
import { Transport } from './components/Transport';
import { ExportDialog } from './components/ExportDialog';

const STORAGE_KEY = 'sonicvisual:project:v2';
const PRESETS_KEY = 'sonicvisual:presets:v2';
const LEGACY_PRESETS_KEY = 'trap_custom_presets';
const PROJECT_VERSION = '2.0.0';

const DEFAULT_EXPORT: ExportSettings = {
  resolution: '1080p',
  fps: 60,
  format: 'mp4',
  durationMode: 'full',
  bitrateMbps: 16,
  startFromPlayhead: false,
};

interface Saved {
  projectName: string;
  config: VisualizerConfig;
  exportSettings: ExportSettings;
}

function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Saved>;
    return {
      projectName: p.projectName || 'Il mio visual',
      config: normalizeConfig(p.config),
      exportSettings: { ...DEFAULT_EXPORT, ...(p.exportSettings || {}) },
    };
  } catch {
    return null;
  }
}

function loadPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY) ?? localStorage.getItem(LEGACY_PRESETS_KEY);
    const list = raw ? (JSON.parse(raw) as Preset[]) : [];
    return Array.isArray(list) ? list.filter((p) => p && p.id && p.config).map((p) => ({ ...p, isCustom: true })) : [];
  } catch {
    return [];
  }
}

const isUserImage = (url: string) => url.startsWith('data:') || url.startsWith('blob:');

function useMediaQuery(q: string) {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const h = () => setM(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [q]);
  return m;
}

export default function App() {
  const toast = useToast();
  const initial = useRef(loadSaved()).current;

  const history = useHistory<VisualizerConfig>(() => initial?.config ?? normalizeConfig(DEFAULT_CONFIG));
  const config = history.state;
  const [projectName, setProjectName] = useState(initial?.projectName ?? 'Il mio visual');
  const [exportSettings, setExportSettings] = useState<ExportSettings>(initial?.exportSettings ?? DEFAULT_EXPORT);
  const [customPresets, setCustomPresets] = useState<Preset[]>(loadPresets);
  const [activePresetId, setActivePresetId] = useState<string | null>(initial ? null : 'solar-crown');
  const [selection, setSelection] = useState<SelectionTarget>({ type: 'visualizer' });
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const isWide = useMediaQuery('(min-width: 1024px)');
  const [leftOpen, setLeftOpen] = useState(isWide);
  const [rightOpen, setRightOpen] = useState(isWide);
  const [leftTab, setLeftTab] = useState<LeftTab>('styles');
  const [cleanView, setCleanView] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const openFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLeftOpen(isWide);
    setRightOpen(isWide);
  }, [isWide]);

  // ---------------------------------------------------------------- config changes
  const changeConfig = useCallback(
    (updater: (prev: VisualizerConfig) => VisualizerConfig, opts?: { coalesce?: boolean }) => {
      history.set(updater, opts);
      setActivePresetId(null);
    },
    [history.set]
  );

  // ---------------------------------------------------------------- autosave
  useEffect(() => {
    const t = setTimeout(() => {
      const data: Saved = { projectName, config, exportSettings };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        setSavedAt(Date.now());
      } catch {
        // Quota exceeded (large uploaded images): save without embedded images
        try {
          const slim = {
            ...data,
            config: {
              ...config,
              logoUrl: isUserImage(config.logoUrl) ? DEFAULT_CONFIG.logoUrl : config.logoUrl,
              backgroundUrl: isUserImage(config.backgroundUrl) ? DEFAULT_CONFIG.backgroundUrl : config.backgroundUrl,
            },
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
          setSavedAt(Date.now());
        } catch {
          /* storage unavailable */
        }
      }
    }, 600);
    return () => clearTimeout(t);
  }, [projectName, config, exportSettings]);

  const persistPresets = (list: Preset[]) => {
    setCustomPresets(list);
    try {
      localStorage.setItem(PRESETS_KEY, JSON.stringify(list));
    } catch {
      toast('Spazio di archiviazione pieno: il preset è stato salvato solo per questa sessione.', 'error');
    }
  };

  // ---------------------------------------------------------------- presets
  const applyPreset = (preset: Preset) => {
    history.set(
      (prev) =>
        normalizeConfig({
          ...DEFAULT_CONFIG,
          ...preset.config,
          textLayers: prev.textLayers,
          logoUrl: isUserImage(prev.logoUrl) ? prev.logoUrl : preset.config.logoUrl ?? DEFAULT_CONFIG.logoUrl,
          backgroundUrl: isUserImage(prev.backgroundUrl) ? prev.backgroundUrl : preset.config.backgroundUrl ?? DEFAULT_CONFIG.backgroundUrl,
        }),
      { coalesce: false }
    );
    setActivePresetId(preset.id);
  };

  const savePreset = (name: string) => {
    const { textLayers: _omit, ...rest } = config;
    void _omit;
    const p: Preset = {
      id: `custom-${Date.now()}`,
      name,
      tagline: 'Preset personale',
      isCustom: true,
      swatch: [config.primaryColor, config.secondaryColor],
      config: rest,
    };
    persistPresets([p, ...customPresets]);
    setActivePresetId(p.id);
    toast(`Preset "${name}" salvato`, 'success');
  };

  // ---------------------------------------------------------------- audio
  const [track, setTrack] = useState<AudioTrackInfo>({
    id: DEMO_TRACKS_LIST[0].id,
    title: DEMO_TRACKS_LIST[0].title,
    artist: DEMO_TRACKS_LIST[0].artist,
    duration: DEMO_TRACKS_LIST[0].durationSeconds,
    bpm: DEMO_TRACKS_LIST[0].bpm,
    isCustom: false,
  });
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const demoCache = useRef(new Map<string, AudioBuffer>());

  const loadDemo = useCallback(
    async (id: string, autoplay = true) => {
      const meta = DEMO_TRACKS_LIST.find((d) => d.id === id);
      if (!meta) return;
      setIsLoadingAudio(true);
      try {
        let buf = demoCache.current.get(id);
        if (!buf) {
          buf = await generateProceduralTrapTrack(id);
          demoCache.current.set(id, buf);
        }
        audioEngine.setAudioBuffer(buf);
        setTrack({ id, title: meta.title, artist: meta.artist, duration: buf.duration, bpm: meta.bpm, isCustom: false, audioBuffer: buf });
        if (autoplay) audioEngine.play(0);
      } catch (e) {
        console.error(e);
        toast('Impossibile generare il brano demo in questo browser.', 'error');
      } finally {
        setIsLoadingAudio(false);
      }
    },
    [toast]
  );

  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    loadDemo(DEMO_TRACKS_LIST[0].id, false);
  }, [loadDemo]);

  const uploadAudio = async (file: File) => {
    if (!file.type.startsWith('audio/') && !/\.(mp3|wav|flac|ogg|m4a|aac|opus|webm)$/i.test(file.name)) {
      toast('Formato non supportato: carica un file audio (MP3, WAV, FLAC, OGG, M4A).', 'error');
      return;
    }
    setIsLoadingAudio(true);
    try {
      const buf = await audioEngine.decodeAudioFile(file);
      audioEngine.setAudioBuffer(buf);
      const clean = file.name.replace(/\.[^/.]+$/, '').replace(/[_]+/g, ' ').trim();
      setTrack({ id: `upload-${Date.now()}`, title: clean, artist: 'Brano caricato', duration: buf.duration, isCustom: true, audioBuffer: buf });
      // Put the file name into the title layer (first layer) as a convenience
      history.set(
        (prev) => ({
          ...prev,
          textLayers: prev.textLayers.map((l) => (l.id === 'track-title' ? { ...l, text: clean } : l)),
        }),
        { coalesce: false }
      );
      audioEngine.play(0);
      toast(`"${clean}" caricato`, 'success');
    } catch (e) {
      console.error(e);
      toast('Impossibile decodificare il file. Prova con un MP3 o WAV.', 'error');
    } finally {
      setIsLoadingAudio(false);
    }
  };

  // ---------------------------------------------------------------- text layers
  const addText = () => {
    const layer = createTextLayer({ label: `Testo ${config.textLayers.length + 1}`, y: 30 });
    history.set((p) => ({ ...p, textLayers: [...p.textLayers, layer] }), { coalesce: false });
    setSelection({ type: 'text', layerId: layer.id });
    setRightOpen(true);
  };
  const duplicateText = (id: string) => {
    const src = config.textLayers.find((l) => l.id === id);
    if (!src) return;
    const copy = createTextLayer({ ...src, id: undefined, label: `${src.label} (copia)`, x: Math.min(95, src.x + 3), y: Math.min(95, src.y + 4), isLocked: false });
    history.set(
      (p) => {
        const i = p.textLayers.findIndex((l) => l.id === id);
        const arr = [...p.textLayers];
        arr.splice(i + 1, 0, copy);
        return { ...p, textLayers: arr };
      },
      { coalesce: false }
    );
    setSelection({ type: 'text', layerId: copy.id });
  };
  const deleteText = (id: string) => {
    history.set((p) => ({ ...p, textLayers: p.textLayers.filter((l) => l.id !== id) }), { coalesce: false });
    if (selection.type === 'text' && selection.layerId === id) setSelection({ type: 'visualizer' });
    toast('Testo eliminato · Ctrl+Z per annullare', 'info');
  };

  // ---------------------------------------------------------------- project file
  const saveProjectFile = () => {
    const data: ProjectData = { version: PROJECT_VERSION, projectName, savedAt: new Date().toISOString(), config, exportSettings };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(projectName || 'progetto').replace(/[^\w\-]+/g, '_')}.sonic`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Progetto salvato su file', 'success');
  };

  const openProjectFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Partial<ProjectData>;
        if (!parsed || typeof parsed !== 'object' || !parsed.config) throw new Error('invalid');
        history.reset(normalizeConfig(parsed.config));
        if (parsed.projectName) setProjectName(parsed.projectName);
        if (parsed.exportSettings) setExportSettings({ ...DEFAULT_EXPORT, ...parsed.exportSettings });
        setSelection({ type: 'visualizer' });
        setActivePresetId(null);
        toast(`Progetto "${parsed.projectName || file.name}" aperto`, 'success');
      } catch {
        toast('Il file non è un progetto SonicVisual valido (.sonic / .json).', 'error');
      }
    };
    reader.readAsText(file);
  };

  const newProject = () => {
    if (!confirm('Creare un nuovo progetto? Le modifiche non salvate su file andranno perse (puoi comunque annullare con Ctrl+Z).')) return;
    history.set(() => normalizeConfig(DEFAULT_CONFIG), { coalesce: false });
    setProjectName('Il mio visual');
    setSelection({ type: 'visualizer' });
    setActivePresetId('solar-crown');
  };

  // ---------------------------------------------------------------- shortcuts
  const stateRef = useRef({ selection, exportOpen, deleteText, saveProjectFile });
  stateRef.current = { selection, exportOpen, deleteText, saveProjectFile };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      const mod = e.ctrlKey || e.metaKey;
      const { selection: sel, exportOpen: exp } = stateRef.current;

      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        stateRef.current.saveProjectFile();
        return;
      }
      if (mod && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        openFileRef.current?.click();
        return;
      }
      if (mod && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setExportOpen(true);
        return;
      }
      if (typing || exp) return;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) history.redo();
        else history.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        history.redo();
        return;
      }
      if (mod) return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          audioEngine.togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          audioEngine.seek(audioEngine.getCurrentTime() - 5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          audioEngine.seek(audioEngine.getCurrentTime() + 5);
          break;
        case 'Home':
          audioEngine.seek(0);
          break;
        case 'm':
        case 'M':
          audioEngine.toggleMute();
          break;
        case 'l':
        case 'L':
          audioEngine.toggleLoop();
          break;
        case 'h':
        case 'H':
          setCleanView((v) => !v);
          break;
        case 'f':
        case 'F': {
          const btn = document.querySelector<HTMLButtonElement>('[aria-label^="Schermo intero"]');
          btn?.click();
          break;
        }
        case 'Delete':
        case 'Backspace':
          if (sel.type === 'text') {
            e.preventDefault();
            stateRef.current.deleteText(sel.layerId);
          }
          break;
        case 'Escape':
          setSelection({ type: 'visualizer' });
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [history.undo, history.redo]);

  // ---------------------------------------------------------------- drag & drop
  const dragDepth = useRef(0);
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (/\.(sonic|json)$/i.test(f.name)) openProjectFile(f);
    else uploadAudio(f);
  };

  const select = (s: SelectionTarget) => {
    setSelection(s);
    if (!isWide && s.type !== selection.type) setRightOpen(true);
  };

  const aspect = aspectOfResolution(exportSettings.resolution);

  const leftPanel = (
    <LeftPanel
      tab={leftTab}
      onTab={setLeftTab}
      config={config}
      onChangeConfig={changeConfig}
      selection={selection}
      onSelect={select}
      customPresets={customPresets}
      activePresetId={activePresetId}
      onApplyPreset={applyPreset}
      onSavePreset={savePreset}
      onDeletePreset={(id) => persistPresets(customPresets.filter((p) => p.id !== id))}
      track={track}
      isLoadingAudio={isLoadingAudio}
      onLoadDemo={(id) => loadDemo(id)}
      onUploadAudio={uploadAudio}
      onAddText={addText}
      onDuplicateText={duplicateText}
      onDeleteText={deleteText}
    />
  );

  const inspector = (
    <Inspector
      config={config}
      selection={selection}
      onChangeConfig={changeConfig}
      onSelect={setSelection}
      onDuplicateText={duplicateText}
      onDeleteText={deleteText}
      onClose={isWide ? undefined : () => setRightOpen(false)}
    />
  );

  return (
    <div
      className="h-full w-full flex flex-col bg-bg text-fg select-none"
      onDragEnter={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        dragDepth.current++;
        setDragOver(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragOver(false);
      }}
      onDrop={onDrop}
    >
      <input
        ref={openFileRef}
        type="file"
        accept=".sonic,.json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) openProjectFile(f);
          e.target.value = '';
        }}
      />

      {dragOver && (
        <div className="fixed inset-3 z-[80] rounded-3xl border-2 border-dashed border-acid bg-bg/85 backdrop-blur-md flex flex-col items-center justify-center gap-3 pointer-events-none animate-in">
          <UploadCloud className="w-12 h-12 text-acid" />
          <div className="font-display text-2xl font-bold">Rilascia per caricare</div>
          <div className="text-sm text-dim">Audio (MP3, WAV, FLAC, OGG, M4A) o progetto .sonic</div>
        </div>
      )}

      <TopBar
        projectName={projectName}
        onProjectName={setProjectName}
        savedAt={savedAt}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={history.undo}
        onRedo={history.redo}
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        onToggleLeft={() => setLeftOpen((v) => !v)}
        onToggleRight={() => setRightOpen((v) => !v)}
        cleanView={cleanView}
        onToggleClean={() => setCleanView((v) => !v)}
        onNew={newProject}
        onOpen={() => openFileRef.current?.click()}
        onSave={saveProjectFile}
        onExport={() => setExportOpen(true)}
      />

      <div className="flex-1 min-h-0 flex relative">
        {/* Left panel: docked on desktop, drawer on small screens */}
        {isWide ? (
          leftOpen && <aside className="w-[300px] shrink-0 border-r border-line">{leftPanel}</aside>
        ) : (
          <>
            <div className={cx('fixed inset-0 top-14 bottom-[72px] z-40 bg-black/60 transition-opacity', leftOpen ? 'opacity-100' : 'opacity-0 pointer-events-none')} onClick={() => setLeftOpen(false)} />
            <aside className={cx('fixed top-14 bottom-[72px] left-0 z-40 w-[min(320px,88vw)] border-r border-line transition-transform duration-200', leftOpen ? 'translate-x-0' : '-translate-x-full')}>
              {leftPanel}
            </aside>
          </>
        )}

        <main className="flex-1 min-w-0 flex flex-col">
          <Stage config={config} aspect={aspect} selection={selection} onSelect={select} onChangeConfig={(u) => changeConfig(u)} cleanView={cleanView} />
        </main>

        {isWide ? (
          rightOpen && <aside className="w-[320px] shrink-0 border-l border-line">{inspector}</aside>
        ) : (
          <>
            <div className={cx('fixed inset-0 top-14 bottom-[72px] z-40 bg-black/60 transition-opacity', rightOpen ? 'opacity-100' : 'opacity-0 pointer-events-none')} onClick={() => setRightOpen(false)} />
            <aside className={cx('fixed top-14 bottom-[72px] right-0 z-40 w-[min(340px,92vw)] border-l border-line transition-transform duration-200', rightOpen ? 'translate-x-0' : 'translate-x-full')}>
              {inspector}
            </aside>
          </>
        )}
      </div>

      <Transport track={track} isLoading={isLoadingAudio} accent="#c6ff3a" />

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        config={config}
        settings={exportSettings}
        onChangeSettings={setExportSettings}
        projectName={projectName}
      />
    </div>
  );
}
