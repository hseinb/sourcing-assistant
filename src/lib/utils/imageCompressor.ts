/**
 * Client-Side Image Compression & Local WebP Storage Utility
 * Hardware-Accelerated via discrete GPU (NVIDIA / WebGL) Canvas
 * Converts photos to WebP format and saves directly into local folder:
 * C:\Users\hussi\Desktop\China\AppPics
 */

import { createHighPerformanceCanvas } from './gpuAccelerator';

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: string;
}

/**
 * Compresses an image file or blob to WebP format using GPU-accelerated canvas
 */
export async function compressImageToWebP(
  fileOrBlob: File | Blob,
  options: CompressionOptions = {}
): Promise<Blob> {
  const {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.85,
    mimeType = 'image/webp',
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Scale dimensions preserving aspect ratio
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
          }
        }

        const { canvas, ctx } = createHighPerformanceCanvas(width, height);
        if (!ctx) {
          resolve(fileOrBlob);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(fileOrBlob);
              return;
            }
            resolve(blob);
          },
          mimeType,
          quality
        );
      };

      img.onerror = () => resolve(fileOrBlob);
      img.src = e.target?.result as string;
    };

    reader.onerror = () => resolve(fileOrBlob);
    reader.readAsDataURL(fileOrBlob);
  });
}

/**
 * Backward compatible compression wrapper returning File
 */
export async function compressImageFile(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  const webpBlob = await compressImageToWebP(file, options);
  const cleanName = file.name.replace(/\.[^/.]+$/, '') + '.webp';
  return new File([webpBlob], cleanName, {
    type: 'image/webp',
    lastModified: Date.now(),
  });
}

/**
 * Saves an image File or Blob directly to C:\Users\hussi\Desktop\China\AppPics as WebP
 * Returns the local serving URL: /api/images/[filename].webp
 */
export async function saveImageLocally(
  fileOrBlob: File | Blob,
  itemCode = 'item'
): Promise<string | null> {
  try {
    const webpBlob = await compressImageToWebP(fileOrBlob);

    const formData = new FormData();
    formData.append('file', webpBlob, `${itemCode}.webp`);
    formData.append('itemCode', itemCode);

    const res = await fetch('/api/images/save', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      console.warn('Local image save returned non-200:', res.status);
      return null;
    }

    const data = await res.json();
    return data.url || null;
  } catch (err) {
    console.error('Error saving image locally:', err);
    return null;
  }
}
