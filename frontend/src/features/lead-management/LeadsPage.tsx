import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { leadsApi } from '../../lib/api/leads';
import { Lead, Qualification } from '../../types';
import {
  UserCheck,
  UserPlus,
  Mail,
  Building,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Search,
  Filter,
  X,
  ShieldCheck,
} from 'lucide-react';

export const LeadsPage: React.FC = () => {
  const { companyId, role } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Tab filter: 'all' | 'active' | 'converted'
  const [statusTab, setStatusTab] = useState<'all' | 'active' | 'converted'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // New lead modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [orgName, setOrgName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [industry, setIndustry] = useState('');
  const [creating, setCreating] = useState(false);

  // Evaluation modal
  const [evaluatingLead, setEvaluatingLead] = useState<Lead | null>(null);
  const [inquiryText, setInquiryText] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<Qualification | null>(null);

  const canManage = role === 'admin' || role === 'user';

  const fetchLeads = async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const res = await leadsApi.listLeads(companyId);
      setLeads(res.items);
    } catch (err: any) {
      setError(err?.message || 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [companyId]);

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setCreating(true);
    setError(null);

    try {
      const newLead = await leadsApi.createLead({
        company_id: companyId,
        full_name: fullName,
        email: email || undefined,
        organization_name: orgName || undefined,
        job_title: jobTitle || undefined,
        industry: industry || undefined,
      });

      setLeads([newLead, ...leads]);
      setShowAddModal(false);
      setFullName('');
      setEmail('');
      setOrgName('');
      setJobTitle('');
      setIndustry('');
      setSuccessMsg('Prospect added successfully.');
    } catch (err: any) {
      setError(err?.message || 'Failed to create lead');
    } finally {
      setCreating(false);
    }
  };

  const handleRunEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evaluatingLead) return;
    setEvaluating(true);
    setError(null);

    try {
      const result = await leadsApi.evaluateLead(evaluatingLead.lead_id, inquiryText);
      setEvaluationResult(result);
      setSuccessMsg(`Lead evaluated! Score: ${result.lead_score ?? 'N/A'}/100 (${result.qualification_status})`);
      fetchLeads();
    } catch (err: any) {
      setError(err?.message || 'Evaluation failed. Please try again.');
    } finally {
      setEvaluating(false);
    }
  };

  const filteredLeads = leads.filter((l) => {
    if (statusTab !== 'all' && l.lead_status !== statusTab) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (l.full_name || '').toLowerCase().includes(q);
      const matchOrg = (l.organization_name || '').toLowerCase().includes(q);
      const matchEmail = (l.email || '').toLowerCase().includes(q);
      if (!matchName && !matchOrg && !matchEmail) return false;
    }
    return true;
  });

  const activeCount = leads.filter((l) => l.lead_status === 'active').length;
  const convertedCount = leads.filter((l) => l.lead_status === 'converted').length;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EAEAE6]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#171B1A]">Lead Intelligence</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Deterministic Fit
            </span>
          </div>
          <p className="text-sm text-[#66716B] mt-0.5">
            Evaluate inbound prospects against your verified company service scope using deterministic 0–100 scoring.
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#256D58] text-white text-xs font-semibold hover:bg-[#1E5846] shadow-sm hover:shadow-md transition-all cursor-pointer shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Ingest New Prospect</span>
          </button>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-800 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Control Bar: Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-[#EAEAE6] shadow-xs">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setStatusTab('all')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-2 shrink-0 cursor-pointer transition-all ${
              statusTab === 'all'
                ? 'bg-[#256D58] text-white shadow-xs'
                : 'bg-[#FAFAF8] text-[#66716B] border border-[#EAEAE6] hover:text-[#171B1A] hover:bg-white'
            }`}
          >
            <span>All Prospects</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                statusTab === 'all' ? 'bg-white/20 text-white' : 'bg-[#EAEAE6] text-[#171B1A]'
              }`}
            >
              {leads.length}
            </span>
          </button>

          <button
            onClick={() => setStatusTab('active')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-2 shrink-0 cursor-pointer transition-all ${
              statusTab === 'active'
                ? 'bg-[#256D58] text-white shadow-xs'
                : 'bg-[#FAFAF8] text-[#66716B] border border-[#EAEAE6] hover:text-[#171B1A] hover:bg-white'
            }`}
          >
            <span>Active Pipeline</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                statusTab === 'active' ? 'bg-white/20 text-white' : 'bg-[#EAEAE6] text-[#171B1A]'
              }`}
            >
              {activeCount}
            </span>
          </button>

          <button
            onClick={() => setStatusTab('converted')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-2 shrink-0 cursor-pointer transition-all ${
              statusTab === 'converted'
                ? 'bg-[#256D58] text-white shadow-xs'
                : 'bg-[#FAFAF8] text-[#66716B] border border-[#EAEAE6] hover:text-[#171B1A] hover:bg-white'
            }`}
          >
            <span>Converted Clients</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                statusTab === 'converted' ? 'bg-white/20 text-white' : 'bg-[#EAEAE6] text-[#171B1A]'
              }`}
            >
              {convertedCount}
            </span>
          </button>
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-[#8E9793] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search prospects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-[#EAEAE6] bg-[#FAFAF8] text-[#171B1A] placeholder:text-[#8E9793] focus:outline-none focus:border-[#256D58] focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-2xl border border-[#EAEAE6] shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#EAEAE6] flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#171B1A]">
            Tracked Prospects ({filteredLeads.length})
          </h2>
          <span className="text-xs text-[#8E9793] font-mono text-[11px]">
            Deterministic 0–100 Scoring Enabled
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FAFAF8] border-b border-[#EAEAE6] text-[#8E9793] uppercase font-semibold text-[11px] tracking-wider">
                <th className="py-3 px-5">Prospect</th>
                <th className="py-3 px-5">Organization</th>
                <th className="py-3 px-5">Job Title</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5 text-right">Agent Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAEAE6]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#66716B]">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#256D58] mb-2" />
                    <span>Loading prospects...</span>
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#8E9793]">
                    No leads found matching your active filter. Ingest an inbound prospect to evaluate qualification fit.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((l) => (
                  <tr key={l.lead_id} className="hover:bg-[#FAFAF8] transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-[#171B1A]">{l.full_name || 'Anonymous Prospect'}</div>
                      {l.email && <div className="text-[11px] text-[#8E9793] font-mono">{l.email}</div>}
                    </td>

                    <td className="py-3.5 px-5 font-medium text-[#171B1A]">
                      {l.organization_name || '—'}
                    </td>

                    <td className="py-3.5 px-5 text-[#66716B]">
                      {l.job_title || '—'}
                    </td>

                    <td className="py-3.5 px-5">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize ${
                          l.lead_status === 'converted'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-[#FAFAF8] text-[#171B1A] border border-[#EAEAE6]'
                        }`}
                      >
                        {l.lead_status}
                      </span>
                    </td>

                    <td className="py-3.5 px-5 text-right">
                      {canManage && (
                        <button
                          onClick={() => {
                            setEvaluatingLead(l);
                            setEvaluationResult(null);
                            setInquiryText('');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#EAEAE6] hover:border-[#256D58] text-xs font-semibold text-[#171B1A] hover:bg-[#256D58]/5 hover:text-[#256D58] transition-colors cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-[#256D58]" />
                          <span>Evaluate Fit</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Lead Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#EAEAE6] space-y-4 animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#EAEAE6]">
              <h3 className="text-base font-bold text-[#171B1A]">Ingest Inbound Lead</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#8E9793] hover:text-[#171B1A] p-1 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#171B1A] mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#EAEAE6] bg-[#FAFAF8] text-[#171B1A] focus:outline-none focus:border-[#256D58] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171B1A] mb-1.5">
                  Work Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex.morgan@company.com"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#EAEAE6] bg-[#FAFAF8] text-[#171B1A] focus:outline-none focus:border-[#256D58] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171B1A] mb-1.5">
                  Organization
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Global Tech Solutions"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#EAEAE6] bg-[#FAFAF8] text-[#171B1A] focus:outline-none focus:border-[#256D58] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171B1A] mb-1.5">
                  Job Title
                </label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Engineering Director"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#EAEAE6] bg-[#FAFAF8] text-[#171B1A] focus:outline-none focus:border-[#256D58] focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#EAEAE6]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#EAEAE6] text-xs font-semibold text-[#66716B] hover:bg-[#FAFAF8] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#256D58] text-white text-xs font-semibold hover:bg-[#1E5846] cursor-pointer disabled:opacity-50"
                >
                  <span>{creating ? 'Saving...' : 'Add Prospect'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Evaluate Lead Modal */}
      {evaluatingLead && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#EAEAE6] space-y-4 animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#EAEAE6]">
              <div>
                <h3 className="text-base font-bold text-[#171B1A]">Evaluate Qualification Fit</h3>
                <p className="text-xs text-[#66716B] mt-0.5">
                  Prospect: <strong className="text-[#171B1A]">{evaluatingLead.full_name}</strong> ({evaluatingLead.organization_name || 'Individual'})
                </p>
              </div>
              <button
                onClick={() => setEvaluatingLead(null)}
                className="text-[#8E9793] hover:text-[#171B1A] p-1 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRunEvaluation} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#171B1A] mb-1.5">
                  Prospect Inquiry / Scope Text
                </label>
                <textarea
                  rows={4}
                  required
                  value={inquiryText}
                  onChange={(e) => setInquiryText(e.target.value)}
                  placeholder="Paste email inquiry, message body, or RFP requirements..."
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#EAEAE6] bg-[#FAFAF8] text-[#171B1A] focus:outline-none focus:border-[#256D58] focus:bg-white leading-relaxed"
                />
              </div>

              {evaluationResult && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                      Evaluation Complete
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-200 text-emerald-900">
                      Score: {evaluationResult.lead_score}/100
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    Status: <strong className="capitalize">{evaluationResult.qualification_status}</strong>
                  </p>
                  {evaluationResult.qualification_reason && (
                    <p className="text-xs text-emerald-700 italic border-t border-emerald-200/60 pt-2">
                      "{evaluationResult.qualification_reason}"
                    </p>
                  )}
                  {evaluationResult.recommended_action && (
                    <p className="text-xs text-emerald-800 font-semibold pt-1">
                      Recommended: {evaluationResult.recommended_action}
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#EAEAE6]">
                <button
                  type="button"
                  onClick={() => setEvaluatingLead(null)}
                  className="px-4 py-2 rounded-xl border border-[#EAEAE6] text-xs font-semibold text-[#66716B] hover:bg-[#FAFAF8] cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={evaluating || !inquiryText.trim()}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#256D58] text-white text-xs font-semibold hover:bg-[#1E5846] cursor-pointer disabled:opacity-50"
                >
                  {evaluating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Scoring Fit...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Run Evaluation</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadsPage;
