import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { companyApi } from '../../lib/api/company';
import { Company } from '../../types';
import {
  ArrowRight,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  Database,
  Globe2,
  Layers,
  Loader2,
  PenTool,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck,
  X,
  Zap,
} from 'lucide-react';

interface OverviewPageProps {
  onNavigate: (path: string) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ onNavigate }) => {
  const { companyId, companyName: authCompanyName } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [crawlOpen, setCrawlOpen] = useState(false);
  const [crawlUrl, setCrawlUrl] = useState('');
  const [crawlState, setCrawlState] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const [crawlJobId, setCrawlJobId] = useState<string | null>(null);
  const [pagesProcessed, setPagesProcessed] = useState(0);
  const [sectionsSaved, setSectionsSaved] = useState(0);
  const [crawlError, setCrawlError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    companyApi.getCompany(companyId).then(setCompany).catch(() => undefined);
  }, [companyId]);

  useEffect(() => {
    if (!crawlOpen) return;
    setCrawlUrl(company?.website_url || '');
  }, [crawlOpen, company]);

  useEffect(() => {
    if (!companyId || !crawlJobId || crawlState !== 'running') return;

    const interval = window.setInterval(async () => {
      try {
        const job = await companyApi.getCrawlStatus(companyId, crawlJobId);
        setPagesProcessed(job.pages_processed);
        setSectionsSaved(job.sections_saved);

        if (job.status === 'completed') {
          setCrawlState('success');
          window.clearInterval(interval);
          window.setTimeout(() => onNavigate('/content-studio'), 1400);
        } else if (job.status === 'failed') {
          setCrawlState('failed');
          setCrawlError('Website crawling could not be completed. Please verify the URL and try again.');
          window.clearInterval(interval);
        }
      } catch {
        // Keep the live progress view active if one status request is temporarily unavailable.
      }
    }, 2000);

    return () => window.clearInterval(interval);
  }, [companyId, crawlJobId, crawlState, onNavigate]);

  const startCrawl = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!companyId || !crawlUrl.trim()) return;

    setCrawlError(null);
    setCrawlState('running');
    setPagesProcessed(0);
    setSectionsSaved(0);

    try {
      if (!company?.website_url) {
        await companyApi.updateCompany(companyId, { website_url: crawlUrl.trim() });
      }
      const job = await companyApi.startCrawl(companyId, crawlUrl.trim());
      setCrawlJobId(job.job_id);
    } catch (error: any) {
      setCrawlState('failed');
      setCrawlError(error?.message || 'Could not start website crawling.');
    }
  };

  const displayName = company?.company_name || authCompanyName || 'Your Organization';
  const progress =
    crawlState === 'success'
      ? 100
      : Math.min(88, 18 + pagesProcessed * 7 + sectionsSaved * 3);

  return (
    <div className="space-y-8 pb-12">
      {/* =========================================================================
          HERO BANNER: Warm Ivory & Forest Green Luxury Workspace Framing
          ========================================================================= */}
      <section className="relative overflow-hidden rounded-3xl bg-[#14211C] text-white p-7 sm:p-10 border border-[#256D58]/30 shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#256D58]/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-[#34D399]/10 rounded-full blur-[80px] pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div className="max-w-xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-[#34D399] backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              <span>Autonomous Marketing System</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Welcome to {displayName}. <br />
              <span className="text-[#34D399]">Your Marketing Agent is Active.</span>
            </h1>

            <p className="text-xs sm:text-sm text-[#8E9793] leading-relaxed">
              Ground your marketing campaigns in verified corporate knowledge via pgvector embeddings. Plan weekly batches, generate branded visual assets, and enforce human approval before dispatch.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('/marketing')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#256D58] hover:bg-[#1E5846] text-white text-xs font-semibold shadow-md shadow-[#256D58]/25 transition-all cursor-pointer"
              >
                <span>Launch Weekly Automation</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('/content-studio')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-semibold transition-all cursor-pointer"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>Open Content Studio</span>
              </button>
            </div>
          </div>

          {/* Quick Engine Telemetry Card */}
          <div className="w-full lg:w-80 rounded-2xl bg-[#1A2A24] border border-white/10 p-5 space-y-3.5 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                System Telemetry
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-[#34D399] border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse" />
                Operational
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-white/5 flex items-center justify-between">
                <span className="text-[#8E9793]">Knowledge Store:</span>
                <span className="font-semibold text-white">PostgreSQL pgvector</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5 flex items-center justify-between">
                <span className="text-[#8E9793]">Weekly Cadence:</span>
                <span className="font-semibold text-white">5 Posts / Week</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5 flex items-center justify-between">
                <span className="text-[#8E9793]">Publishing Gate:</span>
                <span className="font-semibold text-[#34D399]">Human Approval Required</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCrawlOpen(true)}
              className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white text-center transition-colors cursor-pointer"
            >
              Configure Website Knowledge
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          CORE CAPABILITY TILES: 3 Clean Structured Cards
          ========================================================================= */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Marketing Agent */}
        <div className="bg-white p-6 rounded-2xl border border-[#EAEAE6] shadow-xs flex flex-col justify-between hover:border-[#256D58]/40 transition-all">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#256D58]/10 text-[#256D58] flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#66716B]">
                Engine 01
              </span>
              <h3 className="text-base font-bold text-[#171B1A]">Weekly Automation</h3>
            </div>
            <p className="text-xs text-[#66716B] leading-relaxed">
              Celery Beat continuously crawls your domain, drafts 5 weekly multi-channel posts, and stages them for your review.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('/marketing')}
            className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#256D58] hover:underline cursor-pointer"
          >
            <span>Open Weekly Automation</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 2: Content Studio */}
        <div className="bg-white p-6 rounded-2xl border border-[#EAEAE6] shadow-xs flex flex-col justify-between hover:border-[#256D58]/40 transition-all">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <PenTool className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#66716B]">
                Engine 02
              </span>
              <h3 className="text-base font-bold text-[#171B1A]">Content Studio</h3>
            </div>
            <p className="text-xs text-[#66716B] leading-relaxed">
              Generate on-demand LinkedIn articles, Instagram carousels, and visual graphic assets with grounded brand guidance.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('/content-studio')}
            className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
          >
            <span>Launch Content Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 3: Lead Intelligence */}
        <div className="bg-white p-6 rounded-2xl border border-[#EAEAE6] shadow-xs flex flex-col justify-between hover:border-[#256D58]/40 transition-all">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#66716B]">
                Engine 03
              </span>
              <h3 className="text-base font-bold text-[#171B1A]">Lead Intelligence</h3>
            </div>
            <p className="text-xs text-[#66716B] leading-relaxed">
              Capture, qualify, and score inbound sales prospects using AI analysis based on company industry fit and deal size.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('/leads')}
            className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
          >
            <span>View Inbound Leads</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* =========================================================================
          CRAWL SETUP MODAL (Grounded Domain Setup)
          ========================================================================= */}
      {crawlOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#EAEAE6] bg-white p-6 sm:p-7 shadow-2xl my-auto">
            {crawlState === 'idle' && (
              <form onSubmit={startCrawl} className="space-y-4">
                <div className="flex items-start justify-between pb-3 border-b border-[#EAEAE6]">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#256D58]">
                      Knowledge Ingestion
                    </span>
                    <h3 className="text-lg font-bold text-[#171B1A] mt-1">
                      Configure Company Website
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCrawlOpen(false)}
                    className="p-1 rounded-lg text-[#66716B] hover:text-[#171B1A] hover:bg-[#F4F4F0]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-xs text-[#66716B] leading-relaxed">
                  Nexora will crawl and index your registered public website weekly to ground all AI marketing campaigns in real corporate context.
                </p>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#171B1A]">
                    Registered Website URL *
                  </label>
                  <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-[#EAEAE6] bg-[#FAFAF8] focus-within:border-[#256D58] focus-within:bg-white transition-all">
                    <Globe2 className="w-4 h-4 text-[#256D58] shrink-0" />
                    <input
                      type="url"
                      required
                      value={crawlUrl}
                      onChange={(e) => setCrawlUrl(e.target.value)}
                      placeholder="https://yourcompany.com"
                      className="w-full bg-transparent text-xs text-[#171B1A] outline-none"
                    />
                  </div>
                </div>

                {crawlError && (
                  <p className="text-xs text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200">
                    {crawlError}
                  </p>
                )}

                <div className="pt-3 border-t border-[#EAEAE6] flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setCrawlOpen(false)}
                    className="px-4 py-2 rounded-xl border border-[#EAEAE6] text-xs font-semibold text-[#171B1A] hover:bg-[#F4F4F0]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#256D58] hover:bg-[#1E5846] text-white text-xs font-semibold shadow-xs"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Start Ingestion Crawl</span>
                  </button>
                </div>
              </form>
            )}

            {crawlState === 'running' && (
              <div className="space-y-4 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#256D58]">
                      Ingestion In Progress
                    </span>
                    <h3 className="text-lg font-bold text-[#171B1A]">Crawling Website...</h3>
                  </div>
                  <Loader2 className="w-6 h-6 animate-spin text-[#256D58]" />
                </div>

                <div className="p-4 rounded-xl bg-[#FAFAF8] border border-[#EAEAE6] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#171B1A]">{crawlUrl}</span>
                    <span className="font-bold text-[#256D58]">{progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#EAEAE6] overflow-hidden">
                    <div
                      className="h-full bg-[#256D58] transition-all duration-500 rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex gap-4 text-[11px] text-[#66716B] pt-1">
                    <span>{pagesProcessed} pages processed</span>
                    <span>{sectionsSaved} pgvector chunks saved</span>
                  </div>
                </div>
              </div>
            )}

            {crawlState === 'success' && (
              <div className="text-center py-6 space-y-3">
                <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-[#171B1A]">Website Crawled Successfully</h3>
                <p className="text-xs text-[#66716B]">
                  {pagesProcessed} pages indexed • {sectionsSaved} sections stored in pgvector.
                </p>
                <p className="text-xs font-medium text-[#256D58] pt-2">Opening Content Studio...</p>
              </div>
            )}

            {crawlState === 'failed' && (
              <div className="text-center py-6 space-y-3">
                <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                  <X className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-[#171B1A]">Crawl Encountered An Error</h3>
                <p className="text-xs text-rose-600">{crawlError}</p>
                <button
                  type="button"
                  onClick={() => setCrawlState('idle')}
                  className="px-5 py-2 rounded-xl bg-[#256D58] text-white text-xs font-semibold"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OverviewPage;
