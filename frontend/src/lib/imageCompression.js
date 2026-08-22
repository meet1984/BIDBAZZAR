/**
 * Compresses an image File using HTML5 Canvas API.
 * Resizes the image so its maximum dimension (width or height) is `maxWidthOrHeight`
 * and compresses it using JPEG format with `quality`.
 *
 * @param {File} file - The file object to compress
 * @param {number} maxWidthOrHeight - Maximum dimension in pixels (default 1024)
 * @param {number} quality - Quality factor between 0 and 1 (default 0.75)
 * @returns {Promise<string>} - Resolves with compressed base64 data URL
 */
export async function compressImage(file, maxWidthOrHeight = 1024, quality = 0.75) {
  return new Promise((resolve, reject) => {
    // If not an image, resolve directly with FileReader
    if (!file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let width = img.width;
      let height = img.height;

      if (width > maxWidthOrHeight || height > maxWidthOrHeight) {
        if (width > height) {
          height = Math.round((height * maxWidthOrHeight) / width);
          width = maxWidthOrHeight;
        } else {
          width = Math.round((width * maxWidthOrHeight) / height);
          height = maxWidthOrHeight;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        // Fallback if canvas context fails
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve(dataUrl);
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };

    img.src = url;
  });
}
