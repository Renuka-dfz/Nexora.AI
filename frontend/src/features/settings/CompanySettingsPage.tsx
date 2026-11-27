import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { companyApi } from '../../lib/api/company';
import { Company } from '../../types';
import { Building, Globe, Save, RefreshCw, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';

export const CompanySettingsPage: React.FC = () => {
  const { companyId } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [industry, setIndustry] = useState('');
  const [overview, setOverview] = useState('');
  const [saving, setSaving] = useState(false);
  const [recrawling, setRecrawling] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    const fetchCompany = async () => {
      try {
        const data = await companyApi.getCompany(companyId);
        setCompany(data);
        setCompanyName(data.company_name);
        setWebsiteUrl(data.website_url || '');
        setIndustry(data.industry || '');
        setOverview(data.company_overview || '');
      } catch (err: any) {
        setError(err?.message || 'Failed to fetch company settings');
      }
    };
    fetchCompany();
  }, [companyId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const updated = await companyApi.updateCompany(companyId, {
        company_name: companyName,
        website_url: websiteUrl,
        industry: industry || undefined,
        company_overview: overview || undefined,
      });
      setCompany(updated);
      setSuccessMsg('Company profile settings saved successfully.');
    } catch (err: any) {
      setError(err?.message || 'Failed to update company settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerRecrawl = async () => {
    if (!companyId || !websiteUrl) return;
    setRecrawling(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await companyApi.startCrawl(companyId, websiteUrl);
      setSuccessMsg('Website crawl enqueued! New pages and sections will update in the Knowledge Base.');
    } catch (err: any) {
      setError(err?.message || 'Failed to enqueue website crawl');
    } finally {
      setRecrawling(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <div className="pb-4 border-b border-[#EAEAE6]">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-[#171B1A]">Company Settings</h1>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#256D58]/10 text-[#256D58] border border-[#256D58]/20">
            Admin Governance
          </span>
        </div>
        <p className="text-sm text-[#66716B] mt-0.5">
          Configure corporate entity identity, verified root domain, and pgvector knowledge ingestion parameters.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs text-red-700 animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-xs text-emerald-800 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#EAEAE6] shadow-xs space-y-6">
        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-[#171B1A] mb-1.5">
              Company Name
            </label>
            <div className="relative">
              <Building className="w-4 h-4 text-[#8E9793] absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-[#EAEAE6] bg-[#FAFAF8] text-[#171B1A] focus:outline-none focus:border-[#256D58] focus:bg-white focus:ring-2 focus:ring-[#256D58]/15 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#171B1A] mb-1.5">
              Verified Website Root Domain
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 text-[#8E9793] absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="url"
                required
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-[#EAEAE6] bg-[#FAFAF8] text-[#171B1A] focus:outline-none focus:border-[#256D58] focus:bg-white focus:ring-2 focus:ring-[#256D58]/15 transition-all font-mono"
              />
            </div>
            <p className="mt-1 text-[11px] text-[#66716B]">
              Only subpaths under this verified root domain are accepted for automatic weekly Celery crawling.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#171B1A] mb-1.5">
              Industry Taxonomy
            </label>
            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="e.g. Enterprise Cloud & Software Services"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#EAEAE6] bg-[#FAFAF8] text-[#171B1A] focus:outline-none focus:border-[#256D58] focus:bg-white focus:ring-2 focus:ring-[#256D58]/15 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#171B1A] mb-1.5">
              Company Overview & Strategic Differentiators
            </label>
            <textarea
              rows={4}
              value={overview}
              onChange={(e) => setOverview(e.target.value)}
              placeholder="Primary products, key customer segments, and brand tone guidelines..."
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#EAEAE6] bg-[#FAFAF8] text-[#171B1A] focus:outline-none focus:border-[#256D58] focus:bg-white focus:ring-2 focus:ring-[#256D58]/15 transition-all leading-relaxed"
            />
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FAFAF8] border border-[#EAEAE6] text-xs text-[#66716B]">
            <ShieldCheck className="w-4 h-4 text-[#256D58] shrink-0 mt-0.5" />
            <span className="text-[11px] leading-relaxed">
              pgvector Knowledge Base: Changes to company profile will reflect in the next weekly campaign synthesis batch.
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#EAEAE6]">
            <button
              type="button"
              onClick={handleTriggerRecrawl}
              disabled={recrawling}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#EAEAE6] bg-white text-xs font-semibold text-[#171B1A] hover:bg-[#FAFAF8] hover:border-[#D5D5CF] transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${recrawling ? 'animate-spin' : ''}`} />
              <span>{recrawling ? 'Recrawling...' : 'Trigger Domain Re-crawl'}</span>
            </button>

            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#256D58] hover:bg-[#1E5846] text-white text-xs font-semibold shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Company Settings'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CompanySettingsPage;
