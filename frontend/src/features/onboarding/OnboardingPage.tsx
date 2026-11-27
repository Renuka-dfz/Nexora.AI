import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { companyApi } from '../../lib/api/company';
import { Building, Globe, ArrowRight, CheckCircle2, AlertCircle, RefreshCw, Sparkles, ShieldCheck } from 'lucide-react';

interface OnboardingPageProps {
  onNavigate: (path: string) => void;
}

export const OnboardingPage: React.FC<OnboardingPageProps> = ({ onNavigate }) => {
  const { setCompanySession } = useAuth();
  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [industry, setIndustry] = useState('');
  const [overview, setOverview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Crawler progress tracking
  const [crawlStatus, setCrawlStatus] = useState<'pending' | 'running' | 'completed' | 'failed'>('pending');
  const [pagesCrawled, setPagesCrawled] = useState<number>(0);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const company = await companyApi.createCompany({
        company_name: companyName,
        website_url: websiteUrl,
        industry: industry || undefined,
        company_overview: overview || undefined,
      });

      // Update session with new company context and assign role
      const preferredRole = (sessionStorage.getItem('nexora_preferred_role') as any) || 'admin';
      setCompanySession(company.company_id, preferredRole, company.company_name);

      // Start website crawl if URL provided
      if (websiteUrl && websiteUrl.trim()) {
        try {
          const job = await companyApi.startCrawl(company.company_id, websiteUrl.trim());
          setCrawlStatus('running');
          setStep(2);
          pollCrawl(company.company_id, job.job_id);
        } catch {
          // If queue unavailable in dev, advance cleanly
          setStep(2);
          setCrawlStatus('completed');
        }
      } else {
        onNavigate('/overview');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to initialize company workspace');
    } finally {
      setLoading(false);
    }
  };

  const pollCrawl = (companyId: string, jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const job = await companyApi.getCrawlStatus(companyId, jobId);
        setPagesCrawled(job.pages_processed);
        if (job.status === 'completed') {
          setCrawlStatus('completed');
          clearInterval(interval);
        } else if (job.status === 'failed') {
          setCrawlStatus('failed');
          clearInterval(interval);
        }
      } catch {
        clearInterval(interval);
      }
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#171B1A] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans antialiased selection:bg-[#256D58] selection:text-white">
      <div className="max-w-xl w-full mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-[#256D58] to-[#34D399] text-white shadow-md shadow-[#256D58]/25">
            <Sparkles className="h-5 w-5 fill-current" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#256D58]">
            Workspace Initialization
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#171B1A]">
            Set up your company workspace
          </h1>
          <p className="text-xs sm:text-sm text-[#66716B]">
            Nexora.AI extracts your corporate context directly from your website into PostgreSQL pgvector.
          </p>
        </div>

        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#EAEAE6] shadow-sm">
          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleCreateCompany} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#171B1A] mb-1.5">
                  Company Name *
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-[#8E9793] absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. DataFactZ Inc."
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-[#EAEAE6] bg-[#FAFAF8] text-[#171B1A] placeholder:text-[#8E9793] focus:outline-none focus:border-[#256D58] focus:bg-white focus:ring-2 focus:ring-[#256D58]/15 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171B1A] mb-1.5">
                  Company Website URL *
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-[#8E9793] absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="url"
                    required
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://datafactz.com"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-[#EAEAE6] bg-[#FAFAF8] text-[#171B1A] placeholder:text-[#8E9793] focus:outline-none focus:border-[#256D58] focus:bg-white focus:ring-2 focus:ring-[#256D58]/15 transition-all font-mono"
                  />
                </div>
                <p className="mt-1 text-[11px] text-[#66716B]">
                  Nexora will crawl your public pages to build your verified knowledge base in pgvector.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171B1A] mb-1.5">
                  Industry / Focus Area
                </label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="e.g. Enterprise AI & Analytics"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#EAEAE6] bg-[#FAFAF8] text-[#171B1A] placeholder:text-[#8E9793] focus:outline-none focus:border-[#256D58] focus:bg-white focus:ring-2 focus:ring-[#256D58]/15 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171B1A] mb-1.5">
                  Company Overview (Optional)
                </label>
                <textarea
                  rows={3}
                  value={overview}
                  onChange={(e) => setOverview(e.target.value)}
                  placeholder="Brief description of core services and differentiators..."
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#EAEAE6] bg-[#FAFAF8] text-[#171B1A] placeholder:text-[#8E9793] focus:outline-none focus:border-[#256D58] focus:bg-white focus:ring-2 focus:ring-[#256D58]/15 transition-all leading-relaxed"
                />
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FAFAF8] border border-[#EAEAE6] text-xs text-[#66716B]">
                <ShieldCheck className="w-4 h-4 text-[#256D58] shrink-0 mt-0.5" />
                <span className="text-[11px] leading-relaxed">
                  Grounded with pgvector semantic similarity. Factual citations enforced automatically.
                </span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-[#256D58] hover:bg-[#1E5846] text-white text-sm font-semibold shadow-md shadow-[#256D58]/20 transition-all hover:-translate-y-0.5 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Initializing Workspace...</span>
                  </>
                ) : (
                  <>
                    <span>Create Company Workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="text-center py-6 space-y-5">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200 shadow-xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-bold text-[#171B1A]">
                  Workspace Created & Crawler Initialized
                </h3>
                <p className="text-xs text-[#66716B] max-w-sm mx-auto leading-relaxed">
                  Our crawler is indexing your website and generating private vector embeddings in pgvector.
                </p>
              </div>

              <div className="p-4 bg-[#FAFAF8] rounded-xl border border-[#EAEAE6] text-left space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[#171B1A]">
                  <span>Knowledge Grounding</span>
                  <span className="capitalize px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {crawlStatus}
                  </span>
                </div>
                <div className="w-full bg-[#EAEAE6] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#256D58] h-full transition-all duration-500 rounded-full"
                    style={{ width: crawlStatus === 'completed' ? '100%' : '65%' }}
                  />
                </div>
                <div className="flex justify-between items-center text-[11px] text-[#8E9793]">
                  <span>Pages analyzed: {pagesCrawled > 0 ? pagesCrawled : (crawlStatus === 'completed' ? 'Complete' : 'Scanning...')}</span>
                  <span>pgvector embeddings active</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('/overview')}
                className="w-full inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-[#256D58] hover:bg-[#1E5846] text-white text-sm font-semibold shadow-md shadow-[#256D58]/20 transition-all hover:-translate-y-0.5 cursor-pointer"
              >
                <span>Enter Workspace Overview</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
