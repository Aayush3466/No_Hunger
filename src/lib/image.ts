/**
 * Client-side photo pipeline.
 *
 * Everything is re-encoded through a canvas, which is what strips EXIF and GPS:
 * a canvas holds pixels only, so the metadata block never survives the round
 * trip. The original file is never uploaded.
 */

export const TARGET_BYTES = 50 * 1024; // ~50 KB
export const MAX_DIMENSION = 1280;
export const MAX_INPUT_BYTES = 25 * 1024 * 1024;
export const ACCEPTED_INPUT = 'image/*';

const QUALITY_LADDER = [0.82, 0.7, 0.6, 0.5, 0.42, 0.35, 0.28];

export class ImageError extends Error {}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to the <img> path (older Safari, exotic colour profiles).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new ImageError('That image could not be read.'));
      img.src = url;
    });
  } finally {
    // Revoked after decode; the bitmap data is already in memory.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function dimensionsOf(source: ImageBitmap | HTMLImageElement) {
  const width = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const height = 'naturalHeight' in source ? source.naturalHeight : source.height;
  return { width, height };
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
}

async function encodeAtScale(
  source: ImageBitmap | HTMLImageElement,
  maxDimension: number,
): Promise<Blob | null> {
  const { width, height } = dimensionsOf(source);
  if (!width || !height) throw new ImageError('That image could not be read.');

  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext('2d');
  if (!context) throw new ImageError('This browser cannot process images.');
  context.drawImage(source as CanvasImageSource, 0, 0, canvas.width, canvas.height);

  let smallest: Blob | null = null;
  for (const quality of QUALITY_LADDER) {
    const blob = await toBlob(canvas, quality);
    if (!blob) continue;
    smallest = blob;
    if (blob.size <= TARGET_BYTES) return blob;
  }
  return smallest;
}

export interface CompressedImage {
  file: File;
  previewUrl: string;
  bytes: number;
  width: number;
  height: number;
}

/**
 * Returns a WebP file at roughly 50 KB with no EXIF, GPS or colour-profile
 * metadata. Throws ImageError with a message safe to show the user.
 */
export async function compressToWebp(file: File): Promise<CompressedImage> {
  if (!file.type.startsWith('image/')) {
    throw new ImageError('Choose an image file.');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new ImageError('That photo is too large. Pick one under 25 MB.');
  }

  const source = await decode(file);

  let blob = await encodeAtScale(source, MAX_DIMENSION);
  // One more pass at half size for very detailed photos that will not compress.
  if (blob && blob.size > TARGET_BYTES * 1.6) {
    const smaller = await encodeAtScale(source, Math.round(MAX_DIMENSION / 2));
    if (smaller && smaller.size < blob.size) blob = smaller;
  }
  if (!blob) throw new ImageError('That image could not be converted.');

  if ('close' in source && typeof source.close === 'function') source.close();

  const name = `${crypto.randomUUID()}.webp`;
  const out = new File([blob], name, { type: 'image/webp' });
  const { width, height } = dimensionsOf(source);

  return {
    file: out,
    previewUrl: URL.createObjectURL(out),
    bytes: out.size,
    width,
    height,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.round(bytes / 1024)} KB`;
}
