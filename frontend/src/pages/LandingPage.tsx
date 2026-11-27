import React, { useEffect } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Database,
  Globe,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface LandingPageProps {
  onNavigate?: (path: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  useEffect(() => {
    document.title = 'Nexora.AI — Autonomous AI Marketing Growth Engine';
    let meta = document.querySelector("meta[name='description']");
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute(
      'content',
      'Autonomous marketing agent grounded in your company knowledge via pgvector. Automatically crawl websites, generate weekly campaigns, and publish with human approval gates.'
    );
  }, []);

  const navigate = (path: string) => onNavigate?.(path);

  return (
    <div className="min-h-screen bg-[#0E1513] text-[#FAFAF8] font-sans antialiased selection:bg-[#256D58] selection:text-white flex flex-col justify-between">
      {/* =========================================================================
          TOP NAVBAR: Clean, Minimalist Header
          ========================================================================= */}
      <header className="sticky top-0 z-50 bg-[#0E1513]/90 backdrop-blur-md border-b border-white/10 transition-all">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo & Brand Wordmark */}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 text-left group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#256D58] to-[#34D399] flex items-center justify-center text-white shadow-md shadow-[#256D58]/25 group-hover:scale-105 transition-transform duration-200">
              <Sparkles className="w-4 h-4 fill-current" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white flex items-center gap-1">
              Nexora<span className="text-[#34D399]">.AI</span>
            </span>
          </button>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-xs font-semibold text-[#8E9793] hover:text-white transition-colors cursor-pointer"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#256D58] hover:bg-[#1E5846] text-white text-xs font-semibold shadow-md shadow-[#256D58]/30 transition-all hover:-translate-y-0.5 cursor-pointer"
            >
              <span>Get Started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* =========================================================================
          HERO SECTION: Pure, Simple Core Motto
          ========================================================================= */}
      <main className="flex-1">
        <section className="relative pt-16 pb-20 md:pt-24 md:pb-24 overflow-hidden">
          {/* Ambient Glow */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#256D58]/15 rounded-full blur-[140px] pointer-events-none" />

          <div className="max-w-4xl mx-auto px-6 text-center relative z-10 space-y-6">
            {/* Tag Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-[#34D399]">
              <span className="w-2 h-2 rounded-full bg-[#34D399] animate-pulse" />
              <span>Autonomous AI Marketing System</span>
            </div>

            {/* Core Motto Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white max-w-3xl mx-auto leading-[1.15]">
              Turn Company Knowledge Into{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#34D399] to-[#6EE7B7]">
                Autonomous Growth Campaigns.
              </span>
            </h1>

            {/* Clear, Concise Subtitle */}
            <p className="text-sm sm:text-base text-[#8E9793] max-w-2xl mx-auto leading-relaxed">
              Nexora automatically crawls your website, extracts verified corporate context into pgvector, generates weekly multi-channel content for LinkedIn & Instagram, and publishes strictly with your approval.
            </p>

            {/* Main Action CTAs */}
            <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#256D58] hover:bg-[#1E5846] text-white text-sm font-semibold shadow-lg shadow-[#256D58]/30 transition-all hover:-translate-y-0.5 cursor-pointer"
              >
                <span>Launch Marketing Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-semibold transition-all cursor-pointer"
              >
                Sign In to Your Workspace
              </button>
            </div>
          </div>
        </section>

        {/* =========================================================================
            THREE-STEP WORKFLOW: Clean, Simple, Direct
            ========================================================================= */}
        <section className="py-16 bg-[#14211C] border-y border-white/10">
          <div className="max-w-6xl mx-auto px-6 space-y-12">
            <div className="text-center max-w-xl mx-auto space-y-2">
              <h2 className="text-xl sm:text-3xl font-bold text-white tracking-tight">
                How Nexora Works in 3 Simple Steps
              </h2>
              <p className="text-xs sm:text-sm text-[#8E9793]">
                Zero hallucinations, verified company facts, and 100% human governance.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Step 1 */}
              <div className="p-6 rounded-2xl bg-[#1A2A24] border border-white/10 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#256D58]/30 text-[#34D399] flex items-center justify-center font-bold">
                  <Globe className="w-5 h-5" />
                </div>
                <div className="text-xs font-mono uppercase tracking-wider text-[#34D399]">
                  Step 01 • Automatic Ingestion
                </div>
                <h3 className="text-base font-bold text-white">Crawl & Ground Knowledge</h3>
                <p className="text-xs text-[#8E9793] leading-relaxed">
                  Celery crawler scans your company website weekly. Real announcements and product details are vectorized in pgvector so every post is factually grounded.
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-6 rounded-2xl bg-[#1A2A24] border border-white/10 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#256D58]/30 text-[#34D399] flex items-center justify-center font-bold">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div className="text-xs font-mono uppercase tracking-wider text-[#34D399]">
                  Step 02 • Campaign Synthesis
                </div>
                <h3 className="text-base font-bold text-white">Generate Weekly Batch</h3>
                <p className="text-xs text-[#8E9793] leading-relaxed">
                  Autonomous Marketing Agent drafts weekly multi-channel posts tailored for LinkedIn and Instagram, complete with on-brand visual creatives.
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-6 rounded-2xl bg-[#1A2A24] border border-white/10 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#256D58]/30 text-[#34D399] flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="text-xs font-mono uppercase tracking-wider text-[#34D399]">
                  Step 03 • Human Governance
                </div>
                <h3 className="text-base font-bold text-white">Approve & Publish</h3>
                <p className="text-xs text-[#8E9793] leading-relaxed">
                  Zero unapproved dispatches. Review every post via inline inspection. Only approved content is scheduled and dispatched to connected social accounts.
                </p>
              </div>
            </div>

            {/* Trust Highlights */}
            <div className="pt-6 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center gap-2.5 text-xs text-white">
                <Database className="w-4 h-4 text-[#34D399]" />
                <span className="font-medium">Strict pgvector Semantic Grounding</span>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center gap-2.5 text-xs text-white">
                <Sparkles className="w-4 h-4 text-[#34D399]" />
                <span className="font-medium">Multi-Platform: LinkedIn + Instagram</span>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center gap-2.5 text-xs text-white">
                <Lock className="w-4 h-4 text-[#34D399]" />
                <span className="font-medium">100% Gated Approval-Only Publishing</span>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            BOTTOM CALL TO ACTION: Simple & High Converting
            ========================================================================= */}
        <section className="py-20 text-center relative overflow-hidden">
          <div className="max-w-2xl mx-auto px-6 space-y-5 relative z-10">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Ready to Put Your Brand on Autonomous Autopilot?
            </h2>
            <p className="text-xs sm:text-sm text-[#8E9793] leading-relaxed">
              Connect your company website today and have your first grounded weekly marketing campaign ready in under five minutes.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#256D58] hover:bg-[#1E5846] text-white text-sm font-semibold shadow-xl shadow-[#256D58]/30 transition-all hover:-translate-y-0.5 cursor-pointer"
              >
                <span>Get Started Now</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* =========================================================================
          SITE FOOTER
          ========================================================================= */}
      <footer className="py-6 bg-[#090E0D] border-t border-white/5 text-xs text-[#8E9793]">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">Nexora.AI</span>
            <span>• Company-Aware Autonomous Marketing Engine</span>
          </div>
          <p>© {new Date().getFullYear()} DataFactZ Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
