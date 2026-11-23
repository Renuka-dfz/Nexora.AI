import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { marketingApi } from '../../lib/api/marketing';
import { ContentItem } from '../../types';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  FileText,
  Calendar,
  Layers,
  Shield,
  MessageSquare,
} from 'lucide-react';

export const ReviewQueuePage: React.FC = () => {
  const { companyId, role } = useAuth();
  const [pendingItems, setPendingItems] = useState<ContentItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Rejection modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionFeedback, setRejectionFeedback] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  const canApproveOrReject = role === 'admin' || role === 'reviewer';

  const fetchPending = async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const res = await marketingApi.listContent(companyId, { status: 'pending' });
      setPendingItems(res.items);
      if (res.items.length > 0 && !selectedItem) {
        setSelectedItem(res.items[0]);
      } else if (res.items.length === 0) {
        setSelectedItem(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load review queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, [companyId]);

  const handleApprove = async () => {
    if (!selectedItem || !canApproveOrReject) return;
    setSubmittingAction(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await marketingApi.approveContent(selectedItem.content_id);
      setSuccessMsg(`Approved "${selectedItem.content_title}" successfully!`);
      const remaining = pendingItems.filter((i) => i.content_id !== selectedItem.content_id);
      setPendingItems(remaining);
      setSelectedItem(remaining[0] || null);
    } catch (err: any) {
      setError(err?.message || 'Failed to approve draft');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !canApproveOrReject) return;
    if (!rejectionFeedback.trim()) {
      setError('Rejection feedback is required');
      return;
    }

    setSubmittingAction(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await marketingApi.rejectContent(selectedItem.content_id, rejectionFeedback.trim());
      setSuccessMsg(`Rejected "${selectedItem.content_title}" with feedback returned to Creator.`);
      setShowRejectModal(false);
      setRejectionFeedback('');
      const remaining = pendingItems.filter((i) => i.content_id !== selectedItem.content_id);
      setPendingItems(remaining);
      setSelectedItem(remaining[0] || null);
    } catch (err: any) {
      setError(err?.message || 'Failed to reject draft');
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EAEAE6]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#171B1A]">Content Review Queue</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              {pendingItems.length} Pending
            </span>
          </div>
          <p className="text-sm text-[#66716B] mt-0.5">
            Audit and verify AI-generated and manual marketing content before publishing authorization.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Pending Posts List */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-[#E5E5E0] shadow-sm space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#8E9793] mb-2">
            Pending Submissions ({pendingItems.length})
          </h2>

          {loading ? (
            <div className="py-12 text-center text-sm text-[#66716B]">Loading queue...</div>
          ) : pendingItems.length === 0 ? (
            <div className="py-16 text-center text-[#8E9793] space-y-2">
              <CheckCircle2 className="w-10 h-10 mx-auto text-[#256D58] opacity-60" />
              <p className="text-sm font-medium text-[#171B1A]">Review Queue is Clear</p>
              <p className="text-xs">All marketing content has been reviewed and resolved.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {pendingItems.map((item) => (
                <div
                  key={item.content_id}
                  onClick={() => setSelectedItem(item)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedItem?.content_id === item.content_id
                      ? 'border-[#256D58] bg-[#256D58]/5'
                      : 'border-[#EAEAE6] hover:bg-[#F4F4F0]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold text-[#171B1A] leading-snug truncate max-w-[240px]">
                      {item.content_title}
                    </p>
                    <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                      {item.platform_target}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-[#66716B]">
                    <span>Type: {item.content_type}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Inspection & Decision Console */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-[#E5E5E0] shadow-sm flex flex-col justify-between">
          {selectedItem ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#EAEAE6]">
                <div>
                  <span className="text-xs font-semibold text-[#8E9793] uppercase tracking-wider">
                    Auditing: {selectedItem.platform_target} ({selectedItem.content_type})
                  </span>
                  <h2 className="text-lg font-bold text-[#171B1A] mt-0.5">
                    {selectedItem.content_title}
                  </h2>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#66716B]">
                  <Calendar className="w-4 h-4 text-[#8E9793]" />
                  <span>Submitted {new Date(selectedItem.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {selectedItem.topic && (
                <div className="p-3 bg-[#FAFAF8] rounded-xl border border-[#EAEAE6]">
                  <p className="text-[11px] font-semibold uppercase text-[#8E9793] mb-1">
                    Grounded Topic & Scope
                  </p>
                  <p className="text-xs text-[#171B1A] font-medium">{selectedItem.topic}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#171B1A] mb-2">
                  Full Draft Text
                </label>
                <div className="p-4 rounded-xl border border-[#D5D5CF] bg-[#FAFAF8] text-sm text-[#171B1A] font-mono whitespace-pre-wrap leading-relaxed max-h-[380px] overflow-y-auto">
                  {selectedItem.content_text}
                </div>
              </div>

              <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Compliance Guarantee:</strong> Approving this post transitions it to <span className="font-semibold">Approved</span>. Publishing to connected LinkedIn or Instagram accounts is executed separately by an authorized Admin.
                </span>
              </div>

              {canApproveOrReject ? (
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#EAEAE6]">
                  <button
                    onClick={() => setShowRejectModal(true)}
                    disabled={submittingAction}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 transition-colors"
                  >
                    <XCircle className="w-4 h-4" /> Reject with Feedback
                  </button>

                  <button
                    onClick={handleApprove}
                    disabled={submittingAction}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#256D58] text-white text-xs font-semibold hover:bg-[#1E5846] transition-all shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Approve Draft
                  </button>
                </div>
              ) : (
                <div className="text-xs text-[#66716B] text-center pt-3 border-t border-[#EAEAE6]">
                  You are viewing this submission as a Content Creator. Awaiting decision from an Admin or Reviewer.
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-24 text-[#8E9793]">
              <Layers className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">Select a pending draft to begin review.</p>
            </div>
          )}
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E5E5E0]">
            <div className="flex items-center gap-2.5 mb-3 text-red-600">
              <MessageSquare className="w-5 h-5" />
              <h3 className="text-base font-bold text-[#171B1A]">Reject Content Draft</h3>
            </div>
            <p className="text-xs text-[#66716B] mb-4">
              Please specify feedback or corrections required so the Creator can revise the draft.
            </p>

            <form onSubmit={handleReject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-[#171B1A] mb-1.5">
                  Rejection Reason / Guidance *
                </label>
                <textarea
                  rows={4}
                  required
                  value={rejectionFeedback}
                  onChange={(e) => setRejectionFeedback(e.target.value)}
                  placeholder="e.g. Tone is overly promotional. Please rephrase the technical claims to cite the specific insurance case study."
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#D5D5CF] focus:outline-none focus:ring-2 focus:ring-red-500 text-[#171B1A]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#66716B] hover:text-[#171B1A]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors"
                >
                  Submit Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
