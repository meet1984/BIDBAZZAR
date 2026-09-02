import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Code2,
  Columns,
  ExternalLink,
  Eye,
  FileCode2,
  History,
  Info,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
  Undo2,
} from "lucide-react";
import api from "../lib/api";
import { errorMessage, formatDateTime } from "../lib/format";
import { LoadingState } from "../components/AsyncState";

const MAX_BYTES = 200 * 1024; // 200 KB

const SNIPPETS = [
  { label: "Heading 2", tag: "<h2>Heading Title</h2>\n" },
  { label: "Heading 3", tag: "<h3>Section Subtitle</h3>\n" },
  { label: "Paragraph", tag: "<p>Write your detailed policy or terms content here.</p>\n" },
  { label: "Bullet List", tag: "<ul>\n  <li>List item one</li>\n  <li>List item two</li>\n</ul>\n" },
  { label: "Numbered List", tag: "<ol>\n  <li>First requirement</li>\n  <li>Second requirement</li>\n</ol>\n" },
  { label: "Bold Text", tag: "<strong>Important:</strong> " },
  { label: "Link", tag: '<a href="/contact" class="text-blue-600 underline">Contact Support</a>' },
];

export function LegalPagesSection() {
  const [activeSlug, setActiveSlug] = useState("terms"); // 'terms' | 'privacy'
  const [viewMode, setViewMode] = useState("split"); // 'split' | 'code' | 'preview'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Editor form state
  const [title, setTitle] = useState("");
  const [contentHtml, setContentHtml] = useState("");
  const [savedData, setSavedData] = useState(null);

  const loadPage = useCallback(async (slug) => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const res = await api.get(`/admin/legal-pages/${slug}`);
      const page = res.data?.page || res.data;
      setTitle(page?.title || (slug === "terms" ? "Terms & Conditions" : "Privacy Policy"));
      const html = page?.contentHtml || page?.content_html || "";
      setContentHtml(html);
      setSavedData({
        title: page?.title || "",
        contentHtml: html,
        updatedAt: page?.updatedAt,
        updatedBy: page?.updatedBy,
      });
    } catch (err) {
      setError(errorMessage(err, `Failed to load ${slug} legal page.`));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPage(activeSlug);
  }, [activeSlug, loadPage]);

  const handleSlugChange = (newSlug) => {
    if (newSlug === activeSlug) return;
    if (isDirty) {
      const confirmLeave = window.confirm(
        "You have unsaved changes on this page. Are you sure you want to switch tabs?",
      );
      if (!confirmLeave) return;
    }
    setActiveSlug(newSlug);
  };

  const isDirty =
    savedData && (title !== savedData.title || contentHtml !== savedData.contentHtml);

  const contentLengthBytes = new Blob([contentHtml]).size;
  const isOverLimit = contentLengthBytes > MAX_BYTES;
  const byteUsagePercent = Math.min(100, Math.round((contentLengthBytes / MAX_BYTES) * 100));

  const handleInsertSnippet = (snippet) => {
    const textarea = document.getElementById("legal-page-html-editor");
    if (!textarea) {
      setContentHtml((prev) => prev + snippet);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = contentHtml;
    const updated = text.substring(0, start) + snippet + text.substring(end);
    setContentHtml(updated);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + snippet.length, start + snippet.length);
    }, 0);
  };

  const handleKeyDown = (e) => {
    // Enable tab key indenting in textarea
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = e.target;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = contentHtml;
      const updated = text.substring(0, start) + "  " + text.substring(end);
      setContentHtml(updated);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  const handleReset = () => {
    if (!savedData) return;
    if (window.confirm("Discard all unsaved edits and reset to currently published version?")) {
      setTitle(savedData.title);
      setContentHtml(savedData.contentHtml);
      setNotice("Edits reverted to last saved version.");
      setError("");
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!title.trim()) {
      setError("Page title cannot be empty.");
      return;
    }
    if (!contentHtml.trim()) {
      setError("Page HTML content cannot be empty.");
      return;
    }
    if (isOverLimit) {
      setError(`Content exceeds maximum limit of 200KB (${Math.round(contentLengthBytes / 1024)}KB). Please shorten.`);
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const res = await api.put(`/admin/legal-pages/${activeSlug}`, {
        title: title.trim(),
        contentHtml: contentHtml.trim(),
      });
      const updatedPage = res.data?.page || res.data;
      const newHtml = updatedPage?.contentHtml || updatedPage?.content_html || contentHtml;
      setTitle(updatedPage?.title || title);
      setContentHtml(newHtml);
      setSavedData({
        title: updatedPage?.title || title,
        contentHtml: newHtml,
        updatedAt: updatedPage?.updatedAt || new Date().toISOString(),
        updatedBy: updatedPage?.updatedBy,
      });
      setNotice(`"${updatedPage?.title || title}" published successfully! Public page is now updated.`);
    } catch (err) {
      setError(errorMessage(err, "Failed to save legal page."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-[#2563eb]">
              <FileCode2 size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                Legal & Policy Pages
              </h2>
              <p className="text-xs text-slate-500">
                Author raw HTML content for public Terms & Conditions and Privacy Policy.
              </p>
            </div>
          </div>

          {/* Tab Selection */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => handleSlugChange("terms")}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-bold transition-all ${
                activeSlug === "terms"
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ShieldCheck size={14} />
              <span>Terms & Conditions</span>
            </button>
            <button
              type="button"
              onClick={() => handleSlugChange("privacy")}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-bold transition-all ${
                activeSlug === "privacy"
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileCode2 size={14} />
              <span>Privacy Policy</span>
            </button>
          </div>
        </div>

        {/* Status Bar */}
        {savedData?.updatedAt && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
            <div className="flex items-center gap-2">
              <History size={13} className="text-slate-400" />
              <span>Last published: <strong>{formatDateTime(savedData.updatedAt)}</strong></span>
              {savedData.updatedBy && <span>(by Admin #{savedData.updatedBy})</span>}
              {isDirty && (
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                  Unsaved Edits
                </span>
              )}
            </div>

            <a
              href={`/${activeSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              <span>View live public page</span>
              <ExternalLink size={12} />
            </a>
          </div>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-800">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600" />
          <div className="flex-1 leading-5">{error}</div>
          <button
            type="button"
            onClick={() => setError("")}
            className="text-red-500 hover:text-red-700"
          >
            &times;
          </button>
        </div>
      )}

      {notice && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
          <div className="flex-1 leading-5">{notice}</div>
          <button
            type="button"
            onClick={() => setNotice("")}
            className="text-emerald-500 hover:text-emerald-700"
          >
            &times;
          </button>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <LoadingState label="Loading legal page editor…" />
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          {/* Header Controls */}
          <div className="border-b border-slate-200 bg-slate-50/70 p-4 sm:p-5">
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Page Display Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Terms & Conditions"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* View mode toggle & Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setViewMode("code")}
                    className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold ${
                      viewMode === "code"
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                    title="Code Only"
                  >
                    <Code2 size={13} />
                    <span>Editor</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("split")}
                    className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold ${
                      viewMode === "split"
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                    title="Split View (Side by side)"
                  >
                    <Columns size={13} />
                    <span>Split</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("preview")}
                    className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold ${
                      viewMode === "preview"
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                    title="Live Preview"
                  >
                    <Eye size={13} />
                    <span>Preview</span>
                  </button>
                </div>

                {isDirty && (
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={saving}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
                  >
                    <Undo2 size={14} />
                    <span>Discard</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || isOverLimit}
                  className="flex items-center gap-2 rounded-lg bg-[#2563eb] px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-all shadow-xs"
                >
                  {saving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Publishing…</span>
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      <span>Save & Publish</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick HTML Snippet Toolbar */}
            {viewMode !== "preview" && (
              <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-slate-200/80 pt-3">
                <span className="mr-1 flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <Code2 size={12} /> Snippets:
                </span>
                {SNIPPETS.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => handleInsertSnippet(s.tag)}
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700 transition-colors"
                  >
                    + {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Main Editor & Preview Grid */}
          <div
            className={`grid divide-y lg:divide-y-0 lg:divide-x divide-slate-200 ${
              viewMode === "split"
                ? "lg:grid-cols-2"
                : viewMode === "code"
                ? "grid-cols-1"
                : "grid-cols-1"
            }`}
          >
            {/* HTML Code Editor */}
            {viewMode !== "preview" && (
              <div className="flex flex-col bg-slate-950 p-4 text-slate-100">
                <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Code2 size={13} className="text-blue-400" />
                    Raw HTML Source
                  </span>
                  <div className="flex items-center gap-3 font-mono text-[11px]">
                    <span className={isOverLimit ? "font-bold text-red-400" : "text-slate-400"}>
                      {(contentLengthBytes / 1024).toFixed(1)} KB / 200 KB
                    </span>
                    <span className="text-slate-500">({contentHtml.length} chars)</span>
                  </div>
                </div>

                {/* Progress bar for 200KB limit */}
                <div className="mb-3 h-1 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isOverLimit
                        ? "bg-red-500"
                        : byteUsagePercent > 80
                        ? "bg-amber-500"
                        : "bg-blue-500"
                    }`}
                    style={{ width: `${byteUsagePercent}%` }}
                  />
                </div>

                <textarea
                  id="legal-page-html-editor"
                  value={contentHtml}
                  onChange={(e) => setContentHtml(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={20}
                  spellCheck={false}
                  placeholder="<h2>Section Title</h2>&#10;<p>Enter raw HTML content here...</p>"
                  className="w-full flex-1 resize-y rounded-lg border border-slate-800 bg-slate-900/90 p-4 font-mono text-xs leading-6 text-slate-100 shadow-inner focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[440px]"
                />

                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 text-slate-400">
                    <Info size={12} /> Standard HTML tags supported (`h2`, `h3`, `p`, `ul`, `ol`, `li`, `strong`, `em`, `a`, `table`)
                  </span>
                  <span>Tab key adds 2 spaces</span>
                </div>
              </div>
            )}

            {/* Live Render Preview */}
            {viewMode !== "code" && (
              <div className="flex flex-col bg-slate-50/50 p-6 sm:p-8">
                <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <Eye size={15} className="text-blue-600" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Live Public Preview
                    </span>
                  </div>
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                    Client Styled View
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs min-h-[440px]">
                  <p className="text-xs font-bold uppercase tracking-widest text-blue-600">
                    BidMyLot Policy
                  </p>
                  <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900">
                    {title || (activeSlug === "terms" ? "Marketplace Terms" : "Privacy Policy")}
                  </h1>
                  <p className="mt-2 text-xs text-slate-400">
                    Last updated: {formatDateTime(savedData?.updatedAt || new Date())}
                  </p>

                  <div
                    className="legal-content-preview mt-6 space-y-4 text-sm leading-7 text-slate-700 border-t border-slate-100 pt-6 prose prose-slate max-w-none [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-slate-900 [&_h3]:mt-4 [&_h3]:mb-1 [&_p]:text-slate-600 [&_p]:leading-6 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_a]:text-blue-600 [&_a]:underline"
                    dangerouslySetInnerHTML={{ __html: contentHtml || "<p class='text-slate-400 italic'>No content authored yet.</p>" }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default LegalPagesSection;
