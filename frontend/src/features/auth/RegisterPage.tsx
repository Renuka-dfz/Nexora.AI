import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { ArrowRight, Lock, Mail, AlertCircle, ShieldCheck, Sparkles } from 'lucide-react';

interface RegisterPageProps {
  onNavigate: (path: string) => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigate }) => {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('Password must be at least 8 characters long');
    if (password !== confirmPassword) return setError('Passwords do not match');
    setLoading(true);
    try {
      await register(email, password, selectedRole);
      onNavigate('/onboarding');
    } catch (err: any) {
      setError(err?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const roles: { value: UserRole; title: string; description: string }[] = [
    { value: 'admin', title: 'Admin', description: 'Manage workspace and approvals' },
    { value: 'reviewer', title: 'Reviewer', description: 'Review and approve content' },
    { value: 'user', title: 'Creator', description: 'Create and submit campaigns' },
  ];

  const inputClass = 'w-full py-3 text-sm rounded-xl border border-[#dfe7ee] bg-white text-[#252525] placeholder:text-[#98a1ae] focus:outline-none focus:border-[#1688d2] focus:ring-2 focus:ring-[#1688d2]/10';

  return (
    <div className="nexora-auth min-h-screen bg-[#eef7fd] text-[#111827] lg:grid lg:grid-cols-[.92fr_1.08fr]">
      <main className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[460px]">
          <button onClick={() => onNavigate('/')} className="mb-7 flex items-center gap-2">
            <div className="flex h-9 w-9 -rotate-6 items-center justify-center rounded-[11px] bg-[#087fd7] text-white"><Sparkles className="h-4 w-4" fill="currentColor" /></div>
            <span className="text-lg font-semibold">Nexora<span className="text-[#1688d2]">.AI</span></span>
          </button>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1688d2]">Start growing</p>
          <h1 className="mt-3 text-[36px] font-medium leading-tight tracking-[-0.04em]">Create your account</h1>
          <p className="mt-2 text-sm text-[#697386]">Build your intelligent marketing workspace.</p>

          <div className="mt-7 rounded-[24px] border border-[#dfeaf2] bg-white p-5 shadow-[0_20px_55px_rgba(38,119,189,.10)] sm:p-7">
            {error && <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-[13px] font-medium">Account role</label>
                <div className="grid grid-cols-3 gap-2">
                  {roles.map((role) => (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => setSelectedRole(role.value)}
                      className={`rounded-xl border p-2.5 text-left transition ${selectedRole === role.value ? 'border-[#1688d2] bg-[#edf7fd] shadow-[0_6px_18px_rgba(22,136,210,.08)]' : 'border-[#e1e7ec] bg-white hover:border-[#1688d2]/50'}`}
                    >
                      <span className="block text-xs font-bold">{role.title}</span>
                      <span className="mt-1 hidden text-[10px] leading-4 text-[#697386] sm:block">{role.description}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium">Work email</label>
                <div className="relative"><Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-[#8d98a6]" /><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={`${inputClass} pl-10 pr-3.5`} /></div>
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium">Password</label>
                <div className="relative"><Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-[#8d98a6]" /><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className={`${inputClass} pl-10 pr-3.5`} /></div>
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium">Confirm password</label>
                <div className="relative"><Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-[#8d98a6]" /><input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat your password" className={`${inputClass} pl-10 pr-3.5`} /></div>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl border border-[#dfeaf2] bg-[#f5faff] p-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#1688d2]" />
                <p className="text-[11px] leading-5 text-[#697386]">Your workspace and generated campaigns remain private to your organization.</p>
              </div>
              <button type="submit" disabled={loading} className="lime-button flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-bold text-[#172300] disabled:opacity-50">
                {loading ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-[#172300] border-t-transparent" />Creating account...</> : <>Get Started <ArrowRight className="h-4 w-4" /></>}
              </button>
            </form>
            <p className="mt-5 text-center text-sm text-[#697386]">Already have an account? <button onClick={() => onNavigate('/login')} className="font-bold text-[#1688d2] hover:underline">Sign in</button></p>
          </div>
        </div>
      </main>

      <aside className="relative hidden overflow-hidden bg-[#087fd7] text-white lg:flex lg:flex-col lg:justify-end lg:p-12">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#087bd4,#159adf_58%,#72c3e8)]" />
        <div className="hero-cloud hero-cloud-one" />
        <div className="hero-cloud hero-cloud-two" />
        <div className="relative z-10 max-w-[560px] pb-10">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.22em] text-[#dfff75]">One intelligent workspace</p>
          <h2 className="text-balance text-[52px] font-medium leading-[1.03] tracking-[-0.05em]">Research. Create. Grow.</h2>
          <div className="float-card mt-10 ml-auto w-[290px] bg-white p-5 text-[#111827]">
            <div className="flex items-center justify-between"><span className="text-xs font-bold">Campaign performance</span><Sparkles className="h-4 w-4 text-[#1688d2]" /></div>
            <div className="mt-5 flex items-end gap-2">{[32,48,42,68,58,84,74].map((h,i)=><div key={i} className="flex-1 rounded-t bg-[#1688d2]" style={{height:h,opacity:.4+i*.08}} />)}</div>
            <p className="mt-4 text-3xl font-bold">3.8x</p>
          </div>
        </div>
      </aside>
    </div>
  );
};
