import React from 'react';
import { PRESETS } from '../visualizer/presets';
import { Preset, VisualizerConfig } from '../types/visualizer';
import { Sparkles, Bookmark } from 'lucide-react';

interface PresetsBarProps {
  currentConfig: VisualizerConfig;
  customPresets: Preset[];
  onApplyPreset: (preset: Preset) => void;
}

export const PresetsBar: React.FC<PresetsBarProps> = ({
  currentConfig,
  customPresets,
  onApplyPreset,
}) => {
  const allPresets = [...customPresets, ...PRESETS];

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs font-medium text-slate-400">
        <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Preset di Layout & Stile (10 Modalità)
        </span>
        <span className="text-[11px] text-slate-500">Un click per cambiare layout del video</span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
        {allPresets.map((preset) => {
          const isSelected =
            currentConfig.layoutStyle === preset.config.layoutStyle &&
            currentConfig.primaryColor === preset.config.primaryColor;

          return (
            <button
              key={preset.id}
              onClick={() => onApplyPreset(preset)}
              className={`flex flex-col text-left px-3 py-2 rounded-xl border transition-all shrink-0 min-w-[150px] max-w-[180px] cursor-pointer ${
                isSelected
                  ? 'bg-amber-400/15 border-amber-400 shadow-md shadow-amber-500/15 ring-1 ring-amber-400/50'
                  : 'bg-slate-900/70 hover:bg-slate-800/80 border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                {preset.isCustom ? (
                  <Bookmark className="w-3 h-3 text-amber-400 shrink-0" />
                ) : (
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                    style={{
                      backgroundColor: preset.config.primaryColor,
                      boxShadow: `0 0 6px ${preset.config.glowColor || preset.config.primaryColor}`,
                    }}
                  />
                )}
                <span className="text-xs font-bold text-white truncate">
                  {preset.name}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 truncate leading-tight">
                {preset.tagline}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
