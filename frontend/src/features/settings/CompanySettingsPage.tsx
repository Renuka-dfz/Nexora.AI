import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { companyApi } from '../../lib/api/company';
import { Company } from '../../types';
import { Building, Globe, Save, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

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
    <div className="space-y-6 max-w-3xl">
      <div className="pb-5 border-b border-[#E7E5E4]">
        <h1 className="text-[28px] font-semibold tracking-tight text-[#252525] leading-tight">Company Settings</h1>
        <p className="text-sm text-[#737373] mt-1">
          Configure company profile, verified domain, and crawler parameters. (Admin only)
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

      <div className="bg-white p-6 sm:p-7 rounded-2xl border border-[#E7E5E4] shadow-xs space-y-6">
        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block text-[13px] font-medium text-[#252525] mb-1.5">
              Company Name
            </label>
            <div className="relative">
              <Building className="w-4 h-4 text-[#737373] absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-[#E7E5E4] focus:outline-none focus:border-[#252525] text-[#252525]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#252525] mb-1.5">
              Website URL
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 text-[#737373] absolute left-3.5 top-3" />
              <input
                type="url"
                required
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-[#E7E5E4] focus:outline-none focus:border-[#252525] text-[#252525] font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#252525] mb-1.5">
              Industry
            </label>
            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E7E5E4] focus:outline-none focus:border-[#252525] text-[#252525]"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#252525] mb-1.5">
              Company Overview & Positioning
            </label>
            <textarea
              rows={4}
              value={overview}
              onChange={(e) => setOverview(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E7E5E4] focus:outline-none focus:border-[#252525] text-[#252525] leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[#E7E5E4]">
            <button
              type="button"
              onClick={handleTriggerRecrawl}
              disabled={recrawling}
              className="btn-motion inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E7E5E4] text-xs font-semibold text-[#252525] hover:bg-[#F0EFED] cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${recrawling ? 'animate-spin' : ''}`} />
              <span>{recrawling ? 'Recrawling...' : 'Re-crawl Website'}</span>
            </button>

            <button
              type="submit"
              disabled={saving}
              className="btn-motion inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#252525] text-white text-xs font-semibold hover:bg-[#383838] shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Settings'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
