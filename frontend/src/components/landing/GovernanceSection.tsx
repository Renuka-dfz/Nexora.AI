import React from 'react';
import { Lock, ShieldCheck, UserCheck, Eye } from 'lucide-react';

export const GovernanceSection: React.FC = () => {
  const securityPillars = [
    {
      icon: <UserCheck className="w-5 h-5 text-[#256D58]" />,
      title: 'Human in the loop approval',
      description:
        'Every AI draft enters the Content Studio with status pending. No post can ever be scheduled or published to LinkedIn without an explicit sign off by an authorized team member.',
    },
    {
      icon: <Lock className="w-5 h-5 text-[#256D58]" />,
      title: 'Strict company data isolation',
      description:
        'Your crawled website information and drafts live in private, company scoped database partitions. Your intelligence is never mixed with other companies or sold to data brokers.',
    },
    {
      icon: <ShieldCheck className="w-5 h-5 text-[#256D58]" />,
      title: 'Fail closed claim verification',
      description:
        'Our retrieval pipeline requires explicit factual evidence before generating marketing claims. If a capability is not verified in your source data, our agent states that evidence is missing.',
    },
    {
      icon: <Eye className="w-5 h-5 text-[#256D58]" />,
      title: 'Auditable citation trails',
      description:
        'Every factual claim in a draft includes direct URLs to the supporting source page, so your reviewers can verify technical claims in seconds before approving.',
    },
  ];

  return (
    <section id="governance" className="py-20 md:py-28 bg-[#FAFAF8] border-t border-[#171B1A]/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#256D58] uppercase tracking-wider mb-3">
            <span>Publishing Control and Security</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold text-[#171B1A] tracking-tight text-balance">
            You stay in control. Nothing gets published without your direct approval.
          </h2>
          <p className="mt-4 text-base text-[#66716B] text-pretty">
            We engineered Nexora for enterprise teams where brand reputation and technical precision are paramount.
          </p>
        </div>

        {/* Governance Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {securityPillars.map((p, idx) => (
            <div
              key={idx}
              className="p-8 rounded-2xl bg-white border border-[#171B1A]/10 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#256D58]/10 flex items-center justify-center mb-6">
                  {p.icon}
                </div>
                <h3 className="text-xl font-semibold text-[#171B1A] tracking-tight mb-3">
                  {p.title}
                </h3>
                <p className="text-sm text-[#66716B] leading-relaxed">
                  {p.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[#171B1A]/5 text-xs text-[#256D58] font-medium">
                Enforced by default
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
