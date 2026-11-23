import React from 'react';
import { XCircle, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

export const ComparisonSection: React.FC = () => {
  return (
    <section id="comparison" className="py-20 md:py-28 bg-[#FAFAF8] border-t border-[#171B1A]/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#256D58] uppercase tracking-wider mb-3">
            <span>The Grounding Difference</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold text-[#171B1A] tracking-tight text-balance">
            Stop publishing generic AI boilerplate that damages your brand credibility
          </h2>
          <p className="mt-4 text-base text-[#66716B] text-pretty">
            B2B buyers and enterprise decision makers can spot ungrounded AI text instantly. See how Nexora turns your real engineering into authentic authority.
          </p>
        </div>

        {/* Side by Side Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          
          {/* Card 1: Generic AI (The Problem) */}
          <div className="rounded-2xl border border-red-200/80 bg-white p-6 sm:p-8 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-red-100 mb-6">
                <div className="flex items-center gap-2 text-red-600 font-semibold text-sm">
                  <XCircle className="w-4 h-4" />
                  <span>Generic AI tools (ChatGPT, standard prompts)</span>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-md bg-red-50 text-red-700 font-medium border border-red-200/50">
                  Hallucination risk
                </span>
              </div>

              {/* Sample output */}
              <div className="p-4 rounded-xl bg-red-50/40 border border-red-100 font-mono text-xs text-[#171B1A]/85 space-y-3 leading-relaxed">
                <p className="text-red-900/90 italic font-sans font-medium text-sm">
                  "In today's fast paced world, AI is revolutionizing everything! At Acme Tech, we supercharge your enterprise workflows with cutting edge digital transformation."
                </p>
                <div className="pt-2 text-[11px] text-red-700 space-y-1">
                  <p className="flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Fabricates fake metrics ("guaranteed 99% savings")</span>
                  </p>
                  <p className="flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Mentions services you do not even offer</span>
                  </p>
                  <p className="flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Zero citations or audit trail for claims</span>
                  </p>
                </div>
              </div>

              <ul className="mt-6 space-y-3 text-xs sm:text-sm text-[#66716B]">
                <li className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>Relies on public internet training data instead of your real company records</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>Sounds like every competitor in your space using the same prompt template</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>Forces marketing to constantly edit and remove factual errors</span>
                </li>
              </ul>
            </div>

            <div className="mt-8 pt-4 border-t border-red-100 text-xs text-red-600 font-medium">
              Result: Generic spam that repels serious B2B buyers
            </div>
          </div>

          {/* Card 2: Nexora.AI (The Grounded Solution) */}
          <div className="rounded-2xl border-2 border-[#256D58]/40 bg-white p-6 sm:p-8 flex flex-col justify-between shadow-sm relative">
            <div className="absolute -top-3 right-6 bg-[#256D58] text-white text-[11px] font-semibold px-3 py-0.5 rounded-full shadow-xs">
              Verified grounding
            </div>

            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#171B1A]/10 mb-6">
                <div className="flex items-center gap-2 text-[#256D58] font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Nexora.AI (Company Knowledge + RAG)</span>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-md bg-[#256D58]/10 text-[#256D58] font-medium border border-[#256D58]/20">
                  100% Verified facts
                </span>
              </div>

              {/* Sample output */}
              <div className="p-4 rounded-xl bg-[#FAFAF8] border border-[#171B1A]/10 text-xs text-[#171B1A] space-y-2.5 leading-relaxed">
                <p className="font-medium text-sm text-[#171B1A]">
                  "When automating insurance bordereaux, custom scripts break the moment partner schemas change. Our Partner Data Intake Agent standardizes incoming spreadsheets into a single canonical model."
                </p>
                <div className="pt-2 text-[11px] text-[#256D58] font-medium space-y-1">
                  <p className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>Cites exact company source: datafactz.ai/agents/partner-data-intake</span>
                  </p>
                  <p className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>Names real architectural capabilities and delivery methodology</span>
                  </p>
                  <p className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>Pending draft requires team sign off before publishing</span>
                  </p>
                </div>
              </div>

              <ul className="mt-6 space-y-3 text-xs sm:text-sm text-[#171B1A]">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#256D58] shrink-0 mt-0.5" />
                  <span>Cites verified company knowledge from your crawled website and case studies</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#256D58] shrink-0 mt-0.5" />
                  <span>Preserves practitioner tone with specific architectural insight</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#256D58] shrink-0 mt-0.5" />
                  <span>Empowers marketing to publish with total confidence</span>
                </li>
              </ul>
            </div>

            <div className="mt-8 pt-4 border-t border-[#171B1A]/10 text-xs text-[#256D58] font-semibold flex items-center justify-between">
              <span>Result: High authority thought leadership that earns inbound pipeline</span>
              <span className="text-[11px] font-normal text-[#66716B]">PostgreSQL isolated</span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
