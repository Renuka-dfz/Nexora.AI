import React from 'react';
import { ShieldAlert, Users, Sliders, Zap, CheckCircle2 } from 'lucide-react';

export const BenefitsSection: React.FC = () => {
  const benefits = [
    {
      icon: <ShieldAlert className="w-5 h-5 text-[#256D58]" />,
      title: 'Eliminate generic AI fluff',
      description:
        'Every paragraph is grounded in your verified website data and technical case studies, protecting your brand reputation from fabricated statistics or imaginary claims.',
      highlight: 'Zero hallucinations',
    },
    {
      icon: <Users className="w-5 h-5 text-[#256D58]" />,
      title: 'Bridge the engineering gap',
      description:
        'Marketing teams no longer need to chase software architects or senior consultants for technical details. Nexora indexes your actual delivery record and turns it into compelling thought leadership.',
      highlight: 'No engineer interview bottlenecks',
    },
    {
      icon: <Sliders className="w-5 h-5 text-[#256D58]" />,
      title: 'Maintain absolute publishing control',
      description:
        'Nothing ever posts automatically. Your team reviews, edits, and approves every word in the Content Studio before anything reaches your social channels.',
      highlight: 'Mandatory human approval',
    },
    {
      icon: <Zap className="w-5 h-5 text-[#256D58]" />,
      title: 'Reclaim hours of research time',
      description:
        'Skip the blank page. Move from a company URL to an authoritative, cited LinkedIn post ready for review in under two minutes.',
      highlight: 'Two minute turnaround',
    },
  ];

  return (
    <section id="benefits" className="py-20 md:py-28 bg-[#FAFAF8]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#256D58] uppercase tracking-wider mb-3">
            <span>Core Business Outcomes</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold text-[#171B1A] tracking-tight text-balance">
            Built for B2B technology teams that value credibility over volume
          </h2>
          <p className="mt-4 text-base text-[#66716B] text-pretty">
            Transform technical depth into a consistent commercial advantage without sacrificing accuracy.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {benefits.map((b, idx) => (
            <div
              key={idx}
              className="p-8 rounded-2xl bg-white border border-[#171B1A]/10 hover:border-[#256D58]/40 transition-all duration-300 shadow-xs flex flex-col justify-between group"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#256D58]/10 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-200">
                  {b.icon}
                </div>
                <h3 className="text-xl font-semibold text-[#171B1A] tracking-tight mb-3">
                  {b.title}
                </h3>
                <p className="text-sm text-[#66716B] leading-relaxed">
                  {b.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[#171B1A]/5 flex items-center gap-2 text-xs font-medium text-[#256D58]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{b.highlight}</span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
