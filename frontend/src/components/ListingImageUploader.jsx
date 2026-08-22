import React, { useState } from "react";
import { ArrowLeft, ArrowRight, LoaderCircle, Star, Trash2, UploadCloud } from "lucide-react";
import api from "../lib/api";
import { errorMessage } from "../lib/format";

export default function ListingImageUploader({
  listingId,
  images = [],
  onImagesChange,
  disabled = false,
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const maxImages = 6;
  const remainingSlots = Math.max(0, maxImages - images.length);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (files.length > remainingSlots) {
      setError(`You can only add ${remainingSlots} more image(s). (Max ${maxImages} total)`);
      return;
    }

    // Validate size and mime type
    for (const f of files) {
      if (f.size > 5 * 1024 * 1024) {
        setError(`File "${f.name}" exceeds the 5MB limit.`);
        return;
      }
      if (!["image/jpeg", "image/png", "image/webp", "image/jpg", "image/gif"].includes(f.type.toLowerCase())) {
        setError(`File "${f.name}" is not a supported image format (JPG, PNG, WebP).`);
        return;
      }
    }

    setError(null);

    // If listingId exists, upload immediately to backend API
    if (listingId) {
      setUploading(true);
      try {
        const formData = new FormData();
        files.forEach((f) => formData.append("images", f));

        const res = await api.post(`/seller/listings/${listingId}/images`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        if (onImagesChange) {
          onImagesChange(res.data?.images || []);
        }
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setUploading(false);
      }
    } else {
      // Local preview mode for new draft creation prior to listing save
      const newItems = files.map((f, idx) => ({
        id: `temp-${Date.now()}-${idx}`,
        imageUrl: URL.createObjectURL(f),
        file: f,
        isPrimary: images.length === 0 && idx === 0,
        displayOrder: images.length + idx + 1,
      }));
      onImagesChange([...images, ...newItems]);
    }
  };

  const handleRemove = async (img, index) => {
    if (disabled) return;
    setError(null);

    if (listingId && img.id && typeof img.id === "number") {
      setUploading(true);
      try {
        await api.delete(`/seller/listings/${listingId}/images/${img.id}`);
        const updated = images.filter((i) => i.id !== img.id);
        onImagesChange(updated);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setUploading(false);
      }
    } else {
      const updated = images.filter((_, i) => i !== index);
      // Promote remaining first image to primary if primary was removed
      if (img.isPrimary && updated.length > 0) {
        updated[0].isPrimary = true;
      }
      onImagesChange(updated);
    }
  };

  const handleSetPrimary = async (targetIndex) => {
    if (disabled) return;
    const updated = images.map((img, i) => ({
      ...img,
      isPrimary: i === targetIndex,
    }));

    if (listingId) {
      setUploading(true);
      try {
        const itemsToReorder = updated.map((img, i) => ({
          id: img.id,
          displayOrder: i + 1,
          isPrimary: img.isPrimary,
        }));
        const res = await api.patch(`/seller/listings/${listingId}/images/reorder`, {
          items: itemsToReorder,
        });
        onImagesChange(res.data?.images || updated);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setUploading(false);
      }
    } else {
      onImagesChange(updated);
    }
  };

  const handleMove = async (index, direction) => {
    if (disabled) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= images.length) return;

    const updated = [...images];
    const temp = updated[index];
    updated[index] = updated[newIndex];
    updated[newIndex] = temp;

    const reordered = updated.map((img, i) => ({
      ...img,
      displayOrder: i + 1,
    }));

    if (listingId) {
      setUploading(true);
      try {
        const itemsToReorder = reordered.map((img) => ({
          id: img.id,
          displayOrder: img.displayOrder,
          isPrimary: img.isPrimary,
        }));
        const res = await api.patch(`/seller/listings/${listingId}/images/reorder`, {
          items: itemsToReorder,
        });
        onImagesChange(res.data?.images || reordered);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setUploading(false);
      }
    } else {
      onImagesChange(reordered);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-[13px] font-semibold text-[#0f172a]">
          Listing Gallery Images ({images.length}/{maxImages})
        </label>
        <span className="text-[12px] text-slate-500">Max 6 images, up to 5MB each</span>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-[12px] font-medium text-red-700">
          {error}
        </div>
      )}

      {/* Grid of uploaded images */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        {images.map((img, idx) => (
          <div
            key={img.id || idx}
            className={`group relative aspect-square overflow-hidden rounded-lg border bg-slate-100 ${img.isPrimary ? "border-[#2563eb] ring-2 ring-[#2563eb]/20" : "border-slate-200"
              }`}
          >
            <img
              src={img.imageUrl || img.url}
              alt={`Listing thumbnail ${idx + 1}`}
              className="h-full w-full object-cover"
            />

            {/* Primary badge */}
            {img.isPrimary && (
              <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-[#2563eb] px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                <Star size={10} className="fill-white" /> Primary
              </span>
            )}

            {/* Action overlay controls */}
            {!disabled && (
              <div className="absolute inset-0 flex flex-col justify-between bg-slate-950/60 p-1.5 opacity-0 transition group-hover:opacity-100">
                <div className="flex items-center justify-between">
                  {!img.isPrimary && (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(idx)}
                      className="rounded bg-white/90 p-1 text-amber-600 hover:bg-white"
                      title="Set as primary thumbnail"
                    >
                      <Star size={13} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemove(img, idx)}
                    className="ml-auto rounded bg-red-600/90 p-1 text-white hover:bg-red-600"
                    title="Remove image"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Move Left / Right buttons */}
                <div className="flex justify-center gap-1">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMove(idx, -1)}
                    className="rounded bg-white/90 p-1 text-slate-800 disabled:opacity-30"
                    title="Move left"
                  >
                    <ArrowLeft size={12} />
                  </button>
                  <button
                    type="button"
                    disabled={idx === images.length - 1}
                    onClick={() => handleMove(idx, 1)}
                    className="rounded bg-white/90 p-1 text-slate-800 disabled:opacity-30"
                    title="Move right"
                  >
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Add image drop button */}
        {remainingSlots > 0 && !disabled && (
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 transition hover:border-[#2563eb] hover:bg-slate-100">
            {uploading ? (
              <LoaderCircle className="animate-spin text-[#2563eb]" size={22} />
            ) : (
              <>
                <UploadCloud className="text-slate-400" size={24} />
                <span className="mt-1 text-[11px] font-semibold text-slate-600">Add Photo</span>
                <span className="text-[10px] text-slate-400">({remainingSlots} left)</span>
              </>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple={remainingSlots > 1}
              onChange={handleFileSelect}
              disabled={uploading || disabled}
              className="hidden"
            />
          </label>
        )}
      </div>
    </div>
  );
}
