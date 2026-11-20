import React, { useState, useEffect } from 'react';
import {
  Copy,
  Check,
  Hash,
  Search,
  MessageSquare,
  FileText,
  Sparkles,
  Layers,
  Edit2,
  Save,
} from 'lucide-react';
import { parseInstagramContent, ParsedInstagramContent } from './instagramParser';

interface InstagramFieldViewerProps {
  rawText: string;
  defaultTitle?: string;
  onSave?: (updatedText: string) => void;
  isEditable?: boolean;
}

export const InstagramFieldViewer: React.FC<InstagramFieldViewerProps> = ({
  rawText,
  defaultTitle = 'DataFactZ Enterprise AI',
  onSave,
  isEditable = false,
}) => {
  const [parsed, setParsed] = useState<ParsedInstagramContent>(() =>
    parseInstagramContent(rawText, defaultTitle)
  );

  const [activeTab, setActiveTab] = useState<'all' | 'caption' | 'description' | 'hashtags' | 'seo'>('all');

  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Editable local state
  const [editing, setEditing] = useState(false);
  const [editCaption, setEditCaption] = useState(parsed.caption);
  const [editDescription, setEditDescription] = useState(parsed.description);
  const [editHashtags, setEditHashtags] = useState(parsed.hashtags.join(' '));
  const [editSeo, setEditSeo] = useState(parsed.seoKeywords.join(', '));

  useEffect(() => {
    const updated = parseInstagramContent(rawText, defaultTitle);
    setParsed(updated);
    setEditCaption(updated.caption);
    setEditDescription(updated.description);
    setEditHashtags(updated.hashtags.join(' '));
    setEditSeo(updated.seoKeywords.join(', '));
  }, [rawText, defaultTitle]);

  const handleCopy = (textToCopy: string, fieldName: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSaveEdits = () => {
    const tagsArray = editHashtags
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => (t.startsWith('#') ? t : `#${t}`));
    const seoArray = editSeo
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const reassembled = `### CAPTION\n${editCaption.trim()}\n\n### DESCRIPTION\n${editDescription.trim()}\n\n### HASHTAGS\n${tagsArray.join(' ')}\n\n### SEO KEYWORDS\n${seoArray.join(', ')}`;

    setParsed({
      caption: editCaption,
      description: editDescription,
      hashtags: tagsArray,
      seoKeywords: seoArray,
    });
    setEditing(false);
    onSave?.(reassembled);
  };

  return (
    <div className="space-y-4">
      {/* Instagram Header with Field Tabs & Copy Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-xl border border-[#E7E5E4] shadow-xs text-xs">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white flex items-center justify-center font-bold text-[10px]">
            IG
          </div>
          <div>
            <span className="font-semibold text-[#252525] block">
              Instagram Structured Asset Architecture
            </span>
            <span className="text-[11px] text-[#737373]">
              Dedicated Caption, Description, Hashtags & SEO Search Keywords
            </span>
          </div>
        </div>

        {/* View Mode Pills */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#FAFAF9] p-1 rounded-lg border border-[#E7E5E4]">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer transition-all ${
                activeTab === 'all'
                  ? 'bg-[#252525] text-white shadow-xs'
                  : 'text-[#737373] hover:text-[#252525]'
              }`}
            >
              All 4 Fields
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('caption')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer transition-all ${
                activeTab === 'caption'
                  ? 'bg-[#252525] text-white shadow-xs'
                  : 'text-[#737373] hover:text-[#252525]'
              }`}
            >
              Caption
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('description')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer transition-all ${
                activeTab === 'description'
                  ? 'bg-[#252525] text-white shadow-xs'
                  : 'text-[#737373] hover:text-[#252525]'
              }`}
            >
              Description
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('hashtags')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer transition-all ${
                activeTab === 'hashtags'
                  ? 'bg-[#252525] text-white shadow-xs'
                  : 'text-[#737373] hover:text-[#252525]'
              }`}
            >
              Hashtags
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('seo')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer transition-all ${
                activeTab === 'seo'
                  ? 'bg-[#252525] text-white shadow-xs'
                  : 'text-[#737373] hover:text-[#252525]'
              }`}
            >
              SEO
            </button>
          </div>

          {isEditable && (
            <button
              type="button"
              onClick={() => (editing ? handleSaveEdits() : setEditing(true))}
              className="btn-motion inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FAFAF9] hover:bg-white text-[#252525] border border-[#E7E5E4] rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
            >
              {editing ? (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Fields</span>
                </>
              ) : (
                <>
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Fields</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Grid of 4 Structured Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* FIELD 1: CAPTION */}
        {(activeTab === 'all' || activeTab === 'caption') && (
          <div className="bg-white p-5 rounded-2xl border border-[#E7E5E4] shadow-xs space-y-3 flex flex-col justify-between hover:shadow-sm transition-shadow">
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-[#E7E5E4]">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-[#252525] text-white flex items-center justify-center">
                    <MessageSquare className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-[#252525] uppercase tracking-wider">
                      1. Instagram Caption
                    </h4>
                    <span className="text-[10px] text-[#737373]">
                      Short, punchy hook designed for immediate scroll-stop
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAFAF9] border border-[#E7E5E4] text-[#737373]">
                    {parsed.caption.length} chars
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(parsed.caption, 'caption')}
                    title="Copy Caption"
                    className="p-1.5 rounded-lg border border-[#E7E5E4] text-[#737373] hover:text-[#252525] hover:bg-[#FAFAF9] transition-all cursor-pointer"
                  >
                    {copiedField === 'caption' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {editing ? (
                <textarea
                  rows={3}
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-[#E7E5E4] focus:outline-none focus:border-[#252525]"
                />
              ) : (
                <div className="p-3.5 rounded-xl bg-[#FAFAF9] border border-[#E7E5E4]/80 text-sm font-semibold text-[#252525] leading-snug">
                  "{parsed.caption}"
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#737373] pt-2 border-t border-[#E7E5E4]/60">
              <span>Mobile Feed Hook Line</span>
              <span>100% Grounded</span>
            </div>
          </div>
        )}

        {/* FIELD 2: DESCRIPTION */}
        {(activeTab === 'all' || activeTab === 'description') && (
          <div className="bg-white p-5 rounded-2xl border border-[#E7E5E4] shadow-xs space-y-3 flex flex-col justify-between hover:shadow-sm transition-shadow">
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-[#E7E5E4]">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-[#252525] text-white flex items-center justify-center">
                    <FileText className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-[#252525] uppercase tracking-wider">
                      2. Detailed Description
                    </h4>
                    <span className="text-[10px] text-[#737373]">
                      Full post story, slide breakdown, & company value points
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAFAF9] border border-[#E7E5E4] text-[#737373]">
                    {parsed.description.split(/\s+/).filter(Boolean).length} words
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(parsed.description, 'description')}
                    title="Copy Description"
                    className="p-1.5 rounded-lg border border-[#E7E5E4] text-[#737373] hover:text-[#252525] hover:bg-[#FAFAF9] transition-all cursor-pointer"
                  >
                    {copiedField === 'description' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {editing ? (
                <textarea
                  rows={6}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-[#E7E5E4] focus:outline-none focus:border-[#252525] leading-relaxed"
                />
              ) : (
                <div className="p-3.5 rounded-xl bg-[#FAFAF9] border border-[#E7E5E4]/80 text-xs text-[#252525] leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto">
                  {parsed.description}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#737373] pt-2 border-t border-[#E7E5E4]/60">
              <span>Includes verified capabilities & CTA</span>
              <span>Formatted with line breaks</span>
            </div>
          </div>
        )}

        {/* FIELD 3: HASHTAGS */}
        {(activeTab === 'all' || activeTab === 'hashtags') && (
          <div className="bg-white p-5 rounded-2xl border border-[#E7E5E4] shadow-xs space-y-3 flex flex-col justify-between hover:shadow-sm transition-shadow">
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-[#E7E5E4]">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-[#252525] text-white flex items-center justify-center">
                    <Hash className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-[#252525] uppercase tracking-wider">
                      3. Instagram Hashtags
                    </h4>
                    <span className="text-[10px] text-[#737373]">
                      Curated tag cloud optimized for discovery reach
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(parsed.hashtags.join(' '), 'hashtags')}
                    className="btn-motion inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#E7E5E4] text-[11px] font-semibold text-[#252525] hover:bg-[#FAFAF9] transition-all cursor-pointer"
                  >
                    {copiedField === 'hashtags' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Copied All!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy All Tags</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {editing ? (
                <textarea
                  rows={3}
                  value={editHashtags}
                  onChange={(e) => setEditHashtags(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-[#E7E5E4] focus:outline-none focus:border-[#252525]"
                />
              ) : (
                <div className="p-3 rounded-xl bg-[#FAFAF9] border border-[#E7E5E4]/80 flex flex-wrap gap-1.5 min-h-[90px]">
                  {parsed.hashtags.map((tag, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleCopy(tag, `tag-${idx}`)}
                      title="Click to copy single tag"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#E7E5E4] text-xs font-mono text-[#252525] hover:border-[#252525] hover:shadow-xs transition-all cursor-pointer"
                    >
                      <Hash className="w-3 h-3 text-[#737373]" />
                      <span>{tag.replace(/^#/, '')}</span>
                      {copiedField === `tag-${idx}` && (
                        <Check className="w-3 h-3 text-emerald-600 ml-1" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#737373] pt-2 border-t border-[#E7E5E4]/60">
              <span>{parsed.hashtags.length} Tags Generated</span>
              <span>1-Click Copy Supported</span>
            </div>
          </div>
        )}

        {/* FIELD 4: SEO KEYWORDS */}
        {(activeTab === 'all' || activeTab === 'seo') && (
          <div className="bg-white p-5 rounded-2xl border border-[#E7E5E4] shadow-xs space-y-3 flex flex-col justify-between hover:shadow-sm transition-shadow">
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-[#E7E5E4]">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-[#252525] text-white flex items-center justify-center">
                    <Search className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-[#252525] uppercase tracking-wider">
                      4. SEO & Search Keywords
                    </h4>
                    <span className="text-[10px] text-[#737373]">
                      Algorithmic ranking keywords for Instagram Search intent
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(parsed.seoKeywords.join(', '), 'seo')}
                    className="btn-motion inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#E7E5E4] text-[11px] font-semibold text-[#252525] hover:bg-[#FAFAF9] transition-all cursor-pointer"
                  >
                    {copiedField === 'seo' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Copied All!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Keywords</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {editing ? (
                <textarea
                  rows={3}
                  value={editSeo}
                  onChange={(e) => setEditSeo(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-[#E7E5E4] focus:outline-none focus:border-[#252525]"
                />
              ) : (
                <div className="p-3 rounded-xl bg-[#FAFAF9] border border-[#E7E5E4]/80 flex flex-wrap gap-1.5 min-h-[90px]">
                  {parsed.seoKeywords.map((kw, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-medium"
                    >
                      <Search className="w-3 h-3 text-emerald-600" />
                      <span>{kw}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#737373] pt-2 border-t border-[#E7E5E4]/60">
              <span>{parsed.seoKeywords.length} Search Keywords</span>
              <span>Algorithm Discoverability</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
