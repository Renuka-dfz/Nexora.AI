import React, { useState, useRef } from 'react';
import {
  Download,
  Check,
  Sparkles,
  Layers,
  ShieldCheck,
  Database,
  Cpu,
} from 'lucide-react';

interface GeneratedGraphicBannerProps {
  title: string;
  topic?: string;
  subhead?: string;
  pillars?: string[];
  metric?: string;
  platform?: 'linkedin' | 'instagram' | string;
  editable?: boolean;
}

export const GeneratedGraphicBanner: React.FC<GeneratedGraphicBannerProps> = ({
  title,
  topic,
  subhead = 'Deterministic Multi-Agent Architecture • PostgreSQL pgvector Grounded',
  pillars = [
    'Pillar 1: Governed Enterprise Ingestion & Vector Indexing',
    'Pillar 2: Deterministic LangGraph Agent Pipelines',
    'Pillar 3: Human-in-the-Loop Audit & Compliance Trail',
  ],
  metric = '99.4% Verified Grounding Score',
  platform = 'linkedin',
  editable = false,
}) => {
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '1:1'>(
    platform === 'instagram' ? '1:1' : '16:9'
  );
  const [theme, setTheme] = useState<'graphite' | 'obsidian' | 'slate'>('graphite');
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const [customTitle, setCustomTitle] = useState(title || topic || 'DataFactZ Enterprise AI');
  const [customSubhead, setCustomSubhead] = useState(subhead);

  const bannerRef = useRef<HTMLDivElement>(null);

  const themeStyles = {
    graphite: {
      bg: 'bg-gradient-to-br from-[#252525] via-[#2D2D2D] to-[#1C1C1C]',
      border: 'border-[#3E3E3E]',
      cardBg: 'bg-white/10 backdrop-blur-sm border border-white/15',
      accentText: 'text-emerald-400',
      pillBg: 'bg-white/10',
    },
    obsidian: {
      bg: 'bg-gradient-to-br from-[#121214] via-[#1A1A1E] to-[#0D0D10]',
      border: 'border-[#2E2E36]',
      cardBg: 'bg-white/5 backdrop-blur-sm border border-white/10',
      accentText: 'text-cyan-400',
      pillBg: 'bg-white/10',
    },
    slate: {
      bg: 'bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0B1120]',
      border: 'border-[#334155]',
      cardBg: 'bg-white/10 backdrop-blur-sm border border-white/15',
      accentText: 'text-indigo-400',
      pillBg: 'bg-white/10',
    },
  }[theme];

  const handleDownload = () => {
    setDownloading(true);
    try {
      const isSquare = aspectRatio === '1:1';
      const width = isSquare ? 1080 : 1920;
      const height = isSquare ? 1080 : 1080;

      const bgColor = theme === 'graphite' ? '#252525' : theme === 'obsidian' ? '#121214' : '#0F172A';
      const subBgColor = theme === 'graphite' ? '#1C1C1C' : theme === 'obsidian' ? '#0D0D10' : '#0B1120';
      const accentColor = theme === 'graphite' ? '#34D399' : theme === 'obsidian' ? '#22D3EE' : '#818CF8';

      const svgData = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <defs>
            <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="${bgColor}" />
              <stop offset="100%" stop-color="${subBgColor}" />
            </linearGradient>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
            </pattern>
          </defs>
          <rect width="${width}" height="${height}" fill="url(#bgGrad)" />
          <rect width="${width}" height="${height}" fill="url(#grid)" />
          
          <circle cx="80" cy="80" r="14" fill="${accentColor}" />
          <text x="110" y="87" font-family="system-ui, sans-serif" font-size="28" font-weight="700" fill="#FFFFFF" letter-spacing="2">DATAFACTZ // ENTERPRISE AI</text>
          <rect x="${width - 320}" y="60" width="240" height="40" rx="20" fill="rgba(255,255,255,0.1)" />
          <text x="${width - 200}" y="86" font-family="system-ui, sans-serif" font-size="18" font-weight="600" fill="${accentColor}" text-anchor="middle">● VERIFIED GROUNDED</text>
          
          <text x="80" y="${isSquare ? 280 : 340}" font-family="system-ui, sans-serif" font-size="${isSquare ? 48 : 56}" font-weight="800" fill="#FFFFFF">${customTitle.replace(/&/g, '&amp;').slice(0, 50)}</text>
          <text x="80" y="${isSquare ? 350 : 420}" font-family="system-ui, sans-serif" font-size="24" font-weight="400" fill="#A1A1AA">${customSubhead.replace(/&/g, '&amp;').slice(0, 80)}</text>
          
          ${pillars
            .slice(0, 3)
            .map((p, i) => {
              const cardY = isSquare ? 420 + i * 160 : 540;
              const cardX = isSquare ? 80 : 80 + i * ((width - 220) / 3 + 30);
              const cardWidth = isSquare ? width - 160 : (width - 220) / 3;
              const cardHeight = isSquare ? 120 : 280;
              return `
              <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="16" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" />
              <text x="${cardX + 24}" y="${cardY + 45}" font-family="system-ui, sans-serif" font-size="20" font-weight="700" fill="#FFFFFF">Pillar ${i + 1}</text>
              <text x="${cardX + 24}" y="${cardY + 85}" font-family="system-ui, sans-serif" font-size="16" font-weight="400" fill="#E4E4E7">${p.replace(/^Pillar \d+:\s*/i, '').replace(/&/g, '&amp;').slice(0, 45)}</text>
            `;
            })
            .join('')}
          
          <line x1="80" y1="${height - 100}" x2="${width - 80}" y2="${height - 100}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
          <text x="80" y="${height - 50}" font-family="system-ui, sans-serif" font-size="20" font-weight="500" fill="#A1A1AA">Deterministic Multi-Agent Execution • Zero Hallucination Guarantee</text>
          <text x="${width - 80}" y="${height - 50}" font-family="system-ui, sans-serif" font-size="20" font-weight="700" fill="${accentColor}" text-anchor="end">${metric}</text>
        </svg>
      `;

      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${customTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-banner.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2500);
    } catch (e) {
      console.error('Failed to download graphic banner:', e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-xl border border-[#E7E5E4] shadow-xs text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-semibold text-[#252525]">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Generated Visual Creative Asset</span>
          </div>
          <span className="text-[#737373] hidden sm:inline">• Zero-prompt native enterprise graphic</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#FAFAF9] p-1 rounded-lg border border-[#E7E5E4]">
            <button
              type="button"
              onClick={() => setAspectRatio('16:9')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer transition-all ${
                aspectRatio === '16:9'
                  ? 'bg-[#252525] text-white shadow-xs'
                  : 'text-[#737373] hover:text-[#252525]'
              }`}
            >
              16:9 Banner
            </button>
            <button
              type="button"
              onClick={() => setAspectRatio('1:1')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer transition-all ${
                aspectRatio === '1:1'
                  ? 'bg-[#252525] text-white shadow-xs'
                  : 'text-[#737373] hover:text-[#252525]'
              }`}
            >
              1:1 Instagram
            </button>
          </div>

          <div className="flex items-center bg-[#FAFAF9] p-1 rounded-lg border border-[#E7E5E4]">
            <button
              type="button"
              onClick={() => setTheme('graphite')}
              title="Soft Graphite"
              className={`w-5 h-5 rounded-md bg-[#252525] border cursor-pointer ${
                theme === 'graphite' ? 'ring-2 ring-[#252525] scale-110' : 'border-white/20'
              }`}
            />
            <button
              type="button"
              onClick={() => setTheme('obsidian')}
              title="Obsidian Charcoal"
              className={`w-5 h-5 rounded-md bg-[#121214] ml-1.5 border cursor-pointer ${
                theme === 'obsidian' ? 'ring-2 ring-[#252525] scale-110' : 'border-white/20'
              }`}
            />
            <button
              type="button"
              onClick={() => setTheme('slate')}
              title="Deep Slate"
              className={`w-5 h-5 rounded-md bg-[#0F172A] ml-1.5 border cursor-pointer ${
                theme === 'slate' ? 'ring-2 ring-[#252525] scale-110' : 'border-white/20'
              }`}
            />
          </div>

          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="btn-motion inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#252525] hover:bg-[#383838] text-white rounded-lg text-xs font-semibold shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50"
          >
            {downloadSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Downloaded!</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download Asset (SVG)</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div
        ref={bannerRef}
        className={`w-full rounded-2xl p-6 sm:p-9 text-white transition-all duration-300 relative overflow-hidden shadow-lg border ${
          themeStyles.bg
        } ${themeStyles.border} ${
          aspectRatio === '1:1' ? 'aspect-square max-w-xl mx-auto' : 'aspect-video'
        } flex flex-col justify-between`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.1)_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none opacity-40" />
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-white/5 blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between z-10 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
            </span>
            <span className="text-xs font-mono font-bold tracking-widest text-white/90 uppercase">
              DATAFACTZ // ENTERPRISE AI
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full ${themeStyles.pillBg} text-white/90 border border-white/10`}>
              {aspectRatio === '1:1' ? '1080x1080 px • Instagram' : '1920x1080 px • HD Banner'}
            </span>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              pgvector Grounded
            </span>
          </div>
        </div>

        <div className="z-10 space-y-4 my-auto py-2">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold tracking-wider uppercase text-white/70">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span>Production Architecture Blueprint</span>
            </span>

            {editable ? (
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full text-2xl sm:text-3xl font-bold tracking-tight bg-transparent text-white border-b border-white/30 focus:border-white focus:outline-none"
              />
            ) : (
              <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                {customTitle}
              </h2>
            )}

            <p className="text-xs sm:text-sm text-white/80 max-w-2xl leading-relaxed">
              {customSubhead}
            </p>
          </div>

          <div
            className={`grid gap-3 pt-2 ${
              aspectRatio === '1:1' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3'
            }`}
          >
            {pillars.slice(0, 3).map((pillar, idx) => {
              const cleanPillar = pillar.replace(/^Pillar \d+:\s*/i, '');
              return (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl ${themeStyles.cardBg} space-y-1.5 transition-all hover:border-white/30`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white/60">
                      0{idx + 1} // Pillar
                    </span>
                    <ShieldCheck className={`w-3.5 h-3.5 ${themeStyles.accentText}`} />
                  </div>
                  <h4 className="text-xs font-semibold text-white leading-snug">
                    {cleanPillar.split('(')[0].trim()}
                  </h4>
                  {cleanPillar.includes('(') && (
                    <p className="text-[10px] text-white/70 font-mono">
                      ({cleanPillar.split('(')[1]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="z-10 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/60">
          <div className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-white/60" />
            <span>PostgreSQL pgvector Ingestion • Multi-Agent LangGraph Orchestration</span>
          </div>
          <div className="font-semibold text-white/90 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>{metric}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
