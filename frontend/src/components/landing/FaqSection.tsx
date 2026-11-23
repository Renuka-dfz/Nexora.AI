import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
}

export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs: FaqItem[] = [
    {
      question: 'Will Nexora generate generic or inaccurate content about my business?',
      answer:
        'No. Standard AI tools guess because they lack company context. Nexora retrieves facts directly from your verified website pages, past projects, and technical case studies using hybrid search. If an answer is not in your data, our agent states that evidence is missing rather than inventing facts.',
    },
    {
      question: 'Can Nexora publish to my LinkedIn profile without my permission?',
      answer:
        'Never. Human review is an absolute architectural requirement. Every piece of content enters your Content Studio as a pending draft. Nothing moves to publishing until an authorized team member explicitly reviews and clicks approve.',
    },
    {
      question: 'How long does setup take?',
      answer:
        'Setup takes less than two minutes. You enter your website address, and our system extracts your core business information automatically. There are no complex software integrations or engineering pipelines required.',
    },
    {
      question: 'What kind of content can I create?',
      answer:
        'You can generate long form thought leadership articles, short conversational LinkedIn posts, technical capability spotlights, and project case study summaries tailored for executive audiences.',
    },
    {
      question: 'How does Nexora handle my company data?',
      answer:
        'Your data is stored with strict company isolation. Your extracted website knowledge and generated drafts are private to your workspace and are never shared or used to train third party public models.',
    },
    {
      question: 'Do I need to connect my social media accounts right away?',
      answer:
        'No. You can index your website, generate posts, and test draft quality immediately. You only need to connect your LinkedIn profile when you are ready to publish directly from the platform.',
    },
    {
      question: 'How does this differ from ChatGPT or standard writing assistants?',
      answer:
        'General writing assistants rely on generic training data and produce recognizable boilerplate. Nexora combines structured database storage, semantic vector retrieval, and automated claim verification to generate posts that accurately reflect your real technical work.',
    },
    {
      question: 'Is there a free trial?',
      answer:
        'Yes. You can get started for free, crawl your website, and generate your first AI powered post without providing credit card details.',
    },
  ];

  const toggleAccordion = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-20 md:py-28 bg-[#FAFAF8] border-t border-[#171B1A]/10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#256D58] uppercase tracking-wider mb-3">
            <span>Frequently Asked Questions</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold text-[#171B1A] tracking-tight text-balance">
            Everything you need to know about Nexora and content grounding
          </h2>
          <p className="mt-4 text-base text-[#66716B] text-pretty">
            Clear answers on data privacy, publishing control, and our retrieval architecture.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-xl border border-[#171B1A]/10 bg-white overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => toggleAccordion(idx)}
                  className="w-full py-5 px-6 flex items-center justify-between text-left gap-4 hover:bg-[#FAFAF8]/50 transition-colors"
                  aria-expanded={isOpen}
                >
                  <span className="text-base font-semibold text-[#171B1A]">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-[#66716B] shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      isOpen ? 'rotate-180 text-[#256D58]' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-6 pb-5 pt-1 text-sm text-[#66716B] leading-relaxed border-t border-[#171B1A]/5 animate-in fade-in duration-200">
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
