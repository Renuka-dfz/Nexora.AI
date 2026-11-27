import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { marketingApi } from '../../lib/api/marketing';
import { companyApi } from '../../lib/api/company';
import {
  ContentItem,
  WebsiteCrawlJob,
  Company,
  MarketingSummaryResponse,
} from '../../types';
import {
  FileText,
  Share2,
  Image as ImageIcon,
  Video,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Search,
  PenTool,
  Send,
  Eye,
  RefreshCw,
  ChevronRight,
  ShieldCheck,
  Globe,
  Database,
  ArrowRight,
  ArrowLeft,
  Terminal,
  Filter,
  Tag,
  Server,
  Check,
  Layers,
  Sparkles,
  Square,
  Download,
  BarChart3,
} from 'lucide-react';
import { GeneratedVideoReel } from '../content-studio/components/GeneratedVideoReel';
import { InstagramFieldViewer } from '../content-studio/components/InstagramFieldViewer';
import { parseInstagramContent } from '../content-studio/components/instagramParser';
import { WeeklyAutomationPage } from './automation/WeeklyAutomationPage';

interface MarketingWorkspacePageProps {
  onNavigate: (path: string) => void;
  initialTab?: 'automation' | 'analytics' | 'review' | 'crawl';
}

const getDomain = (url?: string | null): string => {
  if (!url) return '';
  try {
    const raw = url.trim();
    const parsed = new URL(raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`);
    return parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
};

const getInstagramCaption = (item: ContentItem): string => {
  const parsed = parseInstagramContent(item.content_text, item.content_title);
  return [parsed.caption, parsed.description, parsed.hashtags.join(' ')].filter(Boolean).join('\n\n');
};

export const MarketingWorkspacePage: React.FC<MarketingWorkspacePageProps> = ({
  onNavigate,
  initialTab = 'automation',
}) => {
  const { companyId, role } = useAuth();

  // Primary Marketing Workspace Sub-Tabs: 1. Weekly Automation | 2. Analytics (plus legacy deep links)
  const [activeTab, setActiveTab] = useState<'automation' | 'analytics' | 'review' | 'crawl'>(() => {
    if (initialTab === 'analytics') return 'analytics';
    if (initialTab === 'crawl') return 'crawl';
    if (initialTab === 'review') return 'review';
    return 'automation';
  });

  // Marketing metrics summary from backend
  const [summary, setSummary] = useState<MarketingSummaryResponse | null>(null);

  // =========================================================================
  // TAB 1: EDITORIAL REVIEW QUEUE STATE
  // =========================================================================
  const [items, setItems] = useState<ContentItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters for drafts
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [typeFilter, setTypeFilter] = useState<'all' | 'article' | 'post' | 'image' | 'video'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Rejection Reason Modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectFeedback, setRejectFeedback] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  // Instagram Integration State
  const [instagramStatus, setInstagramStatus] = useState<{
    connected: boolean;
    user_id?: string;
    account_username?: string;
  } | null>(null);
  const [publishingIgId, setPublishingIgId] = useState<string | null>(null);

  // Instagram Publish Modal
  const [showIgModal, setShowIgModal] = useState(false);
  const [igModalItem, setIgModalItem] = useState<ContentItem | null>(null);
  const [igModalCaption, setIgModalCaption] = useState('');
  const [igModalImageLoaded, setIgModalImageLoaded] = useState(false);
  const [igModalImageLoadError, setIgModalImageLoadError] = useState(false);

  // LinkedIn Integration State
  const [linkedinStatus, setLinkedinStatus] = useState<{
    connected: boolean;
    author_urn?: string;
    account_name?: string;
  } | null>(null);
  const [publishingLiId, setPublishingLiId] = useState<string | null>(null);

  // Rejection reasons map
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('nexora_rejection_reasons');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // =========================================================================
  // TAB 2: WEB CRAWL STATE
  // =========================================================================
  const [company, setCompany] = useState<Company | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [crawlLoading, setCrawlLoading] = useState(false);
  const [activeJob, setActiveJob] = useState<WebsiteCrawlJob | null>(null);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [crawlSuccess, setCrawlSuccess] = useState<string | null>(null);
  const pollingRef = useRef<any>(null);
  const stepTimerRef = useRef<any>(null);

  // Live Step Execution for Web Crawling
  // 1: Crawling Started, 2: Inspected, 3: Extracted, 4: Normalization & Cleaning, 5: Classification into Categories, 6: Saved into DB (pgAdmin / pgvector)
  const [crawlLiveStep, setCrawlLiveStep] = useState<number>(0);
  const [crawlLogs, setCrawlLogs] = useState<
    Array<{
      timestamp: string;
      stepTitle: string;
      stepNumber: number;
      message: string;
      status: 'pending' | 'running' | 'completed';
    }>
  >([]);

  const canApprove = role === 'admin' || role === 'reviewer';
  const isAdmin = role === 'admin';
  const igModalImageUrl = (igModalItem?.image_url || '').trim();
  const igModalPublishReady =
    igModalImageUrl.startsWith('https://') &&
    Boolean(igModalCaption.trim()) &&
    igModalCaption.length <= 2200 &&
    igModalImageLoaded &&
    !igModalImageLoadError;

  // Registered Website Domain policy validation
  const registeredUrl = company?.website_url?.trim() || '';
  const registeredDomain = getDomain(registeredUrl);
  const targetDomain = getDomain(websiteUrl);
  const hasRegisteredDomain = Boolean(registeredDomain);
  const isDomainMismatch = hasRegisteredDomain && Boolean(targetDomain) && targetDomain !== registeredDomain;

  // -------------------------------------------------------------------------
  // Fetch drafts from API
  // -------------------------------------------------------------------------
  const loadContent = async () => {
    if (!companyId) return;

    try {
      setLoading(true);
      setError(null);
      const res = await marketingApi.listContent(companyId, { limit: 100 });
      const fetchedItems = res?.items || [];
      setItems(fetchedItems);

      // Smart default: If there are no pending review items, default to 'all' so existing approved/rejected drafts are visible immediately
      const hasPending = fetchedItems.some((i) => i.approval_status === 'pending');
      if (!hasPending && fetchedItems.length > 0) {
        setStatusFilter('all');
      }

      if (fetchedItems.length > 0) {
        setSelectedItem((prev) => {
          if (prev) {
            const found = fetchedItems.find((i) => i.content_id === prev.content_id);
            if (found) return found;
          }
          return null;
        });
      } else {
        setSelectedItem(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load content workflow state');
      setItems([]);
      setSelectedItem(null);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Fetch company info for website URL
  // -------------------------------------------------------------------------
  const loadCompanyInfo = async () => {
    if (!companyId) return;
    try {
      const comp = await companyApi.getCompany(companyId);
      setCompany(comp);
      if (comp.website_url) {
        setWebsiteUrl(comp.website_url);
      }
    } catch {
      // Non-blocking
    }
  };

  useEffect(() => {
    loadContent();
    loadCompanyInfo();
    if (companyId) {
      marketingApi.getSummary(companyId)
        .then((data) => setSummary(data))
        .catch(() => {});
    }
    marketingApi.getInstagramStatus()
      .then((st) => setInstagramStatus(st))
      .catch(() => setInstagramStatus(null));
    marketingApi.getLinkedInStatus()
      .then((st) => setLinkedinStatus(st))
      .catch(() => setLinkedinStatus(null));

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    };
  }, [companyId]);

  // -------------------------------------------------------------------------
  // Web Crawl Execution & Reactive Polling with Live Step Execution
  // -------------------------------------------------------------------------
  const handleStartCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !websiteUrl.trim() || !isAdmin) return;

    const targetUrl = websiteUrl.trim();
    const targetDomain = getDomain(targetUrl);
    const regDomain = getDomain(company?.website_url);

    // Enforce Registered Websites Only Policy
    if (regDomain && targetDomain && regDomain !== targetDomain) {
      setCrawlError(
        `Only your company's registered website (${company?.website_url}) is accepted for crawling. To crawl a different domain, please update your registered website in Company Settings.`
      );
      return;
    }

    setCrawlLoading(true);
    setCrawlError(null);
    setCrawlSuccess(null);
    setCrawlLiveStep(1);

    const now = () =>
      new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Step 1: Crawling Started log
    setCrawlLogs([
      {
        timestamp: now(),
        stepTitle: 'Crawling Started',
        stepNumber: 1,
        message: `Crawler initiated on ${targetUrl}. Scanning sitemap.xml and validating robots.txt permissions.`,
        status: 'running',
      },
    ]);

    if (pollingRef.current) clearInterval(pollingRef.current);
    if (stepTimerRef.current) clearInterval(stepTimerRef.current);

    try {
      const job = await companyApi.startCrawl(companyId, targetUrl);
      setActiveJob(job);

      pollingRef.current = setInterval(async () => {
        try {
          const updated = await companyApi.getCrawlStatus(companyId, job.job_id);
          setActiveJob(updated);

          if (updated.status === 'completed') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            if (stepTimerRef.current) clearInterval(stepTimerRef.current);
            setCrawlLiveStep(6);
            setCrawlLoading(false);
            setCrawlLogs((prev) => [
              ...prev.map((l) => ({ ...l, status: 'completed' as const })),
              {
                timestamp: now(),
                stepTitle: 'Saved into DB (pgAdmin / pgvector)',
                stepNumber: 6,
                message: `Generated 768-dim dense vector embeddings and successfully saved ${updated.sections_saved || 'all'} chunks into PostgreSQL pgvector. Queryable in pgAdmin!`,
                status: 'completed' as const,
              },
            ]);
            setCrawlSuccess(
              `Crawl & Ingestion completed! Processed ${updated.pages_processed} pages and saved ${updated.sections_saved} vector chunks into PostgreSQL pgvector (queryable in pgAdmin).`
            );
          } else if (updated.status === 'failed') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            if (stepTimerRef.current) clearInterval(stepTimerRef.current);
            setCrawlLoading(false);
            setCrawlError(
              'Crawl job failed or worker timed out. Please verify that your website is reachable.'
            );
          }
        } catch {
          if (pollingRef.current) clearInterval(pollingRef.current);
          if (stepTimerRef.current) clearInterval(stepTimerRef.current);
          setCrawlLoading(false);
        }
      }, 3000);
    } catch (err: any) {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
      setCrawlLoading(false);
      const detail = err?.response?.data?.detail;
      const errorMsg = typeof detail === 'object' && detail?.message ? detail.message : detail || err?.message;
      setCrawlError(
        errorMsg || 'Failed to dispatch website crawl. Ensure URL is valid and matches the registered company website.'
      );
    }
  };

  const handleStopCrawl = async () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    setCrawlLoading(false);
    const now = () =>
      new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setCrawlLogs((prev) => [
      ...prev.map((l) => (l.status === 'running' ? { ...l, status: 'completed' as const } : l)),
      {
        timestamp: now(),
        stepTitle: 'Crawling Stopped by User',
        stepNumber: crawlLiveStep || 1,
        message: 'Website crawl and ingestion was halted by the user.',
        status: 'completed' as const,
      },
    ]);
    setCrawlError('Website crawl was stopped by user.');
    if (companyId && activeJob?.job_id) {
      try {
        await companyApi.cancelCrawl(companyId, activeJob.job_id);
      } catch {
        // Non-blocking cleanup
      }
    }
  };

  // -------------------------------------------------------------------------
  // Editorial Approval / Rejection Handlers
  // -------------------------------------------------------------------------
  const handleApprove = async (item: ContentItem) => {
    if (!canApprove) return;
    if (item.platform_target === 'instagram' && !item.image_url) {
      setError('Save the Instagram image before approving this content.');
      return;
    }
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const updated = await marketingApi.approveContent(item.content_id);
      setItems((prev) => prev.map((i) => (i.content_id === updated.content_id ? updated : i)));
      setSelectedItem(updated);
      setSuccessMsg(`Draft "${item.content_title}" was successfully approved! Ready for publication dispatch.`);
    } catch (err: any) {
      setError(err?.message || 'Failed to approve draft');
    } finally {
      setActionLoading(false);
    }
  };

  const openRejectDialog = () => {
    if (!selectedItem || !canApprove) return;
    setRejectFeedback('');
    setRejectError(null);
    setShowRejectModal(true);
  };

  const handleConfirmReject = async () => {
    if (!selectedItem || !canApprove) return;
    const trimmed = rejectFeedback.trim();
    if (!trimmed) {
      setRejectError('Please specify a rejection reason or revision guidance.');
      return;
    }

    setActionLoading(true);
    setRejectError(null);

    try {
      const updated = await marketingApi.rejectContent(selectedItem.content_id, trimmed);
      setItems((prev) => prev.map((i) => (i.content_id === updated.content_id ? updated : i)));
      setSelectedItem(updated);

      const newReasons = { ...rejectionReasons, [selectedItem.content_id]: trimmed };
      setRejectionReasons(newReasons);
      try {
        localStorage.setItem('nexora_rejection_reasons', JSON.stringify(newReasons));
      } catch { }

      setShowRejectModal(false);
      setSuccessMsg(`Draft rejected with audit reason: "${trimmed}". Returned for revision.`);
    } catch (err: any) {
      setRejectError(err?.message || 'Failed to record rejection feedback');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResubmit = async (item: ContentItem) => {
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const updated = await marketingApi.submitContent(item.content_id);
      setItems((prev) => prev.map((i) => (i.content_id === updated.content_id ? updated : i)));
      setSelectedItem(updated);
      setSuccessMsg('Draft resubmitted to review queue.');
    } catch (err: any) {
      setError(err?.message || 'Failed to resubmit draft');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublishToInstagram = (item: ContentItem) => {
    if (item.approval_status !== 'approved') return;
    const parsed = parseInstagramContent(item.content_text, item.content_title);
    const cleanCaption = [parsed.caption, parsed.description, parsed.hashtags.join(' ')].filter(Boolean).join('\n\n');

    setIgModalItem(item);
    setIgModalCaption(item.caption || cleanCaption);
    setIgModalImageLoaded(false);
    setIgModalImageLoadError(false);
    setShowIgModal(true);
  };

  const handleConfirmPublishInstagram = async () => {
    if (!igModalItem) return;
    if (!igModalItem.image_url || !igModalCaption.trim() || !igModalImageLoaded || igModalImageLoadError) {
      setError('The approved Instagram image and caption are required before publishing.');
      return;
    }

    setPublishingIgId(igModalItem.content_id);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await marketingApi.publishToInstagram(igModalItem.content_id);
      setSuccessMsg(`🚀 ${res.message || 'Published to Instagram!'} (Media ID: ${res.media_id})`);
      setShowIgModal(false);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'object' && detail?.message ? detail.message : detail || err?.message;
      setError(msg || 'Failed to publish to Instagram. Verify your Meta Graph API credentials in .env');
    } finally {
      setPublishingIgId(null);
    }
  };

  const handleGenerateContentImage = async (item: ContentItem) => {
    if (item.approval_status !== 'draft' && item.approval_status !== 'rejected') return;
    setActionLoading(true);
    setError(null);
    try {
      const prompt = `Photorealistic corporate technology promotional visual for DataFactZ: ${item.topic || item.content_title || 'Enterprise AI Automation'}, futuristic digital data architecture, minimal slate background, cinematic lighting`;
      const result = await marketingApi.generateRecraftImage({
        prompt,
        topic: item.topic || undefined,
        company_name: 'DataFactZ',
        custom_style: 'polished corporate social image, no logos or watermarks',
        content_id: item.content_id,
        size: item.platform_target === 'instagram' ? '1:1' : '16:9',
      });
      if (!result.public_url) {
        throw new Error('Image generation succeeded but did not return a saved public URL.');
      }

      const updatedItem = { ...item, image_url: result.public_url };
      setItems((prev) => prev.map((current) =>
        current.content_id === updatedItem.content_id ? updatedItem : current
      ));
      setSelectedItem((current) =>
        current?.content_id === updatedItem.content_id ? updatedItem : current
      );
      setSuccessMsg('Image generated and saved to this content item.');
    } catch (err: any) {
      setError(err?.message || 'Failed to generate and save the image.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublishToLinkedIn = async (item: ContentItem) => {
    if (item.approval_status !== 'approved') return;
    setPublishingLiId(item.content_id);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await marketingApi.publishToLinkedIn(item.content_id);
      setSuccessMsg(`🚀 ${res.message || 'Published to LinkedIn!'} (URN: ${res.post_urn})`);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'object' && detail?.message ? detail.message : detail || err?.message;
      setError(msg || 'Failed to publish to LinkedIn. Verify your LinkedIn credentials in .env');
    } finally {
      setPublishingLiId(null);
    }
  };

  // Format categorization
  const getItemTypeCategory = (item: ContentItem): 'article' | 'post' | 'image' | 'video' => {
    const rawType = (item.content_type || '').toLowerCase();
    const rawTitle = (item.content_title || (item as any).title || '').toLowerCase();
    const rawText = (item.content_text || '').toLowerCase();

    if (rawType.includes('article') || rawTitle.includes('article') || item.platform_target === 'linkedin_article') {
      return 'article';
    }
    if (
      rawType.includes('image') ||
      rawTitle.includes('banner') ||
      rawTitle.includes('image') ||
      rawTitle.includes('graphic') ||
      rawText.includes('### visual asset specification') ||
      rawText.includes('visual graphic direction') ||
      rawText.includes('branded visual graphic')
    ) {
      return 'image';
    }
    if (
      rawType.includes('video') ||
      rawTitle.includes('video') ||
      rawTitle.includes('reel') ||
      rawTitle.includes('script') ||
      rawText.includes('### video reel storyboard') ||
      rawText.includes('scene 1: hook')
    ) {
      return 'video';
    }
    return 'post';
  };

  // Saved creatives belong in the Images view even when they are attached to a social post.
  const matchesFormat = (item: ContentItem, format: 'all' | 'article' | 'post' | 'image' | 'video') =>
    format === 'all' ||
    (format === 'image'
      ? getItemTypeCategory(item) === 'image' || Boolean(item.image_url)
      : getItemTypeCategory(item) === format);

  const filteredItems = items.filter((item) => {
    if (statusFilter !== 'all' && item.approval_status !== statusFilter) return false;
    if (!matchesFormat(item, typeFilter)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.content_title.toLowerCase().includes(q);
      const matchTopic = (item.topic || '').toLowerCase().includes(q);
      const matchText = item.content_text.toLowerCase().includes(q);
      if (!matchTitle && !matchTopic && !matchText) return false;
    }
    return true;
  });

  const pendingCount = items.filter((i) => i.approval_status === 'pending').length;
  const approvedCount = items.filter((i) => i.approval_status === 'approved').length;
  const rejectedCount = items.filter((i) => i.approval_status === 'rejected').length;

  // Per-format total counts across entire collection:
  const totalItemCount = items.length;
  const articleTotal = items.filter((i) => getItemTypeCategory(i) === 'article').length;
  const postTotal = items.filter((i) => getItemTypeCategory(i) === 'post').length;
  const imageTotal = items.filter((i) => matchesFormat(i, 'image')).length;
  const videoTotal = items.filter((i) => getItemTypeCategory(i) === 'video').length;

  // Format-scoped items (for sub-status counts):
  const formatScopedItems = typeFilter === 'all'
    ? items
    : items.filter((i) => matchesFormat(i, typeFilter));

  const formatPendingCount = formatScopedItems.filter((i) => i.approval_status === 'pending').length;
  const formatApprovedCount = formatScopedItems.filter((i) => i.approval_status === 'approved').length;
  const formatRejectedCount = formatScopedItems.filter((i) => i.approval_status === 'rejected').length;
  const formatAllCount = formatScopedItems.length;

  const handleSelectFormat = (format: 'all' | 'article' | 'post' | 'image' | 'video') => {
    setTypeFilter(format);
    const targetItems = items.filter((item) => matchesFormat(item, format));
    // If the active statusFilter has 0 items in this newly chosen format, auto-switch to 'all'
    // so the user immediately sees all available items (approved, rejected, etc.) instead of an empty screen!
    if (statusFilter !== 'all') {
      const matchInCurrentStatus = targetItems.filter((i) => i.approval_status === statusFilter).length;
      if (matchInCurrentStatus === 0 && targetItems.length > 0) {
        setStatusFilter('all');
      }
    }
  };

  const getFormatLabel = (fmt: 'all' | 'article' | 'post' | 'image' | 'video') => {
    switch (fmt) {
      case 'article': return 'Articles';
      case 'post': return 'Posts';
      case 'image': return 'Images';
      case 'video': return 'Videos';
      default: return 'Content';
    }
  };

  const getFormatBadge = (type: string) => {
    switch (type) {
      case 'article':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#F0EFED] text-[#252525] border border-[#E7E5E4]">
            <FileText className="w-3 h-3 text-[#252525]" /> Article
          </span>
        );
      case 'image':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#F0EFED] text-[#252525] border border-[#E7E5E4]">
            <ImageIcon className="w-3 h-3 text-[#252525]" /> Image Brief
          </span>
        );
      case 'video':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#F0EFED] text-[#252525] border border-[#E7E5E4]">
            <Video className="w-3 h-3 text-[#252525]" /> Video Script
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#F0EFED] text-[#252525] border border-[#E7E5E4]">
            <Share2 className="w-3 h-3 text-[#252525]" /> Social Post
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Approved
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3" /> In Review
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-red-50 text-red-800 border border-red-200">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#F0EFED] text-[#737373] border border-[#E7E5E4]">
            Draft
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="pb-5 border-b border-[#EAEAE6] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-[#171B1A]">
              Marketing Agent Workspace
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#256D58]/10 text-[#256D58] border border-[#256D58]/20">
              Autonomous Weekly System
            </span>
          </div>
          <p className="text-sm text-[#66716B] mt-0.5">
            Manage automatic website crawling, weekly grounded campaign batches, and social analytics.
          </p>
        </div>

        {/* Primary Action: Go to Content Studio */}
        <button
          onClick={() => onNavigate('/content-studio')}
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-[#256D58] hover:bg-[#1E5846] text-white text-xs font-semibold shadow-xs hover:shadow-md transition-all cursor-pointer shrink-0"
        >
          <PenTool className="w-3.5 h-3.5" />
          <span>Create in Content Studio</span>
        </button>
      </div>

      {/* Workspace Sub-Tabs: 1. Weekly Automation | 2. Analytics */}
      <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-[#FAFAF8] border border-[#EAEAE6]">
        <button
          onClick={() => setActiveTab('automation')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'automation'
              ? 'bg-white text-[#171B1A] shadow-xs border border-[#EAEAE6]'
              : 'text-[#66716B] hover:text-[#171B1A]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-[#256D58]" />
          <span>Weekly Automation</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'analytics'
              ? 'bg-white text-[#171B1A] shadow-xs border border-[#EAEAE6]'
              : 'text-[#66716B] hover:text-[#171B1A]'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Analytics</span>
        </button>
      </div>

      {/* Global Notifications */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-800 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* =========================================================================
          SUB-TAB 1: WEEKLY AUTOMATION
          ========================================================================= */}
      {activeTab === 'automation' && (
        <WeeklyAutomationPage
          onNavigateToStudio={() => onNavigate('/content-studio')}
        />
      )}

      {/* =========================================================================
          SUB-TAB 2: ANALYTICS (Live dynamic metrics from pgvector & content store)
          ========================================================================= */}
      {activeTab === 'analytics' && (() => {
        const totalPosts = summary ? summary.generated_posts : items.length;
        const approvedPosts = items.filter((i) => i.approval_status === 'approved').length;
        const scheduledPosts = summary
          ? summary.scheduled_posts
          : items.filter((i) => i.publish_status === 'scheduled' || i.publish_status === 'published').length;
        const publishedPosts = items.filter((i) => i.publish_status === 'published').length;
        const pendingPosts = summary
          ? summary.pending_reviews
          : items.filter((i) => i.approval_status === 'pending').length;
        const rejectedPosts = items.filter((i) => i.approval_status === 'rejected').length;
        const linkedinPosts = items.filter(
          (i) => i.platform_target?.toLowerCase() === 'linkedin'
        ).length;
        const instagramPosts = items.filter(
          (i) => i.platform_target?.toLowerCase() === 'instagram'
        ).length;

        return (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Top Metrics Cards: Real Live Dynamic Data */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-[#EAEAE6] shadow-xs">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#66716B] block mb-1">
                  Generated Posts
                </span>
                <div className="text-2xl font-bold text-[#171B1A]">{totalPosts}</div>
                <p className="text-[11px] text-[#256D58] font-medium mt-1">
                  {linkedinPosts} LinkedIn • {instagramPosts} Instagram
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#EAEAE6] shadow-xs">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#66716B] block mb-1">
                  Scheduled & Published
                </span>
                <div className="text-2xl font-bold text-[#171B1A]">{scheduledPosts}</div>
                <p className="text-[11px] text-blue-700 font-medium mt-1">
                  {publishedPosts} Published • {Math.max(0, scheduledPosts - publishedPosts)} Queued
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#EAEAE6] shadow-xs">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#66716B] block mb-1">
                  Approval Governance
                </span>
                <div className="text-2xl font-bold text-[#171B1A]">{approvedPosts} Approved</div>
                <p className="text-[11px] text-[#66716B] mt-1">
                  {pendingPosts} Pending Review • {rejectedPosts} Rejected
                </p>
              </div>
            </div>

            {/* Performance Telemetry */}
            <div className="bg-white p-6 rounded-2xl border border-[#EAEAE6] shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-[#171B1A]">Social Reach & Performance</h3>
                  <p className="text-xs text-[#66716B] mt-0.5">
                    Live analytics synced from connected platform APIs upon post publication.
                  </p>
                </div>
                <span className="text-xs font-mono text-[#8E9793] bg-[#FAFAF8] px-2.5 py-1 rounded-lg border border-[#EAEAE6] self-start sm:self-auto">
                  pgvector + Star Schema
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-3.5 rounded-xl bg-[#FAFAF8] border border-[#EAEAE6]">
                  <span className="text-[10px] uppercase font-semibold text-[#8E9793] block">
                    Total Impressions
                  </span>
                  <span className="text-lg font-bold text-[#171B1A]">
                    {publishedPosts > 0 ? 'Syncing...' : '—'}
                  </span>
                  <span className="text-[10px] text-[#8E9793] block mt-0.5">
                    {publishedPosts > 0 ? 'Live platform telemetry' : 'No posts published yet'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAFAF8] border border-[#EAEAE6]">
                  <span className="text-[10px] uppercase font-semibold text-[#8E9793] block">
                    Audience Reach
                  </span>
                  <span className="text-lg font-bold text-[#171B1A]">
                    {publishedPosts > 0 ? 'Syncing...' : '—'}
                  </span>
                  <span className="text-[10px] text-[#8E9793] block mt-0.5">
                    {publishedPosts > 0 ? 'Unique accounts reached' : 'Awaiting published posts'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAFAF8] border border-[#EAEAE6]">
                  <span className="text-[10px] uppercase font-semibold text-[#8E9793] block">
                    Total Engagements
                  </span>
                  <span className="text-lg font-bold text-[#171B1A]">
                    {publishedPosts > 0 ? 'Syncing...' : '—'}
                  </span>
                  <span className="text-[10px] text-[#8E9793] block mt-0.5">
                    {publishedPosts > 0 ? 'Likes, comments & shares' : 'Awaiting published posts'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAFAF8] border border-[#EAEAE6]">
                  <span className="text-[10px] uppercase font-semibold text-[#8E9793] block">
                    Engagement Rate
                  </span>
                  <span className="text-lg font-bold text-[#171B1A]">
                    {publishedPosts > 0 ? 'Syncing...' : '—'}
                  </span>
                  <span className="text-[10px] text-[#8E9793] block mt-0.5">
                    {publishedPosts > 0 ? 'Interactions per impression' : 'Awaiting published posts'}
                  </span>
                </div>
              </div>
            </div>

            {/* Connected Social Channels */}
            <div className="bg-white p-6 rounded-2xl border border-[#EAEAE6] shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-[#171B1A]">Connected Social Channels</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-[#EAEAE6] bg-[#FAFAF8] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#0077B5]/10 text-[#0077B5] flex items-center justify-center font-bold text-xs">
                      in
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#171B1A]">LinkedIn Company Page</h4>
                      <p className="text-[11px] text-[#66716B]">
                        {linkedinStatus?.connected
                          ? linkedinStatus.account_name || 'Connected & Authorized'
                          : 'Not connected. Configure in Settings.'}
                      </p>
                    </div>
                  </div>
                  {linkedinStatus?.connected ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Connected
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#EAEAE6] text-[#66716B]">
                      Disconnected
                    </span>
                  )}
                </div>

                <div className="p-4 rounded-xl border border-[#EAEAE6] bg-[#FAFAF8] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#E1306C]/10 text-[#E1306C] flex items-center justify-center font-bold text-xs">
                      ig
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#171B1A]">Instagram Professional</h4>
                      <p className="text-[11px] text-[#66716B]">
                        {instagramStatus?.connected
                          ? instagramStatus.account_username
                            ? `@${instagramStatus.account_username}`
                            : 'Connected & Authorized'
                          : 'Not connected. Configure in Settings.'}
                      </p>
                    </div>
                  </div>
                  {instagramStatus?.connected ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Connected
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#EAEAE6] text-[#66716B]">
                      Disconnected
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* =========================================================================
          TAB 1 CONTENT: EDITORIAL REVIEW QUEUE
          ========================================================================= */}
      {activeTab === 'review' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Format & Status Filter System (Format-First Architecture) */}
          <div className="space-y-3 bg-white p-4 sm:p-5 rounded-2xl border border-[#E7E5E4] shadow-xs">
            {/* ROW 1: PRIMARY FORMAT SELECTOR TABS */}
            <div className="flex flex-col gap-3 pb-3 border-b border-[#E7E5E4]">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#737373] mr-2 shrink-0">
                  Format:
                </span>

                <button
                  onClick={() => handleSelectFormat('all')}
                  className={`btn-motion inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer ${typeFilter === 'all'
                    ? 'bg-[#252525] text-white shadow-xs -translate-y-0.5'
                    : 'bg-[#FAFAF9] text-[#737373] hover:text-[#252525] hover:bg-white border border-[#E7E5E4]'
                    }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>All Content</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${typeFilter === 'all' ? 'bg-white/20 text-white' : 'bg-[#E7E5E4] text-[#252525]'
                      }`}
                  >
                    {totalItemCount}
                  </span>
                </button>

                <button
                  onClick={() => handleSelectFormat('article')}
                  className={`btn-motion inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer ${typeFilter === 'article'
                    ? 'bg-[#252525] text-white shadow-xs -translate-y-0.5'
                    : 'bg-[#FAFAF9] text-[#737373] hover:text-[#252525] hover:bg-white border border-[#E7E5E4]'
                    }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Articles</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${typeFilter === 'article' ? 'bg-white/20 text-white' : 'bg-[#E7E5E4] text-[#252525]'
                      }`}
                  >
                    {articleTotal}
                  </span>
                </button>

                <button
                  onClick={() => handleSelectFormat('post')}
                  className={`btn-motion inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer ${typeFilter === 'post'
                    ? 'bg-[#252525] text-white shadow-xs -translate-y-0.5'
                    : 'bg-[#FAFAF9] text-[#737373] hover:text-[#252525] hover:bg-white border border-[#E7E5E4]'
                    }`}
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Posts</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${typeFilter === 'post' ? 'bg-white/20 text-white' : 'bg-[#E7E5E4] text-[#252525]'
                      }`}
                  >
                    {postTotal}
                  </span>
                </button>

                <button
                  onClick={() => handleSelectFormat('image')}
                  className={`btn-motion inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer ${typeFilter === 'image'
                    ? 'bg-[#252525] text-white shadow-xs -translate-y-0.5'
                    : 'bg-[#FAFAF9] text-[#737373] hover:text-[#252525] hover:bg-white border border-[#E7E5E4]'
                    }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Images</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${typeFilter === 'image' ? 'bg-white/20 text-white' : 'bg-[#E7E5E4] text-[#252525]'
                      }`}
                  >
                    {imageTotal}
                  </span>
                </button>

                <button
                  onClick={() => handleSelectFormat('video')}
                  className={`btn-motion inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer ${typeFilter === 'video'
                    ? 'bg-[#252525] text-white shadow-xs -translate-y-0.5'
                    : 'bg-[#FAFAF9] text-[#737373] hover:text-[#252525] hover:bg-white border border-[#E7E5E4]'
                    }`}
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Videos</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${typeFilter === 'video' ? 'bg-white/20 text-white' : 'bg-[#E7E5E4] text-[#252525]'
                      }`}
                  >
                    {videoTotal}
                  </span>
                </button>
              </div>

              {/* Instant Search Bar */}
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder={`Search ${getFormatLabel(typeFilter).toLowerCase()}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-[#E7E5E4] bg-white text-[#252525] placeholder:text-[#737373]/60 focus:outline-none focus:border-[#252525] transition-colors"
                />
              </div>
            </div>

            {/* ROW 2: SCOPED STATUS TABS FOR SELECTED FORMAT */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#737373] mr-2 shrink-0">
                  Status:
                </span>

                <button
                  onClick={() => setStatusFilter('all')}
                  className={`btn-motion px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 shrink-0 cursor-pointer ${statusFilter === 'all'
                    ? 'bg-[#252525] text-white shadow-xs'
                    : 'bg-[#FAFAF9] text-[#737373] hover:text-[#252525] hover:bg-white border border-[#E7E5E4]'
                    }`}
                >
                  <span>All {getFormatLabel(typeFilter)}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${statusFilter === 'all' ? 'bg-white/20 text-white' : 'bg-[#E7E5E4] text-[#252525]'
                      }`}
                  >
                    {formatAllCount}
                  </span>
                </button>

                <button
                  onClick={() => setStatusFilter('pending')}
                  className={`btn-motion px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 shrink-0 cursor-pointer ${statusFilter === 'pending'
                    ? 'bg-[#252525] text-white shadow-xs'
                    : 'bg-[#FAFAF9] text-[#737373] hover:text-[#252525] hover:bg-white border border-[#E7E5E4]'
                    }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>In Review</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${statusFilter === 'pending' ? 'bg-white/20 text-white' : 'bg-[#E7E5E4] text-[#252525]'
                      }`}
                  >
                    {formatPendingCount}
                  </span>
                </button>

                <button
                  onClick={() => setStatusFilter('approved')}
                  className={`btn-motion px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 shrink-0 cursor-pointer ${statusFilter === 'approved'
                    ? 'bg-[#252525] text-white shadow-xs'
                    : 'bg-[#FAFAF9] text-[#737373] hover:text-[#252525] hover:bg-white border border-[#E7E5E4]'
                    }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Approved</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${statusFilter === 'approved' ? 'bg-white/20 text-white' : 'bg-[#E7E5E4] text-[#252525]'
                      }`}
                  >
                    {formatApprovedCount}
                  </span>
                </button>

                <button
                  onClick={() => setStatusFilter('rejected')}
                  className={`btn-motion px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 shrink-0 cursor-pointer ${statusFilter === 'rejected'
                    ? 'bg-[#252525] text-white shadow-xs'
                    : 'bg-[#FAFAF9] text-[#737373] hover:text-[#252525] hover:bg-white border border-[#E7E5E4]'
                    }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span>Needs Revision</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${statusFilter === 'rejected' ? 'bg-white/20 text-white' : 'bg-[#E7E5E4] text-[#252525]'
                      }`}
                  >
                    {formatRejectedCount}
                  </span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                {instagramStatus?.connected && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-purple-50 via-pink-50 to-amber-50 border border-pink-200 text-pink-950 text-xs font-semibold shadow-2xs shrink-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <Share2 className="w-3 h-3 text-pink-600" />
                    <span>Instagram:</span>
                    <span className="font-mono text-[11px] text-purple-900">@{instagramStatus.account_username}</span>
                  </div>
                )}
                {linkedinStatus?.connected && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-950 text-xs font-semibold shadow-2xs shrink-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <Share2 className="w-3 h-3 text-[#0A66C2]" />
                    <span>LinkedIn:</span>
                    <span className="font-mono text-[11px] text-blue-900">{linkedinStatus.account_name}</span>
                  </div>
                )}
                <div className="text-[11px] text-[#737373]">
                  Viewing <strong className="text-[#252525]">{filteredItems.length}</strong> {getFormatLabel(typeFilter).toLowerCase()}
                  {statusFilter !== 'all' ? ` (${statusFilter === 'pending' ? 'in review' : statusFilter})` : ''}
                </div>
              </div>
            </div>
          </div>

          {!selectedItem ? (
            /* =========================================================================
               VIEW 1: FULL-PAGE REVIEW QUEUE (RESPONSIVE GRID VIEW)
               ========================================================================= */
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-[#252525]">
                    {getFormatLabel(typeFilter)} Queue ({filteredItems.length})
                  </span>
                  <span className="text-[11px] text-[#737373] font-medium px-2 py-0.5 rounded-md bg-white border border-[#E7E5E4]">
                    {statusFilter === 'all'
                      ? 'All Statuses'
                      : statusFilter === 'pending'
                        ? 'In Review'
                        : statusFilter === 'approved'
                          ? 'Approved'
                          : 'Needs Revision'}
                  </span>
                </div>
                <span className="text-xs text-[#737373]">
                  {canApprove ? 'Admin Governance Active • Click Any Item to Open Full Tab' : 'View Only Mode'}
                </span>
              </div>

              {loading ? (
                <div className="py-16 text-center text-xs text-[#737373] space-y-2 bg-white rounded-2xl border border-[#E7E5E4] p-8 shadow-xs">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#252525]" />
                  <p>Loading workflow queue...</p>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="py-16 text-center space-y-3 bg-white rounded-2xl border border-[#E7E5E4] p-8 shadow-xs">
                  <CheckCircle2 className="w-8 h-8 text-[#737373] mx-auto opacity-60" />
                  <p className="text-[15px] font-semibold text-[#252525]">
                    No {getFormatLabel(typeFilter)} Found in {statusFilter === 'all' ? 'Queue' : statusFilter === 'pending' ? 'In Review' : statusFilter === 'approved' ? 'Approved' : 'Needs Revision'}
                  </p>
                  <p className="text-xs text-[#737373] leading-relaxed max-w-sm mx-auto">
                    {statusFilter !== 'all' && formatAllCount > 0 ? (
                      <span>
                        There are {formatAllCount} {getFormatLabel(typeFilter).toLowerCase()} available in other status tabs.
                      </span>
                    ) : (
                      <span>
                        Generate new grounded {getFormatLabel(typeFilter).toLowerCase()} in Content Studio to initiate the editorial review cycle.
                      </span>
                    )}
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    {statusFilter !== 'all' && formatAllCount > 0 && (
                      <button
                        onClick={() => setStatusFilter('all')}
                        className="btn-motion px-4 py-2 text-xs font-semibold text-[#252525] bg-[#F0EFED] rounded-xl hover:bg-[#E7E5E4] transition-colors cursor-pointer"
                      >
                        View All {getFormatLabel(typeFilter)} ({formatAllCount})
                      </button>
                    )}
                    <button
                      onClick={() => onNavigate('/content-studio')}
                      className="btn-motion inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#252525] rounded-xl hover:bg-[#383838] transition-colors cursor-pointer shadow-xs"
                    >
                      <PenTool className="w-3.5 h-3.5" />
                      <span>Generate in Studio</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
                  {filteredItems.map((item) => {
                    const category = getItemTypeCategory(item);
                    const rejectionReason = rejectionReasons[item.content_id];
                    const wordCount = item.content_text.split(/\s+/).filter(Boolean).length;
                    const readTime = Math.max(1, Math.ceil(wordCount / 200));

                    return (
                      <div
                        key={item.content_id}
                        className="card-motion p-5 rounded-2xl border border-[#E7E5E4] bg-white hover:border-[#252525]/40 hover:bg-[#FAFAF9] flex flex-col justify-between gap-4 cursor-pointer shadow-xs group"
                        onClick={() => setSelectedItem(item)}
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              {getFormatBadge(category)}
                              <span className="text-[11px] text-[#737373] capitalize font-medium">
                                {item.platform_target}
                              </span>
                            </div>
                            <div>{getStatusBadge(item.approval_status)}</div>
                          </div>

                          <h3 className="text-[15px] font-semibold text-[#252525] line-clamp-2 leading-snug group-hover:text-black">
                            {item.content_title || 'Untitled Draft'}
                          </h3>

                          <p className="text-xs text-[#737373] line-clamp-3 leading-relaxed">
                            {item.content_text.replace(/[#*`\[\]]/g, '').slice(0, 160)}...
                          </p>

                          {typeFilter === 'image' && item.image_url && (
                            <img
                              src={item.image_url}
                              alt={`Generated image for ${item.content_title || 'content'}`}
                              loading="lazy"
                              className="w-full aspect-square object-cover rounded-xl border border-[#E7E5E4] bg-[#FAFAF9]"
                            />
                          )}

                          {item.approval_status === 'rejected' && rejectionReason && (
                            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-[11px] text-red-700 leading-snug">
                              <span className="font-semibold">Reason:</span> {rejectionReason}
                            </div>
                          )}
                        </div>

                        <div className="pt-3 border-t border-[#E7E5E4]/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#737373]">
                          <div className="flex items-center gap-2">
                            <span>{new Date(item.created_at).toLocaleDateString()}</span>
                            <span>•</span>
                            <span>{wordCount} words (~{readTime}m)</span>
                          </div>

                          <div className="flex items-center gap-2">
                            {item.approval_status === 'approved' && (
                              <div className="flex items-center gap-1.5">
                                {(item.platform_target === 'instagram' || item.platform_target === 'all') && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePublishToInstagram(item);
                                    }}
                                    disabled={publishingIgId === item.content_id}
                                    className="btn-motion inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white text-[11px] font-semibold hover:from-purple-700 hover:to-pink-700 cursor-pointer disabled:opacity-50 shadow-2xs"
                                    title="Publish directly to Instagram"
                                  >
                                    {publishingIgId === item.content_id ? (
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Share2 className="w-3 h-3" />
                                    )}
                                    <span>Publish IG</span>
                                  </button>
                                )}
                                {(item.platform_target === 'linkedin' || item.platform_target === 'all' || item.platform_target === 'linkedin_article') && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePublishToLinkedIn(item);
                                    }}
                                    disabled={publishingLiId === item.content_id}
                                    className="btn-motion inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0A66C2] text-white text-[11px] font-semibold hover:bg-[#004182] cursor-pointer disabled:opacity-50 shadow-2xs"
                                    title="Publish directly to LinkedIn"
                                  >
                                    {publishingLiId === item.content_id ? (
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Share2 className="w-3 h-3" />
                                    )}
                                    <span>Publish LI</span>
                                  </button>
                                )}
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedItem(item);
                              }}
                              className="btn-motion inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#252525] text-white text-xs font-semibold hover:bg-[#383838] transition-colors cursor-pointer"
                            >
                              <span>Inspect & Read</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* =========================================================================
               VIEW 2: FULL-TAB INSPECTION & REVIEW VIEW (OPENS IN FULL TAB)
               ========================================================================= */
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Top Navigation & Governance Action Bar */}
              <div className="bg-white rounded-2xl border border-[#E7E5E4] p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedItem(null)}
                    className="btn-motion inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#252525] bg-white border border-[#E7E5E4] rounded-xl hover:bg-[#F0EFED] cursor-pointer shadow-xs"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Review Queue</span>
                  </button>

                  <div className="h-4 w-px bg-[#E7E5E4] hidden sm:block" />

                  <div className="flex items-center gap-2">
                    {getStatusBadge(selectedItem.approval_status)}
                    <span className="text-xs text-[#737373] hidden md:inline">
                      {selectedItem.approval_status === 'pending'
                        ? 'Pending Admin or Reviewer sign-off'
                        : selectedItem.approval_status === 'approved'
                          ? 'Approved by human reviewer • Ready for publication'
                          : selectedItem.approval_status === 'rejected'
                            ? 'Revision requested by reviewer'
                            : 'Draft stage'}
                    </span>
                  </div>
                </div>

                {/* Top Action Controls */}
                <div className="flex items-center gap-2.5">
                  {selectedItem.approval_status === 'pending' && canApprove && (
                    <>
                      <button
                        onClick={openRejectDialog}
                        disabled={actionLoading}
                        className="btn-motion inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-red-700 bg-white border border-red-200 rounded-xl hover:bg-red-50 hover:border-red-300 shadow-2xs cursor-pointer disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject with Reason</span>
                      </button>

                      <button
                        onClick={() => handleApprove(selectedItem)}
                        disabled={actionLoading || (selectedItem.platform_target === 'instagram' && !selectedItem.image_url)}
                        title={
                          selectedItem.platform_target === 'instagram' && !selectedItem.image_url
                            ? 'Save the Instagram image before approval'
                            : undefined
                        }
                        className="btn-motion inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-[#252525] hover:bg-[#383838] rounded-xl shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve Content</span>
                      </button>
                    </>
                  )}

                  {selectedItem.approval_status === 'rejected' && (
                    <button
                      onClick={() => handleResubmit(selectedItem)}
                      disabled={actionLoading}
                      className="btn-motion inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#252525] bg-white border border-[#E7E5E4] rounded-xl hover:bg-[#F0EFED] cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Resubmit for Review</span>
                    </button>
                  )}

                  {selectedItem.approval_status === 'draft' && (
                    <button
                      onClick={() => handleResubmit(selectedItem)}
                      disabled={actionLoading}
                      className="btn-motion inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-[#252525] hover:bg-[#383838] rounded-xl shadow-xs hover:shadow-md cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit for Review</span>
                    </button>
                  )}

                  {selectedItem.approval_status === 'approved' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="px-3.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Approved & Ready</span>
                      </div>

                      {/* Instagram Channel Publish Button */}
                      {selectedItem.platform_target === 'instagram' && (
                        <button
                          type="button"
                          onClick={() => handlePublishToInstagram(selectedItem)}
                          disabled={publishingIgId === selectedItem.content_id}
                          className="btn-motion inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50 transition-all"
                          title={instagramStatus?.connected ? 'Publish to verified connected Instagram' : 'Publish to Instagram (Checks credentials)'}
                        >
                          {publishingIgId === selectedItem.content_id ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Publishing to IG...</span>
                            </>
                          ) : (
                            <>
                              <Share2 className="w-3.5 h-3.5" />
                              <span>Publish to Instagram</span>
                            </>
                          )}
                        </button>
                      )}

                      {/* LinkedIn Channel Publish Button */}
                      {(selectedItem.platform_target === 'linkedin' || selectedItem.platform_target === 'all' || selectedItem.platform_target === 'linkedin_article') && (
                        <button
                          type="button"
                          onClick={() => handlePublishToLinkedIn(selectedItem)}
                          disabled={publishingLiId === selectedItem.content_id}
                          className="btn-motion inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#0A66C2] hover:bg-[#004182] text-white shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50 transition-all"
                          title={linkedinStatus?.connected ? 'Publish to verified connected LinkedIn' : 'Publish to LinkedIn (Checks credentials)'}
                        >
                          {publishingLiId === selectedItem.content_id ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Publishing to LinkedIn...</span>
                            </>
                          ) : (
                            <>
                              <Share2 className="w-3.5 h-3.5" />
                              <span>Publish to LinkedIn</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  {!canApprove && selectedItem.approval_status === 'pending' && (
                    <div className="px-3 py-1.5 rounded-lg bg-[#F0EFED] border border-[#E7E5E4] text-[11px] text-[#737373] flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#252525]" />
                      <span>Admin sign-off required</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Full-Tab Content Canvas */}
              <div className="bg-white rounded-2xl border border-[#E7E5E4] p-7 sm:p-8 space-y-6 shadow-xs">
                {/* Rejection Notice if rejected */}
                {selectedItem.approval_status === 'rejected' && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 text-red-800 font-semibold">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      <span>Revision Requested by Reviewer</span>
                    </div>
                    <p className="text-red-700 leading-relaxed pl-6">
                      {rejectionReasons[selectedItem.content_id] ||
                        'Content does not meet accuracy or compliance standards. Please review guidance and resubmit.'}
                    </p>
                  </div>
                )}

                {/* Draft Title & Metadata Bar */}
                <div className="space-y-3 pb-5 border-b border-[#E7E5E4]">
                  <div className="flex flex-wrap items-center gap-2">
                    {getFormatBadge(getItemTypeCategory(selectedItem))}
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-medium bg-[#FAFAF9] text-[#737373] border border-[#E7E5E4] uppercase tracking-wider">
                      {selectedItem.platform_target}
                    </span>
                    {selectedItem.tone && (
                      <span className="px-2.5 py-0.5 rounded text-[11px] font-medium bg-[#FAFAF9] text-[#737373] border border-[#E7E5E4]">
                        Tone: {selectedItem.tone}
                      </span>
                    )}
                    <span className="text-xs text-[#737373] ml-auto">
                      Created: {new Date(selectedItem.created_at).toLocaleString()}
                    </span>
                  </div>

                  <h1 className="text-[26px] font-semibold text-[#252525] leading-snug tracking-tight">
                    {selectedItem.content_title}
                  </h1>

                  {selectedItem.topic && (
                    <p className="text-xs text-[#737373]">
                      <span className="font-semibold text-[#252525]">Topic Focus:</span> {selectedItem.topic}
                    </p>
                  )}
                </div>

                {/* Article Reader View */}
                {getItemTypeCategory(selectedItem) === 'article' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-[#737373] pb-2 border-b border-[#E7E5E4]/60">
                      <span className="font-semibold text-[#252525]">Long-Form Article Reader</span>
                      <span>
                        ~{Math.ceil(selectedItem.content_text.split(/\s+/).length / 200)} min read •{' '}
                        {selectedItem.content_text.split(/\s+/).length} words
                      </span>
                    </div>
                    <div className="prose prose-sm max-w-none text-[#252525] bg-[#FAFAF9] p-8 rounded-xl border border-[#E7E5E4] font-sans leading-relaxed whitespace-pre-wrap text-[15px]">
                      {selectedItem.content_text}
                    </div>
                  </div>
                )}

                {/* Social Post Preview Mockup */}
                {getItemTypeCategory(selectedItem) === 'post' && !(typeFilter === 'image' && selectedItem.image_url) && (
                  <div className="space-y-4">
                    {selectedItem.platform_target === 'instagram' ? (
                      /* Dedicated 4-field Instagram breakdown: Caption, Description, Hashtags, SEO */
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4 rounded-2xl border border-[#E7E5E4] bg-[#FAFAF9] p-4">
                          <div className="aspect-square overflow-hidden rounded-xl border border-[#E7E5E4] bg-white">
                            {selectedItem.image_url ? (
                              <img
                                src={selectedItem.image_url}
                                alt={`Approved creative for ${selectedItem.content_title}`}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full flex-col items-center justify-center gap-3 p-5 text-center">
                                <ImageIcon className="h-8 w-8 text-[#A8A29E]" />
                                <p className="text-xs text-[#737373]">
                                  No saved Instagram image. Generate and save the image before submitting for approval.
                                </p>
                                {(selectedItem.approval_status === 'draft' || selectedItem.approval_status === 'rejected') && (
                                  <button
                                    type="button"
                                    onClick={() => handleGenerateContentImage(selectedItem)}
                                    disabled={actionLoading}
                                    className="btn-motion inline-flex items-center gap-2 rounded-xl bg-[#252525] px-4 py-2 text-xs font-semibold text-white hover:bg-[#383838] disabled:opacity-50"
                                  >
                                    {actionLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                                    Generate and save image
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-2">
                            <span className="text-xs font-semibold text-[#252525]">Instagram caption for approval</span>
                            <div className="min-h-40 flex-1 whitespace-pre-wrap rounded-xl border border-[#E7E5E4] bg-white p-4 text-sm leading-relaxed text-[#252525]">
                              {selectedItem.caption || getInstagramCaption(selectedItem)}
                            </div>
                            <span className="text-[11px] text-[#737373]">
                              This saved image and caption are the values used when you publish.
                            </span>
                          </div>
                        </div>
                        <InstagramFieldViewer
                          rawText={selectedItem.content_text}
                          defaultTitle={selectedItem.content_title}
                        />
                      </div>
                    ) : (
                      /* Unified LinkedIn Post Preview */
                      <div className="space-y-3">
                        <div className="text-xs font-semibold text-[#252525]">Social Post Preview Mockup</div>
                        <div className="bg-white rounded-xl border border-[#E7E5E4] p-6 shadow-xs space-y-4 max-w-2xl">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#252525] text-white flex items-center justify-center font-semibold text-xs tracking-wider">
                              DF
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-semibold text-[#252525]">DataFactZ Official Voice</span>
                                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 inline" />
                              </div>
                              <span className="text-[11px] text-[#737373]">
                                Grounded Post • Governed by Multi-Stage LangGraph Agent
                              </span>
                            </div>
                          </div>

                          <div className="text-sm text-[#252525] whitespace-pre-wrap leading-relaxed font-sans bg-[#FAFAF9] p-5 rounded-xl border border-[#E7E5E4]">
                            {selectedItem.content_text}
                          </div>

                          <div className="pt-3 border-t border-[#E7E5E4] flex items-center justify-between text-xs text-[#737373]">
                            <span>Enterprise Audience Reach</span>
                            <span className="capitalize">{selectedItem.platform_target} Feed Format</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Image Creative Visual Canvas & Copy */}
                {(getItemTypeCategory(selectedItem) === 'image' || (typeFilter === 'image' && Boolean(selectedItem.image_url))) && (
                  <div className="space-y-6">
                    {/* Show the saved Recraft image or offer generation for eligible drafts. */}
                    {(() => {
                      const recraftImage = selectedItem.image_url;

                      if (recraftImage) {
                        return (
                          <div className="rounded-2xl border border-[#E7E5E4] overflow-hidden bg-gradient-to-b from-[#1C1C1E] to-[#121214] p-5 space-y-4 shadow-sm text-white">
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10 text-xs">
                              <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-amber-400" />
                                <span className="font-semibold text-white">
                                  Generated by Recraft V4.1 Flash V2
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px]">
                                  ● Photorealistic AI Creative
                                </span>
                              </div>
                              <a
                                href={recraftImage}
                                download={`recraft-${selectedItem.content_id.slice(0, 8)}.jpg`}
                                className="btn-motion inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold cursor-pointer transition-all"
                              >
                                <span>Download JPEG</span>
                              </a>
                            </div>

                            <div className="relative aspect-square max-w-md mx-auto rounded-xl overflow-hidden shadow-2xl border border-white/20 bg-black">
                              <img
                                src={recraftImage}
                                alt={selectedItem.content_title || 'Recraft generated image'}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>
                        );
                      }

                      // If no image is saved yet, offer Recraft generation for draft content.
                      return (
                        <div className="p-8 rounded-2xl border-2 border-dashed border-[#E7E5E4] bg-[#FAFAF9] text-center space-y-3">
                          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto shadow-2xs">
                            <Sparkles className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-[#252525]">
                              Photorealistic Creative for {selectedItem.topic || 'Enterprise AI'}
                            </h4>
                            <p className="text-xs text-[#737373] max-w-md mx-auto mt-1">
                              Generate a high-resolution branding visual with Recraft V4.1 Flash V2.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleGenerateContentImage(selectedItem)}
                            disabled={
                              actionLoading ||
                              (selectedItem.approval_status !== 'draft' && selectedItem.approval_status !== 'rejected')
                            }
                            className="btn-motion inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#252525] hover:bg-[#383838] text-white text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-50"
                          >
                            {actionLoading ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Generating with Recraft...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                <span>Generate Recraft Image</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })()}

                    {/* Platform Copy underneath */}
                    {selectedItem.platform_target === 'instagram' ? (
                      <InstagramFieldViewer
                        rawText={selectedItem.content_text}
                        defaultTitle={selectedItem.content_title}
                      />
                    ) : (
                      <div className="bg-[#FAFAF9] p-5 rounded-xl border border-[#E7E5E4] space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[#252525]">
                          Accompanying LinkedIn Post Copy
                        </span>
                        <div className="text-xs text-[#252525] whitespace-pre-wrap leading-relaxed">
                          {selectedItem.content_text}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Video Asset Interactive Reel & Storyboard */}
                {getItemTypeCategory(selectedItem) === 'video' && (
                  <div className="space-y-6">
                    {/* Render Interactive Reel Player & Storyboard */}
                    <GeneratedVideoReel
                      title={selectedItem.content_title}
                      topic={selectedItem.topic}
                      platform={selectedItem.platform_target}
                    />

                    {/* Platform Copy underneath */}
                    {selectedItem.platform_target === 'instagram' ? (
                      <InstagramFieldViewer
                        rawText={selectedItem.content_text}
                        defaultTitle={selectedItem.content_title}
                      />
                    ) : (
                      <div className="bg-[#FAFAF9] p-5 rounded-xl border border-[#E7E5E4] space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[#252525]">
                          Accompanying LinkedIn Post Copy
                        </span>
                        <div className="text-xs text-[#252525] whitespace-pre-wrap leading-relaxed">
                          {selectedItem.content_text}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Grounded Knowledge Evidence */}
                <div className="p-5 rounded-xl bg-[#FAFAF9] border border-[#E7E5E4] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-700" />
                      <span className="text-xs font-semibold text-[#252525]">
                        Grounded Knowledge Evidence
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      100% Fact-Grounded
                    </span>
                  </div>
                  <p className="text-xs text-[#737373] leading-relaxed">
                    Synthesized using verified facts extracted from your crawled website and stored in pgvector embeddings. No external speculation was introduced into this draft.
                  </p>
                </div>

                {/* Bottom Action Footer */}
                <div className="pt-4 border-t border-[#E7E5E4] flex flex-wrap items-center justify-between gap-3">
                  <button
                    onClick={() => setSelectedItem(null)}
                    className="btn-motion inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#252525] bg-white border border-[#E7E5E4] rounded-xl hover:bg-[#F0EFED] cursor-pointer shadow-xs"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Review Queue</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {selectedItem.approval_status === 'pending' && canApprove && (
                      <>
                        <button
                          onClick={openRejectDialog}
                          disabled={actionLoading}
                          className="btn-motion inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-red-700 bg-white border border-red-200 rounded-xl hover:bg-red-50 hover:border-red-300 shadow-2xs cursor-pointer disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject with Reason</span>
                        </button>

                        <button
                          onClick={() => handleApprove(selectedItem)}
                          disabled={actionLoading || (selectedItem.platform_target === 'instagram' && !selectedItem.image_url)}
                          title={
                            selectedItem.platform_target === 'instagram' && !selectedItem.image_url
                              ? 'Save the Instagram image before approval'
                              : undefined
                          }
                          className="btn-motion inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-[#252525] hover:bg-[#383838] rounded-xl shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve Content</span>
                        </button>
                      </>
                    )}

                    {selectedItem.approval_status === 'rejected' && (
                      <button
                        onClick={() => handleResubmit(selectedItem)}
                        disabled={actionLoading}
                        className="btn-motion inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#252525] bg-white border border-[#E7E5E4] rounded-xl hover:bg-[#F0EFED] cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Resubmit for Review</span>
                      </button>
                    )}

                    {selectedItem.approval_status === 'approved' && (
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="px-3.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Approved & Ready</span>
                        </div>

                        {/* Instagram Channel Publish Button */}
                        {selectedItem.platform_target === 'instagram' && (
                          <button
                            type="button"
                            onClick={() => handlePublishToInstagram(selectedItem)}
                            disabled={publishingIgId === selectedItem.content_id}
                            className="btn-motion inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50 transition-all"
                            title={instagramStatus?.connected ? 'Publish to verified connected Instagram' : 'Publish to Instagram (Checks credentials)'}
                          >
                            {publishingIgId === selectedItem.content_id ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Publishing to IG...</span>
                              </>
                            ) : (
                              <>
                                <Share2 className="w-3.5 h-3.5" />
                                <span>Publish to Instagram</span>
                              </>
                            )}
                          </button>
                        )}

                        {/* LinkedIn Channel Publish Button */}
                        {(selectedItem.platform_target === 'linkedin' || selectedItem.platform_target === 'all' || selectedItem.platform_target === 'linkedin_article') && (
                          <button
                            type="button"
                            onClick={() => handlePublishToLinkedIn(selectedItem)}
                            disabled={publishingLiId === selectedItem.content_id}
                            className="btn-motion inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#0A66C2] hover:bg-[#004182] text-white shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50 transition-all"
                            title={linkedinStatus?.connected ? 'Publish to verified connected LinkedIn' : 'Publish to LinkedIn (Checks credentials)'}
                          >
                            {publishingLiId === selectedItem.content_id ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Publishing to LinkedIn...</span>
                              </>
                            ) : (
                              <>
                                <Share2 className="w-3.5 h-3.5" />
                                <span>Publish to LinkedIn</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2 CONTENT: WEB CRAWL PIPELINE
          ========================================================================= */}
      {activeTab === 'crawl' && (
        <div className="space-y-6">
          {/* Crawl Status & Progress Notifications */}
          {crawlError && (
            <div className="p-3.5 rounded-md bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{crawlError}</span>
            </div>
          )}

          {crawlSuccess && (
            <div className="p-3.5 rounded-md bg-emerald-50 border border-emerald-200 flex items-start justify-between gap-4 text-xs text-emerald-800">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{crawlSuccess}</span>
              </div>
              <button
                onClick={() => onNavigate('/content-studio')}
                className="underline font-semibold hover:text-emerald-950 shrink-0 text-xs flex items-center gap-1"
              >
                <span>Launch Content Studio</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* 1. Crawler Input Card */}
          <div className="bg-white rounded-2xl border border-[#E7E5E4] p-6 space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E7E5E4]">
              <div>
                <h2 className="text-[16px] font-semibold text-[#252525] flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#252525]" />
                  <span>Website Crawling & Vector Ingestion Engine</span>
                </h2>
                <p className="text-xs text-[#737373] mt-0.5">
                  Crawls your public website, parses clean text, generates 768-dim embeddings, and stores them in PostgreSQL pgvector.
                </p>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAFAF9] border border-[#E7E5E4] text-xs text-[#252525]">
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                <span>PostgreSQL + pgvector Indexed</span>
              </div>
            </div>

            {/* Registered Domain Governance Callout */}
            <div className="p-3.5 rounded-xl bg-[#FAFAF9] border border-[#E7E5E4] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#737373] block">
                    Registered Website Policy
                  </span>
                  <span className="text-xs text-[#252525]">
                    Only verified registered company domains are accepted for vector ingestion.
                  </span>
                </div>
              </div>

              {hasRegisteredDomain ? (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-white text-emerald-800 border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Registered: {registeredDomain}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigate('/settings')}
                    className="text-[11px] font-semibold text-[#737373] hover:text-[#252525] underline cursor-pointer"
                  >
                    Edit in Settings
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigate('/settings')}
                  className="btn-motion px-3 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer shrink-0"
                >
                  Configure Registered Website in Settings →
                </button>
              )}
            </div>

            <form onSubmit={handleStartCrawl} className="space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <Globe className="w-4 h-4 text-[#737373] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="url"
                    required
                    placeholder={hasRegisteredDomain ? company?.website_url : "https://datafactz.ai"}
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    disabled={crawlLoading || !isAdmin}
                    className={`w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border bg-white text-[#252525] placeholder:text-[#737373]/60 focus:outline-none transition-colors font-mono disabled:opacity-60 shadow-2xs ${isDomainMismatch
                      ? 'border-red-300 focus:border-red-500 bg-red-50/20'
                      : 'border-[#E7E5E4] focus:border-[#252525]'
                      }`}
                  />
                </div>

                <button
                  type="submit"
                  disabled={crawlLoading || !isAdmin || !websiteUrl.trim() || isDomainMismatch}
                  className="btn-motion inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#252525] hover:bg-[#383838] text-white text-xs font-semibold shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {crawlLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Crawling & Ingesting...</span>
                    </>
                  ) : (
                    <>
                      <Globe className="w-3.5 h-3.5" />
                      <span>Start Website Crawl</span>
                    </>
                  )}
                </button>

                {crawlLoading && (
                  <button
                    type="button"
                    onClick={handleStopCrawl}
                    className="btn-motion inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 hover:border-red-300 text-xs font-semibold cursor-pointer shadow-xs transition-all shrink-0"
                    title="Stop crawl immediately"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop Crawl</span>
                  </button>
                )}
              </div>

              {/* Instant Mismatch Warning */}
              {isDomainMismatch && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 animate-in fade-in duration-200">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-950">Unregistered Website URL</p>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        Only your company's registered website (<strong>{company?.website_url}</strong>) is accepted for crawling.
                        To crawl a different domain, please update your registered website in Company Settings.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setWebsiteUrl(company?.website_url || '')}
                      className="btn-motion px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 cursor-pointer shadow-2xs"
                    >
                      Reset to Registered
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('/settings')}
                      className="btn-motion px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[#252525] text-white hover:bg-[#383838] cursor-pointer shadow-2xs"
                    >
                      Company Settings →
                    </button>
                  </div>
                </div>
              )}

              {/* Matched Registered Domain Confirmation */}
              {!isDomainMismatch && hasRegisteredDomain && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 pl-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Matches registered company domain ({registeredDomain}). Ready for vector ingestion.</span>
                </div>
              )}
            </form>

            {!isAdmin && (
              <p className="text-[11px] text-[#737373]">
                * Only organization Admins can trigger website crawling. Reviewers and Creators have read-only access.
              </p>
            )}
          </div>

          {/* 2. Visual Ingestion Pipeline (From Crawling to DB Storage) */}
          <div className="bg-white rounded-2xl border border-[#E7E5E4] p-6 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#E7E5E4]">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#252525] block">
                  Active Ingestion Pipeline Architecture
                </span>
                <p className="text-xs text-[#737373] mt-0.5">
                  Automated 6-stage ingestion pipeline: from headless crawl to classification and PostgreSQL pgvector storage.
                </p>
              </div>

              {crawlLoading && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#252525] text-white text-xs font-mono font-medium shadow-xs">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Executing Stage {crawlLiveStep} of 6</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleStopCrawl}
                    className="btn-motion inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>Stop Crawl</span>
                  </button>
                </div>
              )}
            </div>

            {/* 6 Step Interactive Architecture Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              {/* Step 1: Crawling Started */}
              <div
                className={`card-motion p-3.5 rounded-xl border text-xs flex flex-col justify-between gap-2.5 transition-all duration-200 ${crawlLiveStep === 1 && crawlLoading
                  ? 'border-[#252525] bg-[#F0EFED] ring-2 ring-[#252525]/15 shadow-md -translate-y-1'
                  : crawlLiveStep > 1 || activeJob?.status === 'completed'
                    ? 'border-emerald-300 bg-emerald-50/40 shadow-xs'
                    : 'border-[#E7E5E4] bg-[#FAFAF9]'
                  }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-[#252525]">1. Crawling Started</span>
                    {crawlLiveStep > 1 || activeJob?.status === 'completed' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : crawlLiveStep === 1 && crawlLoading ? (
                      <span className="w-2 h-2 rounded-full bg-[#252525] animate-ping" />
                    ) : null}
                  </div>
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/80 border border-[#E7E5E4] text-[#737373] mb-1.5">
                    Sitemap & Seeds
                  </span>
                  <p className="text-[#737373] text-[11px] leading-relaxed">
                    Validates robots.txt, discovers site structure via sitemap.xml, and queues seed URLs.
                  </p>
                </div>
                <div className="pt-2 border-t border-[#E7E5E4]/60 text-[11px] font-medium text-[#252525]">
                  {crawlLiveStep > 1 || activeJob?.status === 'completed' ? (
                    <span className="text-emerald-700 font-semibold">✓ Discovery Complete</span>
                  ) : crawlLiveStep === 1 && crawlLoading ? (
                    <span className="text-[#252525] font-semibold flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Scanning Sitemap
                    </span>
                  ) : (
                    <span>Target: Full Sitemap</span>
                  )}
                </div>
              </div>

              {/* Step 2: Inspected */}
              <div
                className={`card-motion p-3.5 rounded-xl border text-xs flex flex-col justify-between gap-2.5 transition-all duration-200 ${crawlLiveStep === 2 && crawlLoading
                  ? 'border-[#252525] bg-[#F0EFED] ring-2 ring-[#252525]/15 shadow-md -translate-y-1'
                  : crawlLiveStep > 2 || activeJob?.status === 'completed'
                    ? 'border-emerald-300 bg-emerald-50/40 shadow-xs'
                    : 'border-[#E7E5E4] bg-[#FAFAF9]'
                  }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-[#252525]">2. Inspected</span>
                    {crawlLiveStep > 2 || activeJob?.status === 'completed' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : crawlLiveStep === 2 && crawlLoading ? (
                      <span className="w-2 h-2 rounded-full bg-[#252525] animate-ping" />
                    ) : null}
                  </div>
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/80 border border-[#E7E5E4] text-[#737373] mb-1.5">
                    DOM Inspection
                  </span>
                  <p className="text-[#737373] text-[11px] leading-relaxed">
                    Executes HTTP preflight, validates 200 OK status codes, checks content-type, and inspects DOM.
                  </p>
                </div>
                <div className="pt-2 border-t border-[#E7E5E4]/60 text-[11px] font-medium text-[#252525]">
                  {crawlLiveStep > 2 || activeJob?.status === 'completed' ? (
                    <span className="text-emerald-700 font-semibold">✓ HTTP 200 & DOM OK</span>
                  ) : crawlLiveStep === 2 && crawlLoading ? (
                    <span className="text-[#252525] font-semibold flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Inspecting DOM
                    </span>
                  ) : (
                    <span>Status Code Checks</span>
                  )}
                </div>
              </div>

              {/* Step 3: Extracted */}
              <div
                className={`card-motion p-3.5 rounded-xl border text-xs flex flex-col justify-between gap-2.5 transition-all duration-200 ${crawlLiveStep === 3 && crawlLoading
                  ? 'border-[#252525] bg-[#F0EFED] ring-2 ring-[#252525]/15 shadow-md -translate-y-1'
                  : crawlLiveStep > 3 || activeJob?.status === 'completed'
                    ? 'border-emerald-300 bg-emerald-50/40 shadow-xs'
                    : 'border-[#E7E5E4] bg-[#FAFAF9]'
                  }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-[#252525]">3. Extracted</span>
                    {crawlLiveStep > 3 || activeJob?.status === 'completed' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : crawlLiveStep === 3 && crawlLoading ? (
                      <span className="w-2 h-2 rounded-full bg-[#252525] animate-ping" />
                    ) : null}
                  </div>
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/80 border border-[#E7E5E4] text-[#737373] mb-1.5">
                    HTML to Markdown
                  </span>
                  <p className="text-[#737373] text-[11px] leading-relaxed">
                    Extracts clean DOM trees, page titles, section headings, meta descriptions, and raw markdown.
                  </p>
                </div>
                <div className="pt-2 border-t border-[#E7E5E4]/60 text-[11px] font-medium text-[#252525]">
                  {crawlLiveStep > 3 || activeJob?.status === 'completed' ? (
                    <span className="text-emerald-700 font-semibold">✓ Markdown Parsed</span>
                  ) : crawlLiveStep === 3 && crawlLoading ? (
                    <span className="text-[#252525] font-semibold flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Extracting Content
                    </span>
                  ) : (
                    <span>Clean Text Chunking</span>
                  )}
                </div>
              </div>

              {/* Step 4: Normalization & Cleaning */}
              <div
                className={`card-motion p-3.5 rounded-xl border text-xs flex flex-col justify-between gap-2.5 transition-all duration-200 ${crawlLiveStep === 4 && crawlLoading
                  ? 'border-[#252525] bg-[#F0EFED] ring-2 ring-[#252525]/15 shadow-md -translate-y-1'
                  : crawlLiveStep > 4 || activeJob?.status === 'completed'
                    ? 'border-emerald-300 bg-emerald-50/40 shadow-xs'
                    : 'border-[#E7E5E4] bg-[#FAFAF9]'
                  }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-[#252525] leading-tight">4. Normalization & Cleaning</span>
                    {crawlLiveStep > 4 || activeJob?.status === 'completed' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : crawlLiveStep === 4 && crawlLoading ? (
                      <span className="w-2 h-2 rounded-full bg-[#252525] animate-ping shrink-0" />
                    ) : null}
                  </div>
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/80 border border-[#E7E5E4] text-[#737373] mb-1.5">
                    Boilerplate Stripped
                  </span>
                  <p className="text-[#737373] text-[11px] leading-relaxed">
                    Strips scripts, stylesheets, nav menus, and footers. Sanitizes whitespace & generates SHA-256 hashes.
                  </p>
                </div>
                <div className="pt-2 border-t border-[#E7E5E4]/60 text-[11px] font-medium text-[#252525]">
                  {crawlLiveStep > 4 || activeJob?.status === 'completed' ? (
                    <span className="text-emerald-700 font-semibold">✓ Sanitized & Deduplicated</span>
                  ) : crawlLiveStep === 4 && crawlLoading ? (
                    <span className="text-[#252525] font-semibold flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Sanitizing Chunks
                    </span>
                  ) : (
                    <span>Boilerplate Filter</span>
                  )}
                </div>
              </div>

              {/* Step 5: Classification into Categories */}
              <div
                className={`card-motion p-3.5 rounded-xl border text-xs flex flex-col justify-between gap-2.5 transition-all duration-200 ${crawlLiveStep === 5 && crawlLoading
                  ? 'border-[#252525] bg-[#F0EFED] ring-2 ring-[#252525]/15 shadow-md -translate-y-1'
                  : crawlLiveStep > 5 || activeJob?.status === 'completed'
                    ? 'border-emerald-300 bg-emerald-50/40 shadow-xs'
                    : 'border-[#E7E5E4] bg-[#FAFAF9]'
                  }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-[#252525] leading-tight">5. Classification</span>
                    {crawlLiveStep > 5 || activeJob?.status === 'completed' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : crawlLiveStep === 5 && crawlLoading ? (
                      <span className="w-2 h-2 rounded-full bg-[#252525] animate-ping shrink-0" />
                    ) : null}
                  </div>
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/80 border border-[#E7E5E4] text-[#737373] mb-1.5">
                    16 Taxonomies
                  </span>
                  <p className="text-[#737373] text-[11px] leading-relaxed">
                    Classifies into 16 categories: Industry Solutions, Services, Products, Case Studies, and Tech Stack.
                  </p>
                </div>
                <div className="pt-2 border-t border-[#E7E5E4]/60 text-[11px] font-medium text-[#252525]">
                  {crawlLiveStep > 5 || activeJob?.status === 'completed' ? (
                    <span className="text-emerald-700 font-semibold">✓ 16 Categories Tagged</span>
                  ) : crawlLiveStep === 5 && crawlLoading ? (
                    <span className="text-[#252525] font-semibold flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Classifying Entities
                    </span>
                  ) : (
                    <span>Auto-Categorization</span>
                  )}
                </div>
              </div>

              {/* Step 6: Saved into DB (pgAdmin / pgvector) */}
              <div
                className={`card-motion p-3.5 rounded-xl border text-xs flex flex-col justify-between gap-2.5 transition-all duration-200 ${crawlLiveStep === 6 && crawlLoading
                  ? 'border-[#252525] bg-[#F0EFED] ring-2 ring-[#252525]/15 shadow-md -translate-y-1'
                  : activeJob?.status === 'completed'
                    ? 'border-emerald-400 bg-emerald-50/60 shadow-xs'
                    : 'border-[#E7E5E4] bg-[#FAFAF9]'
                  }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-[#252525] leading-tight">6. Saved into DB</span>
                    {activeJob?.status === 'completed' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : crawlLiveStep === 6 && crawlLoading ? (
                      <span className="w-2 h-2 rounded-full bg-[#252525] animate-ping shrink-0" />
                    ) : null}
                  </div>
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-100/60 border border-emerald-200 text-emerald-800 mb-1.5">
                    pgAdmin / pgvector
                  </span>
                  <p className="text-[#737373] text-[11px] leading-relaxed">
                    Generates 768-dim embeddings and persists into PostgreSQL pgvector table with cosine index.
                  </p>
                </div>
                <div className="pt-2 border-t border-[#E7E5E4]/60 text-[11px] font-medium text-[#252525]">
                  {activeJob?.status === 'completed' ? (
                    <span className="text-emerald-800 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Saved in PostgreSQL</span>
                    </span>
                  ) : crawlLiveStep === 6 && crawlLoading ? (
                    <span className="text-[#252525] font-semibold flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Writing to pgvector
                    </span>
                  ) : (
                    <span>Ready for pgvector</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Live In-Flight Progress Tracker & Live Step Execution Stream */}
          {crawlLoading ? (
            <div className="bg-white rounded-2xl border border-[#252525] p-6 shadow-sm space-y-5 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#252525] text-white flex items-center justify-center shadow-xs">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-[#252525]">
                        Live Web Crawling & Vector Ingestion
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-[#252525] text-white">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Stage {crawlLiveStep} of 6 Active
                      </span>
                    </div>
                    <span className="text-xs text-[#737373]">
                      Target: <strong className="font-mono text-[#252525]">{websiteUrl}</strong> • PostgreSQL pgvector Ingestion
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono px-3 py-1 rounded-lg bg-[#FAFAF9] border border-[#E7E5E4] text-[#252525] font-medium">
                    {crawlLiveStep === 1 && '1. Crawling Started'}
                    {crawlLiveStep === 2 && '2. Inspected'}
                    {crawlLiveStep === 3 && '3. Extracted'}
                    {crawlLiveStep === 4 && '4. Normalization & Cleaning'}
                    {crawlLiveStep === 5 && '5. Classification into Categories'}
                    {crawlLiveStep === 6 && '6. Saved into DB (pgAdmin / pgvector)'}
                  </span>
                  <button
                    type="button"
                    onClick={handleStopCrawl}
                    className="btn-motion inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                    title="Halt active crawl"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>Stop Crawl</span>
                  </button>
                </div>
              </div>

              {/* Progress Bar with 6 Stage Steps */}
              <div className="space-y-1.5">
                <div className="w-full bg-[#F0EFED] h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#252525] h-full transition-all duration-500 rounded-full"
                    style={{
                      width: activeJob?.status === 'completed'
                        ? '100%'
                        : '100%',
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#737373]">
                  <span>Step {crawlLiveStep}/6: {crawlLiveStep === 1 ? 'Target discovery & robots.txt' : crawlLiveStep === 2 ? 'Preflight HTTP 200 & DOM' : crawlLiveStep === 3 ? 'Markdown extraction' : crawlLiveStep === 4 ? 'Boilerplate stripped' : crawlLiveStep === 5 ? '16 categories tagged' : 'pgvector embeddings stored'}</span>
                  <span className="font-mono">{activeJob?.status === 'completed' ? 'Completed' : crawlLoading ? 'In progress' : 'Waiting'}</span>
                </div>
              </div>

              {/* Live Ingestion Pipeline Log Stream Console */}
              <div className="rounded-xl border border-[#E7E5E4] overflow-hidden shadow-2xs">
                <div className="bg-[#252525] text-white px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Live Pipeline Activity Feed • pgAdmin / pgvector</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    STREAMING
                  </span>
                </div>

                <div className="bg-[#1C1C1C] p-4 font-mono text-xs space-y-2 max-h-56 overflow-y-auto">
                  {crawlLogs.map((log, lIdx) => (
                    <div key={lIdx} className="flex items-start gap-2.5 text-[11px] leading-relaxed">
                      <span className="text-emerald-400 shrink-0 font-mono">[{log.timestamp}]</span>
                      <span className="px-1.5 py-0.2 rounded bg-white/10 text-white font-semibold shrink-0 uppercase tracking-wider text-[10px]">
                        {log.stepTitle}
                      </span>
                      <span className="text-[#E7E5E4] flex-1">{log.message}</span>
                      {log.status === 'completed' ? (
                        <span className="text-emerald-400 text-[10px] shrink-0">✓ OK</span>
                      ) : (
                        <span className="text-amber-400 text-[10px] shrink-0 animate-pulse">⚡ In Progress</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : activeJob?.status === 'completed' ? (
            <div className="bg-white rounded-2xl border border-emerald-200 bg-emerald-50/20 p-6 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold text-[#252525]">
                      Latest Crawl Completed & Grounded in PostgreSQL pgvector
                    </h3>
                    <p className="text-xs text-[#737373] mt-0.5">
                      All 6 stages executed successfully: crawled, inspected, extracted, normalized, classified, and stored in pgvector.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono px-3 py-1 rounded-lg bg-white border border-emerald-200 text-emerald-800 font-semibold shadow-2xs">
                    {activeJob.pages_processed} Pages Processed
                  </span>
                  <span className="text-xs font-mono px-3 py-1 rounded-lg bg-emerald-100/70 border border-emerald-200 text-emerald-900 font-semibold shadow-2xs">
                    {activeJob.sections_saved} Chunks in pgvector / pgAdmin
                  </span>
                </div>
              </div>

              {/* Completed Log Console */}
              {crawlLogs.length > 0 && (
                <div className="rounded-xl border border-emerald-200 overflow-hidden shadow-2xs">
                  <div className="bg-[#252525] text-white px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Ingestion Pipeline Audit Logs (All 6 Stages Completed)</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                      VERIFIED IN PGADMIN
                    </span>
                  </div>

                  <div className="bg-[#1C1C1C] p-3.5 font-mono text-xs space-y-1.5 max-h-48 overflow-y-auto">
                    {crawlLogs.map((log, lIdx) => (
                      <div key={lIdx} className="flex items-start gap-2.5 text-[11px] leading-relaxed">
                        <span className="text-emerald-400 shrink-0 font-mono">[{log.timestamp}]</span>
                        <span className="px-1.5 py-0.2 rounded bg-white/10 text-white font-semibold shrink-0 uppercase tracking-wider text-[10px]">
                          {log.stepTitle}
                        </span>
                        <span className="text-[#E7E5E4] flex-1">{log.message}</span>
                        <span className="text-emerald-400 text-[10px] shrink-0 font-bold">✓ DONE</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs text-[#737373]">
                  Content Studio queries these pgvector embeddings to guarantee zero ungrounded hallucinations.
                </span>

                <button
                  onClick={() => onNavigate('/content-studio')}
                  className="btn-motion inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#252525] hover:bg-[#383838] rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer shrink-0"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>Launch Content Studio to Generate Content</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Reject Reason Modal Dialog */}
      {showRejectModal && selectedItem && (
        <div className="fixed inset-0 z-50 bg-[#252525]/30 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-[#E7E5E4] shadow-2xl w-full max-w-lg p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#E7E5E4]">
              <div>
                <h3 className="text-[16px] font-semibold text-[#252525]">Reject Content Draft</h3>
                <p className="text-xs text-[#737373] mt-0.5">
                  Explain required revisions so the author or agent can make adjustments.
                </p>
              </div>
              <button
                onClick={() => setShowRejectModal(false)}
                className="btn-motion p-1 rounded-lg text-[#737373] hover:text-[#252525] hover:bg-[#F0EFED] transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-[#FAFAF9] border border-[#E7E5E4] text-xs">
              <span className="font-semibold text-[#252525]">Draft Title: </span>
              <span className="text-[#737373]">{selectedItem.content_title}</span>
            </div>

            {rejectError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{rejectError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#252525] mb-1.5">
                Audit Reason & Revision Guidance *
              </label>
              <textarea
                rows={4}
                required
                value={rejectFeedback}
                onChange={(e) => {
                  setRejectFeedback(e.target.value);
                  if (rejectError) setRejectError(null);
                }}
                placeholder="e.g. Inaccurate claim regarding SOC2 certification in section 2; adjust tone to be more technical; missing a clear registration link for the webinar."
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#E7E5E4] bg-white text-[#252525] placeholder:text-[#737373]/60 focus:outline-none focus:border-[#252525] transition-colors resize-y leading-relaxed"
              />
              <div className="flex justify-between items-center mt-1 text-[11px] text-[#737373]">
                <span>A mandatory audit reason is recorded for compliance.</span>
                <span>{rejectFeedback.trim().length} characters</span>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E7E5E4] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                disabled={actionLoading}
                className="btn-motion px-4 py-2 text-xs font-semibold text-[#737373] hover:text-[#252525] hover:bg-[#F0EFED] rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={actionLoading || !rejectFeedback.trim()}
                className="btn-motion inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {actionLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Recording Rejection...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Confirm Rejection</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instagram Publishing Modal Dialog */}
      {showIgModal && igModalItem && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-[#E7E5E4] shadow-2xl w-full max-w-3xl p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-200 my-8">
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#E7E5E4]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white flex items-center justify-center shadow-xs">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#252525]">Publish to Instagram Feed</h3>
                  <p className="text-xs text-[#737373]">
                    The exact saved image and caption approved by your administrator will be published.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowIgModal(false)}
                className="btn-motion p-1.5 rounded-lg text-[#737373] hover:text-[#252525] hover:bg-[#F0EFED] transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Saved image preview */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#252525]">Image Creative</label>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-medium">
                    Approved asset
                  </span>
                </div>
                <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-[#FAFAF9] border border-[#E7E5E4] shadow-2xs">
                  {igModalImageUrl ? (
                    igModalImageLoadError ? (
                      <div className="flex h-full flex-col items-center justify-center gap-2 p-5 text-center text-xs text-red-700">
                        <AlertCircle className="h-6 w-6" />
                        <span>The approved image URL could not be loaded. Check that the public backend URL is active and serves this saved image.</span>
                      </div>
                    ) : (
                      <img
                        src={igModalImageUrl}
                        alt={`Approved Instagram creative for ${igModalItem.content_title}`}
                        onError={() => setIgModalImageLoadError(true)}
                        onLoad={() => setIgModalImageLoaded(true)}
                        className="h-full w-full object-cover"
                      />
                    )
                  ) : (
                    <div className="flex h-full items-center justify-center p-5 text-center text-xs text-[#737373]">
                      No saved Instagram image is attached to this approved content.
                    </div>
                  )}
                </div>
                <p className="break-all text-[10px] text-[#737373]">{igModalImageUrl || 'Image URL missing'}</p>
              </div>

              {/* Saved caption */}
              <div className="space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#252525]">Approved Caption</label>
                    <span
                      className={`text-[10px] font-mono ${igModalCaption.length > 2200 ? 'text-red-600 font-bold' : 'text-[#737373]'
                        }`}
                    >
                      {igModalCaption.length} / 2,200 chars
                    </span>
                  </div>
                  <p className="text-[11px] text-[#737373] leading-relaxed">
                    This caption is read-only. To change it, update the content and submit it for approval again.
                  </p>
                  <textarea
                    rows={12}
                    value={igModalCaption}
                    readOnly
                    className="w-full resize-none text-xs text-[#111827] p-3.5 rounded-xl border border-[#E7E5E4] bg-[#FAFAF9] leading-relaxed font-sans"
                  />
                </div>

                <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  igModalPublishReady
                    ? 'bg-purple-50/60 border-purple-200/60 text-purple-950'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}>
                  <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
                  <span className="text-[11px]">
                    {igModalPublishReady
                      ? 'Publishing sends these approved database values without substitutions.'
                      : igModalImageLoadError
                        ? 'The saved image URL is unreachable. Restore the public backend tunnel and update the approved image URL before publishing.'
                        : 'Publishing requires a saved public HTTPS image and a non-empty approved caption.'}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#E7E5E4] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowIgModal(false)}
                disabled={publishingIgId === igModalItem.content_id}
                className="btn-motion px-4 py-2 text-xs font-semibold text-[#737373] hover:text-[#252525] hover:bg-[#F0EFED] rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPublishInstagram}
                disabled={
                  publishingIgId === igModalItem.content_id ||
                  !igModalPublishReady
                }
                className="btn-motion inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {publishingIgId === igModalItem.content_id ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Publishing to Instagram...</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Publish to Instagram Feed</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
