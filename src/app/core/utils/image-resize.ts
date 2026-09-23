/**
 * Client-side image preparation for uploads.
 *
 * The backend's largest generated size is 1200px, so uploading anything
 * larger than that is pure waste: the full-resolution file is transmitted,
 * stored under .raw/, downloaded again by the worker, decoded, then
 * discarded. Downscaling before upload typically shrinks a 5-8 MB phone
 * photo to ~0.2-0.4 MB (an 8-15x reduction) before it ever leaves the
 * browser.
 *
 * EXIF ORIENTATION — READ THIS BEFORE TOUCHING THE DECODE PATH:
 * Canvas output carries no EXIF metadata. If the camera's rotation flag is
 * not baked into the pixels at decode time, it is lost permanently and
 * portrait photos come out sideways (the exact bug the backend just fixed
 * server-side). Therefore:
 *  - createImageBitmap MUST be called with { imageOrientation: 'from-image' }
 *  - the fallback path relies on <img> decoding, where all evergreen
 *    browsers (Chrome 81+, Firefox 77+, Safari 13.1+) apply EXIF rotation
 *    before drawImage
 * Never decode via a plain canvas draw of a blob/File without one of the
 * two paths above.
 */

/** Largest dimension the backend generates — no reason to send more pixels. */
export const MAX_IMAGE_DIMENSION = 1200;

/** JPEG quality for re-encoded uploads (matches the measurement at 1600px/q85). */
export const JPEG_UPLOAD_QUALITY = 0.85;

/**
 * Hard client-side cap. The backend rejects oversized uploads with 413 only
 * after the entire upload has finished, so checking here fails in
 * milliseconds instead of after a multi-minute upload of a doomed payload.
 */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/** Below this size there is nothing meaningful to win by re-encoding. */
const SKIP_THRESHOLD_BYTES = 200 * 1024;

/** Types that can carry alpha: re-encoded to the same type to keep transparency. */
const ALPHA_SAFE_TYPES: Record<string, string> = {
  'image/png': 'image/png',
  'image/webp': 'image/webp'
};

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

interface DecodedImage {
  source: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
}

/**
 * Fail fast on files the upload can never succeed with.
 * Throws an Error with an admin-readable message.
 */
export function validateImageFile(file: File, maxBytes = MAX_UPLOAD_BYTES): void {
  if (!file.type || !file.type.startsWith('image/')) {
    throw new Error(
      `"${file.name}" is not an image file (received ${file.type || 'unknown type'}).`
    );
  }
  if (file.size > maxBytes) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      `"${file.name}" is ${mb} MB. The maximum allowed image size is ` +
      `${Math.round(maxBytes / (1024 * 1024))} MB.`
    );
  }
}

function decodeViaImgElement(file: File): Promise<DecodedImage> {
  return new Promise<DecodedImage>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      try {
        resolve({ source: img, width: img.naturalWidth, height: img.naturalHeight });
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image decode failed'));
    };
    img.src = url;
  });
}

async function decodeImage(file: File): Promise<DecodedImage | null> {
  // Primary path: explicit EXIF-respecting decode.
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height };
    } catch {
      // Older Safari throws on the options bag — fall through to <img>,
      // which also applies EXIF orientation during decode.
    }
  }
  try {
    return await decodeViaImgElement(file);
  } catch {
    // Undecodable in this browser (e.g. HEIC that the file input did not
    // transcode). Upload the original untouched and let the backend decide.
    return null;
  }
}

async function reencode(
  decoded: DecodedImage,
  targetWidth: number,
  targetHeight: number,
  type: string,
  quality?: number
): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(decoded.source, 0, 0, targetWidth, targetHeight);
      return canvas.convertToBlob({ type, quality });
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }
  ctx.drawImage(decoded.source, 0, 0, targetWidth, targetHeight);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Canvas encoding failed'))),
      type,
      quality
    );
  });
}

/**
 * Downscale and re-compress an image for upload.
 *
 * Behavior:
 *  - non-raster or already-small files are returned untouched
 *  - files this browser cannot decode are returned untouched (backend
 *    behaves exactly as before for those)
 *  - dimensions are capped at `maxDim` (aspect preserved, never upscaled)
 *  - JPEG sources are re-encoded at `quality`; PNG/WebP keep their type so
 *    transparency survives
 *  - if re-encoding does not shrink the file, the original is returned —
 *    never make an upload bigger than it was
 */
export async function downscaleImage(
  file: File,
  maxDim: number = MAX_IMAGE_DIMENSION,
  quality: number = JPEG_UPLOAD_QUALITY
): Promise<File> {
  const alphaSafeType = ALPHA_SAFE_TYPES[file.type];
  const isProcessable = file.type === 'image/jpeg' || !!alphaSafeType;
  if (!isProcessable || file.size <= SKIP_THRESHOLD_BYTES) {
    return file;
  }

  const decoded = await decodeImage(file);
  if (!decoded) {
    return file;
  }

  const needsResize = decoded.width > maxDim || decoded.height > maxDim;
  if (!needsResize) {
    // PNG/WebP at or below the cap: re-encoding won't shrink them reliably
    // and would risk quality/transparency loss — keep the original bytes.
    if (alphaSafeType) {
      return file;
    }
    // Large JPEG that already fits: still worth recompressing at q0.85.
  }

  const scale = needsResize ? Math.min(maxDim / decoded.width, maxDim / decoded.height, 1) : 1;
  const targetWidth = Math.max(1, Math.round(decoded.width * scale));
  const targetHeight = Math.max(1, Math.round(decoded.height * scale));

  const outType = alphaSafeType ?? 'image/jpeg';
  try {
    const blob = await reencode(decoded, targetWidth, targetHeight, outType, alphaSafeType ? undefined : quality);
    if (blob.size >= file.size) {
      return file;
    }
    const ext = EXTENSION_BY_TYPE[outType];
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], ext ? `${baseName}.${ext}` : file.name, {
      type: outType,
      lastModified: file.lastModified
    });
  } finally {
    if ('close' in decoded.source && typeof decoded.source.close === 'function') {
      (decoded.source as ImageBitmap).close();
    }
  }
}
