import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { companyApi } from '../../lib/api/company';
import { Company } from '../../types';
import {
  Sparkles,
  UserCheck,
  Building2,
  ArrowRight,
  ShieldCheck,
  Sliders,
} from 'lucide-react';

interface OverviewPageProps {
  onNavigate: (path: string) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ onNavigate }) => {
  const { companyId, companyName: authCompanyName } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [backendReady, setBackendReady] = useState(true);

  useEffect(() => {
    if (!companyId) return;

    let isMounted = true;
    const fetchCompanyData = async () => {
      try {
        const data = await companyApi.getCompany(companyId);
        if (isMounted) {
          setCompany(data);
          setBackendReady(true);
        }
      } catch {
        if (isMounted) {
          setBackendReady(false);
        }
      }
    };

    fetchCompanyData();

    return () => {
      isMounted = false;
    };
  }, [companyId]);

  const displayName = company?.company_name || authCompanyName || 'Your Organization';
  const cleanWebsiteUrl = company?.website_url
    ? company.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')
    : null;

  return (
    <div className="space-y-8 font-sans">
      {/* =========================================================================
          PAGE HEADER: 28px/600 title, 14px/400 body, shared 32px padding grid
          Soft Graphite Palette: #252525 text, #737373 secondary
          ========================================================================= */}
      <div className="pb-6 border-b border-[#E7E5E4]">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-semibold text-[#252525] tracking-tight leading-tight">
              Overview
            </h1>
            <p className="text-[14px] text-[#737373] mt-2 max-w-2xl leading-relaxed">
              Your central workspace where autonomous AI agents write authentic marketing and qualify new sales opportunities using your company's real expertise.
            </p>
          </div>

          {/* Understated Company Context Pill */}
          <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-[#FFFFFF] border border-[#E7E5E4] text-[13px] transition-colors shrink-0">
            <Building2 className="w-4 h-4 text-[#737373] shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[#252525] block truncate max-w-[160px]">
                  {displayName}
                </span>
                <button
                  onClick={() => onNavigate('/settings')}
                  title="Configure in Settings"
                  className="btn-motion text-[#737373] hover:text-[#252525] p-0.5 rounded cursor-pointer"
                >
                  <Sliders className="w-3 h-3" />
                </button>
              </div>
              <span className="text-[#737373] text-[12px] block truncate max-w-[150px]">
                {cleanWebsiteUrl || 'Domain not set'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          TWO WORKSPACE ENTRIES: Marketing Agent & Lead Qualification Agent
          Soft Graphite Palette: #FFFFFF surface, #E7E5E4 border, #252525 button
          32px grid gap, equal heights, 24px internal card padding
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">

        {/* =========================================================================
            ENTRY 1: Marketing Agent
            ========================================================================= */}
        <div className="card-motion h-full flex flex-col justify-between bg-[#FFFFFF] rounded-2xl border border-[#E7E5E4] p-7 shadow-xs hover:border-[#252525]/30 hover:shadow-md transition-all">
          <div className="space-y-4">
            {/* Header: Title & Status */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#252525] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-[17px] font-semibold text-[#252525] leading-snug">
                    Marketing Agent
                  </h2>
                  <p className="text-[12px] text-[#737373] leading-normal mt-0.5">
                    Authentic Content & Brand Voice
                  </p>
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium bg-[#FAFAF9] text-[#252525] border border-[#E7E5E4] shrink-0">
                <span className={`w-1.5 h-1.5 rounded-full ${backendReady ? 'bg-emerald-600 animate-pulse' : 'bg-[#737373]'}`} />
                <span>{backendReady ? 'Active' : 'Connecting'}</span>
              </div>
            </div>

            {/* Core Agent Motto Callout */}
            <div className="p-3.5 rounded-xl bg-[#FAFAF9] border border-[#E7E5E4] text-xs space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#737373] block">
                Agent Motto
              </span>
              <p className="font-semibold text-[#252525] text-[13px] leading-snug">
                "Turn your real company expertise into high-impact content — with zero made-up claims."
              </p>
            </div>

            {/* Clear Natural Description */}
            <p className="text-[13px] text-[#737373] leading-relaxed">
              Reads your website and verified company knowledge to draft engaging social posts, in-depth articles, branded visual graphics, and 60-second video reels. Every word sounds like your leadership team and stays 100% faithful to what your business actually delivers.
            </p>

            <div className="h-px bg-[#E7E5E4]" />

            {/* What this Agent Delivers (Clean Words) */}
            <div className="space-y-2.5">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-[#252525] block">
                What This Agent Does For You:
              </span>

              <ul className="space-y-2 text-[13px] text-[#252525]">
                <li className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#252525] shrink-0 mt-2" />
                  <span className="leading-relaxed">
                    <strong className="font-semibold text-[#252525]">100% Fact-Checked:</strong> Only writes about services, technologies, and achievements your company actually delivers — never invented claims.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#252525] shrink-0 mt-2" />
                  <span className="leading-relaxed">
                    <strong className="font-semibold text-[#252525]">Ready for LinkedIn & Instagram:</strong> Generates platform-tuned posts with custom hooks, descriptions, hashtags, graphic banners, and video reels.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#252525] shrink-0 mt-2" />
                  <span className="leading-relaxed">
                    <strong className="font-semibold text-[#252525]">Always Under Your Control:</strong> Saves drafts directly to your review queue so your team can inspect, edit, and approve before anything goes live.
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-6 mt-6 border-t border-[#E7E5E4] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <button
              onClick={() => onNavigate('/marketing')}
              className="btn-motion inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-[#252525] hover:bg-[#383838] text-white text-[13px] font-semibold shadow-xs cursor-pointer group"
            >
              <span>Open Marketing Agent</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-150" />
            </button>

            <button
              onClick={() => onNavigate('/content-studio')}
              className="btn-motion inline-flex items-center justify-center gap-2 h-10 px-3.5 rounded-xl text-[13px] font-semibold text-[#252525] bg-white border border-[#E7E5E4] hover:bg-[#F5F5F4] hover:border-[#D6D3D1] transition-all cursor-pointer group"
            >
              <span>Launch Content Studio</span>
              <ArrowRight className="w-3 h-3 text-[#737373] group-hover:translate-x-0.5 transition-transform duration-150" />
            </button>
          </div>
        </div>

        {/* =========================================================================
            ENTRY 2: Lead Qualification Agent
            ========================================================================= */}
        <div className="card-motion h-full flex flex-col justify-between bg-[#FFFFFF] rounded-2xl border border-[#E7E5E4] p-7 shadow-xs hover:border-[#252525]/30 hover:shadow-md transition-all">
          <div className="space-y-4">
            {/* Header: Title & Status */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#252525] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-[17px] font-semibold text-[#252525] leading-snug">
                    Lead Qualification Agent
                  </h2>
                  <p className="text-[12px] text-[#737373] leading-normal mt-0.5">
                    Smart Inbound Client Matching
                  </p>
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium bg-[#FAFAF9] text-[#252525] border border-[#E7E5E4] shrink-0">
                <span className={`w-1.5 h-1.5 rounded-full ${backendReady ? 'bg-emerald-600 animate-pulse' : 'bg-[#737373]'}`} />
                <span>{backendReady ? 'Active' : 'Connecting'}</span>
              </div>
            </div>

            {/* Core Agent Motto Callout */}
            <div className="p-3.5 rounded-xl bg-[#FAFAF9] border border-[#E7E5E4] text-xs space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#737373] block">
                Agent Motto
              </span>
              <p className="font-semibold text-[#252525] text-[13px] leading-snug">
                "Spot your best client opportunities instantly — so your sales team speaks only with real buyers."
              </p>
            </div>

            {/* Clear Natural Description */}
            <p className="text-[13px] text-[#737373] leading-relaxed">
              Reviews incoming client inquiries the moment they arrive. It checks whether the client's project, budget, and timeline match what your company excels at, delivering an instant 0–100 fit score and strategic sales advice.
            </p>

            <div className="h-px bg-[#E7E5E4]" />

            {/* What this Agent Delivers (Clean Words) */}
            <div className="space-y-2.5">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-[#252525] block">
                What This Agent Does For You:
              </span>

              <ul className="space-y-2 text-[13px] text-[#252525]">
                <li className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#252525] shrink-0 mt-2" />
                  <span className="leading-relaxed">
                    <strong className="font-semibold text-[#252525]">Instant 0–100 Fit Score:</strong> Automatically rates budget, company size, and project needs against your real company capabilities.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#252525] shrink-0 mt-2" />
                  <span className="leading-relaxed">
                    <strong className="font-semibold text-[#252525]">Actionable Sales Call Briefs:</strong> Gives your reps clear talking points, potential risks, and recommendations before the first call.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#252525] shrink-0 mt-2" />
                  <span className="leading-relaxed">
                    <strong className="font-semibold text-[#252525]">Zero Wasted Time:</strong> Filters out spam and mismatches so your team spends their time closing high-value deals.
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-6 mt-6 border-t border-[#E7E5E4] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <button
              onClick={() => onNavigate('/leads')}
              className="btn-motion inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-[#252525] hover:bg-[#383838] text-white text-[13px] font-semibold shadow-xs cursor-pointer group"
            >
              <span>Open Lead Agent</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-150" />
            </button>

            <button
              onClick={() => onNavigate('/settings')}
              className="btn-motion inline-flex items-center justify-center gap-2 h-10 px-3.5 rounded-xl text-[13px] font-semibold text-[#252525] bg-white border border-[#E7E5E4] hover:bg-[#F5F5F4] hover:border-[#D6D3D1] transition-all cursor-pointer group"
            >
              <span>Manage Profile</span>
              <ArrowRight className="w-3 h-3 text-[#737373] group-hover:translate-x-0.5 transition-transform duration-150" />
            </button>
          </div>
        </div>

      </div>

      {/* =========================================================================
          WORKSPACE FOOTER: Minimal Tenant Isolation Guarantee
          ========================================================================= */}
      <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E7E5E4] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[12px] text-[#737373]">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[#252525] shrink-0" />
          <span>
            Tenant isolation active. All agent executions, vector embeddings, and drafts are private to your workspace.
          </span>
        </div>
        <span className="text-[12px] text-[#737373] shrink-0">
          FastAPI • PostgreSQL • pgvector • Ollama
        </span>
      </div>
    </div>
  );
};
