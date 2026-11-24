import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Menu,
  Search,
  Sparkles,
  Users,
  X,
  Zap,
} from 'lucide-react';

interface LandingPageProps {
  onNavigate?: (path: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.title = 'Nexora.AI — AI Marketing Growth Engine';
    let meta = document.querySelector("meta[name='description']");
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute(
      'content',
      'Research competitors, plan content, generate campaigns, and grow your brand with Nexora AI agents.'
    );
  }, []);

  const navigate = (path: string) => onNavigate?.(path);

  return (
    <div className="min-h-screen overflow-hidden bg-[#087fd7] text-white">
      <section className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#087bd4_0%,#159adf_55%,#79c9e8_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,.16),transparent_32%)]" />
        <div className="hero-cloud hero-cloud-one" />
        <div className="hero-cloud hero-cloud-two" />
        <div className="hero-cloud hero-cloud-three" />

        <header className="relative z-40 mx-auto flex max-w-[1180px] items-center justify-between px-5 py-5 md:px-8">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5"
            aria-label="Nexora.AI home"
          >
            <div className="flex h-10 w-10 -rotate-6 items-center justify-center rounded-[12px] border border-white/30 bg-white/15 shadow-[0_8px_25px_rgba(0,55,120,.18)] backdrop-blur">
              <Sparkles className="h-5 w-5" fill="currentColor" />
            </div>
            <span className="text-lg font-semibold tracking-[-0.03em]">
              Nexora<span className="text-[#dfff75]">.AI</span>
            </span>
          </button>

          <nav className="hidden items-center gap-8 lg:flex" aria-label="Main navigation">
            <a href="#about" className="text-[13px] font-medium text-white/75 transition hover:text-white">
              About Us
            </a>
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="text-[13px] font-medium text-white/75 transition hover:text-white"
            >
              Register
            </button>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-[13px] font-medium text-white/75 transition hover:text-white"
            >
              Login
            </button>
          </nav>

          <button
            type="button"
            onClick={() => navigate('/register')}
            className="lime-button hidden rounded-full px-5 py-3 text-[12px] font-bold uppercase tracking-[0.12em] text-[#172300] lg:block"
          >
            Get Started
          </button>

          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-full border border-white/20 bg-white/10 p-2 backdrop-blur lg:hidden"
            aria-label="Toggle navigation"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>

        {menuOpen && (
          <div className="absolute left-5 right-5 top-20 z-50 rounded-2xl border border-white/20 bg-[#087cc8]/95 p-4 shadow-2xl backdrop-blur-xl lg:hidden">
            <a
              href="#about"
              onClick={() => setMenuOpen(false)}
              className="block rounded-xl px-3 py-3 text-sm font-medium hover:bg-white/10"
            >
              About Us
            </a>
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="block w-full rounded-xl px-3 py-3 text-left text-sm font-medium hover:bg-white/10"
            >
              Register
            </button>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="block w-full rounded-xl px-3 py-3 text-left text-sm font-medium hover:bg-white/10"
            >
              Login
            </button>
          </div>
        )}

        <div className="relative z-20 mx-auto max-w-[920px] px-5 pt-14 text-center sm:pt-16 lg:pt-20">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white/90 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-[#dfff75]" />
            AI marketing workspace
          </div>
          <h1 className="mx-auto max-w-[850px] text-balance text-[44px] font-medium leading-[1.02] tracking-[-0.055em] sm:text-[58px] lg:text-[74px]">
            Turn Your Marketing Into an <span className="text-[#dfff75]">AI Growth Engine</span>
          </h1>
          <p className="mx-auto mt-6 max-w-[650px] text-pretty text-[15px] leading-7 text-white/80 sm:text-lg">
            Research competitors, plan content, generate campaigns, and grow your brand — powered by intelligent AI agents.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="lime-button flex min-w-[170px] items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold text-[#172300]"
            >
              Get Started <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="flex min-w-[150px] items-center justify-center rounded-full border border-white/25 bg-white/10 px-6 py-3.5 text-sm font-bold backdrop-blur transition hover:bg-white/15"
            >
              Login
            </button>
          </div>
        </div>

        <div className="product-stage relative z-20 mx-auto mt-10 h-[270px] max-w-[1060px] px-4 sm:mt-8 sm:h-[300px]">
          <div className="stage-grid absolute inset-x-[8%] bottom-1 h-[180px]" />

          <div className="float-card absolute left-[3%] top-[78px] w-[150px] -rotate-[8deg] bg-white p-3 text-[#1d2430] sm:left-[1%] sm:w-[168px]">
            <div className="mb-2 flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-[#8790a0]">
              <Search className="h-3 w-3" /> Competitor
            </div>
            <p className="text-xs font-semibold">Brand analysis</p>
            <div className="mt-3 space-y-2">
              <div className="h-2 w-full rounded bg-[#e9edf3]" />
              <div className="h-2 w-3/4 rounded bg-[#d8e9ff]" />
            </div>
          </div>

          <div className="float-card float-slow absolute left-[16%] top-[35px] w-[150px] rotate-[5deg] bg-white p-3 text-[#1d2430] sm:w-[176px]">
            <div className="flex items-start justify-between">
              <div><p className="text-[9px] font-bold text-[#8790a0]">MONTHLY GROWTH</p><p className="mt-1 text-xl font-bold">+42%</p></div>
              <BarChart3 className="h-5 w-5 text-[#258bd8]" />
            </div>
            <div className="mt-3 flex h-12 items-end gap-1">
              {[35,52,44,68,58,82,74].map((height, index) => (
                <div key={index} className="flex-1 rounded-t bg-[#55a9df]" style={{ height: `${height}%`, opacity: 0.55 + index * 0.06 }} />
              ))}
            </div>
          </div>

          <div className="float-card float-mid absolute left-[29%] top-[72px] w-[155px] -rotate-[3deg] overflow-hidden text-white sm:w-[174px]">
            <div className="h-[88px] bg-[radial-gradient(circle_at_30%_20%,#91cdf5,#275ea4_42%,#10264d_100%)] p-3">
              <div className="text-[9px] font-semibold text-white/75">AI POST</div>
              <div className="mt-5 h-2 w-4/5 rounded bg-white/25" />
              <div className="mt-1.5 h-2 w-3/5 rounded bg-white/25" />
            </div>
            <div className="bg-[#101827] px-3 py-2 text-[9px]">Campaign ready <Zap className="ml-1 inline h-3 w-3 text-[#dfff75]" /></div>
          </div>

          <div className="float-card float-fast absolute left-[43%] top-[20px] w-[158px] bg-white p-3 text-[#1d2430] sm:w-[182px]">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-bold">Content calendar</p>
              <CalendarDays className="h-4 w-4 text-[#258bd8]" />
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 21 }).map((_, index) => (
                <div key={index} className={`h-3 rounded-sm ${index === 8 || index === 14 ? 'bg-[#dfff75]' : index % 5 === 0 ? 'bg-[#b8dffc]' : 'bg-[#edf1f5]'}`} />
              ))}
            </div>
          </div>

          <div className="float-card absolute left-[58%] top-[72px] w-[156px] -rotate-[2deg] bg-[#101827] p-3 text-white sm:w-[178px]">
            <p className="text-[9px] text-white/55">COMPETITOR SIGNAL</p>
            <p className="mt-2 text-sm font-semibold">Market move detected</p>
            <div className="mt-3 h-1.5 rounded-full bg-white/10">
              <div className="h-full w-[72%] rounded-full bg-[#dfff75]" />
            </div>
          </div>

          <div className="float-card float-slow absolute left-[71%] top-[35px] w-[140px] rotate-[7deg] bg-white p-3 text-[#1d2430] sm:w-[162px]">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e9f7ff]">
                <Users className="h-4 w-4 text-[#258bd8]" />
              </div>
              <div><p className="text-[9px] text-[#8790a0]">LEAD SCORE</p><p className="text-lg font-bold">520k</p></div>
            </div>
          </div>

          <div className="float-card float-mid absolute right-[1%] top-[82px] w-[145px] rotate-[8deg] bg-white p-3 text-[#1d2430] sm:w-[160px]">
            <p className="text-[9px] font-bold text-[#8790a0]">ENGAGEMENT</p>
            <div className="mt-2 flex items-end justify-between">
              <p className="text-xl font-bold">18.4%</p>
              <BarChart3 className="h-5 w-5 text-[#d2ef62]" />
            </div>
            <div className="mt-3 h-12 rounded-lg bg-[linear-gradient(160deg,transparent_48%,#87bfe5_49%,#87bfe5_51%,transparent_52%)]" />
          </div>
        </div>
      </section>

      <section id="about" className="bg-white px-5 py-20 text-[#111827]">
        <div className="mx-auto max-w-[760px] text-center">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-[#1688d2]">About Us</p>
          <h2 className="text-balance text-[38px] font-medium leading-[1.12] tracking-[-0.045em] sm:text-[52px]">
            One intelligent platform for <span className="text-[#1688d2]">smarter marketing</span>.
          </h2>
          <p className="mx-auto mt-5 max-w-[620px] text-pretty text-base leading-7 text-[#697386]">
            Nexora brings competitor insights, content planning, campaign generation, and performance tracking into one focused workspace.
          </p>
          <button
            type="button"
            onClick={() => navigate('/register')}
            className="lime-button mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold text-[#172300]"
          >
            Create an Account <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
