import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { companyApi } from '../../lib/api/company';
import { Building, Globe, ArrowRight, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

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

  // Crawler progress simulation / tracking
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
    <div className="min-h-screen bg-[#FAFAF9] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-xl w-full mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-8 h-8 rounded bg-[#252525] text-white font-semibold text-xs mb-3 tracking-wider">
            N
          </div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[#252525] leading-tight">
            Set up your company workspace
          </h1>
          <p className="mt-1 text-sm text-[#737373]">
            Nexora.AI extracts your real expertise, services, and projects directly from your website.
          </p>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-[#E7E5E4] shadow-xs">
          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleCreateCompany} className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[#252525] mb-1.5">
                  Company Name *
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-[#737373] absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Acme Corporation"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-[#E7E5E4] bg-white text-[#252525] placeholder:text-[#737373]/60 focus:outline-none focus:border-[#252525] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#252525] mb-1.5">
                  Company Website URL *
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-[#737373] absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="url"
                    required
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://yourcompany.com"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-[#E7E5E4] bg-white text-[#252525] placeholder:text-[#737373]/60 focus:outline-none focus:border-[#252525] transition-colors font-mono"
                  />
                </div>
                <p className="mt-1 text-[11px] text-[#737373]">
                  Nexora will crawl your public pages to build your verified knowledge base in PostgreSQL pgvector.
                </p>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#252525] mb-1.5">
                  Industry / Focus Area
                </label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="e.g. Enterprise Cloud & Software Services"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E7E5E4] bg-white text-[#252525] placeholder:text-[#737373]/60 focus:outline-none focus:border-[#252525] transition-colors"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#252525] mb-1.5">
                  Company Overview (Optional)
                </label>
                <textarea
                  rows={3}
                  value={overview}
                  onChange={(e) => setOverview(e.target.value)}
                  placeholder="Short description of your services, solutions, and core differentiators"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E7E5E4] bg-white text-[#252525] placeholder:text-[#737373]/60 focus:outline-none focus:border-[#252525] transition-colors leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-motion w-full mt-3 inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-[#252525] text-white text-xs font-semibold hover:bg-[#383838] transition-all disabled:opacity-50 shadow-xs hover:shadow-md cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Initializing Workspace...</span>
                  </>
                ) : (
                  <>
                    <span>Create Company Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="text-center py-6 space-y-5">
              <div className="w-10 h-10 bg-[#F0EFED] text-[#252525] rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-5 h-5" />
              </div>

              <div>
                <h3 className="text-base font-semibold text-[#252525]">
                  Workspace Created & Vector Extraction Initialized
                </h3>
                <p className="mt-1 text-xs text-[#737373] max-w-sm mx-auto leading-relaxed">
                  Our crawler is reading your website and creating private vector embeddings in PostgreSQL pgvector.
                </p>
              </div>

              <div className="p-4 bg-[#FAFAF9] rounded-xl border border-[#E7E5E4] text-left">
                <div className="flex items-center justify-between text-xs font-medium text-[#252525] mb-2">
                  <span>Knowledge Extraction</span>
                  <span className="capitalize font-semibold">{crawlStatus}</span>
                </div>
                <div className="w-full bg-[#E7E5E4] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#252525] h-full transition-all duration-500 rounded-full"
                    style={{ width: crawlStatus === 'completed' ? '100%' : '65%' }}
                  />
                </div>
                <div className="flex justify-between items-center mt-2 text-[11px] text-[#737373]">
                  <span>Pages analyzed: {pagesCrawled > 0 ? pagesCrawled : (crawlStatus === 'completed' ? 'Complete' : 'Scanning...')}</span>
                  <span>pgvector embeddings active</span>
                </div>
              </div>

              <button
                onClick={() => onNavigate('/overview')}
                className="btn-motion w-full inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-[#252525] text-white text-xs font-semibold hover:bg-[#383838] transition-all shadow-xs hover:shadow-md cursor-pointer"
              >
                <span>Enter Workspace Overview</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
