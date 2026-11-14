/**
 * Receipt Image Utilities
 * Handles compression, validation, and metadata formatting for transfer receipts.
 */

export interface ProcessedReceiptImage {
  dataUrl: string;
  fileName: string;
  sizeKb: number;
  width: number;
  height: number;
}

export interface ReceiptValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates whether a receipt image data URL or file satisfies mandatory deposit constraints.
 */
export function validateReceiptImage(dataUrl?: string | null): ReceiptValidationResult {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.trim()) {
    return {
      isValid: false,
      error: 'صورة إيصال الحوالة إلزامية لتأكيد طلب شحن الرصيد.',
    };
  }

  const clean = dataUrl.trim();
  if (!clean.startsWith('data:image/')) {
    return {
      isValid: false,
      error: 'صيغة صورة الإيصال غير صحيحة، يرجى إعادة اختيار ملف صورة صالح (JPG, PNG, WebP).',
    };
  }

  return { isValid: true };
}

/**
 * Formats file size in human readable Arabic format
 */
export function formatReceiptFileSize(sizeKb: number): string {
  if (sizeKb >= 1024) {
    return `${(sizeKb / 1024).toFixed(1)} ميجابايت`;
  }
  return `${Math.round(sizeKb)} كيلوبايت`;
}

/**
 * Compresses an image File using an in-browser HTML5 Canvas.
 * Scales down large photos (e.g. from mobile cameras) while maintaining high sharpness
 * of transfer text and amounts, producing an efficient JPEG Data URL (~60KB to ~150KB).
 */
export function compressReceiptImageFile(
  file: File,
  maxDimension = 1200,
  quality = 0.82
): Promise<ProcessedReceiptImage> {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('الملف المختار ليس صورة صالحة. يرجى اختيار ملف صورة (JPG, PNG, WebP).'));
      return;
    }

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      // Non-browser fallback
      reject(new Error('ضغط الصور متاح فقط داخل متصفح الويب.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة ملف الإيصال. يرجى المحاولة مجدداً.'));

    reader.onload = (e) => {
      const resultDataUrl = e.target?.result as string;
      if (!resultDataUrl) {
        reject(new Error('بيانات الصورة فارغة.'));
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error('تعذر معالجة أبعاد الصورة.'));
      img.onload = () => {
        let { width, height } = img;

        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // If canvas context fails, fallback to direct data URL
          const sizeKb = Math.round((resultDataUrl.length * 3) / 4 / 1024);
          resolve({
            dataUrl: resultDataUrl,
            fileName: file.name,
            sizeKb,
            width: img.width,
            height: img.height,
          });
          return;
        }

        // Draw image onto canvas
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        const approxSizeKb = Math.round((compressedDataUrl.length * 3) / 4 / 1024);

        resolve({
          dataUrl: compressedDataUrl,
          fileName: file.name,
          sizeKb: approxSizeKb,
          width,
          height,
        });
      };

      img.src = resultDataUrl;
    };

    reader.readAsDataURL(file);
  });
}
