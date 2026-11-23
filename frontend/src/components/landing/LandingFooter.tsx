import React from 'react';
import { Sparkles } from 'lucide-react';

export const LandingFooter: React.FC = () => {
  return (
    <footer className="bg-[#FAFAF8] border-t border-[#171B1A]/10 py-12 text-[#66716B] text-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-[#171B1A]/5">
          
          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#256D58] flex items-center justify-center text-white text-xs">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-[#171B1A] font-semibold text-sm tracking-tight">
              Nexora<span className="text-[#256D58]">.AI</span>
            </span>
            <span className="text-[#66716B]/60 text-xs ml-2">
              Company grounded marketing for B2B technology teams
            </span>
          </div>

          {/* Nav links */}
          <nav className="flex flex-wrap items-center gap-6" aria-label="Footer navigation">
            <a href="#how-it-works" className="hover:text-[#171B1A] transition-colors">
              How it works
            </a>
            <a href="#comparison" className="hover:text-[#171B1A] transition-colors">
              Comparison
            </a>
            <a href="#benefits" className="hover:text-[#171B1A] transition-colors">
              Benefits
            </a>
            <a href="#governance" className="hover:text-[#171B1A] transition-colors">
              Governance
            </a>
            <a href="#faq" className="hover:text-[#171B1A] transition-colors">
              FAQ
            </a>
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[#66716B]/80">
          <p>© {new Date().getFullYear()} Nexora.AI. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-[#171B1A] transition-colors">
              Privacy policy
            </a>
            <span>•</span>
            <a href="#" className="hover:text-[#171B1A] transition-colors">
              Terms of service
            </a>
            <span>•</span>
            <a href="#" className="hover:text-[#171B1A] transition-colors">
              Security notice
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
};
