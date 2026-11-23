import React, { useState } from 'react';
import { ArrowRight, Globe, CheckCircle2, ShieldCheck, Lock } from 'lucide-react';

interface CtaSectionProps {
  onStartCrawl?: (url: string) => void;
}

export const CtaSection: React.FC<CtaSectionProps> = ({ onStartCrawl }) => {
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
    <section className="py-20 md:py-28 bg-[#14211C] text-white relative overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center flex flex-col items-center">
        
        <span className="text-xs uppercase font-semibold text-[#256D58] tracking-widest mb-4">
          Ready to experience grounded content?
        </span>

        <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight max-w-[680px] text-balance leading-tight">
          Turn your company website into inbound client interest today
        </h2>

        <p className="mt-5 text-base sm:text-lg text-white/70 max-w-[600px] text-pretty">
          Enter your website address to index your real capabilities and generate your first AI powered post with full source citations.
        </p>

        {/* URL intake form */}
        <form 
          onSubmit={handleSubmit}
          className="mt-8 w-full max-w-md flex flex-col sm:flex-row items-center gap-2 p-1.5 bg-white border border-white/20 rounded-2xl sm:rounded-full shadow-lg"
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

        {/* Guarantees */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs text-white/60">
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
            <span>Nothing published without approval</span>
          </div>
        </div>

      </div>
    </section>
  );
};
