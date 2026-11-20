import React, { useState } from 'react';
import { 
  ArrowRight, 
  Globe, 
  CheckCircle2, 
  ShieldCheck, 
  Database, 
  Sparkles, 
  Lock, 
  Clock, 
  ExternalLink 
} from 'lucide-react';

interface HeroSectionProps {
  onStartCrawl?: (url: string) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onStartCrawl }) => {
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setIsSubmitting(true);
    if (onStartCrawl) {
      onStartCrawl(url);
    }
  };

  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden bg-[#FAFAF8]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        {/* Top Tagline Pill */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 bg-[#256D58]/10 border border-[#256D58]/20 rounded-full px-3.5 py-1 text-xs font-medium text-[#256D58]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Company grounded AI marketing for B2B technology leaders</span>
          </div>
        </div>

        {/* Hero Headline and Subhead */}
        <div className="text-center flex flex-col items-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.08] max-w-[680px] text-balance">
            <span className="bg-gradient-to-r from-[#000000] to-[#666666] bg-clip-text text-transparent">
              Turn your real engineering work into high authority content that wins clients
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-[#66716B] max-w-[680px] text-pretty leading-relaxed">
            Nexora crawls your company website to build a verified knowledge base. Generate accurate LinkedIn articles and posts grounded in your actual services, projects, and tech stack.
          </p>

          {/* Interactive URL Intake Form */}
          <form 
            onSubmit={handleSubmit}
            className="mt-8 w-full max-w-md flex flex-col sm:flex-row items-center gap-2 p-1.5 bg-white border border-[#171B1A]/15 rounded-2xl sm:rounded-full shadow-sm hover:border-[#256D58]/40 focus-within:border-[#256D58] focus-within:ring-2 focus-within:ring-[#256D58]/10 transition-all duration-200"
          >
            <div className="flex items-center gap-2 pl-3.5 w-full">
              <Globe className="w-4 h-4 text-[#66716B] shrink-0" />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter your company website URL"
                className="w-full bg-transparent text-sm text-[#171B1A] placeholder-[#66716B]/70 focus:outline-none py-2"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 bg-[#256D58] hover:bg-[#1E5746] text-white text-sm font-semibold px-5 py-2.5 rounded-xl sm:rounded-full transition-all duration-200 shadow-sm active:scale-[0.98]"
            >
              <span>{isSubmitting ? 'Analyzing...' : 'Get started'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Trust Guarantees */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs text-[#66716B]">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#256D58]" />
              <span>Free to try</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#256D58]" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#256D58]" />
              <span>Human approval on every post</span>
            </div>
          </div>
        </div>

        {/* Central Product Showcase: Content Studio Mockup */}
        <div className="mt-14 relative">
          <div className="rounded-2xl border border-[#171B1A]/10 bg-white shadow-xl overflow-hidden">
            
            {/* Window Title Bar */}
            <div className="bg-[#FAFAF8] border-b border-[#171B1A]/10 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#171B1A]/15" />
                <div className="w-3 h-3 rounded-full bg-[#171B1A]/15" />
                <div className="w-3 h-3 rounded-full bg-[#171B1A]/15" />
                <span className="ml-2 text-xs font-medium text-[#66716B]">
                  Nexora.AI Content Studio — Verified Knowledge Extraction
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#256D58] font-medium bg-[#256D58]/10 px-2.5 py-1 rounded-md">
                <Database className="w-3.5 h-3.5" />
                <span>Source: datafactz.ai (42 verified facts)</span>
              </div>
            </div>

            {/* Studio Workspace Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[460px]">
              
              {/* Left Column: Verified Knowledge Context */}
              <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-[#171B1A]/10 p-5 bg-[#FAFAF8]/50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-[#171B1A]/10 mb-3">
                    <span className="text-xs font-semibold text-[#171B1A] uppercase tracking-wider">
                      Authoritative Company Facts
                    </span>
                    <span className="text-[11px] text-[#256D58] font-medium">PostgreSQL + RAG</span>
                  </div>

                  <div className="space-y-2.5">
                    <div className="p-2.5 rounded-lg bg-white border border-[#171B1A]/10 text-xs shadow-xs">
                      <div className="flex items-center justify-between text-[#256D58] font-medium mb-1">
                        <span>Partner Data Intake Agent</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#256D58]" />
                      </div>
                      <p className="text-[#66716B] line-clamp-2">
                        Automates insurance bordereaux ingestion, canonical data mapping, and partner audit trails.
                      </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white border border-[#171B1A]/10 text-xs shadow-xs">
                      <div className="flex items-center justify-between text-[#256D58] font-medium mb-1">
                        <span>Site Intelligence Agent</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#256D58]" />
                      </div>
                      <p className="text-[#66716B] line-clamp-2">
                        Pulls 100 years of aerial photos and historical maps for environmental desk reports.
                      </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white border border-[#171B1A]/10 text-xs shadow-xs">
                      <div className="flex items-center justify-between text-[#256D58] font-medium mb-1">
                        <span>Architecture Contract</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#256D58]" />
                      </div>
                      <p className="text-[#66716B] line-clamp-2">
                        Every agent built on declared schema contracts and registered centrally to prevent code silos.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#171B1A]/10 text-xs text-[#66716B] flex items-center justify-between">
                  <span>Fact currency: Current</span>
                  <span className="text-[#256D58] font-medium">100% Grounded</span>
                </div>
              </div>

              {/* Right Column: Grounded LinkedIn Post Draft Preview */}
              <div className="lg:col-span-8 p-6 flex flex-col justify-between bg-white">
                <div>
                  
                  {/* Status Bar */}
                  <div className="flex items-center justify-between pb-4 border-b border-[#171B1A]/10 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      <span className="text-xs font-semibold text-[#171B1A]">
                        Approval Status: Pending human review
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#66716B]">Target: LinkedIn Article</span>
                    </div>
                  </div>

                  {/* Post Content */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-[#171B1A] leading-snug">
                      From Fragile Pilots to Production: How Enterprise Teams Build Agents on Contracts
                    </h3>
                    
                    <p className="text-sm text-[#171B1A]/90 leading-relaxed">
                      Most enterprise AI initiatives stall because teams write one off conversational scripts with no schema validation or permission boundaries.
                    </p>

                    <p className="text-sm text-[#171B1A]/90 leading-relaxed">
                      In production, reliability requires contracts. When deploying our Partner Data Intake Agent for insurance bordereaux and Site Intelligence Agent for historic environmental mapping, every input and output is governed by an explicit schema contract.
                    </p>

                    <p className="text-sm text-[#171B1A]/90 leading-relaxed">
                      Crucially, consequential actions require human verification before data updates take effect. That is how enterprise teams move from endless prototypes to real operational impact.
                    </p>

                    {/* Cited Evidence Sources */}
                    <div className="mt-3 p-3 rounded-lg bg-[#FAFAF8] border border-[#171B1A]/10 text-xs space-y-1">
                      <span className="font-semibold text-[#171B1A] block">Verified Evidence Citations:</span>
                      <div className="flex flex-wrap gap-2 pt-1 text-[#256D58]">
                        <span className="inline-flex items-center gap-1 hover:underline">
                          datafactz.ai/agents <ExternalLink className="w-3 h-3" />
                        </span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 hover:underline">
                          datafactz.ai/agents/partner-data-intake <ExternalLink className="w-3 h-3" />
                        </span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 hover:underline">
                          datafactz.ai/agents/site-intelligence <ExternalLink className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Human Governance Action Footer */}
                <div className="mt-6 pt-4 border-t border-[#171B1A]/10 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-[#66716B]">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Generated in 1.4 seconds from verified company facts</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      type="button"
                      className="px-3.5 py-1.5 text-xs font-semibold text-[#171B1A] bg-[#FAFAF8] hover:bg-[#171B1A]/5 border border-[#171B1A]/15 rounded-lg transition-colors"
                    >
                      Edit text
                    </button>
                    <button 
                      type="button"
                      className="px-4 py-1.5 text-xs font-semibold text-white bg-[#256D58] hover:bg-[#1E5746] rounded-lg transition-all shadow-xs flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve and publish</span>
                    </button>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </div>

      </div>
    </section>
  );
};
