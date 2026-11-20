import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { companyApi } from '../../lib/api/company';
import { Category, StructuredFact, VerificationStatus, GroundedRAGResponse } from '../../types';
import {
  BookOpen,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  HelpCircle,
  ExternalLink,
  AlertCircle,
  ShieldCheck,
  Send,
} from 'lucide-react';

export const KnowledgeBasePage: React.FC = () => {
  const { companyId, role } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [facts, setFacts] = useState<StructuredFact[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Grounded RAG Assistant
  const [question, setQuestion] = useState('');
  const [answering, setAnswering] = useState(false);
  const [ragResult, setRagResult] = useState<GroundedRAGResponse | null>(null);

  const canVerify = role === 'admin' || role === 'reviewer';

  const loadData = async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const [catsRes, factsRes] = await Promise.all([
        companyApi.getCategories(companyId),
        companyApi.getKnowledge(companyId, { category_id: selectedCategory, limit: 100 }),
      ]);
      setCategories(catsRes.items);
      setFacts(factsRes.items);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch knowledge base');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [companyId, selectedCategory]);

  const handleFactVerification = async (factId: string, status: VerificationStatus) => {
    if (!companyId || !canVerify) return;
    try {
      const updated = await companyApi.verifyFact(companyId, factId, status);
      setFacts(facts.map((f) => (f.fact_id === factId ? updated : f)));
    } catch (err: any) {
      setError(err?.message || 'Failed to update fact verification');
    }
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !question.trim()) return;
    setAnswering(true);
    setRagResult(null);

    try {
      const res = await companyApi.askQuestion(companyId, question.trim());
      setRagResult(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to generate grounded answer');
    } finally {
      setAnswering(false);
    }
  };

  const filteredFacts = facts.filter((f) => {
    const q = searchQuery.toLowerCase();
    return f.title.toLowerCase().includes(q) || (f.description && f.description.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EAEAE6]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#171B1A]">Company Knowledge Base</h1>
          <p className="text-sm text-[#66716B] mt-0.5">
            Verified ground truth extracted from your website. Powers factual AI generation and prevents hallucination.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* RAG Grounded Q&A Assistant Bar */}
      <div className="bg-white p-5 rounded-2xl border border-[#E5E5E0] shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#256D58]" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#171B1A]">
            Test Grounded Knowledge Retrieval (RAG + Ollama)
          </h2>
        </div>

        <form onSubmit={handleAskQuestion} className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about your company (e.g. 'What AI agents does DataFactZ offer?')"
            className="flex-1 px-4 py-2.5 text-xs rounded-xl border border-[#D5D5CF] focus:outline-none focus:ring-2 focus:ring-[#256D58] text-[#171B1A]"
          />
          <button
            type="submit"
            disabled={answering}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#256D58] text-white text-xs font-semibold hover:bg-[#1E5846] transition-all disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{answering ? 'Searching...' : 'Ask RAG'}</span>
          </button>
        </form>

        {ragResult && (
          <div className="p-4 rounded-xl bg-[#FAFAF8] border border-[#EAEAE6] text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#171B1A]">Evidence-Grounded Answer:</span>
              <span className="text-[11px] font-medium text-[#256D58]">
                Factual Grounding: {Math.round(ragResult.factual_grounding_score * 100)}%
              </span>
            </div>
            <p className="text-[#171B1A] leading-relaxed whitespace-pre-wrap">{ragResult.answer}</p>
            {ragResult.citations.length > 0 && (
              <div className="pt-2 border-t border-[#EAEAE6] flex flex-wrap gap-2 text-[10px] text-[#66716B]">
                <span className="font-semibold">Citations:</span>
                {ragResult.citations.map((c, idx) => (
                  <span key={idx} className="bg-white px-2 py-0.5 rounded border border-[#E5E5E0]">
                    {c.title || c.source_url}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Categories & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex gap-1.5 overflow-x-auto w-full sm:w-auto pb-1">
          <button
            onClick={() => setSelectedCategory(undefined)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedCategory === undefined
                ? 'bg-[#256D58] text-white'
                : 'bg-white border border-[#E5E5E0] text-[#66716B] hover:text-[#171B1A]'
            }`}
          >
            All Categories
          </button>
          {categories.map((c) => (
            <button
              key={c.category_id}
              onClick={() => setSelectedCategory(c.category_id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                selectedCategory === c.category_id
                  ? 'bg-[#256D58] text-white'
                  : 'bg-white border border-[#E5E5E0] text-[#66716B] hover:text-[#171B1A]'
              }`}
            >
              {c.category_name}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-[#8E9793] absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search facts..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#D5D5CF] text-[#171B1A] focus:outline-none focus:ring-2 focus:ring-[#256D58]"
          />
        </div>
      </div>

      {/* Facts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 py-16 text-center text-xs text-[#66716B]">Loading facts...</div>
        ) : filteredFacts.length === 0 ? (
          <div className="col-span-2 py-16 text-center text-xs text-[#8E9793]">
            No company facts match this filter.
          </div>
        ) : (
          filteredFacts.map((fact) => {
            const isVerified = fact.verification_status === 'verified';
            const isRejected = fact.verification_status === 'rejected';

            return (
              <div
                key={fact.fact_id}
                className={`p-5 rounded-xl border bg-white shadow-sm flex flex-col justify-between transition-all ${
                  isVerified ? 'border-[#E5E5E0]' : isRejected ? 'border-red-200 bg-red-50/20' : 'border-amber-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#F4F4F0] text-[#66716B]">
                      {fact.heading_path || 'General Fact'}
                    </span>

                    {isVerified ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> Verified
                      </span>
                    ) : isRejected ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                        <XCircle className="w-3 h-3" /> Rejected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        <Clock className="w-3 h-3" /> Pending Review
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-[#171B1A] mb-1.5">{fact.title}</h3>
                  <p className="text-xs text-[#66716B] leading-relaxed line-clamp-3">
                    {fact.description || 'No detailed description available.'}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#EAEAE6] flex items-center justify-between text-[11px]">
                  <span className="text-[#8E9793]">
                    {new Date(fact.extracted_at).toLocaleDateString()}
                  </span>

                  {canVerify ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleFactVerification(fact.fact_id, 'verified')}
                        className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                          isVerified
                            ? 'bg-emerald-600 text-white'
                            : 'text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        Verify
                      </button>
                      <button
                        onClick={() => handleFactVerification(fact.fact_id, 'rejected')}
                        className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                          isRejected ? 'bg-red-600 text-white' : 'text-red-600 hover:bg-red-50'
                        }`}
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] text-[#8E9793]">Verified by Governance</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
