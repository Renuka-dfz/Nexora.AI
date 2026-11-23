import React, { useEffect, useRef, useState } from 'react';

export const TaglineReveal: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeWords, setActiveWords] = useState<number>(0);

  const words = [
    'Anyone', 'can', 'prompt', 'an', 'AI', 'to', 'generate', 'generic', 'claims.',
    'We', 'ground', 'every', 'word', 'in', 'what', 'your', 'company', 'has', 'actually', 'engineered', 'and', 'delivered.'
  ];

  useEffect(() => {
    // Check for prefers-reduced-motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      setActiveWords(words.length);
      return;
    }

    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // Start revealing when the container enters the middle 60% of viewport
      const start = windowHeight * 0.85;
      const end = windowHeight * 0.25;

      if (rect.top <= start && rect.bottom >= end) {
        const progress = Math.min(1, Math.max(0, (start - rect.top) / (start - end)));
        const wordsToActivate = Math.floor(progress * words.length);
        setActiveWords(wordsToActivate);
      } else if (rect.top > start) {
        setActiveWords(0);
      } else if (rect.bottom < end) {
        setActiveWords(words.length);
      }
    };

    let animationFrameId: number;
    const throttledScroll = () => {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(handleScroll);
    };

    window.addEventListener('scroll', throttledScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', throttledScroll);
      cancelAnimationFrame(animationFrameId);
    };
  }, [words.length]);

  return (
    <section className="py-24 md:py-36 bg-[#14211C] text-white">
      <div 
        ref={containerRef} 
        className="max-w-4xl mx-auto px-4 sm:px-6 text-center flex flex-col items-center"
      >
        <span className="text-xs uppercase font-semibold text-[#256D58] tracking-widest mb-6 block">
          The Nexora Operating Principle
        </span>

        <h2 className="text-2xl sm:text-3xl md:text-5xl font-semibold leading-tight sm:leading-tight max-w-[680px] text-balance">
          {words.map((word, idx) => {
            const isActivated = idx <= activeWords;
            return (
              <span
                key={idx}
                className="inline-block mr-2 sm:mr-3 transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{
                  color: isActivated ? '#FFFFFF' : 'rgba(255, 255, 255, 0.28)',
                }}
              >
                {word}
              </span>
            );
          })}
        </h2>

        <p className="mt-8 text-sm sm:text-base text-white/60 max-w-[540px] text-pretty">
          Built on deterministic PostgreSQL facts and pgvector semantic retrieval. Zero hallucinated metrics, zero surprise posts.
        </p>
      </div>
    </section>
  );
};
