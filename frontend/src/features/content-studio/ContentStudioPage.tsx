import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { marketingApi } from '../../lib/api/marketing';
import { ContentItem, Platform } from '../../types';
import {
  Sparkles,
  Send,
  Save,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  RefreshCw,
  Image as ImageIcon,
  Video,
  Share2,
  ArrowRight,
  Copy,
  Check,
  Eye,
  Edit3,
  Database,
  Hash,
  Sliders,
  ChevronDown,
  Layers,
  ShieldCheck,
  Search,
  Zap,
  TrendingUp,
  BarChart2,
  MessageSquare,
  Square,
  StopCircle,
} from 'lucide-react';
import { GeneratedGraphicBanner } from './components/GeneratedGraphicBanner';
import { GeneratedVideoReel } from './components/GeneratedVideoReel';
import { InstagramFieldViewer } from './components/InstagramFieldViewer';

interface ContentStudioPageProps {
  onNavigate?: (path: string) => void;
}

export const ContentStudioPage: React.FC<ContentStudioPageProps> = ({ onNavigate }) => {
  const { user, companyId, role } = useAuth();
  const [generating, setGenerating] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // AI Generator Form Fields
  const [topic, setTopic] = useState('');
  const [platform, setPlatform] = useState<Platform>('linkedin');
  const [formatType, setFormatType] = useState<'post' | 'article' | 'image' | 'video'>('post');
  const [tone, setTone] = useState('authoritative yet accessible');
  const [instructions, setInstructions] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [blueprintView, setBlueprintView] = useState<'pipeline' | 'preview'>('pipeline');

  // Generated Result Canvas
  const [generatedDraft, setGeneratedDraft] = useState<ContentItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editText, setEditText] = useState('');
  const [viewMode, setViewMode] = useState<'preview' | 'editor'>('preview');

  const draftResultRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isCreatorOrAdmin = role === 'admin' || role === 'user';

  // Cloudflare Flux AI Image Generation State
  const [cloudflareStatus, setCloudflareStatus] = useState<{ configured: boolean; model: string } | null>(null);
  const [aiImageUrl, setAiImageUrl] = useState<string | null>(null);
  const [generatingAiImage, setGeneratingAiImage] = useState<boolean>(false);
  const [imageTab, setImageTab] = useState<'flux' | 'svg'>('flux');

  // Load Cloudflare status and cleanup abort controller on unmount
  useEffect(() => {
    marketingApi.getCloudflareStatus()
      .then((st) => setCloudflareStatus(st))
      .catch(() => setCloudflareStatus(null));

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleGenerateFluxImage = async (customPrompt?: string, targetContentId?: string) => {
    const promptToUse = customPrompt || instructions || topic || 'DataFactZ enterprise AI deterministic data intelligence platform';
    const cid = targetContentId || generatedDraft?.content_id;
    setGeneratingAiImage(true);
    setError(null);
    try {
      const res = await marketingApi.generateCloudflareImage({
        prompt: promptToUse,
        topic: topic || undefined,
        company_name: 'DataFactZ',
        content_id: cid,
      });
      setAiImageUrl(res.image_url);
      try {
        localStorage.setItem('last_flux_image', res.image_url);
        if (topic) localStorage.setItem(`flux_image_${topic}`, res.image_url);
        if (cid) {
          localStorage.setItem(`flux_image_${cid}`, res.image_url);
        }
        if (res.public_url) {
          localStorage.setItem('last_flux_public_url', res.public_url);
          if (cid) {
            localStorage.setItem(`flux_public_url_${cid}`, res.public_url);
          }
        }
      } catch {}
      setSuccessMsg('Branding visual generated via Cloudflare Flux-1-schnell!');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'object' && detail?.message ? detail.message : detail || err?.message;
      setError(msg || 'Failed to generate image with Cloudflare Workers AI.');
    } finally {
      setGeneratingAiImage(false);
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setGenerating(false);
    setSuccessMsg('Content generation stopped.');
  };

  const handleGenerateAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCreatorOrAdmin || !companyId || generating) return;
    setError(null);
    setSuccessMsg(null);
    setGenerating(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Build tailored instructions based on format and target platform
      let formatInstructions = instructions || '';
      if (formatType === 'image') {
        formatInstructions = `Generate complete branded visual graphic assets explaining our company offerings: headline, subheadline, 3 architecture pillars, and verified metrics. Do not output raw prompt strings. ${formatInstructions}`.trim();
      } else if (formatType === 'video') {
        formatInstructions = `Generate a 60-second video reel storyboard with 4 sequential scenes (Hook, Breakthrough, Governed Architecture, CTA) with visual direction and spoken voiceover transcript. Do not output raw prompt strings. ${formatInstructions}`.trim();
      }

      if (platform === 'instagram') {
        formatInstructions = `${formatInstructions} Structure Instagram content strictly into 4 separate sections: ### CAPTION (short mobile hook), ### DESCRIPTION (detailed narrative body story), ### HASHTAGS (10-18 tags), and ### SEO KEYWORDS (6-10 search discovery keywords).`.trim();
      } else if (platform === 'linkedin') {
        formatInstructions = `${formatInstructions} Structure LinkedIn content as a unified executive post with punchy hook, body paragraphs, core pillars, CTA, and 3-5 hashtags. No broken-out caption/description/seo fields needed.`.trim();
      }

      const generated = await marketingApi.generateContent(
        {
          topic,
          platform,
          content_type: formatType,
          tone,
          instructions: formatInstructions || undefined,
        },
        { signal: controller.signal }
      );

      setGeneratedDraft(generated);
      setEditTitle(generated.content_title);
      setEditText(generated.content_text);
      setViewMode('preview');
      setSuccessMsg('Grounded content draft generated successfully with verified company context!');

      // If format is Image, automatically generate the Cloudflare Flux promotional image for this exact draft
      if (formatType === 'image') {
        handleGenerateFluxImage(
          `Photorealistic corporate technology promotional visual for ${topic || 'DataFactZ'}: futuristic digital data architecture, deterministic multi-agent platform, enterprise cloud data governance`,
          generated.content_id
        );
      }

      // Smooth scroll to draft
      setTimeout(() => {
        draftResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message?.includes('aborted') || err?.name === 'CanceledError') {
        setError(null);
        setSuccessMsg('Content generation was stopped by user.');
        return;
      }
      setError(err?.message || 'Content generation failed. Please ensure verified knowledge exists.');
    } finally {
      abortControllerRef.current = null;
      setGenerating(false);
    }
  };

  const handleSaveEdits = async () => {
    if (!generatedDraft || !isCreatorOrAdmin) return;
    try {
      const updated = await marketingApi.updateContent(generatedDraft.content_id, {
        content_title: editTitle,
        content_text: editText,
      });
      setGeneratedDraft(updated);
      setSuccessMsg('Draft edits saved successfully.');
    } catch (err: any) {
      setError(err?.message || 'Failed to save edits');
    }
  };

  const handleSubmitForReview = async () => {
    if (!generatedDraft || !isCreatorOrAdmin) return;
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const updated = await marketingApi.submitContent(generatedDraft.content_id);
      setGeneratedDraft(updated);
      setSuccessMsg(
        'Draft submitted to Marketing Agent Review Queue! Admin or Reviewer approval is now required before dispatch.'
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to submit draft for review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyText = () => {
    if (!editText) return;
    navigator.clipboard.writeText(editText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getFormatIcon = (type: string) => {
    switch (type) {
      case 'article':
        return <FileText className="w-4 h-4" />;
      case 'image':
        return <ImageIcon className="w-4 h-4" />;
      case 'video':
        return <Video className="w-4 h-4" />;
      default:
        return <Share2 className="w-4 h-4" />;
    }
  };

  // Helper to render markdown text with bolding and headers
  const renderFormattedLine = (line: string, index: number) => {
    if (line.startsWith('### ')) {
      return (
        <h4 key={index} className="text-sm font-bold text-[#252525] mt-4 mb-2 tracking-tight">
          {renderInlineFormatting(line.replace('### ', ''))}
        </h4>
      );
    }
    if (line.startsWith('## ')) {
      return (
        <h3 key={index} className="text-base font-bold text-[#252525] mt-5 mb-2.5 pb-1 border-b border-[#E7E5E4] tracking-tight">
          {renderInlineFormatting(line.replace('## ', ''))}
        </h3>
      );
    }
    if (line.startsWith('# ')) {
      return (
        <h2 key={index} className="text-lg font-bold text-[#252525] mt-6 mb-3 tracking-tight">
          {renderInlineFormatting(line.replace('# ', ''))}
        </h2>
      );
    }

    if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
      const content = line.trim().substring(2);
      return (
        <div key={index} className="flex items-start gap-2.5 my-1.5 pl-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#252525] mt-2 shrink-0" />
          <span className="text-sm text-[#252525] leading-relaxed">
            {renderInlineFormatting(content)}
          </span>
        </div>
      );
    }

    const numMatch = line.match(/^\s*(\d+)\.\s+(.*)/);
    if (numMatch) {
      return (
        <div key={index} className="flex items-start gap-2.5 my-1.5 pl-1">
          <span className="text-xs font-bold text-[#737373] mt-0.5 w-4 shrink-0 font-mono">
            {numMatch[1]}.
          </span>
          <span className="text-sm text-[#252525] leading-relaxed">
            {renderInlineFormatting(numMatch[2])}
          </span>
        </div>
      );
    }

    if (line.trim().startsWith('#') && !line.includes(' ')) {
      const tags = line.split(/\s+/).filter(Boolean);
      return (
        <div key={index} className="flex flex-wrap gap-1.5 my-3 pt-2">
          {tags.map((tag, tIdx) => (
            <span
              key={tIdx}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#F0EFED] text-[#252525] text-xs font-medium font-mono"
            >
              <Hash className="w-3 h-3 text-[#737373]" />
              <span>{tag.replace(/^#/, '')}</span>
            </span>
          ))}
        </div>
      );
    }

    if (!line.trim()) {
      return <div key={index} className="h-3" />;
    }

    return (
      <p key={index} className="text-sm text-[#252525] leading-relaxed my-1.5">
        {renderInlineFormatting(line)}
      </p>
    );
  };

  const renderInlineFormatting = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, pIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={pIdx} className="font-semibold text-[#252525]">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={pIdx} className="px-1.5 py-0.5 rounded bg-[#F0EFED] font-mono text-xs text-[#252525]">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  const formatOptions = [
    { id: 'post', label: 'Short Post', icon: Share2, desc: 'Optimized social feed update' },
    { id: 'article', label: 'Long-Form Article', icon: FileText, desc: 'Technical architecture deep dive' },
    { id: 'image', label: 'Image Creative', icon: ImageIcon, desc: 'Branded infographic & visual asset' },
    { id: 'video', label: 'Video Asset / Reel', icon: Video, desc: 'Interactive 60s Reel & Storyboard' },
  ] as const;

  const toneOptions = [
    { id: 'authoritative yet accessible', label: 'Authoritative & Accessible' },
    { id: 'thought leadership', label: 'Executive Thought Leadership' },
    { id: 'technical deep dive', label: 'Technical Architecture Deep Dive' },
    { id: 'conversational', label: 'Conversational & Engaging' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E7E5E4]">
        <div>
          <h1 className="text-[28px] font-semibold text-[#252525] tracking-tight flex items-center gap-2.5">
            <span>Content Studio</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              pgvector Grounded
            </span>
          </h1>
          <p className="text-sm text-[#737373] mt-1">
            Generate company-grounded marketing assets strictly verified against your company knowledge base.
          </p>
        </div>

        {onNavigate && (
          <button
            onClick={() => onNavigate('/marketing')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-[#252525] bg-white border border-[#E7E5E4] rounded-lg shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-200 self-start sm:self-auto cursor-pointer"
          >
            <span>Marketing Workspace & Reviews</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs text-red-700 shadow-sm animate-in fade-in duration-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-xs text-emerald-800 shadow-sm animate-in fade-in duration-300">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1 flex items-center justify-between gap-4">
            <span>{successMsg}</span>
            {onNavigate && generatedDraft?.approval_status === 'pending' && (
              <button
                onClick={() => onNavigate('/marketing')}
                className="underline font-semibold hover:text-emerald-950 shrink-0 text-xs cursor-pointer"
              >
                Open Review Queue &rarr;
              </button>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ONLY AI CONTENT GENERATOR — Expansive, Interactive Canvas */}
      {/* ========================================================= */}
      <div className="bg-white p-7 sm:p-8 rounded-2xl border border-[#E7E5E4] shadow-sm hover:shadow-md transition-shadow duration-300 space-y-7">
        <div className="flex items-center justify-between pb-4 border-b border-[#E7E5E4]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#252525] text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#252525]">AI Content Generator</h2>
              <p className="text-xs text-[#737373]">Configure your content goal, format, and tone below.</p>
            </div>
          </div>

          {generating ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-mono font-medium">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Generating...</span>
              </span>
              <button
                type="button"
                onClick={handleStopGeneration}
                className="btn-motion inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold cursor-pointer shadow-xs"
                title="Stop content generation"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Stop</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs font-mono text-[#737373] bg-[#FAFAF9] px-3 py-1 rounded-full border border-[#E7E5E4]">
              <Database className="w-3.5 h-3.5 text-[#252525]" />
              <span>Zero Hallucinations</span>
            </div>
          )}
        </div>

        {isCreatorOrAdmin ? (
          <form onSubmit={handleGenerateAI} className="space-y-6">
            {/* Topic Input */}
            <div className="space-y-2">
              <label className="block text-[13px] font-medium text-[#252525]">
                Content Topic or Goal *
              </label>
              <textarea
                rows={3}
                required
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. DataFactZ Industry Solutions across Insurance, Banking, and Manufacturing"
                className="w-full px-4 py-3 text-sm rounded-xl border border-[#E7E5E4] bg-white text-[#252525] placeholder:text-[#737373]/60 focus:outline-none focus:border-[#252525] focus:ring-2 focus:ring-[#252525]/5 transition-all leading-relaxed shadow-xs"
              />
            </div>

            {/* Format Selection: Interactive Floating Cards */}
            <div className="space-y-2.5">
              <label className="block text-[13px] font-medium text-[#252525]">
                Select Content Format *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {formatOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = formatType === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFormatType(opt.id as any)}
                      className={`card-motion p-3.5 rounded-xl border text-left flex flex-col justify-between gap-3 cursor-pointer ${isSelected
                        ? 'bg-[#252525] text-white border-[#252525] shadow-md -translate-y-1 ring-2 ring-[#252525]/15'
                        : 'bg-white text-[#252525] border-[#E7E5E4] hover:border-[#252525]/40 hover:bg-[#FAFAF9]'
                        }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isSelected ? 'bg-white/15 text-white' : 'bg-[#F0EFED] text-[#252525]'
                            }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <div>
                        <span className="block text-xs font-semibold leading-tight">{opt.label}</span>
                        <span
                          className={`block text-[10px] mt-0.5 leading-tight ${isSelected ? 'text-white/70' : 'text-[#737373]'
                            }`}
                        >
                          {opt.desc}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Platform & Tone Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 pt-1">
              {/* Platform Selector Floating Pills */}
              <div className="sm:col-span-5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[13px] font-medium text-[#252525]">
                    Target Platform *
                  </label>
                  <span className="text-[11px] font-mono text-[#737373]">
                    {platform === 'instagram' ? 'Separate 4-Tier Schema' : 'Unified Executive Layout'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 bg-[#FAFAF9] p-1.5 rounded-xl border border-[#E7E5E4]">
                  <button
                    type="button"
                    onClick={() => setPlatform('linkedin')}
                    className={`btn-motion py-2 px-3 rounded-lg text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 ${platform === 'linkedin'
                      ? 'bg-[#252525] text-white shadow-sm -translate-y-0.5'
                      : 'text-[#737373] hover:text-[#252525]'
                      }`}
                  >
                    <span>LinkedIn</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlatform('instagram')}
                    className={`btn-motion py-2 px-3 rounded-lg text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 ${platform === 'instagram'
                      ? 'bg-[#252525] text-white shadow-sm -translate-y-0.5'
                      : 'text-[#737373] hover:text-[#252525]'
                      }`}
                  >
                    <span>Instagram</span>
                  </button>
                </div>
                <p className="text-[11px] text-[#737373] leading-tight">
                  {platform === 'instagram'
                    ? 'Generates dedicated fields: Caption, Description, Hashtags & SEO Keywords.'
                    : 'Generates cohesive authoritative executive post with hook, narrative, and CTA.'}
                </p>
              </div>

              {/* Tone Selection Floating Chips */}
              <div className="sm:col-span-7 space-y-2">
                <label className="block text-[13px] font-medium text-[#252525]">
                  Tone & Editorial Style
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {toneOptions.map((t) => {
                    const isSelected = tone === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTone(t.id)}
                        className={`btn-motion px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${isSelected
                          ? 'bg-[#252525] text-white shadow-xs -translate-y-0.5'
                          : 'bg-[#FAFAF9] text-[#737373] border border-[#E7E5E4] hover:text-[#252525] hover:border-[#D6D3D1]'
                          }`}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Custom Instructions Accordion */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#737373] hover:text-[#252525] transition-colors cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{showAdvanced ? 'Hide Custom Instructions' : 'Add Custom Guidance & Instructions (Optional)'}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''
                    }`}
                />
              </button>

              {showAdvanced && (
                <div className="mt-2.5 animate-in fade-in duration-200">
                  <input
                    type="text"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="e.g. Emphasize enterprise security, ROI, and include an invitation to discuss pilots"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E7E5E4] bg-white text-[#252525] placeholder:text-[#737373]/60 focus:outline-none focus:border-[#252525] transition-colors"
                  />
                </div>
              )}
            </div>

            {/* =========================================================================
               GENERATION BLUEPRINT & PIPELINE ARCHITECTURE (CRAWL-FLOW STYLE)
               ========================================================================= */}
            <div className="bg-white rounded-2xl border border-[#E7E5E4] p-6 space-y-5 shadow-xs">
              {/* Header with Title, Mode Switcher, and Platform Badges */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-[#E7E5E4]">
                <div>
                  <h3 className="text-[15px] font-semibold text-[#252525] flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#252525]" />
                    <span>
                      {platform === 'linkedin'
                        ? 'LinkedIn Content Generation Pipeline Architecture'
                        : 'Instagram Content Generation Pipeline Architecture'}
                    </span>
                  </h3>
                  <p className="text-xs text-[#737373] mt-0.5">
                    {platform === 'linkedin'
                      ? 'Automated multi-stage synthesis pipeline: from executive hook to architectural grounding, impact metrics, and closing CTA.'
                      : 'Automated 4-tier synthesis pipeline: dedicated Caption, Description, Hashtag cloud, and SEO Search Keywords.'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {/* View Mode Toggle: Pipeline Flow vs Live Feed Preview */}
                  <div className="flex items-center bg-[#FAFAF9] p-1 rounded-xl border border-[#E7E5E4]">
                    <button
                      type="button"
                      onClick={() => setBlueprintView('pipeline')}
                      className={`btn-motion px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer flex items-center gap-1.5 transition-all ${blueprintView === 'pipeline'
                        ? 'bg-[#252525] text-white shadow-xs'
                        : 'text-[#737373] hover:text-[#252525]'
                        }`}
                    >
                      <Zap className="w-3 h-3" />
                      <span>Pipeline Stages</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBlueprintView('preview')}
                      className={`btn-motion px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer flex items-center gap-1.5 transition-all ${blueprintView === 'preview'
                        ? 'bg-[#252525] text-white shadow-xs'
                        : 'text-[#737373] hover:text-[#252525]'
                        }`}
                    >
                      <Eye className="w-3 h-3" />
                      <span>Feed Preview</span>
                    </button>
                  </div>

                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-mono font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    pgvector Indexed
                  </span>
                </div>
              </div>

              {/* VIEW 1: INTERACTIVE SEQUENTIAL PIPELINE STAGE CARDS (LIKE CRAWL FLOW) */}
              {blueprintView === 'pipeline' && (
                <div className="space-y-4">
                  {/* Pipeline Stepper Breadcrumb / Ribbon */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-mono text-[#737373]">
                    <span className="font-semibold text-[#252525] uppercase tracking-wider text-[10px]">
                      Execution Path:
                    </span>
                    {platform === 'linkedin' ? (
                      formatType === 'article' ? (
                        <>
                          <span className="px-2 py-0.5 rounded bg-[#F0EFED] text-[#252525]">1. Abstract</span>
                          <ArrowRight className="w-3 h-3 text-[#737373] shrink-0" />
                          <span className="px-2 py-0.5 rounded bg-[#F0EFED] text-[#252525]">2. Paradigm Shift</span>
                          <ArrowRight className="w-3 h-3 text-[#737373] shrink-0" />
                          <span className="px-2 py-0.5 rounded bg-[#F0EFED] text-[#252525]">3. Capabilities</span>
                          <ArrowRight className="w-3 h-3 text-[#737373] shrink-0" />
                          <span className="px-2 py-0.5 rounded bg-[#F0EFED] text-[#252525]">4. Contracts</span>
                          <ArrowRight className="w-3 h-3 text-[#737373] shrink-0" />
                          <span className="px-2 py-0.5 rounded bg-[#F0EFED] text-[#252525]">5. Audit</span>
                          <ArrowRight className="w-3 h-3 text-[#737373] shrink-0" />
                          <span className="px-2 py-0.5 rounded bg-[#F0EFED] text-[#252525]">6. Roadmap</span>
                        </>
                      ) : (
                        <>
                          <span className="px-2 py-0.5 rounded bg-[#F0EFED] text-[#252525]">1. Hook</span>
                          <ArrowRight className="w-3 h-3 text-[#737373] shrink-0" />
                          <span className="px-2 py-0.5 rounded bg-[#F0EFED] text-[#252525]">2. Strategic Reality</span>
                          <ArrowRight className="w-3 h-3 text-[#737373] shrink-0" />
                          <span className="px-2 py-0.5 rounded bg-[#F0EFED] text-[#252525]">3. Pillars</span>
                          <ArrowRight className="w-3 h-3 text-[#737373] shrink-0" />
                          <span className="px-2 py-0.5 rounded bg-[#F0EFED] text-[#252525]">4. Business Impact</span>
                          <ArrowRight className="w-3 h-3 text-[#737373] shrink-0" />
                          <span className="px-2 py-0.5 rounded bg-[#F0EFED] text-[#252525]">5. Discussion CTA</span>
                        </>
                      )
                    ) : (
                      <>
                        <span className="px-2 py-0.5 rounded bg-[#F0EFED] text-[#252525]">1. Caption</span>
                        <ArrowRight className="w-3 h-3 text-[#737373] shrink-0" />
                        <span className="px-2 py-0.5 rounded bg-[#F0EFED] text-[#252525]">2. Description</span>
                        <ArrowRight className="w-3 h-3 text-[#737373] shrink-0" />
                        <span className="px-2 py-0.5 rounded bg-[#F0EFED] text-[#252525]">3. Hashtags</span>
                        <ArrowRight className="w-3 h-3 text-[#737373] shrink-0" />
                        <span className="px-2 py-0.5 rounded bg-[#F0EFED] text-[#252525]">4. SEO Keywords</span>
                      </>
                    )}
                  </div>

                  {/* STAGE CARDS GRID FOR LINKEDIN (Unified Standard) */}
                  {platform === 'linkedin' && formatType !== 'article' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                      {/* Step 1: Executive Hook */}
                      <div className="card-motion p-3.5 rounded-xl border border-[#E7E5E4] bg-[#FAFAF9] hover:bg-white hover:border-[#252525]/40 text-xs flex flex-col justify-between gap-2.5 transition-all duration-200 shadow-2xs group">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-semibold text-[#252525] group-hover:text-black flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-[#252525]" />
                              <span>1. Executive Hook</span>
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          </div>
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-white border border-[#E7E5E4] text-[#737373] mb-1.5">
                            Scroll-Stop / 1-2 Lines
                          </span>
                          <p className="text-[#737373] text-[11px] leading-relaxed">
                            High-impact mobile opener placed before the "see more" cutoff to capture immediate executive attention.
                          </p>
                        </div>
                        <div className="pt-2 border-t border-[#E7E5E4]/60 text-[10px] text-[#737373] font-mono flex items-center justify-between">
                          <span>Target: &lt;140 Chars</span>
                          <span className="text-[#252525] font-semibold">Stage 1</span>
                        </div>
                      </div>

                      {/* Step 2: Strategic Reality */}
                      <div className="card-motion p-3.5 rounded-xl border border-[#E7E5E4] bg-[#FAFAF9] hover:bg-white hover:border-[#252525]/40 text-xs flex flex-col justify-between gap-2.5 transition-all duration-200 shadow-2xs group">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-semibold text-[#252525] group-hover:text-black flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5 text-[#252525]" />
                              <span>2. Strategic Reality</span>
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          </div>
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-white border border-[#E7E5E4] text-[#737373] mb-1.5">
                            Context & Shift
                          </span>
                          <p className="text-[#737373] text-[11px] leading-relaxed">
                            Frames the transition from fragile one-off AI scripts to production-grade, deterministic architecture.
                          </p>
                        </div>
                        <div className="pt-2 border-t border-[#E7E5E4]/60 text-[10px] text-[#737373] font-mono flex items-center justify-between">
                          <span>2-3 Clean Paragraphs</span>
                          <span className="text-[#252525] font-semibold">Stage 2</span>
                        </div>
                      </div>

                      {/* Step 3: Solution Pillars */}
                      <div className="card-motion p-3.5 rounded-xl border border-[#E7E5E4] bg-[#FAFAF9] hover:bg-white hover:border-[#252525]/40 text-xs flex flex-col justify-between gap-2.5 transition-all duration-200 shadow-2xs group">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-semibold text-[#252525] group-hover:text-black flex items-center gap-1.5">
                              <Database className="w-3.5 h-3.5 text-emerald-600" />
                              <span>3. Solution Pillars</span>
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          </div>
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-white border border-[#E7E5E4] text-[#737373] mb-1.5">
                            pgvector Grounded
                          </span>
                          <p className="text-[#737373] text-[11px] leading-relaxed">
                            Governed data pipelines, semantic embeddings, and contract-driven LangGraph multi-agent nodes.
                          </p>
                        </div>
                        <div className="pt-2 border-t border-[#E7E5E4]/60 text-[10px] text-[#737373] font-mono flex items-center justify-between">
                          <span>3 Verified Bullets</span>
                          <span className="text-[#252525] font-semibold">Stage 3</span>
                        </div>
                      </div>

                      {/* Step 4: Business Impact */}
                      <div className="card-motion p-3.5 rounded-xl border border-[#E7E5E4] bg-[#FAFAF9] hover:bg-white hover:border-[#252525]/40 text-xs flex flex-col justify-between gap-2.5 transition-all duration-200 shadow-2xs group">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-semibold text-[#252525] group-hover:text-black flex items-center gap-1.5">
                              <TrendingUp className="w-3.5 h-3.5 text-[#252525]" />
                              <span>4. Business Impact</span>
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          </div>
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-white border border-[#E7E5E4] text-[#737373] mb-1.5">
                            Outcome Delivery
                          </span>
                          <p className="text-[#737373] text-[11px] leading-relaxed">
                            Quantified efficiency gains, eliminated transcription backlogs, and auditable governance trails.
                          </p>
                        </div>
                        <div className="pt-2 border-t border-[#E7E5E4]/60 text-[10px] text-[#737373] font-mono flex items-center justify-between">
                          <span>Zero Hallucinations</span>
                          <span className="text-[#252525] font-semibold">Stage 4</span>
                        </div>
                      </div>

                      {/* Step 5: Takeaway & CTA */}
                      <div className="card-motion p-3.5 rounded-xl border border-[#E7E5E4] bg-[#FAFAF9] hover:bg-white hover:border-[#252525]/40 text-xs flex flex-col justify-between gap-2.5 transition-all duration-200 shadow-2xs group">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-semibold text-[#252525] group-hover:text-black flex items-center gap-1.5">
                              <MessageSquare className="w-3.5 h-3.5 text-[#252525]" />
                              <span>5. Discussion CTA</span>
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          </div>
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-white border border-[#E7E5E4] text-[#737373] mb-1.5">
                            Conversation Driver
                          </span>
                          <p className="text-[#737373] text-[11px] leading-relaxed">
                            Strategic closing takeaway inviting collaborative discussions, pilot inquiries, and community engagement.
                          </p>
                        </div>
                        <div className="pt-2 border-t border-[#E7E5E4]/60 text-[10px] text-[#737373] font-mono flex items-center justify-between">
                          <span>+ 3-5 Industry Tags</span>
                          <span className="text-[#252525] font-semibold">Stage 5</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STAGE CARDS GRID FOR LONG-FORM ARTICLE (When article selected) */}
                  {platform === 'linkedin' && formatType === 'article' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                      <div className="card-motion p-3.5 rounded-xl border border-[#E7E5E4] bg-[#FAFAF9] hover:bg-white hover:border-[#252525]/40 text-xs flex flex-col justify-between gap-2 transition-all shadow-2xs">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-[#252525]">1. Abstract</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          </div>
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-white border border-[#E7E5E4] text-[#737373] mb-1">
                            Problem & Thesis
                          </span>
                          <p className="text-[#737373] text-[11px] leading-relaxed">
                            Technical leadership perspective framing the core engineering challenge.
                          </p>
                        </div>
                        <div className="pt-2 border-t border-[#E7E5E4]/60 text-[10px] text-[#737373] font-mono">
                          ~100 Words
                        </div>
                      </div>

                      <div className="card-motion p-3.5 rounded-xl border border-[#E7E5E4] bg-[#FAFAF9] hover:bg-white hover:border-[#252525]/40 text-xs flex flex-col justify-between gap-2 transition-all shadow-2xs">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-[#252525]">2. Paradigm Shift</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          </div>
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-white border border-[#E7E5E4] text-[#737373] mb-1">
                            Fragile to Governed
                          </span>
                          <p className="text-[#737373] text-[11px] leading-relaxed">
                            Moving from unconstrained bots to deterministic multi-agent systems.
                          </p>
                        </div>
                        <div className="pt-2 border-t border-[#E7E5E4]/60 text-[10px] text-[#737373] font-mono">
                          Architecture Focus
                        </div>
                      </div>

                      <div className="card-motion p-3.5 rounded-xl border border-[#E7E5E4] bg-[#FAFAF9] hover:bg-white hover:border-[#252525]/40 text-xs flex flex-col justify-between gap-2 transition-all shadow-2xs">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-[#252525]">3. Capabilities</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          </div>
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-white border border-[#E7E5E4] text-[#737373] mb-1">
                            pgvector Retrieval
                          </span>
                          <p className="text-[#737373] text-[11px] leading-relaxed">
                            Examination of verified company agents and documented case studies.
                          </p>
                        </div>
                        <div className="pt-2 border-t border-[#E7E5E4]/60 text-[10px] text-[#737373] font-mono">
                          Factual Citations
                        </div>
                      </div>

                      <div className="card-motion p-3.5 rounded-xl border border-[#E7E5E4] bg-[#FAFAF9] hover:bg-white hover:border-[#252525]/40 text-xs flex flex-col justify-between gap-2 transition-all shadow-2xs">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-[#252525]">4. Contracts</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          </div>
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-white border border-[#E7E5E4] text-[#737373] mb-1">
                            Deterministic Nodes
                          </span>
                          <p className="text-[#737373] text-[11px] leading-relaxed">
                            Formal Pydantic schema contracts, state graphs, and strict error handling.
                          </p>
                        </div>
                        <div className="pt-2 border-t border-[#E7E5E4]/60 text-[10px] text-[#737373] font-mono">
                          Zero Ungrounded
                        </div>
                      </div>

                      <div className="card-motion p-3.5 rounded-xl border border-[#E7E5E4] bg-[#FAFAF9] hover:bg-white hover:border-[#252525]/40 text-xs flex flex-col justify-between gap-2 transition-all shadow-2xs">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-[#252525]">5. Audit & HITL</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          </div>
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-white border border-[#E7E5E4] text-[#737373] mb-1">
                            Human Governance
                          </span>
                          <p className="text-[#737373] text-[11px] leading-relaxed">
                            Mandatory human review and audit trails for high-consequence operations.
                          </p>
                        </div>
                        <div className="pt-2 border-t border-[#E7E5E4]/60 text-[10px] text-[#737373] font-mono">
                          Admin Review
                        </div>
                      </div>

                      <div className="card-motion p-3.5 rounded-xl border border-[#E7E5E4] bg-[#FAFAF9] hover:bg-white hover:border-[#252525]/40 text-xs flex flex-col justify-between gap-2 transition-all shadow-2xs">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-[#252525]">6. Roadmap</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          </div>
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-white border border-[#E7E5E4] text-[#737373] mb-1">
                            Measurable ROI
                          </span>
                          <p className="text-[#737373] text-[11px] leading-relaxed">
                            Strategic adoption roadmap and measurable business delivery takeaways.
                          </p>
                        </div>
                        <div className="pt-2 border-t border-[#E7E5E4]/60 text-[10px] text-[#737373] font-mono">
                          550 - 750 Words
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STAGE CARDS GRID FOR INSTAGRAM (4-Tier Standard) */}
                  {platform === 'instagram' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="card-motion p-3.5 rounded-xl border border-[#E7E5E4] bg-[#FAFAF9] hover:bg-white hover:border-[#252525]/40 text-xs flex flex-col justify-between gap-2.5 transition-all shadow-2xs">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-[#252525]">1. Caption</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          </div>
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-white border border-[#E7E5E4] text-[#737373] mb-1">
                            Mobile Hook Line
                          </span>
                          <p className="text-[#737373] text-[11px] leading-relaxed">
                            Immediate scroll-stopping 1-2 sentence hook designed for mobile feed attention.
                          </p>
                        </div>
                        <div className="pt-2 border-t border-[#E7E5E4]/60 text-[10px] text-[#737373] font-mono">
                          Target: &lt;150 Chars
                        </div>
                      </div>

                      <div className="card-motion p-3.5 rounded-xl border border-[#E7E5E4] bg-[#FAFAF9] hover:bg-white hover:border-[#252525]/40 text-xs flex flex-col justify-between gap-2.5 transition-all shadow-2xs">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-[#252525]">2. Description</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          </div>
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-white border border-[#E7E5E4] text-[#737373] mb-1">
                            Story Narrative
                          </span>
                          <p className="text-[#737373] text-[11px] leading-relaxed">
                            Detailed narrative story with clean line breaks explaining the company solutions.
                          </p>
                        </div>
                        <div className="pt-2 border-t border-[#E7E5E4]/60 text-[10px] text-[#737373] font-mono">
                          2-3 Value Paragraphs
                        </div>
                      </div>

                      <div className="card-motion p-3.5 rounded-xl border border-[#E7E5E4] bg-[#FAFAF9] hover:bg-white hover:border-[#252525]/40 text-xs flex flex-col justify-between gap-2.5 transition-all shadow-2xs">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-[#252525]">3. Hashtags</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          </div>
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-white border border-[#E7E5E4] text-[#737373] mb-1">
                            Tag Cloud
                          </span>
                          <p className="text-[#737373] text-[11px] leading-relaxed">
                            Curated 10-18 hashtag cloud optimized for algorithmic reach and discoverability.
                          </p>
                        </div>
                        <div className="pt-2 border-t border-[#E7E5E4]/60 text-[10px] text-[#737373] font-mono">
                          1-Click Copy Ready
                        </div>
                      </div>

                      <div className="card-motion p-3.5 rounded-xl border border-[#E7E5E4] bg-[#FAFAF9] hover:bg-white hover:border-[#252525]/40 text-xs flex flex-col justify-between gap-2.5 transition-all shadow-2xs">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-[#252525]">4. SEO Keywords</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          </div>
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-white border border-[#E7E5E4] text-[#737373] mb-1">
                            Search Ranking
                          </span>
                          <p className="text-[#737373] text-[11px] leading-relaxed">
                            Algorithmic keywords and search tags targeting Instagram search intent.
                          </p>
                        </div>
                        <div className="pt-2 border-t border-[#E7E5E4]/60 text-[10px] text-[#737373] font-mono">
                          Discoverability Tags
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Supplemental Asset Highlights */}
                  {formatType === 'image' && (
                    <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-50 via-orange-50 to-emerald-50 border border-amber-200 text-xs text-amber-950 space-y-1.5 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                          <span>AI Branding & Promotion Engine: Cloudflare Flux-1-schnell</span>
                        </span>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                          Cloudflare Workers AI Active
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        Generates photorealistic promotional branding visuals using Black Forest Labs Flux-1-schnell on Cloudflare AI edge.
                      </p>
                    </div>
                  )}

                  {formatType === 'video' && (
                    <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200 text-xs text-purple-900 flex items-center justify-between">
                      <span className="font-semibold flex items-center gap-1.5">
                        <Video className="w-3.5 h-3.5 text-purple-600" />
                        <span>60s Reel Engine: Interactive player with audio soundwave & 4-scene storyboard</span>
                      </span>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                        9:16 Vertical Reel Player
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* VIEW 2: REAL-TIME FEED OUTPUT MOCKUP PREVIEW */}
              {blueprintView === 'preview' && (
                <div className="space-y-3">
                  <div className="bg-white rounded-xl border border-[#E7E5E4] p-5 shadow-xs space-y-3 max-w-xl mx-auto">
                    {/* LinkedIn Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-[#E7E5E4]/80">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-[#252525] text-white flex items-center justify-center font-bold text-xs tracking-wider">
                          DF
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-[#252525]">DataFactZ Official Voice</span>
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 inline" />
                            <span className="text-[10px] text-[#737373]">• 1st</span>
                          </div>
                          <span className="text-[10px] text-[#737373]">
                            Enterprise Data & AI Architecture • 12,480 followers • Just now
                          </span>
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#FAFAF9] border border-[#E7E5E4] text-[#737373]">
                        {platform.toUpperCase()}
                      </span>
                    </div>

                    {/* Post Copy Mockup */}
                    <div className="text-xs text-[#252525] space-y-2 leading-relaxed font-sans">
                      <p className="font-semibold text-sm">
                        Why enterprise teams are rethinking ungoverned AI in production:
                      </p>
                      <p className="text-[#737373]">
                        Moving from fragile conversational bots to deterministic multi-agent architectures isn't just an engineering upgrade — it's an operational necessity.
                      </p>
                      <div className="p-3 rounded-lg bg-[#FAFAF9] border border-[#E7E5E4] space-y-1 text-[11px] font-mono text-[#252525]">
                        <div>• Pillar 1: Governed Enterprise Ingestion & Vector Indexing (pgvector)</div>
                        <div>• Pillar 2: Deterministic LangGraph Agent Pipelines with Schema Contracts</div>
                        <div>• Pillar 3: Mandatory Human-in-the-Loop Audit & Verification</div>
                      </div>
                      <p className="text-[#252525]">
                        How is your leadership team approaching production AI governance this quarter? Let's connect.
                      </p>
                      <div className="text-xs font-mono text-blue-700">
                        #EnterpriseAI #DataEngineering #CloudData #TechStrategy #DataFactZ
                      </div>
                    </div>

                    {/* Reactions Bar */}
                    <div className="pt-2 border-t border-[#E7E5E4] flex items-center justify-between text-[11px] text-[#737373]">
                      <span>👍 💡 👏 842 reactions</span>
                      <span>64 comments • 38 reposts</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Grounding Pill */}
              <div className="pt-2 border-t border-[#E7E5E4]/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#737373]">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Strict pgvector Grounding • Factual citations enforced on every stage</span>
                </div>
                <span className="font-mono text-[10px] text-[#737373]">
                  Status: 100% Deterministic Contract
                </span>
              </div>
            </div>

            {/* Floating Primary Action Button */}
            <div className="pt-4 border-t border-[#E7E5E4] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-[#737373]">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Grounded with pgvector semantic similarity. Factual citations enforced.</span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                {generating && (
                  <button
                    type="button"
                    onClick={handleStopGeneration}
                    className="btn-motion w-full sm:w-auto inline-flex items-center justify-center gap-1.5 h-11 px-5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 hover:border-red-300 text-xs font-semibold cursor-pointer shadow-xs transition-all animate-in fade-in"
                    title="Stop content generation"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop Generation</span>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={generating || !topic.trim()}
                  className="btn-motion w-full sm:w-auto inline-flex items-center justify-center gap-2 h-11 px-7 rounded-xl bg-[#252525] text-white text-sm font-semibold shadow-xs hover:shadow-md hover:bg-[#383838] disabled:opacity-50 disabled:pointer-events-none cursor-pointer group"
                >
                  {generating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Agent Generating...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform duration-200" />
                      <span>Generate AI Draft</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="p-4 bg-[#FAFAF9] border border-[#E7E5E4] rounded-xl text-xs text-[#737373] leading-relaxed">
            Reviewer accounts have read-only access to Content Studio. Please navigate to the{' '}
            <button
              onClick={() => onNavigate?.('/marketing')}
              className="font-medium text-[#252525] underline cursor-pointer"
            >
              Marketing Agent Workspace
            </button>{' '}
            to inspect, approve, or reject drafts in the review queue.
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* LAZY LOADING UI: Layout-Stable Shimmer Skeleton Screen   */}
      {/* (Renders during real active backend generation)           */}
      {/* ========================================================= */}
      {generating && (
        <div className="bg-white p-7 sm:p-8 rounded-2xl border border-[#E7E5E4] shadow-md space-y-6 animate-in fade-in duration-200">
          {/* Real Backend Status Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E7E5E4]">
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#252525] opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#252525]" />
              </span>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#252525] block">
                  Generating Company-Grounded Draft
                </span>
                <span className="text-xs text-[#737373]">
                  Querying pgvector vector store & executing grounded synthesis...
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-[#FAFAF9] border border-[#E7E5E4] text-[#737373]">
                Processing Request
              </span>
              <button
                type="button"
                onClick={handleStopGeneration}
                className="btn-motion inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 hover:border-red-300 text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                title="Stop generation immediately"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Stop Generation</span>
              </button>
            </div>
          </div>

          {/* Layout-Stable Shimmer Skeleton */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2.5">
              <div className="h-6 w-24 rounded-md animate-shimmer" />
              <div className="h-6 w-32 rounded-md animate-shimmer" />
            </div>

            <div className="h-7 w-3/4 rounded-lg animate-shimmer" />

            <div className="space-y-2 pt-2">
              <div className="h-4 w-full rounded animate-shimmer" />
              <div className="h-4 w-11/12 rounded animate-shimmer" />
              <div className="h-4 w-4/5 rounded animate-shimmer" />
            </div>

            <div className="space-y-2.5 pl-3 pt-2">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#E7E5E4] shrink-0" />
                <div className="h-4 w-5/6 rounded animate-shimmer" />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#E7E5E4] shrink-0" />
                <div className="h-4 w-3/4 rounded animate-shimmer" />
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <div className="h-4 w-full rounded animate-shimmer" />
              <div className="h-4 w-2/3 rounded animate-shimmer" />
            </div>

            <div className="pt-4 border-t border-[#E7E5E4] flex items-center justify-between">
              <div className="h-9 w-28 rounded-xl animate-shimmer" />
              <div className="h-9 w-40 rounded-xl animate-shimmer" />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* GENERATED DRAFT STUDIO (Appears once generated)          */}
      {/* ========================================================= */}
      {generatedDraft && !generating && (
        <div
          ref={draftResultRef}
          className="bg-white p-7 sm:p-8 rounded-2xl border border-[#E7E5E4] shadow-md space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500"
        >
          {/* Header & Floating View Mode Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E7E5E4]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#252525] text-white flex items-center justify-center shadow-xs">
                {getFormatIcon(generatedDraft.content_type)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#252525] uppercase tracking-wider">
                    {generatedDraft.platform_target} • {generatedDraft.content_type}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${generatedDraft.approval_status === 'approved'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : generatedDraft.approval_status === 'pending'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : generatedDraft.approval_status === 'rejected'
                          ? 'bg-red-50 text-red-800 border border-red-200'
                          : 'bg-[#F0EFED] text-[#252525] border border-[#E7E5E4]'
                      }`}
                  >
                    <Clock className="w-3 h-3" />
                    <span className="capitalize">
                      {generatedDraft.approval_status === 'pending'
                        ? 'In Review'
                        : generatedDraft.approval_status}
                    </span>
                  </span>
                </div>
                <span className="text-xs font-mono text-[#737373]">
                  {editText.split(/\s+/).filter(Boolean).length} words • {editText.length} characters • ~
                  {Math.max(1, Math.ceil(editText.split(/\s+/).filter(Boolean).length / 200))} min read
                </span>
              </div>
            </div>

            {/* Floating Action Buttons */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-[#FAFAF9] p-1 rounded-xl border border-[#E7E5E4]">
                <button
                  type="button"
                  onClick={() => setViewMode('preview')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer transform ${viewMode === 'preview'
                    ? 'bg-[#252525] text-white shadow-sm -translate-y-0.5'
                    : 'text-[#737373] hover:text-[#252525] hover:-translate-y-0.5'
                    } active:translate-y-0`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('editor')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer transform ${viewMode === 'editor'
                    ? 'bg-[#252525] text-white shadow-sm -translate-y-0.5'
                    : 'text-[#737373] hover:text-[#252525] hover:-translate-y-0.5'
                    } active:translate-y-0`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Markdown Editor</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopyText}
                title="Copy content copy"
                className="p-2 rounded-xl border border-[#E7E5E4] text-[#737373] hover:text-[#252525] hover:bg-[#F0EFED] hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 transition-all duration-200 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Title Editor */}
          <div className="space-y-1.5">
            <label className="block text-[13px] font-medium text-[#252525]">
              Asset Title
            </label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-4 py-2.5 text-base font-semibold rounded-xl border border-[#E7E5E4] bg-white text-[#252525] focus:outline-none focus:border-[#252525] transition-colors"
            />
          </div>

          {/* Body: Formatted View vs Raw Editor */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-[13px] font-medium text-[#252525]">
                {viewMode === 'preview' ? 'Generated Output & Visual Assets' : 'Raw Markdown Source'}
              </label>
              {viewMode === 'preview' && (
                <span className="text-[11px] font-mono text-[#737373]">
                  {generatedDraft.platform_target === 'instagram'
                    ? 'Instagram 4-Tier Structured View'
                    : 'LinkedIn Unified View'}
                </span>
              )}
            </div>

            {viewMode === 'preview' ? (
              <div className="space-y-6">
                {/* 1. VISUAL ASSET RENDERING (If image creative selected) */}
                {generatedDraft.content_type === 'image' && (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-[#FAFAF9] border border-[#E7E5E4]">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#252525]">Visual Format:</span>
                        <div className="flex items-center bg-white border border-[#E7E5E4] rounded-lg p-0.5 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => setImageTab('flux')}
                            className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                              imageTab === 'flux'
                                ? 'bg-[#252525] text-white shadow-xs'
                                : 'text-[#737373] hover:text-[#252525]'
                            }`}
                          >
                            <Sparkles className="w-3 h-3 text-amber-400" />
                            <span>Flux AI Visual (Cloudflare)</span>
                          </button>
                          {generatedDraft.platform_target !== 'instagram' && (
                            <button
                              type="button"
                              onClick={() => setImageTab('svg')}
                              className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                                imageTab === 'svg'
                                  ? 'bg-[#252525] text-white shadow-xs'
                                  : 'text-[#737373] hover:text-[#252525]'
                              }`}
                            >
                              <Layers className="w-3 h-3" />
                              <span>Corporate Blueprint</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {imageTab === 'flux' && (
                        <button
                          type="button"
                          onClick={() => handleGenerateFluxImage()}
                          disabled={generatingAiImage}
                          className="btn-motion inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#252525] hover:bg-[#383838] text-white text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          {generatingAiImage ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>Generating with Flux...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3 text-amber-300" />
                              <span>{aiImageUrl ? 'Regenerate Flux Image' : 'Generate Flux Image'}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {imageTab === 'flux' ? (
                      <div className="bg-white rounded-2xl border border-[#E7E5E4] p-5 shadow-xs space-y-4">
                        {aiImageUrl ? (
                          <div className="space-y-3">
                            <div className="relative rounded-xl overflow-hidden border border-[#252525]/10 shadow-sm bg-black aspect-video flex items-center justify-center">
                              <img
                                src={aiImageUrl}
                                alt="Cloudflare Flux Branding Graphic"
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-white text-[10px] font-mono font-semibold flex items-center gap-1.5 border border-white/20">
                                <Sparkles className="w-3 h-3 text-amber-300" />
                                <span>@cf/black-forest-labs/flux-1-schnell</span>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E7E5E4] text-xs">
                              <span className="text-[#737373] text-[11px]">
                                Engine: <strong>Cloudflare Workers AI</strong> • Black Forest Labs Flux-1-schnell
                              </span>
                              <div className="flex items-center gap-2">
                                <a
                                  href={aiImageUrl}
                                  download={`datafactz-brand-flux-${Date.now()}.jpg`}
                                  className="btn-motion inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FAFAF9] hover:bg-[#F0EFED] border border-[#E7E5E4] text-[#252525] text-xs font-semibold cursor-pointer"
                                >
                                  <span>Download JPEG</span>
                                </a>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="py-12 text-center space-y-3 border-2 border-dashed border-[#E7E5E4] rounded-xl bg-[#FAFAF9]/60">
                            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto shadow-2xs">
                              <Sparkles className="w-6 h-6" />
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-[#252525]">
                                Generate Photorealistic Promotional Visual
                              </h4>
                              <p className="text-xs text-[#737373] max-w-md mx-auto mt-1">
                                Click below to generate an AI marketing visual using Cloudflare Workers AI and Flux-1-schnell, tuned for corporate promotion.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleGenerateFluxImage()}
                              disabled={generatingAiImage}
                              className="btn-motion inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#252525] hover:bg-[#383838] text-white text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-50"
                            >
                              {generatingAiImage ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>Generating with Cloudflare Flux...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                  <span>Generate Flux AI Image</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : generatedDraft.platform_target !== 'instagram' ? (
                      <GeneratedGraphicBanner
                        title={editTitle}
                        topic={generatedDraft.topic}
                        platform={generatedDraft.platform_target}
                      />
                    ) : null}
                  </div>
                )}

                {/* 2. REEL / VIDEO ASSET RENDERING (If video reel selected) */}
                {generatedDraft.content_type === 'video' && (
                  <GeneratedVideoReel
                    title={editTitle}
                    topic={generatedDraft.topic}
                    platform={generatedDraft.platform_target}
                  />
                )}

                {/* 3. PLATFORM-SPECIFIC COPY RENDERING */}
                {generatedDraft.platform_target === 'instagram' ? (
                  /* Dedicated 4-field Instagram breakdown: Caption, Description, Hashtags, SEO */
                  <InstagramFieldViewer
                    rawText={editText}
                    defaultTitle={editTitle}
                    onSave={(val) => setEditText(val)}
                    isEditable={true}
                  />
                ) : (
                  /* Unified LinkedIn Executive Post / Article Reader */
                  <div className="min-h-[260px] p-6 rounded-xl border border-[#E7E5E4] bg-[#FAFAF9] space-y-2">
                    <div className="mb-4 pb-3 border-b border-[#E7E5E4] flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#252525] text-white flex items-center justify-center font-bold text-xs">
                          DF
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-[#252525]">DataFactZ Official Voice</span>
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 inline" />
                          </div>
                          <span className="text-[10px] text-[#737373]">
                            Unified LinkedIn Post • Zero Ungrounded Claims
                          </span>
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white border border-[#E7E5E4] text-[#252525]">
                        Executive Feed Format
                      </span>
                    </div>

                    {editText.split('\n').map((line, idx) => renderFormattedLine(line, idx))}
                  </div>
                )}
              </div>
            ) : (
              <textarea
                rows={16}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full px-4 py-3 text-sm rounded-xl border border-[#E7E5E4] bg-white text-[#252525] font-mono leading-relaxed focus:outline-none focus:border-[#252525] transition-colors resize-y"
              />
            )}
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-[#E7E5E4] flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleSaveEdits}
              className="btn-motion inline-flex items-center gap-1.5 h-10 px-4 text-xs font-semibold text-[#252525] bg-white border border-[#E7E5E4] rounded-xl shadow-xs hover:shadow-sm cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>

            <div className="flex items-center gap-2">
              {generatedDraft.approval_status !== 'pending' && generatedDraft.approval_status !== 'approved' && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSubmitForReview}
                  className="btn-motion inline-flex items-center gap-1.5 h-10 px-5 text-xs font-semibold text-white bg-[#252525] hover:bg-[#383838] rounded-xl shadow-xs hover:shadow-md disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Submitting...' : 'Submit to Review Queue'}</span>
                </button>
              )}

              {generatedDraft.approval_status === 'pending' && onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('/marketing')}
                  className="btn-motion inline-flex items-center gap-1.5 h-10 px-5 text-xs font-semibold text-white bg-[#252525] hover:bg-[#383838] rounded-xl shadow-xs hover:shadow-md cursor-pointer"
                >
                  <span>View in Marketing Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
