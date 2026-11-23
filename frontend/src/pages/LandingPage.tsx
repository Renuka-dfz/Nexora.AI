import React, { useEffect } from 'react';
import { LandingNav } from '../components/landing/LandingNav';
import { HeroSection } from '../components/landing/HeroSection';
import { ComparisonSection } from '../components/landing/ComparisonSection';
import { BenefitsSection } from '../components/landing/BenefitsSection';
import { TaglineReveal } from '../components/landing/TaglineReveal';
import { HowItWorksSection } from '../components/landing/HowItWorksSection';
import { GovernanceSection } from '../components/landing/GovernanceSection';
import { FaqSection } from '../components/landing/FaqSection';
import { CtaSection } from '../components/landing/CtaSection';
import { LandingFooter } from '../components/landing/LandingFooter';

interface LandingPageProps {
  onNavigate?: (path: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  useEffect(() => {
    // Set page title and meta description per Section 6 (SEO / AEO)
    document.title = 'Nexora.AI — Turn Your Engineering Work Into Grounded B2B Content';
    
    let metaDesc = document.querySelector("meta[name='description']");
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute(
      'content',
      'Nexora crawls your company website to generate verified, company grounded LinkedIn content and articles. Free to try with zero risk and mandatory human approval.'
    );

    // Inject FAQ Schema for Answer Engine Optimization (AEO)
    const faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Will Nexora generate generic or inaccurate content about my business?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'No. Nexora retrieves facts directly from your verified website pages, past projects, and technical case studies using hybrid search. If an answer is not in your data, our agent states that evidence is missing rather than inventing facts.',
          },
        },
        {
          '@type': 'Question',
          name: 'Can Nexora publish to my LinkedIn profile without my permission?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Never. Human review is an absolute architectural requirement. Every piece of content enters your Content Studio as a pending draft. Nothing moves to publishing until an authorized team member explicitly reviews and clicks approve.',
          },
        },
        {
          '@type': 'Question',
          name: 'How does Nexora handle company data security?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Your data is stored with strict company isolation. Your extracted website knowledge and generated drafts are private to your workspace and are never shared or used to train third party public models.',
          },
        },
      ],
    };

    const scriptTag = document.createElement('script');
    scriptTag.type = 'application/ld+json';
    scriptTag.text = JSON.stringify(faqSchema);
    document.head.appendChild(scriptTag);

    return () => {
      document.head.removeChild(scriptTag);
    };
  }, []);

  const handleStartCrawl = (url: string) => {
    if (onNavigate) {
      onNavigate('/register');
    }
  };

  const handleNavGetStarted = () => {
    if (onNavigate) {
      onNavigate('/register');
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNavLogin = () => {
    if (onNavigate) {
      onNavigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#171B1A] font-sans antialiased selection:bg-[#256D58]/15 selection:text-[#256D58]">
      {/* Skip to main content for accessibility per Rule B10 */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-50 px-4 py-2 bg-[#256D58] text-white rounded-md text-sm font-semibold"
      >
        Skip to main content
      </a>

      {/* Floating Translucent Navigation */}
      <LandingNav onGetStarted={handleNavGetStarted} onLogin={handleNavLogin} />

      <main id="main-content">
        {/* 1. Hero Section */}
        <HeroSection onStartCrawl={handleStartCrawl} />

        {/* 2. Comparison: The Grounding Difference */}
        <ComparisonSection />

        {/* 3. Core Business Benefits */}
        <BenefitsSection />

        {/* 4. Mandatory Tagline Reveal (Rule B11) */}
        <TaglineReveal />

        {/* 5. How It Works Workflow */}
        <HowItWorksSection />

        {/* 6. Publishing Control and Governance */}
        <GovernanceSection />

        {/* 7. Comprehensive FAQ */}
        <FaqSection />

        {/* 8. Final Call to Action */}
        <CtaSection onStartCrawl={handleStartCrawl} />
      </main>

      {/* 9. Footer */}
      <LandingFooter />
    </div>
  );
};

export default LandingPage;
