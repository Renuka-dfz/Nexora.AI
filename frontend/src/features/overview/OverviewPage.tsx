import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { companyApi } from '../../lib/api/company';
import { Company } from '../../types';
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Globe2,
  Loader2,
  Search,
  Sparkles,
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
  const progress = crawlState === 'success'
    ? 100
    : Math.min(88, 18 + pagesProcessed * 7 + sectionsSaved * 3);

  return (
    <div className="space-y-7 pb-10">
      <section className="relative min-h-[390px] overflow-hidden rounded-[28px] bg-[#087fd7] text-white">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#087bd4_0%,#159adf_55%,#75c3e6_100%)]" />
        <div className="absolute right-[-80px] top-[-100px] h-[300px] w-[300px] rounded-full bg-white/10 blur-2xl" />
        <div className="absolute bottom-[-100px] left-[35%] h-[230px] w-[380px] rounded-[100%] bg-white/10 blur-xl" />

        <div className="relative z-10 flex min-h-[390px] flex-col justify-between px-6 py-7 sm:px-9 lg:flex-row lg:items-center lg:px-12">
          <div className="max-w-[560px]">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-[#dfff75]" />
              Marketing Agent
            </div>
            <h1 className="text-balance text-[42px] font-medium leading-[1.02] tracking-[-0.055em] sm:text-[58px]">
              Your AI Marketing Agent <span className="text-[#dfff75]">Is Ready.</span>
            </h1>
            <p className="mt-5 max-w-[520px] text-pretty text-sm leading-6 text-white/78 sm:text-base">
              Turn your company knowledge into authentic marketing content. Let AI research your brand and create content that connects.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('/crawl')}
              className="lime-button mt-7 inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold text-[#172300]"
            >
              Start Website Crawling <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="relative mt-10 h-[210px] w-full max-w-[390px] self-end lg:mt-0">
            <div className="float-card absolute right-0 top-0 w-[190px] rounded-[18px] bg-white p-4 text-[#111827]">
              <div className="flex items-center justify-between"><p className="text-xs font-bold">Campaign growth</p><BarChart3 className="h-4 w-4 text-[#1688d2]" /></div>
              <p className="mt-5 text-3xl font-bold">+42%</p>
              <div className="mt-4 flex h-10 items-end gap-1">{[35,48,42,68,58,82,74].map((h,i)=><div key={i} className="flex-1 rounded-t bg-[#1688d2]" style={{height:`${h}%`,opacity:.4+i*.07}} />)}</div>
            </div>
            <div className="float-card float-mid absolute bottom-0 left-0 w-[210px] rounded-[18px] border border-white/70 bg-[#101827]/95 p-4 text-white">
              <div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dfff75] text-[#172300]"><Sparkles className="h-4 w-4" /></div><div><p className="text-[10px] text-white/55">AI STATUS</p><p className="text-sm font-semibold">Ready to create</p></div></div>
              <div className="mt-4 h-1.5 rounded-full bg-white/10"><div className="h-full w-4/5 rounded-full bg-[#dfff75]" /></div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
        <article className="rounded-[24px] border border-[#dfeaf2] bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#087fd7] text-white"><Sparkles className="h-5 w-5" /></div>
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1688d2]">Marketing Agent</p><h2 className="mt-1 text-xl font-semibold">Create grounded campaigns</h2></div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#edf8ff] px-2.5 py-1 text-xs font-medium text-[#1688d2]"><span className="h-1.5 w-1.5 rounded-full bg-[#1688d2]" />Active</span>
          </div>
          <p className="mt-5 max-w-[620px] text-sm leading-6 text-[#697386]">Transform verified company knowledge into platform-ready LinkedIn and Instagram posts, complete with captions and AI visuals.</p>
          <button type="button" onClick={() => onNavigate('/content-studio')} className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#087fd7] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#076db8]">Generate a Post <ArrowRight className="h-4 w-4" /></button>
        </article>

        <article className="rounded-[24px] border border-[#dfeaf2] bg-[#f5faff] p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#dfff75] text-[#172300]"><UserCheck className="h-5 w-5" /></div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-[#697386]">Lead Agent</p>
          <h2 className="mt-2 text-xl font-semibold">Focus on real buyers</h2>
          <button type="button" onClick={() => onNavigate('/leads')} className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#1688d2]">Open Leads <ArrowRight className="h-4 w-4" /></button>
        </article>
      </section>

      {crawlOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#071827]/45 p-4 backdrop-blur-sm">
          <div className="relative max-h-[92vh] w-full max-w-[900px] overflow-y-auto rounded-[28px] border border-white/50 bg-white shadow-[0_30px_80px_rgba(7,54,95,.28)]">
            {crawlState === 'idle' && (
              <form onSubmit={startCrawl} className="p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1688d2]">Website setup</p><h2 className="mt-2 text-3xl font-medium tracking-[-0.04em]">Start with your website</h2></div>
                  <button type="button" onClick={() => setCrawlOpen(false)} className="rounded-full border border-[#dfe7ee] p-2 text-[#697386] hover:bg-[#f5faff]"><X className="h-5 w-5" /></button>
                </div>
                <p className="mt-3 text-sm leading-6 text-[#697386]">Nexora will securely crawl and index your public pages for grounded AI marketing.</p>
                <label className="mt-7 block text-sm font-bold">Company website URL</label>
                <div className="mt-2 flex items-center gap-3 rounded-2xl border border-[#dfe7ee] px-4 focus-within:border-[#1688d2] focus-within:ring-2 focus-within:ring-[#1688d2]/10">
                  <Globe2 className="h-5 w-5 text-[#1688d2]" />
                  <input type="url" required value={crawlUrl} onChange={(e)=>setCrawlUrl(e.target.value)} placeholder="https://yourcompany.com" className="min-h-14 w-full bg-transparent text-sm outline-none" />
                </div>
                {crawlError && <p className="mt-3 text-sm text-red-600">{crawlError}</p>}
                <button type="submit" className="lime-button mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-bold text-[#172300]"><Search className="h-4 w-4" /> Start Website Crawl</button>
              </form>
            )}

            {crawlState === 'running' && (
              <div className="p-6 sm:p-8">
                <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1688d2]">Active ingestion pipeline</p><h2 className="mt-2 text-3xl font-medium tracking-[-0.04em]">Crawling your website</h2></div><Loader2 className="h-7 w-7 animate-spin text-[#1688d2]" /></div>
                <div className="mt-6 rounded-2xl border border-[#dfeaf2] bg-[#f7fbfd] p-5">
                  <div className="flex items-center justify-between text-sm"><span className="font-semibold">{crawlUrl}</span><span className="font-bold text-[#1688d2]">{progress}%</span></div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#dfeaf2]"><div className="h-full rounded-full bg-[#1688d2] transition-all duration-700" style={{width:`${progress}%`}} /></div>
                  <div className="mt-3 flex gap-5 text-xs text-[#697386]"><span>{pagesProcessed} pages processed</span><span>{sectionsSaved} sections saved</span></div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {[
                    ['Crawling','Sitemap & seeds'],
                    ['Inspecting','DOM & status'],
                    ['Extracting','Clean page text'],
                    ['Cleaning','Boilerplate filter'],
                    ['Classifying','16 categories'],
                    ['Saving','pgvector index'],
                  ].map(([title,detail],index)=>{
                    const reached = crawlState === 'running' && index <= Math.min(5,Math.floor(progress/18));
                    return <div key={title} className={`rounded-xl border p-3 ${reached?'border-[#1688d2]/30 bg-[#edf7fd]':'border-[#e5eaef] bg-white'}`}><span className={`text-[10px] font-bold ${reached?'text-[#1688d2]':'text-[#697386]'}`}>0{index+1}. {title}</span><p className="mt-2 text-[11px] leading-4 text-[#697386]">{detail}</p></div>
                  })}
                </div>
              </div>
            )}

            {crawlState === 'success' && (
              <div className="p-10 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#dfff75] text-[#172300]"><CheckCircle2 className="h-8 w-8" /></div>
                <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-[#1688d2]">Crawl complete</p>
                <h2 className="mt-2 text-4xl font-medium tracking-[-0.04em]">Website crawled successfully</h2>
                <p className="mt-3 text-sm text-[#697386]">{pagesProcessed} pages processed · {sectionsSaved} sections indexed</p>
                <p className="mt-6 text-xs font-medium text-[#697386]">Opening Generate Post...</p>
              </div>
            )}

            {crawlState === 'failed' && (
              <div className="p-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600"><X className="h-7 w-7" /></div>
                <h2 className="mt-5 text-2xl font-semibold">Crawl could not start</h2>
                <p className="mt-2 text-sm text-red-600">{crawlError}</p>
                <button type="button" onClick={()=>setCrawlState('idle')} className="lime-button mt-6 rounded-full px-6 py-3 text-sm font-bold text-[#172300]">Try Again</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
