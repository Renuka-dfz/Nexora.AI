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
  Sparkles,
  Share2,
  Tag,
  ArrowLeft,
  Check,
} from 'lucide-react';

interface ReviewQueuePageProps {
  initialContentId?: string;
  onNavigate?: (path: string) => void;
}

export const ReviewQueuePage: React.FC<ReviewQueuePageProps> = ({
  initialContentId,
  onNavigate,
}) => {
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

  // Feedback suggestion chips
  const feedbackSuggestions = [
    'Tone needs adjustment',
    'Image does not match the brand',
    'Information needs verification',
    'Other',
  ];

  const fetchPending = async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      setError(null);
      // Fetch both manually and automatically generated pending posts
      const res = await marketingApi.listContent(companyId, { status: 'pending', limit: 100 });
      setPendingItems(res.items);

      // Determine pre-selected item from prop or URL
      const targetId = initialContentId || new URLSearchParams(window.location.search).get('id');
      if (targetId) {
        const found = res.items.find((i) => i.content_id === targetId);
        if (found) {
          setSelectedItem(found);
        } else {
          // If not in pending list, fetch directly
          try {
            const single = await marketingApi.getContent(targetId);
            setSelectedItem(single);
          } catch {
            setSelectedItem(res.items[0] || null);
          }
        }
      } else if (res.items.length > 0 && !selectedItem) {
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
  }, [companyId, initialContentId]);

  const handleApprove = async () => {
    if (!selectedItem || !canApproveOrReject) return;
    setSubmittingAction(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await marketingApi.approveContent(selectedItem.content_id);
      const isScheduled = Boolean(selectedItem.scheduled_at);
      setSuccessMsg(
        isScheduled
          ? `Approved "${selectedItem.content_title}"! Scheduled for autonomous dispatch.`
          : `Approved "${selectedItem.content_title}" successfully!`
      );
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

  const getGenerationSourceLabel = (item: ContentItem): string => {
    if (item.generation_batch_id) {
      return 'Autonomous Weekly Batch';
    }
    if (item.generation_type === 'ai') {
      return 'Content Studio AI';
    }
    return 'Manual Draft';
  };

  const formatDate = (isoString?: string | null): string => {
    if (!isoString) return 'No schedule proposed';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EAEAE6]">
        <div>
          <div className="flex items-center gap-2">
            {onNavigate && (
              <button
                onClick={() => onNavigate('/marketing')}
                className="p-1 rounded-lg text-[#66716B] hover:text-[#171B1A] hover:bg-[#F4F4F0] mr-1"
                title="Back to Marketing Workspace"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h1 className="text-2xl font-bold tracking-tight text-[#171B1A]">Content Review Queue</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              {pendingItems.length} Pending
            </span>
          </div>
          <p className="text-sm text-[#66716B] mt-0.5">
            Audit and verify both automatically generated weekly posts and manual drafts before publishing authorization.
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
        {/* Left: Pending Submissions List */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-[#EAEAE6] shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#8E9793]">
              Pending Submissions ({pendingItems.length})
            </h2>
            <span className="text-[11px] text-[#66716B]">Individual Review</span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-[#66716B]">Loading queue...</div>
          ) : pendingItems.length === 0 ? (
            <div className="py-16 text-center text-[#8E9793] space-y-2">
              <CheckCircle2 className="w-10 h-10 mx-auto text-[#256D58] opacity-60" />
              <p className="text-sm font-medium text-[#171B1A]">Review Queue is Clear</p>
              <p className="text-xs">All marketing content has been audited and resolved.</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
              {pendingItems.map((item) => {
                const isSelected = selectedItem?.content_id === item.content_id;
                const source = getGenerationSourceLabel(item);

                return (
                  <div
                    key={item.content_id}
                    onClick={() => setSelectedItem(item)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[#256D58] bg-[#256D58]/5 shadow-xs'
                        : 'border-[#EAEAE6] hover:bg-[#F4F4F0] hover:border-[#D5D5CF]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-bold text-[#171B1A] leading-snug line-clamp-1">
                        {item.content_title}
                      </p>
                      <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-black/75 text-white">
                        {item.platform_target}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#66716B] line-clamp-2 mt-1.5 leading-relaxed">
                      {item.content_text}
                    </p>

                    <div className="mt-2.5 pt-2 border-t border-[#EAEAE6]/80 flex items-center justify-between text-[11px] text-[#8E9793]">
                      <span className="font-medium text-[#256D58]">{source}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Inspection & Decision Console */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-[#EAEAE6] shadow-xs flex flex-col justify-between">
          {selectedItem ? (
            <div className="space-y-5">
              {/* Inspection Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#EAEAE6]">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-black/75 text-white">
                      {selectedItem.platform_target}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#256D58]/10 text-[#256D58] border border-[#256D58]/20">
                      {getGenerationSourceLabel(selectedItem)}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      {selectedItem.approval_status}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-[#171B1A]">
                    {selectedItem.content_title}
                  </h2>
                </div>

                <div className="text-xs text-[#66716B] shrink-0 text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <Calendar className="w-3.5 h-3.5 text-[#8E9793]" />
                    <span>Created: {new Date(selectedItem.created_at).toLocaleDateString()}</span>
                  </div>
                  {selectedItem.scheduled_at && (
                    <div className="flex items-center gap-1 justify-end mt-1 text-[#256D58] font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Slot: {formatDate(selectedItem.scheduled_at)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Generated Image Preview (Full Image) */}
              {selectedItem.image_url && (
                <div className="rounded-xl overflow-hidden border border-[#EAEAE6] bg-[#F4F4F0] max-h-72 flex items-center justify-center">
                  <img
                    src={selectedItem.image_url}
                    alt={selectedItem.content_title}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              {/* Full Caption & Content Text */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#171B1A] mb-2">
                  Full Caption / Post Body
                </label>
                <div className="p-4 rounded-xl border border-[#D5D5CF] bg-[#FAFAF8] text-xs font-mono text-[#171B1A] whitespace-pre-wrap leading-relaxed max-h-[260px] overflow-y-auto">
                  {selectedItem.content_text}
                </div>
              </div>

              {/* Existing Feedback (if any) */}
              {selectedItem.publish_error && (
                <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-700">
                  <strong>Previous Error:</strong> {selectedItem.publish_error}
                </div>
              )}

              {/* Governance Notice */}
              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Compliance Guarantee:</strong> Approving this post authorizes Celery Beat to publish it to {selectedItem.platform_target} at its scheduled slot. Rejection cancels the slot and returns feedback to the Creator.
                </span>
              </div>

              {/* Decision Actions */}
              {canApproveOrReject ? (
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#EAEAE6]">
                  <button
                    onClick={() => {
                      setRejectionFeedback('');
                      setShowRejectModal(true);
                    }}
                    disabled={submittingAction}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" /> Reject with Feedback
                  </button>

                  <button
                    onClick={handleApprove}
                    disabled={submittingAction}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#256D58] text-white text-xs font-semibold hover:bg-[#1E5846] transition-all shadow-xs cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {selectedItem.scheduled_at ? 'Approve & Schedule' : 'Approve Draft'}
                    </span>
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
              <p className="text-sm font-medium">Select a pending post from the left to inspect.</p>
            </div>
          )}
        </div>
      </div>

      {/* Rejection Modal with Feedback Suggestions */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#EAEAE6] space-y-4">
            <div className="flex items-center gap-2.5 text-red-600">
              <MessageSquare className="w-5 h-5" />
              <h3 className="text-base font-bold text-[#171B1A]">Reject Content Draft</h3>
            </div>
            <p className="text-xs text-[#66716B]">
              Please specify the reason for rejection. This feedback will be returned to the Creator to guide revisions.
            </p>

            {/* Quick Feedback Suggestion Chips */}
            <div>
              <span className="text-[11px] font-semibold text-[#8E9793] uppercase block mb-1.5">
                Quick Suggestions:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {feedbackSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      if (suggestion === 'Other') {
                        setRejectionFeedback((prev) => prev || '');
                      } else {
                        setRejectionFeedback((prev) =>
                          prev ? `${prev}. ${suggestion}` : suggestion
                        );
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#FAFAF8] text-[#171B1A] border border-[#EAEAE6] hover:bg-[#F4F4F0] hover:border-[#D5D5CF] transition-colors"
                  >
                    + {suggestion}
                  </button>
                ))}
              </div>
            </div>

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
                  placeholder="e.g. Tone needs adjustment. Please emphasize technical architecture rather than marketing buzzwords."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#D5D5CF] focus:outline-none focus:ring-2 focus:ring-red-500 text-[#171B1A]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#EAEAE6]">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#66716B] hover:text-[#171B1A] hover:bg-[#F4F4F0]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction || !rejectionFeedback.trim()}
                  className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {submittingAction ? 'Submitting...' : 'Submit Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default ReviewQueuePage;