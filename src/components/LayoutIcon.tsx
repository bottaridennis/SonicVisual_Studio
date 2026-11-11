import React from 'react';
import { VisualizerLayoutStyle } from '../types/visualizer';

/** Tiny schematic thumbnails for each visualizer layout. */
export const LayoutIcon: React.FC<{ layout: VisualizerLayoutStyle; className?: string }> = ({ layout, className }) => {
  const bars = (n: number, f: (i: number) => React.ReactNode) => Array.from({ length: n }, (_, i) => f(i));
  const h = (i: number, n: number) => 3 + Math.abs(Math.sin(i * 1.7) * 7 + Math.cos(i * 0.6) * 4) * (1 - i / n / 1.6);
  let content: React.ReactNode;
  switch (layout) {
    case 'classic-circle':
      content = (
        <g>
          {bars(28, (i) => {
            const a = (i / 28) * Math.PI * 2;
            const r0 = 7;
            const r1 = 7 + 2 + Math.abs(Math.sin(i * 1.3)) * 4;
            return <line key={i} x1={32 + Math.cos(a) * r0} y1={18 + Math.sin(a) * r0} x2={32 + Math.cos(a) * r1} y2={18 + Math.sin(a) * r1} stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />;
          })}
          <circle cx="32" cy="18" r="5.5" fill="currentColor" opacity="0.35" />
        </g>
      );
      break;
    case 'bottom-bars':
      content = bars(16, (i) => <rect key={i} x={6 + i * 3.25} y={30 - h(i, 16) * 1.5} width="2" height={h(i, 16) * 1.5} rx="1" fill="currentColor" />);
      break;
    case 'mirror-bars':
      content = bars(16, (i) => <rect key={i} x={6 + i * 3.25} y={18 - h(i, 16)} width="2" height={h(i, 16) * 2} rx="1" fill="currentColor" />);
      break;
    case 'horizontal-wave':
      content = <path d="M4 18 C 10 6, 14 30, 20 18 S 30 4, 36 18 S 46 28, 52 18 S 58 12, 60 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />;
      break;
    case 'side-bars':
      content = (
        <g>
          {bars(8, (i) => (
            <rect key={`l${i}`} x="2" y={4 + i * 3.6} width={4 + Math.abs(Math.sin(i * 1.4)) * 10} height="2" rx="1" fill="currentColor" />
          ))}
          {bars(8, (i) => {
            const w = 4 + Math.abs(Math.cos(i * 1.2)) * 10;
            return <rect key={`r${i}`} x={62 - w} y={4 + i * 3.6} width={w} height="2" rx="1" fill="currentColor" />;
          })}
        </g>
      );
      break;
    case 'full-width':
      content = <path d="M0 34 L0 24 C 8 12, 14 20, 20 16 S 34 8, 40 18 S 54 14, 64 22 L64 34 Z" fill="currentColor" opacity="0.8" />;
      break;
    case 'turntable-vinyl':
      content = (
        <g>
          <circle cx="30" cy="18" r="13" fill="currentColor" opacity="0.25" />
          <circle cx="30" cy="18" r="10" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.6" />
          <circle cx="30" cy="18" r="7.5" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.6" />
          <circle cx="30" cy="18" r="4.5" fill="currentColor" />
          <line x1="50" y1="5" x2="38" y2="22" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </g>
      );
      break;
    case 'album-art-pulse':
      content = (
        <g>
          <rect x="22" y="5" width="20" height="20" rx="2.5" fill="currentColor" opacity="0.85" />
          {bars(10, (i) => (
            <rect key={i} x={22 + i * 2.05} y={30 - Math.abs(Math.sin(i)) * 2} width="1.2" height={1 + Math.abs(Math.sin(i)) * 4} rx="0.6" fill="currentColor" />
          ))}
        </g>
      );
      break;
    case 'minimal':
      content = (
        <g>
          <circle cx="32" cy="18" r="9" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.5" />
          {bars(16, (i) => {
            const a = (i / 16) * Math.PI * 2;
            const r = 10 + Math.abs(Math.sin(i * 2)) * 2.5;
            return <circle key={i} cx={32 + Math.cos(a) * r} cy={18 + Math.sin(a) * r} r="0.9" fill="currentColor" />;
          })}
        </g>
      );
      break;
    case 'particles-only':
      content = (
        <g>
          <circle cx="32" cy="18" r="5" fill="currentColor" />
          <circle cx="32" cy="18" r="10" fill="currentColor" opacity="0.15" />
          {bars(18, (i) => (
            <circle key={i} cx={8 + ((i * 37) % 50)} cy={4 + ((i * 23) % 28)} r={0.5 + (i % 3) * 0.4} fill="currentColor" opacity="0.7" />
          ))}
        </g>
      );
      break;
  }
  return (
    <svg viewBox="0 0 64 36" className={className} aria-hidden="true">
      {content}
    </svg>
  );
};
