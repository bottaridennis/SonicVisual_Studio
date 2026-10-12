import React, { useState, useEffect, useCallback } from 'react';
import {
  VisualizerConfig,
  ExportSettings,
  AudioTrackInfo,
  Preset,
  ProjectData,
  SelectionTarget,
} from './types/visualizer';
import { DEFAULT_CONFIG, PRESETS } from './visualizer/presets';
import { Header } from './components/Header';
import { SidebarLeft, LeftTabId } from './components/SidebarLeft';
import { VisualizerCanvas } from './components/VisualizerCanvas';
import { TimelineBottom } from './components/TimelineBottom';
import { Inspector } from './components/Inspector/Inspector';
import { ExportModal } from './components/ExportModal';
import { audioEngine } from './audio/audioEngine';
import { generateProceduralTrapTrack, DEMO_TRACKS_LIST } from './audio/demoTracks';
import { UploadCloud } from 'lucide-react';

export default function App() {
  const [config, setConfig] = useState<VisualizerConfig>(DEFAULT_CONFIG);
  const [projectName, setProjectName] = useState<string>('Sonic Visual Project #1');
  const [customPresets, setCustomPresets] = useState<Preset[]>([]);

  // Selection target state for contextual editing
  const [selection, setSelection] = useState<SelectionTarget>({ type: 'visualizer' });

  // Workspace layout panel states (inspired by CapCut & Premiere Pro)
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [activeLeftTab, setActiveLeftTab] = useState<LeftTabId>('visualizer');
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [isCleanView, setIsCleanView] = useState(false);

  // Video Export Settings & Modal
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    resolution: '1080p',
    fps: 60,
    format: 'mp4',
    durationMode: 'full',
    bitrateMbps: 25,
  });
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Audio track state
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const [currentTrack, setCurrentTrack] = useState<AudioTrackInfo>({
    id: DEMO_TRACKS_LIST[0].id,
    title: DEMO_TRACKS_LIST[0].title,
    artist: DEMO_TRACKS_LIST[0].artist,
    duration: DEMO_TRACKS_LIST[0].durationSeconds,
    isCustom: false,
    bpm: DEMO_TRACKS_LIST[0].bpm,
  });

  // Load custom presets from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('trap_custom_presets');
      if (stored) {
        setCustomPresets(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Could not read presets from localStorage', e);
    }
  }, []);

  const handleSavePreset = (name: string) => {
    const newPreset: Preset = {
      id: `custom-${Date.now()}`,
      name,
      tagline: 'Preset Personalizzato',
      isCustom: true,
      config: { ...config },
    };
    const updated = [newPreset, ...customPresets];
    setCustomPresets(updated);
    try {
      localStorage.setItem('trap_custom_presets', JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not save preset', e);
    }
  };

  const handleDeleteCustomPreset = (id: string) => {
    const updated = customPresets.filter((p) => p.id !== id);
    setCustomPresets(updated);
    try {
      localStorage.setItem('trap_custom_presets', JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not delete preset', e);
    }
  };

  // Load default procedural demo track on initial load
  useEffect(() => {
    let isCancelled = false;
    async function loadInitialTrack() {
      setIsLoadingAudio(true);
      try {
        const buffer = await generateProceduralTrapTrack('trap-overdrive');
        if (!isCancelled) {
          audioEngine.setAudioBuffer(buffer);
          setCurrentTrack((prev) => ({
            ...prev,
            duration: buffer.duration,
            audioBuffer: buffer,
          }));
        }
      } catch (e) {
        console.error('Failed to generate initial procedural track', e);
      } finally {
        if (!isCancelled) {
          setIsLoadingAudio(false);
        }
      }
    }

    loadInitialTrack();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Handle preset application
  const handleApplyPreset = (preset: Preset) => {
    setConfig((prev) => ({
      ...prev,
      ...preset.config,
    }));
  };

  // Handle project loading from JSON / .sonic file
  const handleLoadProject = (project: ProjectData) => {
    if (project.projectName) setProjectName(project.projectName);
    if (project.config) setConfig(project.config);
    if (project.exportSettings) setExportSettings(project.exportSettings);
  };

  // Handle project reset
  const handleResetProject = () => {
    if (confirm('Sei sicuro di voler ripristinare il progetto alla configurazione iniziale?')) {
      setConfig(DEFAULT_CONFIG);
      setProjectName('Sonic Visual Project #1');
      setSelection({ type: 'visualizer' });
    }
  };

  // Handle audio file upload (MP3, WAV, FLAC, etc.)
  const handleUploadTrack = async (file: File) => {
    setIsLoadingAudio(true);
    try {
      const buffer = await audioEngine.decodeAudioFile(file);
      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      const newTrack: AudioTrackInfo = {
        id: `custom-${Date.now()}`,
        title: cleanName.toUpperCase(),
        artist: 'CUSTOM AUDIO // USER UPLOAD',
        duration: buffer.duration,
        isCustom: true,
        audioBuffer: buffer,
      };

      setCurrentTrack(newTrack);
      setConfig((prev) => {
        const updatedLayers = (prev.textLayers || []).map((layer, idx) => {
          if (idx === 0) return { ...layer, text: cleanName.toUpperCase() };
          if (idx === 1) return { ...layer, text: 'CUSTOM AUDIO // USER UPLOAD' };
          return layer;
        });
        return {
          ...prev,
          trackTitle: cleanName.toUpperCase(),
          artistName: 'CUSTOM AUDIO // USER UPLOAD',
          textLayers: updatedLayers,
        };
      });

      // Auto start playback
      audioEngine.play(0);
    } catch (err) {
      console.error('Error decoding uploaded audio file:', err);
      alert('Impossibile decodificare il file audio. Assicurati che sia un MP3 o WAV valido.');
    } finally {
      setIsLoadingAudio(false);
    }
  };

  // Drag and drop audio files onto workspace
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleUploadTrack(files[0]);
    }
  };

  // Global keyboard shortcuts (Space, Arrow keys, M, L)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'SELECT'
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        audioEngine.togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        audioEngine.seek(Math.max(0, audioEngine.getCurrentTime() - 5));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        audioEngine.seek(Math.min(audioEngine.getDuration(), audioEngine.getCurrentTime() + 5));
      } else if (e.key === 'm' || e.key === 'M') {
        audioEngine.toggleMute();
      } else if (e.key === 'l' || e.key === 'L') {
        audioEngine.toggleLoop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const activeTextLayerId =
    selection.type === 'text' ? selection.layerId : config.textLayers?.[0]?.id;

  return (
    <div
      className="h-screen w-screen bg-[#07090e] text-slate-100 flex flex-col font-['Outfit'] select-none overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Visual Overlay */}
      {isDragOver && (
        <div className="fixed inset-0 z-50 bg-violet-950/70 backdrop-blur-md border-4 border-dashed border-violet-400 flex flex-col items-center justify-center pointer-events-none">
          <UploadCloud className="w-16 h-16 text-cyan-300 animate-bounce mb-3" />
          <h2 className="text-2xl font-bold text-white">Rilascia il File Audio Qui</h2>
          <p className="text-sm text-cyan-200">Supporta MP3, WAV, FLAC, OGG, M4A</p>
        </div>
      )}

      {/* Top Workstation Header */}
      <Header
        projectName={projectName}
        onProjectNameChange={setProjectName}
        config={config}
        exportSettings={exportSettings}
        onLoadProject={handleLoadProject}
        onResetProject={handleResetProject}
        onOpenExport={() => setIsExportModalOpen(true)}
        isLeftPanelOpen={isLeftPanelOpen}
        onToggleLeftPanel={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
        isRightPanelOpen={isRightPanelOpen}
        onToggleRightPanel={() => setIsRightPanelOpen(!isRightPanelOpen)}
        isCleanView={isCleanView}
        onToggleCleanView={() => setIsCleanView(!isCleanView)}
        onQuickSavePreset={() => handleSavePreset(`${projectName} Preset`)}
      />

      {/* Main Creative Workstation Area (3 Columns: Left Tools, Center Preview, Right Inspector) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Column: Navigator & Tool Drawer */}
        <SidebarLeft
          activeTab={activeLeftTab}
          onSelectTab={setActiveLeftTab}
          isOpen={isLeftPanelOpen}
          onToggleOpen={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
          config={config}
          onChangeConfig={setConfig}
          currentTrack={currentTrack}
          onTrackChange={setCurrentTrack}
          onUploadTrack={handleUploadTrack}
          isLoadingAudio={isLoadingAudio}
          customPresets={customPresets}
          onApplyPreset={handleApplyPreset}
          onSavePreset={handleSavePreset}
          onDeleteCustomPreset={handleDeleteCustomPreset}
          selection={selection}
          onSelectTarget={setSelection}
        />

        {/* Center Column: Viewport Video Preview */}
        <div className="flex-1 flex flex-col h-full bg-[#05060a] relative overflow-hidden">
          <VisualizerCanvas
            config={config}
            selection={selection}
            onSelectTarget={setSelection}
            selectedTextLayerId={activeTextLayerId}
            onSelectTextLayer={(layerId) => setSelection({ type: 'text', layerId })}
            onChangeConfig={setConfig}
            isCleanView={isCleanView}
          />
        </div>

        {/* Right Column: Contextual Inspector Panel */}
        {isRightPanelOpen && (
          <div className="w-80 sm:w-92 h-full shrink-0 flex flex-col z-20">
            <Inspector
              config={config}
              selection={selection}
              onSelectTarget={setSelection}
              selectedTextLayerId={activeTextLayerId}
              onSelectTextLayer={(layerId) => setSelection({ type: 'text', layerId })}
              onChangeConfig={setConfig}
              exportSettings={exportSettings}
              onChangeExportSettings={setExportSettings}
              onOpenExportModal={() => setIsExportModalOpen(true)}
              customPresets={customPresets}
              onSavePreset={handleSavePreset}
              onDeleteCustomPreset={handleDeleteCustomPreset}
              onClose={() => setIsRightPanelOpen(false)}
            />
          </div>
        )}
      </div>

      {/* Bottom Timeline & DAW Playback Transport Bar */}
      <TimelineBottom
        currentTrack={currentTrack}
        onTrackChange={setCurrentTrack}
        onUploadTrack={handleUploadTrack}
        isLoadingAudio={isLoadingAudio}
        onOpenAudioDrawer={() => {
          setActiveLeftTab('audio');
          setIsLeftPanelOpen(true);
        }}
      />

      {/* Video Rendering and Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        config={config}
        exportSettings={exportSettings}
      />
    </div>
  );
}
