import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { marketingApi } from '../../../lib/api/marketing';
import { companyApi } from '../../../lib/api/company';
import {
  ContentItem,
  CrawledPageItem,
  CrawlTelemetryResponse,
  MarketingSummaryResponse,
  ContentGenerationBatch,
  Platform,
} from '../../../types';
import {
  Globe,
  Sparkles,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  ExternalLink,
  RefreshCw,
  Layers,
  ShieldCheck,
  Check,
  XCircle,
  Share2,
  ArrowRight,
  ChevronRight,
  FileText,
  Search,
  X,
  Zap,
} from 'lucide-react';

interface WeeklyAutomationPageProps {
  onInspectPost?: (item: ContentItem) => void;
  onNavigateToStudio?: () => void;
  onNavigateToReview?: (contentId?: string) => void;
}

export const WeeklyAutomationPage: React.FC<WeeklyAutomationPageProps> = ({
  onInspectPost,
  onNavigateToStudio,
  onNavigateToReview,
}) => {
  const { companyId, role } = useAuth();
  const canApprove = role === 'admin' || role === 'reviewer';

  // Internal Tabs: 'crawled' | 'generated' | 'scheduled'
  const [activeTab, setActiveTab] = useState<'crawled' | 'generated' | 'scheduled'>('crawled');

  // Summary Metrics State
  const [summary, setSummary] = useState<MarketingSummaryResponse | null>(null);

  // Tab 1: Crawled Websites State
  const [crawlData, setCrawlData] = useState<CrawlTelemetryResponse | null>(null);
  const [crawlLoading, setCrawlLoading] = useState<boolean>(true);
  const [crawlError, setCrawlError] = useState<string | null>(null);

  // Tab 2: Generated Weekly Posts State
  const [generatedPosts, setGeneratedPosts] = useState<ContentItem[]>([]);
  const [generatedLoading, setGeneratedLoading] = useState<boolean>(true);
  const [generatedError, setGeneratedError] = useState<string | null>(null);

  // Tab 3: Scheduled & Published Posts State
  const [scheduledPosts, setScheduledPosts] = useState<ContentItem[]>([]);
  const [scheduledLoading, setScheduledLoading] = useState<boolean>(true);
  const [scheduledError, setScheduledError] = useState<string | null>(null);

  // Selected post for pop-up modal inspection
  const [inspectedPost, setInspectedPost] = useState<ContentItem | null>(null);
  const [modalActionLoading, setModalActionLoading] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccessMsg, setModalSuccessMsg] = useState<string | null>(null);
  const [showModalRejectForm, setShowModalRejectForm] = useState<boolean>(false);
  const [modalRejectFeedback, setModalRejectFeedback] = useState<string>('');

  // On-demand Weekly Batch Generation State
  const [latestBatch, setLatestBatch] = useState<ContentGenerationBatch | null>(null);
  const [batchRunning, setBatchRunning] = useState<boolean>(false);
  const [showRunConfirmModal, setShowRunConfirmModal] = useState<boolean>(false);
  const [runPlatform, setRunPlatform] = useState<Platform>('instagram');
  const [runError, setRunError] = useState<string | null>(null);
  const [runSuccessMsg, setRunSuccessMsg] = useState<string | null>(null);

  const pollBatchStatus = () => {
    const timer = setInterval(async () => {
      try {
        const batch = await marketingApi.getLatestWeeklyPlan();
        if (batch) {
          setLatestBatch(batch);
          if (batch.status === 'completed' || batch.status === 'failed') {
            clearInterval(timer);
            setBatchRunning(false);
            if (batch.status === 'completed') {
              setRunSuccessMsg(`Weekly campaign ready! ${batch.posts?.length || 5} branded posts generated and staged for review.`);
              loadGeneratedPosts();
              loadSummary();
              setActiveTab('generated');
            } else {
              setRunError(batch.error_message || 'Weekly batch generation failed.');
            }
          }
        }
      } catch {
        // Non-blocking polling
      }
    }, 4000);
  };

  const handleRunWeeklyNow = async () => {
    setShowRunConfirmModal(false);
    setBatchRunning(true);
    setRunError(null);
    setRunSuccessMsg(null);
    try {
      const batch = await marketingApi.runWeeklyGenerationNow(runPlatform);
      setLatestBatch(batch);
      setRunSuccessMsg(`Weekly generation initiated for ${runPlatform}! Formulating verified briefs and rendering branded visual cards in the background.`);
      pollBatchStatus();
    } catch (err: any) {
      setRunError(err?.message || 'Failed to start weekly generation.');
      setBatchRunning(false);
    }
  };

  // On-demand crawl state
  const [triggeringCrawl, setTriggeringCrawl] = useState<boolean>(false);
  const [crawlTriggerSuccess, setCrawlTriggerSuccess] = useState<string | null>(null);

  const handleTriggerCrawl = async () => {
    if (!companyId) return;
    setTriggeringCrawl(true);
    setCrawlError(null);
    setCrawlTriggerSuccess(null);
    try {
      const comp = await companyApi.getCompany(companyId);
      if (!comp.website_url) {
        setCrawlError('No registered website URL found. Please set your website in Settings.');
        return;
      }
      await companyApi.startCrawl(companyId, comp.website_url);
      setCrawlTriggerSuccess(`Website crawl enqueued for ${comp.website_url}! Indexing pages in background.`);
      setTimeout(() => {
        loadCrawledWebsites();
        loadSummary();
      }, 2000);
    } catch (err: any) {
      setCrawlError(err?.message || 'Failed to start website crawl.');
    } finally {
      setTriggeringCrawl(false);
    }
  };

  // Load summary metrics and tab data
  const loadSummary = async () => {
    if (!companyId) return;
    try {
      const res = await marketingApi.getSummary(companyId);
      setSummary(res);
    } catch {
      // Graceful fallback: non-blocking
    }
  };

  const loadCrawledWebsites = async () => {
    if (!companyId) return;
    setCrawlLoading(true);
    setCrawlError(null);
    try {
      const data = await companyApi.getCrawledPages(companyId, { limit: 100 });
      setCrawlData(data);
    } catch (err: any) {
      setCrawlError(err?.message || 'Failed to load crawled websites telemetry.');
    } finally {
      setCrawlLoading(false);
    }
  };

  const loadGeneratedPosts = async () => {
    if (!companyId) return;
    setGeneratedLoading(true);
    setGeneratedError(null);
    try {
      // 1. Attempt to get latest weekly batch
      const latestBatch = await marketingApi.getLatestWeeklyPlan();
      if (latestBatch && latestBatch.posts && latestBatch.posts.length > 0) {
        setGeneratedPosts(latestBatch.posts);
      } else {
        // Fallback: query all content items created by autonomous engine or pending review
        const res = await marketingApi.listContent(companyId, { limit: 50 });
        setGeneratedPosts(res.items);
      }
    } catch (err: any) {
      setGeneratedError(err?.message || 'Failed to load generated posts.');
    } finally {
      setGeneratedLoading(false);
    }
  };

  const loadScheduledPosts = async () => {
    if (!companyId) return;
    setScheduledLoading(true);
    setScheduledError(null);
    try {
      // Fetch posts that are scheduled or published
      const res = await marketingApi.listContent(companyId, { limit: 100 });
      // Keep items that either have a proposed schedule or are published/scheduled
      const filtered = res.items.filter(
        (item) => item.scheduled_at || item.publish_status === 'scheduled' || item.publish_status === 'published'
      );
      setScheduledPosts(filtered.length > 0 ? filtered : res.items);
    } catch (err: any) {
      setScheduledError(err?.message || 'Failed to load scheduled posts.');
    } finally {
      setScheduledLoading(false);
    }
  };

  useEffect(() => {
    if (!companyId) return;
    loadSummary();
    loadCrawledWebsites();
    loadGeneratedPosts();
    loadScheduledPosts();

    // Check latest weekly batch status on mount
    marketingApi.getLatestWeeklyPlan().then((batch) => {
      if (batch) {
        setLatestBatch(batch);
        if (batch.status === 'generating' || batch.status === 'queued') {
          setBatchRunning(true);
          pollBatchStatus();
        }
      }
    }).catch(() => {});
  }, [companyId]);

  const handleInspect = (item: ContentItem) => {
    setInspectedPost(item);
    setModalActionLoading(false);
    setModalError(null);
    setModalSuccessMsg(null);
    setShowModalRejectForm(false);
    setModalRejectFeedback('');
    if (onInspectPost) {
      onInspectPost(item);
    }
  };

  const handleModalApprove = async () => {
    if (!inspectedPost || !canApprove) return;
    setModalActionLoading(true);
    setModalError(null);
    setModalSuccessMsg(null);
    try {
      const updated = await marketingApi.approveContent(inspectedPost.content_id);
      setInspectedPost(updated);
      setModalSuccessMsg(
        updated.scheduled_at
          ? `Post approved and scheduled for ${formatDate(updated.scheduled_at)}!`
          : 'Post approved successfully!'
      );
      // Update in generatedPosts
      setGeneratedPosts((prev) =>
        prev.map((p) => (p.content_id === updated.content_id ? updated : p))
      );
      // Update or prepend in scheduledPosts
      setScheduledPosts((prev) => {
        const exists = prev.some((p) => p.content_id === updated.content_id);
        if (exists) {
          return prev.map((p) => (p.content_id === updated.content_id ? updated : p));
        }
        return [updated, ...prev];
      });
      loadSummary();
    } catch (err: any) {
      setModalError(err?.message || 'Failed to approve content draft.');
    } finally {
      setModalActionLoading(false);
    }
  };

  const handleModalReject = async () => {
    if (!inspectedPost || !canApprove) return;
    if (!modalRejectFeedback.trim()) {
      setModalError('Please provide a reason for rejection.');
      return;
    }
    setModalActionLoading(true);
    setModalError(null);
    setModalSuccessMsg(null);
    try {
      const updated = await marketingApi.rejectContent(
        inspectedPost.content_id,
        modalRejectFeedback.trim()
      );
      setInspectedPost(updated);
      setShowModalRejectForm(false);
      setModalSuccessMsg('Post rejected. Revision guidance has been recorded.');
      // Update in generatedPosts
      setGeneratedPosts((prev) =>
        prev.map((p) => (p.content_id === updated.content_id ? updated : p))
      );
      // Update in scheduledPosts
      setScheduledPosts((prev) =>
        prev.map((p) => (p.content_id === updated.content_id ? updated : p))
      );
      loadSummary();
    } catch (err: any) {
      setModalError(err?.message || 'Failed to reject content draft.');
    } finally {
      setModalActionLoading(false);
    }
  };

  // Helper formatting dates in local/company timezone
  const formatDate = (isoString?: string | null): string => {
    if (!isoString) return 'Not scheduled';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      {/* =========================================================================
          TOP ACTION HEADER: Brand Title + Run Weekly Generation Now
          ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-[#EAEAE6] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#171B1A]">Autonomous Weekly Marketing Engine</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              DataFactZ Branded
            </span>
          </div>
          <p className="text-xs text-[#66716B] mt-0.5 max-w-2xl">
            Crawls datafactz.ai, grounds creative briefs with pgvector & Ollama, generates rich OpenRouter visuals, and stages 5 weekly posts in Pending Review.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowRunConfirmModal(true)}
          disabled={batchRunning}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#256D58] hover:bg-[#1E5846] text-white text-xs font-semibold shadow-xs hover:shadow-sm transition-all cursor-pointer disabled:opacity-50 shrink-0"
        >
          {batchRunning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Generating Weekly Campaign...</span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 text-amber-300" />
              <span>Run Weekly Generation Now</span>
            </>
          )}
        </button>
      </div>

      {/* Live Batch Generation Status Banner */}
      {batchRunning && (
        <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-blue-900 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
            <div>
              <span className="font-semibold block">Weekly Batch Generation in Progress</span>
              <span className="text-[11px] text-blue-800">
                1. Ingesting DataFactZ knowledge • 2. Formulating structured briefs • 3. Rendering branded visuals via OpenRouter • 4. Staging for review
              </span>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 shrink-0">
            Background Processing
          </span>
        </div>
      )}

      {runSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2.5 text-xs text-emerald-800 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{runSuccessMsg}</span>
          </div>
          <button onClick={() => setRunSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {runError && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-2.5 text-xs text-rose-700 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{runError}</span>
          </div>
          <button onClick={() => setRunError(null)} className="text-rose-700 hover:text-rose-900 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* =========================================================================
          TOP SUMMARY METRICS: 3 Core Indicators
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Metric 1: Crawled Pages */}
        <div className="bg-white p-5 rounded-2xl border border-[#EAEAE6] shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#66716B]">
              Crawled Pages
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#256D58]/10 text-[#256D58] flex items-center justify-center">
              <Globe className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#171B1A]">
              {summary ? summary.crawled_pages : crawlData?.total ?? 0}
            </span>
            <span className="text-xs text-[#256D58] font-medium">Automatic Sync</span>
          </div>
          <p className="text-[11px] text-[#66716B] mt-1">
            Change detection enabled • Grounded in pgvector
          </p>
        </div>

        {/* Metric 2: Generated Posts */}
        <div className="bg-white p-5 rounded-2xl border border-[#EAEAE6] shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#66716B]">
              Generated Posts
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#171B1A]">
              {summary ? summary.generated_posts : generatedPosts.length}
            </span>
            <span className="text-xs text-blue-700 font-medium">Weekly Batch</span>
          </div>
          <p className="text-[11px] text-[#66716B] mt-1">
            Grounded by Ollama + Branded visual generation
          </p>
        </div>

        {/* Metric 3: Scheduled Posts */}
        <div className="bg-white p-5 rounded-2xl border border-[#EAEAE6] shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#66716B]">
              Scheduled Posts
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#171B1A]">
              {summary ? summary.scheduled_posts : scheduledPosts.length}
            </span>
            <span className="text-xs text-emerald-700 font-medium">Approval-Gated</span>
          </div>
          <p className="text-[11px] text-[#66716B] mt-1">
            Dispatched strictly after human review
          </p>
        </div>
      </div>

      {/* =========================================================================
          INTERNAL TABS: Crawled Websites | Generated Posts | Scheduled Posts
          ========================================================================= */}
      <div className="flex items-center gap-2 border-b border-[#EAEAE6] pb-1">
        <button
          onClick={() => setActiveTab('crawled')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === 'crawled'
              ? 'bg-[#256D58] text-white shadow-xs'
              : 'text-[#66716B] hover:text-[#171B1A] hover:bg-[#FAFAF8]'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Crawled Websites</span>
          {crawlData && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'crawled' ? 'bg-white/20 text-white' : 'bg-[#EAEAE6] text-[#171B1A]'
              }`}
            >
              {crawlData.total}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('generated')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === 'generated'
              ? 'bg-[#256D58] text-white shadow-xs'
              : 'text-[#66716B] hover:text-[#171B1A] hover:bg-[#FAFAF8]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Generated Posts</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'generated' ? 'bg-white/20 text-white' : 'bg-[#EAEAE6] text-[#171B1A]'
            }`}
          >
            {generatedPosts.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('scheduled')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === 'scheduled'
              ? 'bg-[#256D58] text-white shadow-xs'
              : 'text-[#66716B] hover:text-[#171B1A] hover:bg-[#FAFAF8]'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Scheduled Posts</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'scheduled' ? 'bg-white/20 text-white' : 'bg-[#EAEAE6] text-[#171B1A]'
            }`}
          >
            {scheduledPosts.length}
          </span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: CRAWLED WEBSITES
          ========================================================================= */}
      {activeTab === 'crawled' && (
        <div className="space-y-4">
          {/* Action Bar: Knowledge Ingestion Status + Manual Crawl Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-[#EAEAE6] shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-[#171B1A] flex items-center gap-2">
                <span>Company Knowledge Crawl Engine</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  pgvector Sync
                </span>
              </h3>
              <p className="text-xs text-[#66716B] mt-0.5">
                Automatically crawled weekly by Celery Beat or triggered on-demand to index new announcements.
              </p>
            </div>

            <button
              type="button"
              onClick={handleTriggerCrawl}
              disabled={triggeringCrawl}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#256D58] hover:bg-[#1E5846] text-white text-xs font-semibold shadow-xs hover:shadow-sm transition-all cursor-pointer disabled:opacity-50 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${triggeringCrawl ? 'animate-spin' : ''}`} />
              <span>{triggeringCrawl ? 'Crawling Website...' : 'Crawl Website Now'}</span>
            </button>
          </div>

          {crawlTriggerSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-800 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{crawlTriggerSuccess}</span>
            </div>
          )}

          {/* Recent Crawl Job Summary Banner */}
          {crawlData?.latest_job && (
            <div className="p-4 rounded-xl bg-white border border-[#EAEAE6] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold text-[#171B1A]">
                  Latest Automatic Sync:
                </span>
                <span className="text-[#66716B] capitalize font-medium">
                  {crawlData.latest_job.status}
                </span>
                <span className="text-[#8E9793]">•</span>
                <span className="text-[#66716B]">
                  {crawlData.latest_job.pages_crawled} pages indexed
                </span>
                {crawlData.latest_job.finished_at && (
                  <>
                    <span className="text-[#8E9793]">•</span>
                    <span className="text-[#66716B]">
                      {formatDate(crawlData.latest_job.finished_at)}
                    </span>
                  </>
                )}
              </div>

              {crawlData.summary && (
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {crawlData.summary.unchanged_count} Unchanged
                  </span>
                  {crawlData.summary.changed_count > 0 && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                      {crawlData.summary.changed_count} Updated
                    </span>
                  )}
                  {crawlData.summary.failed_count > 0 && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                      {crawlData.summary.failed_count} Errors
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {crawlError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{crawlError}</span>
            </div>
          )}

          {crawlLoading ? (
            <div className="py-16 text-center text-xs text-[#66716B]">
              <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-[#256D58]" />
              Loading crawled websites...
            </div>
          ) : !crawlData || crawlData.items.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-[#EAEAE6]">
              <Globe className="w-10 h-10 mx-auto mb-2 text-[#8E9793] opacity-60" />
              <p className="text-sm font-semibold text-[#171B1A]">No crawled pages found yet</p>
              <p className="text-xs text-[#66716B] mt-1 max-w-sm mx-auto">
                Nexora.AI automatically crawls your configured website weekly to extract verified company context.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#EAEAE6] overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAFAF8] border-b border-[#EAEAE6] text-[#66716B] font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Page Title & URL</th>
                      <th className="py-3 px-4">Last Crawled</th>
                      <th className="py-3 px-4">Indexing Status</th>
                      <th className="py-3 px-4">Change State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAEAE6]">
                    {crawlData.items.map((page: CrawledPageItem) => (
                      <tr key={page.page_id} className="hover:bg-[#FAFAF8] transition-colors">
                        <td className="py-3.5 px-4 max-w-md">
                          <p className="font-semibold text-[#171B1A] truncate">{page.title}</p>
                          <a
                            href={page.page_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-[#256D58] hover:underline mt-0.5 truncate max-w-sm"
                          >
                            <span className="truncate">{page.page_url}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        </td>
                        <td className="py-3.5 px-4 text-[#66716B] whitespace-nowrap">
                          {formatDate(page.crawled_at)}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {page.crawl_status === 'success' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> Indexed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertCircle className="w-3 h-3" /> {page.crawl_status}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {page.change_status === 'changed' ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              Changed
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FAFAF8] text-[#66716B] border border-[#EAEAE6]">
                              Unchanged
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: GENERATED POSTS (Weekly Campaign)
          ========================================================================= */}
      {activeTab === 'generated' && (
        <div className="space-y-4">
          {generatedError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{generatedError}</span>
            </div>
          )}

          {generatedLoading ? (
            <div className="py-16 text-center text-xs text-[#66716B]">
              <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-[#256D58]" />
              Loading generated posts...
            </div>
          ) : generatedPosts.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-[#EAEAE6]">
              <Sparkles className="w-10 h-10 mx-auto mb-2 text-[#8E9793] opacity-60" />
              <p className="text-sm font-semibold text-[#171B1A]">No weekly posts generated yet</p>
              <p className="text-xs text-[#66716B] mt-1 max-w-sm mx-auto">
                Celery Beat runs the weekly campaign generator autonomously, or you can create posts on demand in Content Studio.
              </p>
              {onNavigateToStudio && (
                <button
                  onClick={onNavigateToStudio}
                  className="mt-4 px-4 py-2 rounded-xl bg-[#256D58] text-white text-xs font-semibold hover:bg-[#1E5846] transition-colors"
                >
                  Open Content Studio
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {generatedPosts.map((post) => {
                const isApproved = post.approval_status === 'approved';
                const isRejected = post.approval_status === 'rejected';

                return (
                  <div
                    key={post.content_id}
                    className="bg-white rounded-2xl border border-[#EAEAE6] overflow-hidden flex flex-col justify-between shadow-xs hover:border-[#256D58]/40 transition-all"
                  >
                    <div>
                      {/* Image Thumbnail */}
                      <div className="h-44 bg-[#F4F4F0] relative overflow-hidden flex items-center justify-center border-b border-[#EAEAE6]">
                        {post.image_url ? (
                          <img
                            src={post.image_url}
                            alt={post.content_title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-center text-[#8E9793] p-4">
                            <Sparkles className="w-8 h-8 mx-auto mb-1 opacity-40 text-[#256D58]" />
                            <span className="text-[11px]">Visual Graphic Asset</span>
                          </div>
                        )}

                        {/* Platform Badge */}
                        <div className="absolute top-2.5 left-2.5">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-black/75 text-white backdrop-blur-xs">
                            {post.platform_target}
                          </span>
                        </div>

                        {/* Approval Status Badge */}
                        <div className="absolute top-2.5 right-2.5">
                          {isApproved ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-600 text-white shadow-xs">
                              Approved
                            </span>
                          ) : isRejected ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-600 text-white shadow-xs">
                              Rejected
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500 text-white shadow-xs">
                              Pending Review
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Content Card Body */}
                      <div className="p-4 space-y-2">
                        <h3 className="font-semibold text-sm text-[#171B1A] line-clamp-1">
                          {post.content_title}
                        </h3>
                        <p className="text-xs text-[#66716B] line-clamp-3 leading-relaxed">
                          {post.content_text}
                        </p>
                      </div>
                    </div>

                    {/* Card Footer: Proposed Time & Inspect CTA */}
                    <div className="p-4 pt-2 border-t border-[#EAEAE6] bg-[#FAFAF8] flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-[#8E9793] block">
                          Proposed Schedule
                        </span>
                        <span className="text-[11px] font-medium text-[#171B1A]">
                          {formatDate(post.scheduled_at)}
                        </span>
                      </div>

                      <button
                        onClick={() => handleInspect(post)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#EAEAE6] text-xs font-semibold text-[#171B1A] hover:bg-[#F4F4F0] hover:border-[#171B1A] transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: SCHEDULED POSTS
          ========================================================================= */}
      {activeTab === 'scheduled' && (
        <div className="space-y-4">
          {/* Strict Human-in-the-Loop Guarantee Notice */}
          <div className="p-3.5 rounded-xl bg-[#FAFAF8] border border-[#EAEAE6] flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-[#171B1A]">
              <ShieldCheck className="w-4 h-4 text-[#256D58] shrink-0" />
              <span>
                <strong>Zero-Unapproved-Publishing Guarantee:</strong> Celery Beat only dispatches posts with <span className="text-emerald-700 font-semibold">Approved</span> status. Drafts pending review are never sent to social channels.
              </span>
            </div>
          </div>

          {scheduledError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{scheduledError}</span>
            </div>
          )}

          {scheduledLoading ? (
            <div className="py-16 text-center text-xs text-[#66716B]">
              <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-[#256D58]" />
              Loading scheduled posts...
            </div>
          ) : scheduledPosts.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-[#EAEAE6]">
              <Calendar className="w-10 h-10 mx-auto mb-2 text-[#8E9793] opacity-60" />
              <p className="text-sm font-semibold text-[#171B1A]">No scheduled or published posts</p>
              <p className="text-xs text-[#66716B] mt-1 max-w-sm mx-auto">
                Approve generated weekly drafts in Weekly Automation to activate automatic scheduled publishing.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#EAEAE6] overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAFAF8] border-b border-[#EAEAE6] text-[#66716B] font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Post & Thumbnail</th>
                      <th className="py-3 px-4">Platform</th>
                      <th className="py-3 px-4">Scheduled Date/Time</th>
                      <th className="py-3 px-4">Approval Status</th>
                      <th className="py-3 px-4">Publishing State</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAEAE6]">
                    {scheduledPosts.map((post) => {
                      const isApproved = post.approval_status === 'approved';
                      const pubStatus = post.publish_status || 'draft';

                      return (
                        <tr key={post.content_id} className="hover:bg-[#FAFAF8] transition-colors">
                          {/* Post Title & Thumbnail */}
                          <td className="py-3 px-4 max-w-sm">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-[#F4F4F0] border border-[#EAEAE6] shrink-0 overflow-hidden flex items-center justify-center">
                                {post.image_url ? (
                                  <img
                                    src={post.image_url}
                                    alt={post.content_title}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <FileText className="w-4 h-4 text-[#8E9793]" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-[#171B1A] truncate">
                                  {post.content_title}
                                </p>
                                <p className="text-[11px] text-[#66716B] truncate">
                                  {post.topic || 'Weekly Automation'}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Social Platform */}
                          <td className="py-3 px-4 capitalize font-medium text-[#171B1A]">
                            <span className="inline-flex items-center gap-1">
                              <Share2 className="w-3 h-3 text-[#66716B]" />
                              {post.platform_target}
                            </span>
                          </td>

                          {/* Scheduled Date/Time in Company Timezone */}
                          <td className="py-3 px-4 text-[#171B1A] whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-[#66716B]" />
                              <span>{formatDate(post.scheduled_at)}</span>
                            </div>
                          </td>

                          {/* Approval Status */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {isApproved ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" /> Approved
                              </span>
                            ) : post.approval_status === 'rejected' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                <XCircle className="w-3 h-3" /> Rejected
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="w-3 h-3" /> Pending Review
                              </span>
                            )}
                          </td>

                          {/* Publishing State Differentiated */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {pubStatus === 'published' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                                <Check className="w-3 h-3" /> Published
                              </span>
                            ) : pubStatus === 'publishing' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 animate-pulse">
                                <RefreshCw className="w-3 h-3 animate-spin" /> Publishing...
                              </span>
                            ) : isApproved && pubStatus === 'scheduled' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Calendar className="w-3 h-3" /> Approved & Scheduled
                              </span>
                            ) : pubStatus === 'failed' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200" title={post.publish_error || ''}>
                                <AlertCircle className="w-3 h-3" /> Failed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                Proposed (Pending Approval)
                              </span>
                            )}
                          </td>

                          {/* Inspect / View Details Action */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              onClick={() => handleInspect(post)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#EAEAE6] text-xs font-semibold text-[#171B1A] hover:bg-[#F4F4F0] hover:border-[#171B1A] transition-colors cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Inspect</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          INSPECTION & APPROVAL POP-UP MODAL
          ========================================================================= */}
      {inspectedPost && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setInspectedPost(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-3xl w-full p-6 sm:p-7 shadow-2xl border border-[#EAEAE6] max-h-[92vh] flex flex-col my-auto animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-[#EAEAE6]">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#171B1A] text-white">
                    {inspectedPost.platform_target}
                  </span>
                  {inspectedPost.approval_status === 'approved' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Approved
                    </span>
                  ) : inspectedPost.approval_status === 'rejected' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                      <XCircle className="w-3.5 h-3.5 text-rose-600" /> Rejected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      <Clock className="w-3.5 h-3.5 text-amber-600" /> Pending Review
                    </span>
                  )}
                </div>
                <h3 className="text-base sm:text-lg font-bold text-[#171B1A]">
                  {inspectedPost.content_title}
                </h3>
              </div>
              <button
                onClick={() => setInspectedPost(null)}
                className="p-1.5 rounded-lg text-[#66716B] hover:text-[#171B1A] hover:bg-[#F4F4F0] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notification Banners */}
            {modalSuccessMsg && (
              <div className="mt-3 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-800 animate-in fade-in duration-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{modalSuccessMsg}</span>
              </div>
            )}

            {modalError && (
              <div className="mt-3 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-xs text-rose-700 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {/* Modal Body */}
            <div className="overflow-y-auto flex-1 space-y-4 py-3 pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Left Column: Image Asset & Meta */}
                <div className="space-y-3">
                  {inspectedPost.image_url ? (
                    <div className="space-y-2">
                      <div className="rounded-xl overflow-hidden border border-[#EAEAE6] bg-[#F4F4F0] flex items-center justify-center max-h-[380px]">
                        <img
                          src={inspectedPost.image_url}
                          alt={inspectedPost.content_title}
                          className="w-full h-full object-contain max-h-[380px] rounded-lg"
                        />
                      </div>
                      <div className="flex items-center justify-between px-1 text-[11px] text-[#66716B]">
                        <span className="font-mono text-[10px]">DataFactZ Branded Visual</span>
                        <a
                          href={inspectedPost.image_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#256D58] hover:underline font-semibold"
                        >
                          <span>Open Full Size</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-[#EAEAE6] bg-[#FAFAF8] p-8 text-center">
                      <Sparkles className="w-10 h-10 mx-auto mb-2 text-[#256D58] opacity-60" />
                      <p className="text-xs font-semibold text-[#171B1A]">Visual Graphic Asset</p>
                      <p className="text-[11px] text-[#66716B] mt-1">Autonomous Grounded Weekly Campaign</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2.5 text-xs bg-[#FAFAF8] p-3 rounded-xl border border-[#EAEAE6]">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-[#8E9793] block">Platform</span>
                      <span className="font-semibold text-[#171B1A] uppercase">{inspectedPost.platform_target}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-[#8E9793] block">Approval Status</span>
                      <span className="font-semibold text-[#171B1A] capitalize">{inspectedPost.approval_status}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-[#8E9793] block">Publishing Status</span>
                      <span className="font-semibold text-[#171B1A] capitalize">{inspectedPost.publish_status || 'draft'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-[#8E9793] block">Scheduled Time</span>
                      <span className="font-semibold text-[#171B1A]">{formatDate(inspectedPost.scheduled_at)}</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Caption & Status Details */}
                <div className="space-y-3 flex flex-col justify-between">
                  <div className="space-y-1.5 flex-1 flex flex-col">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#66716B]">
                      Caption & Post Content
                    </label>
                    <div className="p-3.5 rounded-xl bg-[#FAFAF8] border border-[#EAEAE6] text-xs font-sans text-[#171B1A] whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto flex-1">
                      {inspectedPost.content_text}
                    </div>
                  </div>

                  {/* Status Callout Card */}
                  {inspectedPost.approval_status === 'approved' ? (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold block">Post is Approved</span>
                        <span className="text-[11px] text-emerald-800">
                          Authorized for automatic scheduled publishing by Celery Beat on {formatDate(inspectedPost.scheduled_at)}.
                        </span>
                      </div>
                    </div>
                  ) : inspectedPost.approval_status === 'rejected' ? (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2.5">
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold block">Post is Rejected</span>
                        <span className="text-[11px] text-rose-800">
                          This post will not be dispatched to social channels. You can re-approve if revisions are accepted.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold block">Pending Human Review</span>
                        <span className="text-[11px] text-amber-800">
                          Click "Approve & Schedule" below to authorize Celery Beat to publish at the scheduled time.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Rejection Form (Expandable) */}
              {showModalRejectForm && (
                <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-200 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-900">
                      Rejection Reason & Revision Guidance *
                    </span>
                    <button
                      onClick={() => setShowModalRejectForm(false)}
                      className="text-[11px] text-[#66716B] hover:text-[#171B1A] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  {/* Suggestion Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Tone needs adjustment',
                      'Image does not match the brand',
                      'Information needs verification',
                      'Other',
                    ].map((chip) => (
                      <button
                        type="button"
                        key={chip}
                        onClick={() =>
                          setModalRejectFeedback((prev) => (prev ? `${prev}. ${chip}` : chip))
                        }
                        className="px-2.5 py-1 rounded-full text-[11px] bg-white border border-rose-200 text-rose-800 hover:bg-rose-100 transition-colors cursor-pointer"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={3}
                    value={modalRejectFeedback}
                    onChange={(e) => setModalRejectFeedback(e.target.value)}
                    placeholder="Explain why this post is rejected so the team can adjust..."
                    className="w-full p-2.5 text-xs rounded-xl border border-rose-200 bg-white text-[#171B1A] placeholder:text-[#8E9793] focus:outline-none focus:border-rose-400 leading-relaxed"
                  />

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowModalRejectForm(false)}
                      className="px-3 py-1.5 text-xs font-semibold text-[#66716B] hover:text-[#171B1A] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={modalActionLoading || !modalRejectFeedback.trim()}
                      onClick={handleModalReject}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
                    >
                      {modalActionLoading ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" />
                      )}
                      <span>Confirm Rejection</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#EAEAE6]">
              <span className="text-[11px] text-[#8E9793]">
                Post ID: {inspectedPost.content_id.slice(0, 8)}...
              </span>

              <div className="flex items-center gap-2.5">
                {canApprove && !showModalRejectForm && (
                  <>
                    {inspectedPost.approval_status !== 'approved' && (
                      <button
                        type="button"
                        disabled={modalActionLoading}
                        onClick={handleModalApprove}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#256D58] hover:bg-[#1E5846] text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                      >
                        {modalActionLoading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>{inspectedPost.scheduled_at ? 'Approve & Schedule' : 'Approve'}</span>
                      </button>
                    )}

                    {inspectedPost.approval_status !== 'rejected' && (
                      <button
                        type="button"
                        disabled={modalActionLoading}
                        onClick={() => {
                          setShowModalRejectForm(true);
                          setModalError(null);
                          setModalSuccessMsg(null);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    )}
                  </>
                )}

                {!canApprove && (
                  <span className="text-[11px] text-[#8E9793] italic">
                    Approval requires Admin or Reviewer role
                  </span>
                )}

                <button
                  onClick={() => setInspectedPost(null)}
                  className="px-4 py-2 rounded-xl border border-[#EAEAE6] text-xs font-semibold text-[#171B1A] hover:bg-[#F4F4F0] transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Confirmation Modal for Run Weekly Generation Now */}
      {showRunConfirmModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowRunConfirmModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#EAEAE6] space-y-4 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-[#EAEAE6]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#171B1A]">Run Weekly Generation Now</h3>
                  <p className="text-xs text-[#66716B]">On-demand weekly campaign dispatch</p>
                </div>
              </div>
              <button
                onClick={() => setShowRunConfirmModal(false)}
                className="p-1 rounded-lg text-[#66716B] hover:text-[#171B1A] hover:bg-[#F4F4F0] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#66716B] leading-relaxed">
              <p>
                This will trigger an asynchronous Celery batch job that performs the complete DataFactZ marketing workflow:
              </p>
              <ul className="space-y-2 pl-4 list-disc text-[#171B1A]">
                <li><strong>Grounded Topics:</strong> Selects 5 verified DataFactZ capability pillars (Enterprise AI Agents, Governed Foundations, etc.)</li>
                <li><strong>Creative Briefs:</strong> Generates headlines, subheadlines, key value points, and concise platform copy.</li>
                <li><strong>Branded Visuals:</strong> Invokes OpenRouter (recraft-v3) with fallback to produce authentic 1080x1350 visual cards.</li>
                <li><strong>Zero Unapproved Publishing:</strong> All 5 posts are saved in <strong>Pending Review</strong> status. No posts will publish until approved by an admin.</li>
              </ul>

              <div className="pt-2">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#171B1A] mb-1.5">
                  Target Social Platform
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRunPlatform('instagram')}
                    className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer ${
                      runPlatform === 'instagram'
                        ? 'border-[#256D58] bg-[#256D58]/5 text-[#256D58]'
                        : 'border-[#EAEAE6] text-[#66716B] hover:bg-[#FAFAF8]'
                    }`}
                  >
                    Instagram (4:5 Card)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRunPlatform('linkedin')}
                    className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer ${
                      runPlatform === 'linkedin'
                        ? 'border-[#256D58] bg-[#256D58]/5 text-[#256D58]'
                        : 'border-[#EAEAE6] text-[#66716B] hover:bg-[#FAFAF8]'
                    }`}
                  >
                    LinkedIn (16:9 Feed)
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#EAEAE6]">
              <button
                type="button"
                onClick={() => setShowRunConfirmModal(false)}
                className="px-4 py-2 rounded-xl border border-[#EAEAE6] text-xs font-semibold text-[#171B1A] hover:bg-[#F4F4F0] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRunWeeklyNow}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#256D58] hover:bg-[#1E5846] text-white text-xs font-semibold shadow-xs cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>Confirm & Run Batch</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default WeeklyAutomationPage;