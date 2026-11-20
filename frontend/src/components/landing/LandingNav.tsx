import React, { useState } from 'react';
import { Sparkles, Menu, X, ArrowRight, ShieldCheck } from 'lucide-react';

interface LandingNavProps {
  onGetStarted?: () => void;
  onLogin?: () => void;
}

export const LandingNav: React.FC<LandingNavProps> = ({ onGetStarted, onLogin }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'How it works', href: '#how-it-works' },
    { label: 'Comparison', href: '#comparison' },
    { label: 'Benefits', href: '#benefits' },
    { label: 'Governance', href: '#governance' },
    { label: 'FAQ', href: '#faq' },
  ];

  return (
    <header className="fixed top-4 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
      <nav 
        className="pointer-events-auto w-full max-w-5xl bg-[#FAFAF8]/85 backdrop-blur-md border border-[#171B1A]/10 rounded-full px-4 py-2 flex items-center justify-between shadow-sm transition-all duration-300"
        aria-label="Main navigation"
      >
        {/* Brand */}
        <a href="#" className="flex items-center gap-2 pl-2 group">
          <div className="w-8 h-8 rounded-lg bg-[#256D58] flex items-center justify-center text-white font-semibold text-sm shadow-sm transition-transform duration-300 group-hover:scale-105">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-[#171B1A] font-semibold text-lg tracking-tight">
            Nexora<span className="text-[#256D58]">.AI</span>
          </span>
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-[#66716B] hover:text-[#171B1A] transition-colors duration-200"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={onLogin}
            className="text-sm font-semibold text-[#171B1A] hover:text-[#256D58] px-3 py-2 transition-colors"
          >
            Sign in
          </button>
          <button
            onClick={onGetStarted}
            className="inline-flex items-center gap-2 bg-[#256D58] hover:bg-[#1E5746] text-white text-sm font-semibold px-4 py-2 rounded-full transition-all duration-200 shadow-sm active:scale-[0.98]"
          >
            <span>Get started</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile menu trigger */}
        <div className="flex md:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-[#171B1A] hover:text-[#256D58] transition-colors"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile panel */}
      {mobileMenuOpen && (
        <div className="pointer-events-auto fixed inset-0 top-20 bg-[#FAFAF8]/95 backdrop-blur-xl z-40 p-6 flex flex-col justify-between border-t border-[#171B1A]/10 md:hidden animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex flex-col gap-4 pt-4">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-xl font-medium text-[#171B1A] hover:text-[#256D58] py-2 border-b border-[#171B1A]/5 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="pt-6 pb-8">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onGetStarted?.();
              }}
              className="w-full flex items-center justify-center gap-2 bg-[#256D58] text-white font-semibold py-3 rounded-full text-base shadow-sm"
            >
              <span>Get started free</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-xs text-center text-[#66716B] mt-3 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#256D58]" />
              No credit card required
            </p>
          </div>
        </div>
      )}
    </header>
  );
};
