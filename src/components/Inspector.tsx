import React, { useRef } from 'react';
import {
  Waves,
  Disc3,
  Sparkles,
  Image as ImageIcon,
  Wand2,
  Type,
  Upload,
  Ban,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  CaseUpper,
  Lock,
  Unlock,
  Copy,
  Trash2,
  X,
  RotateCcw,
} from 'lucide-react';
import { SelectionTarget, TextLayer, VisualizerConfig, TextFontFamily } from '../types/visualizer';
import { BUILTIN_IMAGES, DEFAULT_CONFIG, LAYOUT_OPTIONS } from '../visualizer/presets';
import { Section, Slider, Toggle, Segmented, Select, ColorField, Grid2, IconButton, Button, FieldLabel, cx } from '../ui/controls';
import { imageFileToDataUrl } from '../ui/imageUtils';
import { useToast } from '../ui/toast';

type ChangeFn = (updater: (prev: VisualizerConfig) => VisualizerConfig, opts?: { coalesce?: boolean }) => void;

interface InspectorProps {
  config: VisualizerConfig;
  selection: SelectionTarget;
  onChangeConfig: ChangeFn;
  onSelect: (s: SelectionTarget) => void;
  onDuplicateText: (id: string) => void;
  onDeleteText: (id: string) => void;
  onClose?: () => void;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const fx = (n: number) => (v: number) => v.toFixed(n);

export const Inspector: React.FC<InspectorProps> = ({ config, selection, onChangeConfig, onSelect, onDuplicateText, onDeleteText, onClose }) => {
  const set = <K extends keyof VisualizerConfig>(key: K, value: VisualizerConfig[K], coalesce = true) =>
    onChangeConfig((p) => ({ ...p, [key]: value }), { coalesce });

  const layer = selection.type === 'text' ? config.textLayers.find((l) => l.id === selection.layerId) : undefined;

  const meta: Record<SelectionTarget['type'], { title: string; icon: React.ReactNode }> = {
    visualizer: { title: 'Visualizer', icon: <Waves className="w-4 h-4" /> },
    logo: { title: 'Logo / Copertina', icon: <Disc3 className="w-4 h-4" /> },
    particles: { title: 'Particelle', icon: <Sparkles className="w-4 h-4" /> },
    background: { title: 'Sfondo', icon: <ImageIcon className="w-4 h-4" /> },
    effects: { title: 'Effetti & Camera', icon: <Wand2 className="w-4 h-4" /> },
    text: { title: layer?.label || 'Testo', icon: <Type className="w-4 h-4" /> },
  };
  const m = meta[selection.type];

  const quickTabs: { type: Exclude<SelectionTarget['type'], 'text'>; icon: React.ReactNode; label: string }[] = [
    { type: 'visualizer', icon: <Waves className="w-3.5 h-3.5" />, label: 'Visualizer' },
    { type: 'logo', icon: <Disc3 className="w-3.5 h-3.5" />, label: 'Logo' },
    { type: 'particles', icon: <Sparkles className="w-3.5 h-3.5" />, label: 'Particelle' },
    { type: 'effects', icon: <Wand2 className="w-3.5 h-3.5" />, label: 'Effetti' },
    { type: 'background', icon: <ImageIcon className="w-3.5 h-3.5" />, label: 'Sfondo' },
  ];

  return (
    <div className="h-full flex flex-col bg-panel">
      <div className="shrink-0 border-b border-line">
        <div className="flex items-center gap-2.5 h-12 px-4">
          <span className="w-7 h-7 rounded-lg bg-raised border border-line flex items-center justify-center text-acid">{m.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[0.14em] text-faint">Proprietà</div>
            <div className="text-[13px] font-semibold text-fg truncate -mt-0.5">{m.title}</div>
          </div>
          {onClose && (
            <IconButton label="Chiudi pannello" onClick={onClose}>
              <X className="w-4 h-4" />
            </IconButton>
          )}
        </div>
        <div className="flex gap-0.5 px-2 pb-2">
          {quickTabs.map((t) => (
            <button
              key={t.type}
              title={t.label}
              aria-label={t.label}
              onClick={() => onSelect({ type: t.type } as SelectionTarget)}
              className={cx(
                'flex-1 h-7 rounded-md flex items-center justify-center transition-colors',
                selection.type === t.type ? 'bg-raised text-acid shadow-[inset_0_0_0_1px_var(--color-line-strong)]' : 'text-faint hover:text-fg hover:bg-hover'
              )}
            >
              {t.icon}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto" key={selection.type === 'text' ? selection.layerId : selection.type}>
        {selection.type === 'visualizer' && <VisualizerProps config={config} set={set} />}
        {selection.type === 'logo' && <LogoProps config={config} set={set} />}
        {selection.type === 'particles' && <ParticleProps config={config} set={set} />}
        {selection.type === 'background' && <BackgroundProps config={config} set={set} />}
        {selection.type === 'effects' && <EffectsProps config={config} set={set} />}
        {selection.type === 'text' &&
          (layer ? (
            <TextProps layer={layer} onChangeConfig={onChangeConfig} onDuplicate={() => onDuplicateText(layer.id)} onDelete={() => onDeleteText(layer.id)} />
          ) : (
            <div className="p-6 text-center text-xs text-faint">Il testo selezionato non esiste più.</div>
          ))}
      </div>
    </div>
  );
};

type SetFn = <K extends keyof VisualizerConfig>(key: K, value: VisualizerConfig[K], coalesce?: boolean) => void;

// ---------------------------------------------------------------- Visualizer

const VisualizerProps: React.FC<{ config: VisualizerConfig; set: SetFn }> = ({ config: c, set }) => {
  const isCircle = c.layoutStyle === 'classic-circle';
  const isRadial = ['classic-circle', 'turntable-vinyl', 'minimal'].includes(c.layoutStyle);
  const usesBottom = c.layoutStyle === 'bottom-bars' || c.layoutStyle === 'full-width';
  const hasBars = c.layoutStyle !== 'particles-only' && c.layoutStyle !== 'album-art-pulse';
  return (
    <>
      <Section title="Stile">
        <Select label="Layout" value={c.layoutStyle} options={LAYOUT_OPTIONS.map((l) => ({ value: l.id, label: `${l.name} — ${l.hint}` }))} onChange={(v) => set('layoutStyle', v, false)} />
        {isCircle && (
          <Select
            label="Forma dell'onda"
            value={c.waveStyle}
            options={[
              { value: 'bars', label: 'Barre radiali' },
              { value: 'smooth-curve', label: 'Curva fluida' },
              { value: 'mirror-bars', label: 'Doppio anello' },
              { value: 'dots', label: 'Punti neon' },
              { value: 'radial-spikes', label: 'Picchi a stella' },
            ]}
            onChange={(v) => set('waveStyle', v, false)}
          />
        )}
        {c.layoutStyle === 'bottom-bars' && (
          <Segmented
            label="Resa barre"
            value={c.waveStyle === 'dots' ? 'dots' : 'bars'}
            options={[
              { value: 'bars', label: 'Piene' },
              { value: 'dots', label: 'LED a segmenti' },
            ]}
            onChange={(v) => set('waveStyle', v, false)}
          />
        )}
        {c.layoutStyle === 'horizontal-wave' && (
          <Segmented
            label="Posizione verticale"
            value={c.waveVerticalPosition}
            options={[
              { value: 'top', label: 'Alto' },
              { value: 'center', label: 'Centro' },
              { value: 'bottom', label: 'Basso' },
            ]}
            onChange={(v) => set('waveVerticalPosition', v, false)}
          />
        )}
      </Section>

      <Section title="Colori">
        <Grid2>
          <ColorField label="Primario" value={c.primaryColor} onChange={(v) => set('primaryColor', v)} />
          <ColorField label="Secondario" value={c.secondaryColor} onChange={(v) => set('secondaryColor', v)} />
        </Grid2>
        <ColorField label="Bagliore" value={c.glowColor} onChange={(v) => set('glowColor', v)} />
        <Slider label="Intensità bagliore" value={c.glowIntensity} min={0} max={50} onChange={(v) => set('glowIntensity', v)} />
        <Slider label="Ciclo colori automatico" value={c.colorCycleSpeed} min={0} max={90} format={(v) => (v ? `${v}°/s` : 'Off')} onChange={(v) => set('colorCycleSpeed', v)} />
      </Section>

      {hasBars && (
        <Section title="Geometria">
          <Slider label="Numero di barre / punti" value={c.barCount} min={16} max={256} step={2} onChange={(v) => set('barCount', v)} />
          <Slider label="Altezza" value={c.barHeightMultiplier} min={0.3} max={3} step={0.05} format={fx(2)} onChange={(v) => set('barHeightMultiplier', v)} />
          <Slider label="Spessore" value={c.barWidth} min={1} max={14} step={0.5} format={fx(1)} onChange={(v) => set('barWidth', v)} />
          {isRadial && (
            <Slider label="Raggio interno" value={c.innerRadiusRatio} min={0.1} max={0.42} step={0.01} format={pct} onChange={(v) => set('innerRadiusRatio', v)} />
          )}
          {(isCircle || c.layoutStyle === 'bottom-bars' || c.layoutStyle === 'mirror-bars') && (
            <Slider label="Altezza massima" value={c.maxBarHeightRatio} min={0.1} max={0.6} step={0.01} format={pct} onChange={(v) => set('maxBarHeightRatio', v)} />
          )}
          {usesBottom && (
            <Slider label="Distanza dal fondo" value={c.bottomOffsetPercent} min={0} max={40} format={(v) => `${v}%`} onChange={(v) => set('bottomOffsetPercent', v)} />
          )}
        </Section>
      )}

      <Section title="Posizione & scala">
        <Slider label="Scala" value={c.visualizerScale} min={0.4} max={2} step={0.01} format={pct} onChange={(v) => set('visualizerScale', v)} />
        <Grid2>
          <Slider label="X" value={c.visualizerX} min={0} max={100} step={0.5} format={(v) => `${v}%`} onChange={(v) => set('visualizerX', v)} />
          <Slider label="Y" value={c.visualizerY} min={0} max={100} step={0.5} format={(v) => `${v}%`} onChange={(v) => set('visualizerY', v)} />
        </Grid2>
      </Section>

      <Section title="Reattività">
        <Slider label="Morbidezza (rilascio)" value={c.smoothing} min={0} max={0.95} step={0.01} format={pct} onChange={(v) => set('smoothing', v)} />
        {(isCircle || c.layoutStyle === 'mirror-bars') && (
          <Toggle label="Spettro specchiato" hint="Bassi agli estremi, simmetrico" checked={c.mirrorWave} onChange={(v) => set('mirrorWave', v, false)} />
        )}
        {isCircle && (
          <>
            <Toggle label="Blocca colature in basso" hint="Attenua le barre rivolte verso il basso" checked={c.preventDownwardBleed} onChange={(v) => set('preventDownwardBleed', v, false)} />
            <Segmented
              label="Direzione barre"
              size="sm"
              value={c.clampingMode}
              options={[
                { value: 'outward-only', label: 'Esterno' },
                { value: 'symmetric', label: 'Simmetrico' },
                { value: 'contained', label: 'Contenuto' },
              ]}
              onChange={(v) => set('clampingMode', v, false)}
            />
          </>
        )}
        {c.layoutStyle === 'turntable-vinyl' && (
          <>
            <Slider label="Velocità rotazione" value={c.turntableRotationSpeed} min={0} max={4} step={0.1} format={(v) => `${v.toFixed(1)}×`} onChange={(v) => set('turntableRotationSpeed', v)} />
            <Toggle label="Bordo luminoso" checked={c.turntableGrooveGlow} onChange={(v) => set('turntableGrooveGlow', v, false)} />
          </>
        )}
      </Section>
    </>
  );
};

// ---------------------------------------------------------------- Image picker

const ImagePicker: React.FC<{
  label: string;
  value: string;
  options: { url: string; label: string }[];
  allowNone?: boolean;
  onChange: (url: string) => void;
}> = ({ label, value, options, allowNone, onChange }) => {
  const ref = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const isCustom = !!value && !options.some((o) => o.url === value);
  const tile = 'relative aspect-square rounded-lg overflow-hidden border transition-all';
  return (
    <div>
      <FieldLabel label={label} />
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            onChange(await imageFileToDataUrl(f));
            toast('Immagine caricata', 'success');
          } catch (err) {
            toast(err instanceof Error ? err.message : 'Errore immagine', 'error');
          }
        }}
      />
      <div className="grid grid-cols-4 gap-1.5">
        {options.map((o) => (
          <button
            key={o.url}
            title={o.label}
            onClick={() => onChange(o.url)}
            className={cx(tile, value === o.url ? 'border-acid ring-1 ring-acid' : 'border-line hover:border-line-strong')}
          >
            <img src={o.url} alt={o.label} className="w-full h-full object-cover" />
          </button>
        ))}
        {isCustom && (
          <button title="Immagine caricata" className={cx(tile, 'border-acid ring-1 ring-acid')}>
            <img src={value} alt="Immagine personalizzata" className="w-full h-full object-cover" />
          </button>
        )}
        <button onClick={() => ref.current?.click()} title="Carica immagine" className={cx(tile, 'border-dashed border-line-strong hover:border-acid/60 text-faint hover:text-acid flex flex-col items-center justify-center gap-0.5')}>
          <Upload className="w-4 h-4" />
          <span className="text-[9px]">Carica</span>
        </button>
        {allowNone && (
          <button onClick={() => onChange('')} title="Nessuna immagine" className={cx(tile, !value ? 'border-acid ring-1 ring-acid text-acid' : 'border-line text-faint hover:text-fg', 'flex items-center justify-center')}>
            <Ban className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- Logo

const LogoProps: React.FC<{ config: VisualizerConfig; set: SetFn }> = ({ config: c, set }) => (
  <>
    <Section title="Immagine">
      <ImagePicker
        label="Logo o copertina"
        value={c.logoUrl}
        allowNone
        options={[
          { url: BUILTIN_IMAGES.emblem, label: 'Emblema' },
          { url: BUILTIN_IMAGES.cyber, label: 'Cyber' },
        ]}
        onChange={(v) => set('logoUrl', v, false)}
      />
      <p className="text-[11px] text-faint leading-relaxed">Usata al centro del cerchio, sull'etichetta del vinile e come copertina nel layout "Cover".</p>
    </Section>
    <Section title="Forma & bordo">
      <Segmented
        label="Forma"
        size="sm"
        value={c.logoShape}
        options={[
          { value: 'circle', label: 'Cerchio' },
          { value: 'ring', label: 'Anello' },
          { value: 'rounded-square', label: 'Quadrato' },
          { value: 'hexagon', label: 'Esagono' },
        ]}
        onChange={(v) => set('logoShape', v, false)}
      />
      <Slider label="Spessore bordo" value={c.logoBorderWidth} min={0} max={16} step={0.5} onChange={(v) => set('logoBorderWidth', v)} />
      <ColorField label="Colore bordo" value={c.logoBorderColor} onChange={(v) => set('logoBorderColor', v)} />
    </Section>
    <Section title="Animazione">
      <Slider label="Pulsazione sui bassi" value={c.logoPulseIntensity} min={0} max={0.5} step={0.01} format={pct} onChange={(v) => set('logoPulseIntensity', v)} />
      <Toggle label="Rotazione continua" checked={c.logoSpin} onChange={(v) => set('logoSpin', v, false)} />
    </Section>
  </>
);

// ---------------------------------------------------------------- Particles

const ParticleProps: React.FC<{ config: VisualizerConfig; set: SetFn }> = ({ config: c, set }) => (
  <>
    <Section title="Emissione">
      <Slider label="Quantità" value={c.particleCount} min={0} max={800} step={10} onChange={(v) => set('particleCount', v)} />
      <Segmented
        label="Movimento"
        value={c.particleDispersion}
        options={[
          { value: 'radial', label: 'Radiale' },
          { value: 'upward', label: 'Verso l’alto' },
          { value: 'ambient', label: 'Fluttuante' },
        ]}
        onChange={(v) => set('particleDispersion', v, false)}
      />
      <Grid2>
        <Slider label="Velocità min" value={c.particleMinSpeed} min={0} max={6} step={0.1} format={fx(1)} onChange={(v) => set('particleMinSpeed', Math.min(v, c.particleMaxSpeed))} />
        <Slider label="Velocità max" value={c.particleMaxSpeed} min={0} max={8} step={0.1} format={fx(1)} onChange={(v) => set('particleMaxSpeed', Math.max(v, c.particleMinSpeed))} />
      </Grid2>
      <Slider label="Spinta sui kick" value={c.particleBassImpact} min={0} max={30} step={0.5} format={fx(1)} onChange={(v) => set('particleBassImpact', v)} />
    </Section>
    <Section title="Aspetto">
      <ColorField label="Colore" value={c.particleColor} onChange={(v) => set('particleColor', v)} />
      <Slider label="Dimensione" value={c.particleSize} min={0.5} max={8} step={0.1} format={fx(1)} onChange={(v) => set('particleSize', v)} />
      <Slider label="Opacità" value={c.particleOpacity} min={0.05} max={1} step={0.01} format={pct} onChange={(v) => set('particleOpacity', v)} />
      <Toggle label="Bagliore additivo" checked={c.particleGlow} onChange={(v) => set('particleGlow', v, false)} />
      <Toggle label="Scintillio" hint="Lampeggio casuale e reazione agli alti" checked={c.particleSparkle} onChange={(v) => set('particleSparkle', v, false)} />
    </Section>
  </>
);

// ---------------------------------------------------------------- Background

const BackgroundProps: React.FC<{ config: VisualizerConfig; set: SetFn }> = ({ config: c, set }) => (
  <>
    <Section title="Immagine">
      <ImagePicker
        label="Sfondo"
        value={c.backgroundUrl}
        allowNone
        options={[
          { url: BUILTIN_IMAGES.backdrop, label: 'Notte' },
          { url: BUILTIN_IMAGES.cyber, label: 'Cyber' },
          { url: BUILTIN_IMAGES.emblem, label: 'Emblema' },
        ]}
        onChange={(v) => set('backgroundUrl', v, false)}
      />
    </Section>
    <Section title="Regolazioni">
      <Slider label="Sfocatura" value={c.backgroundBlur} min={0} max={40} step={1} format={(v) => `${v}px`} onChange={(v) => set('backgroundBlur', v)} />
      <Slider label="Oscuramento" value={c.backgroundDim} min={0} max={0.9} step={0.01} format={pct} onChange={(v) => set('backgroundDim', v)} />
      <Slider label="Vignettatura" value={c.backgroundVignette} min={0} max={1} step={0.01} format={pct} onChange={(v) => set('backgroundVignette', v)} />
      <Toggle label="Parallasse lenta" hint="Movimento di camera morbido sullo sfondo" checked={c.backgroundParallax} onChange={(v) => set('backgroundParallax', v, false)} />
    </Section>
  </>
);

// ---------------------------------------------------------------- Effects

const EffectsProps: React.FC<{ config: VisualizerConfig; set: SetFn }> = ({ config: c, set }) => (
  <>
    <Section title="Camera">
      <Toggle label="Scossa sui bassi" checked={c.bassCameraShake} onChange={(v) => set('bassCameraShake', v, false)} />
      <Slider label="Zoom sui bassi" value={c.bassZoomIntensity} min={0} max={0.2} step={0.005} format={pct} onChange={(v) => set('bassZoomIntensity', v)} />
    </Section>
    <Section title="Effetti sul beat">
      <Toggle label="Flash sul kick" hint="Lampo di luce a ogni colpo di cassa" checked={c.beatFlash} onChange={(v) => set('beatFlash', v, false)} />
      <Toggle label="Onde d'urto" hint="Anelli che si espandono dal centro" checked={c.shockwaveRings} onChange={(v) => set('shockwaveRings', v, false)} />
      <Slider label="Aberrazione cromatica" value={c.chromaticAberration} min={0} max={1} step={0.01} format={pct} onChange={(v) => set('chromaticAberration', v)} />
    </Section>
    <Section title="Pellicola">
      <Slider label="Grana" value={c.filmGrain} min={0} max={1} step={0.01} format={pct} onChange={(v) => set('filmGrain', v)} />
    </Section>
    <div className="p-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          set('bassCameraShake', DEFAULT_CONFIG.bassCameraShake, false);
          set('bassZoomIntensity', DEFAULT_CONFIG.bassZoomIntensity);
          set('beatFlash', DEFAULT_CONFIG.beatFlash);
          set('shockwaveRings', DEFAULT_CONFIG.shockwaveRings);
          set('chromaticAberration', DEFAULT_CONFIG.chromaticAberration);
          set('filmGrain', DEFAULT_CONFIG.filmGrain);
        }}
      >
        <RotateCcw className="w-3.5 h-3.5" /> Ripristina effetti
      </Button>
    </div>
  </>
);

// ---------------------------------------------------------------- Text

const FONTS: TextFontFamily[] = ['Outfit', 'Montserrat', 'Oswald', 'Bricolage Grotesque', 'Cinzel', 'JetBrains Mono'];

const TextProps: React.FC<{
  layer: TextLayer;
  onChangeConfig: ChangeFn;
  onDuplicate: () => void;
  onDelete: () => void;
}> = ({ layer: l, onChangeConfig, onDuplicate, onDelete }) => {
  const upd = (patch: Partial<TextLayer>, coalesce = true) =>
    onChangeConfig((p) => ({ ...p, textLayers: p.textLayers.map((x) => (x.id === l.id ? { ...x, ...patch } : x)) }), { coalesce });

  const toggleBtn = (active: boolean) =>
    cx('h-8 flex-1 rounded-md flex items-center justify-center transition-colors', active ? 'bg-raised text-acid shadow-[inset_0_0_0_1px_var(--color-line-strong)]' : 'text-faint hover:text-fg');

  return (
    <>
      <Section
        title="Contenuto"
        right={
          <div className="flex">
            <IconButton size="sm" label={l.isLocked ? 'Sblocca posizione' : 'Blocca posizione'} onClick={() => upd({ isLocked: !l.isLocked }, false)}>
              {l.isLocked ? <Lock className="w-3.5 h-3.5 text-acid" /> : <Unlock className="w-3.5 h-3.5" />}
            </IconButton>
            <IconButton size="sm" label="Duplica" onClick={onDuplicate}>
              <Copy className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton size="sm" label="Elimina" onClick={onDelete}>
              <Trash2 className="w-3.5 h-3.5" />
            </IconButton>
          </div>
        }
      >
        <div>
          <FieldLabel label="Testo" />
          <textarea
            value={l.text}
            rows={2}
            onChange={(e) => upd({ text: e.target.value })}
            className="w-full px-2.5 py-2 rounded-lg bg-bg border border-line focus:border-acid/60 focus:outline-none text-sm resize-none"
            style={{ fontFamily: l.fontFamily }}
          />
        </div>
        <div>
          <FieldLabel label="Nome livello" />
          <input
            value={l.label}
            onChange={(e) => upd({ label: e.target.value })}
            className="w-full h-8 px-2.5 rounded-lg bg-bg border border-line focus:border-acid/60 focus:outline-none text-xs"
          />
        </div>
      </Section>

      <Section title="Tipografia">
        <Select label="Font" value={l.fontFamily} options={FONTS.map((f) => ({ value: f, label: f }))} onChange={(v) => upd({ fontFamily: v }, false)} />
        <Grid2>
          <Select
            label="Peso"
            value={l.fontWeight}
            options={[
              { value: '400', label: 'Regular' },
              { value: '600', label: 'Semibold' },
              { value: '700', label: 'Bold' },
              { value: '800', label: 'Extra bold' },
            ]}
            onChange={(v) => upd({ fontWeight: v }, false)}
          />
          <div>
            <FieldLabel label="Stile" />
            <div className="flex p-0.5 rounded-lg bg-bg border border-line gap-0.5">
              <button className={toggleBtn(l.fontWeight === '800' || l.fontWeight === '700')} title="Grassetto" aria-label="Grassetto" onClick={() => upd({ fontWeight: l.fontWeight === '400' || l.fontWeight === '600' ? '800' : '400' }, false)}>
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button className={toggleBtn(l.isItalic)} title="Corsivo" aria-label="Corsivo" onClick={() => upd({ isItalic: !l.isItalic }, false)}>
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button className={toggleBtn(l.isUppercase)} title="Maiuscolo" aria-label="Maiuscolo" onClick={() => upd({ isUppercase: !l.isUppercase }, false)}>
                <CaseUpper className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </Grid2>
        <Slider label="Dimensione" value={l.fontSize} min={8} max={200} onChange={(v) => upd({ fontSize: v })} format={(v) => `${v}px`} />
        <Slider label="Spaziatura lettere" value={l.letterSpacing} min={-4} max={30} step={0.5} onChange={(v) => upd({ letterSpacing: v })} format={fx(1)} />
        <Segmented
          label="Allineamento"
          value={l.align}
          options={[
            { value: 'left', label: <AlignLeft className="w-3.5 h-3.5" />, title: 'Sinistra' },
            { value: 'center', label: <AlignCenter className="w-3.5 h-3.5" />, title: 'Centro' },
            { value: 'right', label: <AlignRight className="w-3.5 h-3.5" />, title: 'Destra' },
          ]}
          onChange={(v) => upd({ align: v }, false)}
        />
        <Grid2>
          <ColorField label="Colore" value={l.color} onChange={(v) => upd({ color: v })} />
          <Slider label="Opacità" value={l.opacity} min={0} max={1} step={0.01} format={pct} onChange={(v) => upd({ opacity: v })} />
        </Grid2>
      </Section>

      <Section title="Posizione">
        <Grid2>
          <Slider label="X" value={l.x} min={0} max={100} step={0.5} format={(v) => `${v}%`} onChange={(v) => upd({ x: v })} />
          <Slider label="Y" value={l.y} min={0} max={100} step={0.5} format={(v) => `${v}%`} onChange={(v) => upd({ y: v })} />
        </Grid2>
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => upd({ x: 50 }, false)}>Centra orizz.</Button>
          <Button size="sm" variant="ghost" onClick={() => upd({ y: 50 }, false)}>Centra vert.</Button>
        </div>
      </Section>

      <Section title="Animazione">
        <Select
          label="Ingresso"
          value={l.enterAnimation || 'none'}
          options={[
            { value: 'none', label: 'Nessuno' },
            { value: 'fade-in', label: 'Dissolvenza' },
            { value: 'slide-up', label: 'Scorre dal basso' },
            { value: 'scale-up', label: 'Ingrandimento' },
          ]}
          onChange={(v) => upd({ enterAnimation: v }, false)}
        />
        <Select
          label="Durante il brano"
          value={l.animation}
          options={[
            { value: 'none', label: 'Statico' },
            { value: 'bass-pulse', label: 'Pulsa sui bassi' },
            { value: 'gentle-float', label: 'Fluttua' },
            { value: 'glow-breath', label: 'Respiro luminoso' },
          ]}
          onChange={(v) => upd({ animation: v }, false)}
        />
        {l.animation === 'bass-pulse' && (
          <Slider label="Intensità pulsazione" value={l.audioReactivity} min={0} max={0.6} step={0.01} format={pct} onChange={(v) => upd({ audioReactivity: v })} />
        )}
      </Section>

      <Section title="Contorno & bagliore" defaultOpen={false}>
        <Slider label="Contorno" value={l.textStrokeWidth || 0} min={0} max={10} step={0.5} format={fx(1)} onChange={(v) => upd({ textStrokeWidth: v })} />
        {(l.textStrokeWidth || 0) > 0 && <ColorField label="Colore contorno" value={l.textStrokeColor || '#000000'} onChange={(v) => upd({ textStrokeColor: v })} />}
        <Toggle label="Bagliore neon" checked={l.glowEnabled} onChange={(v) => upd({ glowEnabled: v }, false)} />
        {l.glowEnabled ? (
          <>
            <ColorField label="Colore bagliore" value={l.glowColor} onChange={(v) => upd({ glowColor: v })} />
            <Slider label="Raggio bagliore" value={l.glowBlur} min={0} max={60} onChange={(v) => upd({ glowBlur: v })} />
          </>
        ) : (
          <Grid2>
            <Slider label="Ombra X" value={l.shadowOffsetX} min={-20} max={20} onChange={(v) => upd({ shadowOffsetX: v })} />
            <Slider label="Ombra Y" value={l.shadowOffsetY} min={-20} max={20} onChange={(v) => upd({ shadowOffsetY: v })} />
          </Grid2>
        )}
      </Section>

      <Section title="Riquadro di sfondo" defaultOpen={l.boxEnabled}>
        <Toggle label="Mostra riquadro" checked={l.boxEnabled} onChange={(v) => upd({ boxEnabled: v }, false)} />
        {l.boxEnabled && (
          <>
            <Grid2>
              <ColorField label="Colore" value={l.boxColor} onChange={(v) => upd({ boxColor: v })} />
              <Slider label="Opacità" value={l.boxOpacity} min={0} max={1} step={0.01} format={pct} onChange={(v) => upd({ boxOpacity: v })} />
            </Grid2>
            <Grid2>
              <Slider label="Margine orizz." value={l.boxPaddingX} min={0} max={60} onChange={(v) => upd({ boxPaddingX: v })} />
              <Slider label="Margine vert." value={l.boxPaddingY} min={0} max={40} onChange={(v) => upd({ boxPaddingY: v })} />
            </Grid2>
            <Slider label="Arrotondamento" value={Math.min(60, l.boxBorderRadius)} min={0} max={60} onChange={(v) => upd({ boxBorderRadius: v })} />
            <Slider label="Bordo" value={l.boxBorderWidth} min={0} max={6} step={0.5} onChange={(v) => upd({ boxBorderWidth: v })} />
          </>
        )}
      </Section>
    </>
  );
};
