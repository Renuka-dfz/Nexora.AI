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
    <div className="space-y-6 max-w-5xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E7E5E4]">
        <div>
          <h1 className="text-[28px] font-semibold text-[#252525] tracking-tight leading-tight flex items-center gap-2.5">
            <span>Lead Qualification Workspace</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Deterministic Fit
            </span>
          </h1>
          <p className="text-sm text-[#737373] mt-1">
            Evaluate inbound prospects against your verified company service scope using mathematical 0–100 scoring.
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-motion inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#252525] text-white text-xs font-semibold hover:bg-[#383838] shadow-xs hover:shadow-md cursor-pointer shrink-0 group"
          >
            <UserPlus className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
            <span>Ingest New Lead</span>
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

      {/* Control Bar: Floating Segmented Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-[#E7E5E4] shadow-xs">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setStatusTab('all')}
            className={`btn-motion px-3.5 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-2 shrink-0 cursor-pointer ${
              statusTab === 'all'
                ? 'bg-[#252525] text-white shadow-sm -translate-y-0.5'
                : 'bg-[#FAFAF9] text-[#737373] border border-[#E7E5E4] hover:text-[#252525] hover:border-[#D6D3D1] hover:bg-white'
            }`}
          >
            <span>All Prospects</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                statusTab === 'all' ? 'bg-white/20 text-white' : 'bg-[#E7E5E4] text-[#252525]'
              }`}
            >
              {leads.length}
            </span>
          </button>

          <button
            onClick={() => setStatusTab('active')}
            className={`btn-motion px-3.5 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-2 shrink-0 cursor-pointer ${
              statusTab === 'active'
                ? 'bg-[#252525] text-white shadow-sm -translate-y-0.5'
                : 'bg-[#FAFAF9] text-[#737373] border border-[#E7E5E4] hover:text-[#252525] hover:border-[#D6D3D1] hover:bg-white'
            }`}
          >
            <span>Active Pipeline</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                statusTab === 'active' ? 'bg-white/20 text-white' : 'bg-[#E7E5E4] text-[#252525]'
              }`}
            >
              {activeCount}
            </span>
          </button>

          <button
            onClick={() => setStatusTab('converted')}
            className={`btn-motion px-3.5 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-2 shrink-0 cursor-pointer ${
              statusTab === 'converted'
                ? 'bg-[#252525] text-white shadow-sm -translate-y-0.5'
                : 'bg-[#FAFAF9] text-[#737373] border border-[#E7E5E4] hover:text-[#252525] hover:border-[#D6D3D1] hover:bg-white'
            }`}
          >
            <span>Converted Clients</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                statusTab === 'converted' ? 'bg-white/20 text-white' : 'bg-[#E7E5E4] text-[#252525]'
              }`}
            >
              {convertedCount}
            </span>
          </button>
        </div>

        <div className="relative min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search prospects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-[#E7E5E4] bg-white text-[#252525] placeholder:text-[#737373]/60 focus:outline-none focus:border-[#252525] transition-colors"
          />
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-2xl border border-[#E7E5E4] shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#E7E5E4] flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-[#252525]">
            Tracked Prospects ({filteredLeads.length})
          </h2>
          <span className="text-xs text-[#737373] font-mono text-[11px]">
            Deterministic 0–100 Scoring Enabled
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FAFAF9] border-b border-[#E7E5E4] text-[#737373] uppercase font-semibold text-[11px] tracking-wider">
                <th className="py-3 px-5">Prospect</th>
                <th className="py-3 px-5">Organization</th>
                <th className="py-3 px-5">Title</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5 text-right">Agent Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E5E4]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#737373]">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#252525] mb-2" />
                    <span>Loading prospects...</span>
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#737373]">
                    No leads found matching your active filter. Ingest an inbound prospect to evaluate qualification fit.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((l) => (
                  <tr key={l.lead_id} className="hover:bg-[#FAFAF9] transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-[#252525]">{l.full_name || 'Anonymous Prospect'}</div>
                      {l.email && <div className="text-[11px] text-[#737373] font-mono">{l.email}</div>}
                    </td>

                    <td className="py-3.5 px-5 font-medium text-[#252525]">
                      {l.organization_name || '—'}
                    </td>

                    <td className="py-3.5 px-5 text-[#737373]">
                      {l.job_title || '—'}
                    </td>

                    <td className="py-3.5 px-5">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium capitalize ${
                          l.lead_status === 'converted'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-[#F0EFED] text-[#252525] border border-[#E7E5E4]'
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
                          className="btn-motion inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E7E5E4] hover:border-[#252525] text-xs font-semibold text-[#252525] hover:bg-[#F0EFED] transition-colors cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Evaluate with Agent</span>
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
        <div className="fixed inset-0 z-50 bg-[#252525]/30 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E7E5E4] space-y-4 animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E5E4]">
              <h3 className="text-base font-semibold text-[#252525]">Ingest Inbound Lead</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="btn-motion text-[#737373] hover:text-[#252525] p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#252525] mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#E7E5E4] focus:outline-none focus:border-[#252525] text-[#252525]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#252525] mb-1.5">
                  Work Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex.morgan@company.com"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#E7E5E4] focus:outline-none focus:border-[#252525] text-[#252525]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#252525] mb-1.5">
                  Organization
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Global Tech Solutions"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#E7E5E4] focus:outline-none focus:border-[#252525] text-[#252525]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#252525] mb-1.5">
                  Job Title
                </label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Engineering Director"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#E7E5E4] focus:outline-none focus:border-[#252525] text-[#252525]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E7E5E4]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-motion px-4 py-2 text-xs font-semibold text-[#737373] hover:text-[#252525] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-motion px-5 py-2 rounded-xl bg-[#252525] text-white text-xs font-semibold hover:bg-[#383838] shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50"
                >
                  {creating ? 'Saving...' : 'Add Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Evaluate Lead Modal */}
      {evaluatingLead && (
        <div className="fixed inset-0 z-50 bg-[#252525]/30 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#E7E5E4] space-y-4 animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E5E4]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#252525]" />
                <h3 className="text-base font-semibold text-[#252525]">
                  Evaluate Fit: {evaluatingLead.full_name || evaluatingLead.organization_name}
                </h3>
              </div>
              <button
                onClick={() => setEvaluatingLead(null)}
                className="btn-motion text-[#737373] hover:text-[#252525] p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!evaluationResult ? (
              <form onSubmit={handleRunEvaluation} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#252525] mb-1.5">
                    Prospect Inquiry / Message Text *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={inquiryText}
                    onChange={(e) => setInquiryText(e.target.value)}
                    placeholder="e.g. We are looking to modernize our data pipelines and deploy private machine learning models in Q3. Do you support enterprise multi-cloud setups?"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#E7E5E4] focus:outline-none focus:border-[#252525] text-[#252525] leading-relaxed"
                  />
                  <p className="mt-1 text-[11px] text-[#737373]">
                    The Lead Agent will retrieve company service scope, classify intent, and calculate deterministic fit score.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E7E5E4]">
                  <button
                    type="button"
                    onClick={() => setEvaluatingLead(null)}
                    className="btn-motion px-4 py-2 text-xs font-semibold text-[#737373] hover:text-[#252525] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={evaluating || !inquiryText.trim()}
                    className="btn-motion inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#252525] text-white text-xs font-semibold hover:bg-[#383838] shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {evaluating ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Evaluating Pipeline Fit...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Run Lead Agent Evaluation</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[#FAFAF9] border border-[#E7E5E4] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#252525]">
                      Fit Score: <strong className="text-base text-[#252525] font-mono">{evaluationResult.lead_score}/100</strong>
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 capitalize">
                      {evaluationResult.qualification_status}
                    </span>
                  </div>

                  <div className="text-xs text-[#737373]">
                    <span>Buyer Intent: <strong className="text-[#252525] capitalize">{evaluationResult.intent_level}</strong></span>
                    <span className="mx-2">•</span>
                    <span>Confidence: {Math.round((evaluationResult.confidence_score ?? 0.8) * 100)}%</span>
                  </div>

                  {evaluationResult.recommended_action && (
                    <div className="pt-2 border-t border-[#E7E5E4] text-xs">
                      <strong className="text-[#252525] block mb-1">Recommended Action:</strong>
                      <p className="text-[#737373] leading-relaxed">{evaluationResult.recommended_action}</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setEvaluatingLead(null)}
                    className="btn-motion px-5 py-2 rounded-xl bg-[#252525] text-white text-xs font-semibold hover:bg-[#383838] cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
