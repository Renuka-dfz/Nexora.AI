import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Video,
  Volume2,
  VolumeX,
  Clock,
  Layers,
  Sparkles,
  Download,
  Share2,
  CheckCircle2,
} from 'lucide-react';

interface Scene {
  scene_num: number;
  time_range: string;
  title: string;
  visual: string;
  voiceover: string;
}

interface GeneratedVideoReelProps {
  title: string;
  topic?: string;
  scenes?: Scene[];
  platform?: 'linkedin' | 'instagram' | string;
}

export const GeneratedVideoReel: React.FC<GeneratedVideoReelProps> = ({
  title,
  topic,
  scenes: initialScenes,
  platform = 'instagram',
}) => {
  const defaultScenes: Scene[] = [
    {
      scene_num: 1,
      time_range: '0:00 - 0:15',
      title: 'The Enterprise Reality',
      visual: 'Dynamic split-screen comparing fragile one-off AI scripts with governed pipeline architecture.',
      voiceover: `Most enterprise teams struggle with ungoverned AI. Here is how production architectures deliver ${topic || title}.`,
    },
    {
      scene_num: 2,
      time_range: '0:15 - 0:35',
      title: 'Architectural Shift',
      visual: 'Flow diagram highlighting PostgreSQL pgvector retrieval and semantic chunk normalization.',
      voiceover: 'By combining 768-dimensional vector indexing with strict deterministic schema contracts, hallucinations are eliminated.',
    },
    {
      scene_num: 3,
      time_range: '0:35 - 0:50',
      title: 'Governed Verification',
      visual: 'Reviewer inspection dashboard approving verified facts with real-time citations and admin governance.',
      voiceover: 'Every claim is audited against company knowledge before publication or client dispatch.',
    },
    {
      scene_num: 4,
      time_range: '0:50 - 1:00',
      title: 'Actionable Next Step',
      visual: 'DataFactZ brand endcard with action button and enterprise contact info.',
      voiceover: 'Explore governed agent workflows for your enterprise today. Link in bio.',
    },
  ];

  const scenes = initialScenes && initialScenes.length > 0 ? initialScenes : defaultScenes;

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); // 0 to 60 seconds
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [copied, setCopied] = useState(false);

  // Playback timer ticker
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= 60) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 500); // 1 virtual second every 500ms for smooth demo preview
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Sync active scene with currentTime
  useEffect(() => {
    if (currentTime < 15) {
      setActiveSceneIndex(0);
    } else if (currentTime < 35) {
      setActiveSceneIndex(1);
    } else if (currentTime < 50) {
      setActiveSceneIndex(2);
    } else {
      setActiveSceneIndex(3);
    }
  }, [currentTime]);

  const activeScene = scenes[activeSceneIndex] || scenes[0];

  const handleSceneClick = (index: number) => {
    setActiveSceneIndex(index);
    if (index === 0) setCurrentTime(0);
    if (index === 1) setCurrentTime(15);
    if (index === 2) setCurrentTime(35);
    if (index === 3) setCurrentTime(50);
  };

  const handleExportStoryboard = () => {
    const text = scenes
      .map(
        (s) =>
          `SCENE ${s.scene_num} (${s.time_range}) — ${s.title}\nVisual: ${s.visual}\nVoiceover: "${s.voiceover}"\n`
      )
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatSec = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-xl border border-[#E7E5E4] shadow-xs text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-[#252525] text-white flex items-center justify-center">
            <Video className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-semibold text-[#252525] block">
              Interactive 60s Video Reel Asset & Storyboard
            </span>
            <span className="text-[11px] text-[#737373]">
              Formatted for 9:16 Vertical Reel / Short Video dispatch
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportStoryboard}
            className="btn-motion inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FAFAF9] hover:bg-white text-[#252525] border border-[#E7E5E4] rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Copied Storyboard!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span>Copy Reel Script</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Grid: Reel Player Simulator + Scene Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        {/* Reel Mobile Player Mockup */}
        <div className="md:col-span-5 bg-[#18181B] rounded-2xl p-4 text-white shadow-xl border border-[#27272A] space-y-3">
          {/* Top Player Status */}
          <div className="flex items-center justify-between text-[11px] text-zinc-400 pb-2 border-b border-zinc-800">
            <span className="font-mono flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span>LIVE REEL SIMULATOR</span>
            </span>
            <span className="font-mono text-zinc-300">
              {formatSec(currentTime)} / 1:00
            </span>
          </div>

          {/* Active Frame Canvas */}
          <div className="relative aspect-[9/14] rounded-xl overflow-hidden bg-gradient-to-br from-[#27272A] via-[#1E1E22] to-[#121214] p-5 flex flex-col justify-between border border-zinc-700/60 shadow-inner">
            {/* Subtle Grid */}
            <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

            {/* Frame Top: Scene Pill & Brand */}
            <div className="z-10 flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md text-[10px] font-mono font-bold tracking-wider uppercase text-emerald-300 border border-white/10">
                Scene {activeScene.scene_num} • {activeScene.time_range}
              </span>

              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className="w-7 h-7 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-zinc-300 hover:text-white"
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Visual Frame Simulation */}
            <div className="z-10 text-center my-auto space-y-3 px-2">
              <div className="inline-block px-3 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono font-semibold">
                {activeScene.title}
              </div>

              <h3 className="text-lg font-bold tracking-tight text-white leading-snug drop-shadow-sm">
                "{activeScene.visual}"
              </h3>

              {/* Animated Audio Soundwave Simulation */}
              <div className="flex items-center justify-center gap-1 pt-2">
                {[12, 24, 38, 18, 42, 28, 16, 34, 22, 40, 14, 30].map((h, i) => (
                  <span
                    key={i}
                    style={{
                      height: isPlaying ? `${Math.max(6, (h * (i % 2 === 0 ? 1 : 0.7)))}px` : '6px',
                      transition: 'height 0.2s ease',
                    }}
                    className={`w-1 rounded-full ${
                      isPlaying ? 'bg-emerald-400' : 'bg-zinc-600'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Spoken Voiceover Subtitle Box */}
            <div className="z-10 p-3 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 space-y-1">
              <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest block">
                🎙 Spoken Voiceover
              </span>
              <p className="text-xs text-zinc-200 leading-relaxed font-sans italic">
                "{activeScene.voiceover}"
              </p>
            </div>
          </div>

          {/* Scrubber Progress Bar */}
          <div className="space-y-2 pt-1">
            <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-400 h-full transition-all duration-300 rounded-full"
                style={{ width: `${(currentTime / 60) * 100}%` }}
              />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-8 h-8 rounded-full bg-white text-[#252525] flex items-center justify-center hover:bg-zinc-200 cursor-pointer transition-transform active:scale-95"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentTime(0);
                    setActiveSceneIndex(0);
                  }}
                  className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-300 flex items-center justify-center hover:text-white cursor-pointer"
                  title="Reset to 0:00"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              <span className="text-[11px] font-mono text-zinc-400">
                DataFactZ 60s Reel
              </span>
            </div>
          </div>
        </div>

        {/* Storyboard 4-Scene Sequential Cards */}
        <div className="md:col-span-7 space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h4 className="text-xs font-semibold text-[#252525] uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#252525]" />
              <span>Production Storyboard Breakdown (4 Scenes)</span>
            </h4>
            <span className="text-[11px] text-[#737373]">Click a scene to preview</span>
          </div>

          {scenes.map((scene, idx) => {
            const isSelected = activeSceneIndex === idx;
            return (
              <div
                key={idx}
                onClick={() => handleSceneClick(idx)}
                className={`p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'bg-white border-[#252525] ring-2 ring-[#252525]/15 shadow-sm -translate-y-0.5'
                    : 'bg-[#FAFAF9] border-[#E7E5E4] hover:bg-white hover:border-[#D6D3D1]'
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-[#E7E5E4]/60">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono font-bold ${
                        isSelected ? 'bg-[#252525] text-white' : 'bg-[#E7E5E4] text-[#252525]'
                      }`}
                    >
                      {scene.scene_num}
                    </span>
                    <span className="text-xs font-bold text-[#252525]">{scene.title}</span>
                  </div>

                  <span className="text-[11px] font-mono font-semibold text-[#737373]">
                    {scene.time_range}
                  </span>
                </div>

                <div className="space-y-1.5 pt-2.5">
                  <div className="text-xs text-[#252525]">
                    <span className="font-semibold text-[#737373]">Visual: </span>
                    {scene.visual}
                  </div>
                  <div className="text-xs text-[#737373] bg-white p-2.5 rounded-lg border border-[#E7E5E4] italic">
                    <span className="font-semibold not-italic text-[#252525]">Voiceover: </span>
                    "{scene.voiceover}"
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
