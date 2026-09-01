import React, { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  LoaderCircle,
  Pencil,
  Plus,
  Power,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import api from "../lib/api";
import { errorMessage } from "../lib/format";
import { resolveImageUrl } from "../lib/image";
import { compressImage } from "../lib/imageCompression";

export function CategoryManagementSection() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState({});

  // Modal State
  const [categoryModal, setCategoryModal] = useState({ open: false, mode: "create", category: null });
  const [subcategoryModal, setSubcategoryModal] = useState({ open: false, mode: "create", parentCategory: null, subcategory: null });
  const [moveModal, setMoveModal] = useState({ open: false, subcategory: null, newCategoryId: "" });

  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formImage, setFormImage] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  const loadCategories = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/admin/categories");
      const items = res.data?.categories || res.data?.items || [];
      setCategories(items);
      // Auto-expand all categories by default
      const exp = {};
      items.forEach((c) => {
        exp[c.id] = true;
      });
      setExpanded(exp);
    } catch (err) {
      setError(errorMessage(err, "Failed to load categories list."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const toggleExpand = (catId) => {
    setExpanded((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  // Reorder Categories
  const handleReorderCategory = async (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= categories.length) return;

    const updated = [...categories];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;

    const itemsToSave = updated.map((c, i) => ({ id: c.id, displayOrder: i + 1 }));
    setCategories(updated);

    try {
      await api.patch("/admin/categories/reorder", { items: itemsToSave });
    } catch (err) {
      alert(errorMessage(err));
      loadCategories();
    }
  };

  // Reorder Subcategories
  const handleReorderSubcategory = async (catId, subIndex, direction) => {
    const cat = categories.find((c) => c.id === catId);
    if (!cat || !cat.subcategories) return;

    const subList = [...cat.subcategories];
    const targetIdx = subIndex + direction;
    if (targetIdx < 0 || targetIdx >= subList.length) return;

    const temp = subList[subIndex];
    subList[subIndex] = subList[targetIdx];
    subList[targetIdx] = temp;

    const itemsToSave = subList.map((sc, i) => ({ id: sc.id, displayOrder: i + 1 }));

    setCategories((prev) =>
      prev.map((c) => (c.id === catId ? { ...c, subcategories: subList } : c)),
    );

    try {
      await api.patch("/admin/subcategories/reorder", { items: itemsToSave });
    } catch (err) {
      alert(errorMessage(err));
      loadCategories();
    }
  };

  // Toggle Category Active Status
  const handleToggleCategoryActive = async (cat) => {
    try {
      await api.patch(`/admin/categories/${cat.id}/active`, { isActive: !cat.isActive });
      loadCategories();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  // Toggle Subcategory Active Status
  const handleToggleSubcategoryActive = async (sub) => {
    try {
      await api.patch(`/admin/subcategories/${sub.id}/active`, { isActive: !sub.isActive });
      loadCategories();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  // Delete Category
  const handleDeleteCategory = async (cat) => {
    if (cat.listingCount > 0) {
      alert(`Cannot delete "${cat.name}" because it has ${cat.listingCount} associated listing(s). Deactivate it instead.`);
      return;
    }
    if (window.confirm(`Are you sure you want to permanently delete category "${cat.name}"?`)) {
      try {
        await api.delete(`/admin/categories/${cat.id}`);
        loadCategories();
      } catch (err) {
        alert(errorMessage(err));
      }
    }
  };

  // Delete Subcategory
  const handleDeleteSubcategory = async (sub) => {
    if (sub.listingCount > 0) {
      alert(`Cannot delete "${sub.name}" because it has ${sub.listingCount} associated listing(s). Deactivate it instead.`);
      return;
    }
    if (window.confirm(`Are you sure you want to permanently delete subcategory "${sub.name}"?`)) {
      try {
        await api.delete(`/admin/subcategories/${sub.id}`);
        loadCategories();
      } catch (err) {
        alert(errorMessage(err));
      }
    }
  };

  const handleCategoryImageFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setModalError("Please select a valid image file.");
      return;
    }
    setUploadingImage(true);
    setModalError("");
    try {
      const formData = new FormData();
      formData.append("image", file);
      const { data } = await api.post("/admin/settings/about-categories/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (data?.imageUrl) {
        setFormImage(data.imageUrl);
      }
    } catch {
      try {
        const compressed = await compressImage(file, 1200, 0.85);
        setFormImage(compressed);
      } catch {
        setModalError("Failed to process image file.");
      }
    } finally {
      setUploadingImage(false);
    }
  };

  // Submit Category Create / Edit
  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      setModalError("Category name is required.");
      return;
    }

    setSubmitting(true);
    setModalError("");
    try {
      if (categoryModal.mode === "create") {
        await api.post("/admin/categories", {
          name: formName.trim(),
          description: formDesc.trim() || undefined,
          imageUrl: formImage.trim() || undefined,
          displayOrder: categories.length + 1,
        });
      } else {
        await api.patch(`/admin/categories/${categoryModal.category.id}`, {
          name: formName.trim(),
          description: formDesc.trim() || undefined,
          imageUrl: formImage.trim() || undefined,
        });
      }
      setCategoryModal({ open: false, mode: "create", category: null });
      loadCategories();
    } catch (err) {
      setModalError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Subcategory Create / Edit
  const handleSaveSubcategory = async (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      setModalError("Subcategory name is required.");
      return;
    }

    setSubmitting(true);
    setModalError("");
    try {
      if (subcategoryModal.mode === "create") {
        await api.post("/admin/subcategories", {
          categoryId: subcategoryModal.parentCategory.id,
          name: formName.trim(),
          description: formDesc.trim() || undefined,
        });
      } else {
        await api.patch(`/admin/subcategories/${subcategoryModal.subcategory.id}`, {
          name: formName.trim(),
          description: formDesc.trim() || undefined,
        });
      }
      setSubcategoryModal({ open: false, mode: "create", parentCategory: null, subcategory: null });
      loadCategories();
    } catch (err) {
      setModalError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Subcategory Move
  const handleMoveSubcategorySubmit = async (e) => {
    e.preventDefault();
    if (!moveModal.newCategoryId) return;

    setSubmitting(true);
    setModalError("");
    try {
      await api.post(`/admin/subcategories/${moveModal.subcategory.id}/move`, {
        newCategoryId: Number(moveModal.newCategoryId),
      });
      setMoveModal({ open: false, subcategory: null, newCategoryId: "" });
      loadCategories();
    } catch (err) {
      setModalError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#0f172a]">Category & Subcategory Hierarchy</h2>
          <p className="text-xs text-slate-500">
            Manage marketplace taxonomy, reorder categories, move subcategories, and set active status.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormName("");
            setFormDesc("");
            setFormImage("");
            setModalError("");
            setCategoryModal({ open: true, mode: "create", category: null });
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-[#2563eb] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
        >
          <Plus size={16} /> Add Category
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          <LoaderCircle className="mx-auto animate-spin text-[#2563eb]" size={24} />
          <p className="mt-2 text-xs font-medium">Loading category tree...</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">{error}</div>
      ) : (
        <div className="space-y-3">
          {categories.map((cat, catIdx) => {
            const isExp = expanded[cat.id];
            const subList = cat.subcategories || [];

            return (
              <div
                key={cat.id}
                className={`rounded-xl border transition ${cat.isActive ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50/70 opacity-75"
                  }`}
              >
                {/* Parent Category Row */}
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleExpand(cat.id)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      {isExp ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>

                    {/* Category Photo Thumbnail */}
                    <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-900 shadow-2xs">
                      <img
                        src={resolveImageUrl(cat.imageUrl || "/hero-auction-marketplace.png")}
                        alt={cat.name}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#0f172a] text-sm">{cat.name}</span>
                        {!cat.isActive && (
                          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 uppercase">
                            Inactive
                          </span>
                        )}
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-[#2563eb]">
                          {cat.listingCount || 0} listings
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">slug: {cat.slug}</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    {/* Reorder Up/Down */}
                    <button
                      type="button"
                      disabled={catIdx === 0}
                      onClick={() => handleReorderCategory(catIdx, -1)}
                      className="rounded p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                      title="Move up"
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      type="button"
                      disabled={catIdx === categories.length - 1}
                      onClick={() => handleReorderCategory(catIdx, 1)}
                      className="rounded p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                      title="Move down"
                    >
                      <ArrowDown size={15} />
                    </button>

                    {/* Add Subcategory */}
                    <button
                      type="button"
                      onClick={() => {
                        setFormName("");
                        setFormDesc("");
                        setModalError("");
                        setSubcategoryModal({ open: true, mode: "create", parentCategory: cat, subcategory: null });
                      }}
                      className="inline-flex items-center gap-1 rounded bg-blue-50 px-2.5 py-1 text-xs font-semibold text-[#2563eb] hover:bg-blue-100"
                    >
                      <FolderPlus size={14} /> Add Subcategory
                    </button>

                    {/* Edit */}
                    <button
                      type="button"
                      onClick={() => {
                        setFormName(cat.name);
                        setFormDesc(cat.description || "");
                        setFormImage(cat.imageUrl || "");
                        setModalError("");
                        setCategoryModal({ open: true, mode: "edit", category: cat });
                      }}
                      className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
                      title="Edit Category"
                    >
                      <Pencil size={15} />
                    </button>

                    {/* Active Toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleCategoryActive(cat)}
                      className={`rounded p-1.5 ${cat.isActive ? "text-emerald-600 hover:bg-emerald-50" : "text-slate-400 hover:bg-slate-100"}`}
                      title={cat.isActive ? "Deactivate Category" : "Activate Category"}
                    >
                      <Power size={15} />
                    </button>

                    {/* Delete with guard tooltip */}
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(cat)}
                      className={`rounded p-1.5 ${cat.listingCount > 0 ? "text-slate-300 cursor-not-allowed" : "text-red-600 hover:bg-red-50"}`}
                      title={cat.listingCount > 0 ? `Blocked: Category used by ${cat.listingCount} listing(s)` : "Delete Category"}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Subcategories Nested List */}
                {isExp && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-3 space-y-2">
                    {subList.length === 0 ? (
                      <div className="pl-8 text-xs text-slate-400 italic">No subcategories defined yet.</div>
                    ) : (
                      subList.map((sub, subIdx) => (
                        <div
                          key={sub.id}
                          className="flex items-center justify-between rounded-lg border border-slate-200/70 bg-white p-3 pl-8 shadow-2xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800 text-xs">{sub.name}</span>
                            {!sub.isActive && (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 uppercase">
                                Inactive
                              </span>
                            )}
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                              {sub.listingCount || 0} listings
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Reorder Subcategory */}
                            <button
                              type="button"
                              disabled={subIdx === 0}
                              onClick={() => handleReorderSubcategory(cat.id, subIdx, -1)}
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                              title="Move up"
                            >
                              <ArrowUp size={13} />
                            </button>
                            <button
                              type="button"
                              disabled={subIdx === subList.length - 1}
                              onClick={() => handleReorderSubcategory(cat.id, subIdx, 1)}
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                              title="Move down"
                            >
                              <ArrowDown size={13} />
                            </button>

                            {/* Move to another category */}
                            <button
                              type="button"
                              onClick={() => {
                                setMoveModal({ open: true, subcategory: sub, newCategoryId: String(cat.id) });
                                setModalError("");
                              }}
                              className="rounded p-1 text-indigo-600 hover:bg-indigo-50"
                              title="Move to another Category"
                            >
                              <ArrowRightLeft size={13} />
                            </button>

                            {/* Edit */}
                            <button
                              type="button"
                              onClick={() => {
                                setFormName(sub.name);
                                setFormDesc(sub.description || "");
                                setModalError("");
                                setSubcategoryModal({ open: true, mode: "edit", parentCategory: cat, subcategory: sub });
                              }}
                              className="rounded p-1 text-slate-600 hover:bg-slate-100"
                              title="Edit Subcategory"
                            >
                              <Pencil size={13} />
                            </button>

                            {/* Active Toggle */}
                            <button
                              type="button"
                              onClick={() => handleToggleSubcategoryActive(sub)}
                              className={`rounded p-1 ${sub.isActive ? "text-emerald-600 hover:bg-emerald-50" : "text-slate-400 hover:bg-slate-100"}`}
                              title={sub.isActive ? "Deactivate" : "Activate"}
                            >
                              <Power size={13} />
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => handleDeleteSubcategory(sub)}
                              className={`rounded p-1 ${sub.listingCount > 0 ? "text-slate-300 cursor-not-allowed" : "text-red-600 hover:bg-red-50"}`}
                              title={sub.listingCount > 0 ? `Blocked: Used by ${sub.listingCount} listing(s)` : "Delete Subcategory"}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Category Create/Edit Modal */}
      {categoryModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-[#0f172a]">
                {categoryModal.mode === "create" ? "Add Category" : "Edit Category"}
              </h3>
              <button type="button" onClick={() => setCategoryModal({ open: false, mode: "create", category: null })} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            {modalError && <div className="mt-3 text-xs text-red-600 font-medium">{modalError}</div>}
            <form onSubmit={handleSaveCategory} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#0f172a]">Category Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Industrial Automation"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs outline-none focus:border-[#2563eb]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0f172a]">Description</label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs outline-none focus:border-[#2563eb]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0f172a]">Category Photo</label>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Displayed on the public About page and marketplace catalogues.
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-900 shadow-2xs">
                    <img
                      src={resolveImageUrl(formImage || "/hero-auction-marketplace.png")}
                      alt="Category preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="url"
                      value={formImage}
                      onChange={(e) => setFormImage(e.target.value)}
                      placeholder="Photo URL (e.g. /hero-auction-marketplace.png or https://...)"
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-[#2563eb]"
                    />
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors">
                      <Upload size={13} />
                      <span>{uploadingImage ? "Uploading..." : "Upload Photo"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCategoryImageFileSelect}
                        disabled={uploadingImage}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCategoryModal({ open: false, mode: "create", category: null })}
                  className="rounded-lg border px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-[#2563eb] px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subcategory Create/Edit Modal */}
      {subcategoryModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-[#0f172a]">
                {subcategoryModal.mode === "create"
                  ? `Add Subcategory under ${subcategoryModal.parentCategory?.name}`
                  : "Edit Subcategory"}
              </h3>
              <button type="button" onClick={() => setSubcategoryModal({ open: false, mode: "create", parentCategory: null, subcategory: null })} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            {modalError && <div className="mt-3 text-xs text-red-600 font-medium">{modalError}</div>}
            <form onSubmit={handleSaveSubcategory} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#0f172a]">Subcategory Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Sensors & Controllers"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs outline-none focus:border-[#2563eb]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0f172a]">Description</label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs outline-none focus:border-[#2563eb]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSubcategoryModal({ open: false, mode: "create", parentCategory: null, subcategory: null })}
                  className="rounded-lg border px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-[#2563eb] px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Subcategory"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Move Subcategory Modal */}
      {moveModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-[#0f172a]">Move "{moveModal.subcategory?.name}"</h3>
              <button type="button" onClick={() => setMoveModal({ open: false, subcategory: null, newCategoryId: "" })} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            {modalError && <div className="mt-3 text-xs text-red-600 font-medium">{modalError}</div>}
            <form onSubmit={handleMoveSubcategorySubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#0f172a]">Target Parent Category *</label>
                <select
                  value={moveModal.newCategoryId}
                  onChange={(e) => setMoveModal((prev) => ({ ...prev, newCategoryId: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs outline-none focus:border-[#2563eb]"
                  required
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMoveModal({ open: false, subcategory: null, newCategoryId: "" })}
                  className="rounded-lg border px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-[#2563eb] px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? "Moving..." : "Confirm Move"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
