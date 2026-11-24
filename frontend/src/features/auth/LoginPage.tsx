import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ArrowRight, Lock, Mail, AlertCircle, Sparkles, BarChart3, CalendarDays, Search } from 'lucide-react';

interface LoginPageProps {
  onNavigate: (path: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      onNavigate('/overview');
    } catch (err: any) {
      setError(err?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nexora-auth min-h-screen bg-[#eef7fd] text-[#111827] lg:grid lg:grid-cols-[1.08fr_.92fr]">
      <aside className="relative hidden overflow-hidden bg-[#087fd7] text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#087bd4,#159adf_58%,#72c3e8)]" />
        <div className="hero-cloud hero-cloud-one" />
        <div className="hero-cloud hero-cloud-two" />
        <div className="relative z-10 flex items-center gap-2.5">
          <button onClick={() => onNavigate('/')} className="flex h-10 w-10 -rotate-6 items-center justify-center rounded-[12px] border border-white/30 bg-white/15">
            <Sparkles className="h-5 w-5" fill="currentColor" />
          </button>
          <span className="text-xl font-semibold">Nexora<span className="text-[#dfff75]">.AI</span></span>
        </div>
        <div className="relative z-10 max-w-[520px] pb-8">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.22em] text-[#dfff75]">AI Growth Workspace</p>
          <h1 className="text-balance text-[54px] font-medium leading-[1.03] tracking-[-0.05em]">Turn marketing into measurable growth.</h1>
          <div className="mt-10 grid grid-cols-3 gap-3">
            {[{Icon:Search,t:'Research',v:'12 insights'}, {Icon:CalendarDays,t:'Plan',v:'24 posts'}, {Icon:BarChart3,t:'Grow',v:'3.8x lift'}].map(({Icon,t,v}) => (
              <div key={t} className="float-card bg-white p-4 text-[#111827]">
                <Icon className="h-4 w-4 text-[#1688d2]" />
                <p className="mt-5 text-[10px] font-bold uppercase tracking-wider text-[#8790a0]">{t}</p>
                <p className="mt-1 text-lg font-bold">{v}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex min-h-screen items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-[440px]">
          <button onClick={() => onNavigate('/')} className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 -rotate-6 items-center justify-center rounded-[11px] bg-[#087fd7] text-white"><Sparkles className="h-4 w-4" fill="currentColor" /></div>
            <span className="text-lg font-semibold">Nexora<span className="text-[#1688d2]">.AI</span></span>
          </button>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1688d2]">Welcome back</p>
          <h2 className="mt-3 text-[36px] font-medium leading-tight tracking-[-0.04em]">Sign in to Nexora</h2>
          <p className="mt-2 text-sm text-[#697386]">Continue to your marketing workspace.</p>

        <div className="mt-8 rounded-[24px] border border-[#dfeaf2] bg-white p-6 shadow-[0_20px_55px_rgba(38,119,189,.10)] sm:p-8">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-[13px] font-medium text-[#252525] mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#737373] absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full pl-10 pr-3.5 py-3 text-sm rounded-xl border border-[#dfe7ee] bg-white text-[#252525] placeholder:text-[#98a1ae] focus:outline-none focus:border-[#1688d2] focus:ring-2 focus:ring-[#1688d2]/10 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#252525] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#737373] absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-3 text-sm rounded-xl border border-[#dfe7ee] bg-white text-[#252525] placeholder:text-[#98a1ae] focus:outline-none focus:border-[#1688d2] focus:ring-2 focus:ring-[#1688d2]/10 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="lime-button btn-motion w-full mt-3 inline-flex items-center justify-center gap-2 h-12 px-4 rounded-full text-sm font-bold text-[#172300] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
          <p className="mt-5 text-center text-sm text-[#697386]">
            New to Nexora?{' '}
            <button onClick={() => onNavigate('/register')} className="font-bold text-[#1688d2] hover:underline">
              Create an account
            </button>
          </p>
        </div>
      </div>
    </main>
    </div>
  );
};
