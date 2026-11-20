import React from 'react';
import { Globe, Cpu, CheckCheck, ArrowRight } from 'lucide-react';

export const HowItWorksSection: React.FC = () => {
  const steps = [
    {
      step: '01',
      title: 'Index your company knowledge',
      description:
        'Enter your company website domain. Nexora crawls authorized pages and organizes your services, technology stack, client projects, and case studies into an isolated database.',
      icon: <Globe className="w-5 h-5 text-[#256D58]" />,
      detail: 'Continuous currency with automated updates',
    },
    {
      step: '02',
      title: 'Generate grounded content',
      description:
        'Choose a topic or business goal. Our marketing agent queries your verified facts to write in depth LinkedIn posts and articles with complete source attribution.',
      icon: <Cpu className="w-5 h-5 text-[#256D58]" />,
      detail: 'Every claim cited back to your website',
    },
    {
      step: '03',
      title: 'Review, refine, and approve',
      description:
        'Inspect the draft in the Content Studio. Verify cited claims, adjust the tone to match your voice, click approve, and publish directly to your audience.',
      icon: <CheckCheck className="w-5 h-5 text-[#256D58]" />,
      detail: 'Mandatory human approval on every post',
    },
  ];

  return (
    <section id="how-it-works" className="py-20 md:py-28 bg-[#FAFAF8] border-t border-[#171B1A]/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#256D58] uppercase tracking-wider mb-3">
            <span>Simple Three Step Workflow</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold text-[#171B1A] tracking-tight text-balance">
            From company website to verified marketing in under two minutes
          </h2>
          <p className="mt-4 text-base text-[#66716B] text-pretty">
            No complex engineering pipelines or prompt engineering courses required.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {steps.map((s, idx) => (
            <div
              key={idx}
              className="p-8 rounded-2xl bg-white border border-[#171B1A]/10 shadow-xs flex flex-col justify-between relative group hover:border-[#256D58]/40 transition-all duration-300"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-10 h-10 rounded-xl bg-[#256D58]/10 flex items-center justify-center">
                    {s.icon}
                  </div>
                  <span className="text-2xl font-semibold font-mono text-[#171B1A]/20">
                    {s.step}
                  </span>
                </div>

                <h3 className="text-xl font-semibold text-[#171B1A] tracking-tight mb-3">
                  {s.title}
                </h3>
                <p className="text-sm text-[#66716B] leading-relaxed">
                  {s.description}
                </p>
              </div>

              <div className="mt-8 pt-4 border-t border-[#171B1A]/5 text-xs font-medium text-[#256D58] flex items-center gap-1.5">
                <ArrowRight className="w-3.5 h-3.5" />
                <span>{s.detail}</span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
