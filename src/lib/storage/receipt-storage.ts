import imageCompression from "browser-image-compression";

export interface CompressedReceiptResult {
  file: File;
  originalSizeKB: number;
  compressedSizeKB: number;
  compressionRatioPercent: number;
  previewDataUrl: string;
}

/**
 * Comprime la foto de un ticket/factura en el navegador usando browser-image-compression
 * con fallback a HTML5 Canvas (WebP) antes de enviarla al bucket de Storage.
 */
export async function compressReceiptImageClient(
  sourceFile: File
): Promise<CompressedReceiptResult> {
  const originalSizeKB = Math.round((sourceFile.size / 1024) * 10) / 10;

  let compressedFile: File = sourceFile;

  try {
    const options = {
      maxSizeMB: 0.35, // ~350 KB máximo
      maxWidthOrHeight: 1400,
      useWebWorker: true,
      fileType: "image/webp",
      initialQuality: 0.82,
    };

    const blob = await imageCompression(sourceFile, options);
    const cleanName = sourceFile.name.replace(/\.[^/.]+$/, "") + ".webp";
    compressedFile = new File([blob], cleanName, {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } catch {
    // Fallback a compresión por Canvas si WebWorker no está disponible
    compressedFile = await compressWithCanvasFallback(sourceFile);
  }

  const compressedSizeKB = Math.round((compressedFile.size / 1024) * 10) / 10;
  const ratio =
    originalSizeKB > 0
      ? Math.max(
          0,
          Math.round(((originalSizeKB - compressedSizeKB) / originalSizeKB) * 100)
        )
      : 0;

  const previewDataUrl = await fileToDataUrl(compressedFile);

  return {
    file: compressedFile,
    originalSizeKB,
    compressedSizeKB,
    compressionRatioPercent: ratio,
    previewDataUrl,
  };
}

async function compressWithCanvasFallback(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDim = 1400;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const cleanName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
          resolve(
            new File([blob], cleanName, {
              type: "image/webp",
              lastModified: Date.now(),
            })
          );
        },
        "image/webp",
        0.8
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Sube la imagen comprimida al endpoint de almacenamiento (/api/upload)
 * que soporta Supabase Storage, S3/MinIO, Cloudinary o almacenamiento local optimizado.
 */
export async function uploadCompressedReceipt(file: File): Promise<{
  url: string;
  provider: string;
}> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(
      errorData.error ?? "No se pudo subir el comprobante al almacenamiento"
    );
  }

  return (await response.json()) as { url: string; provider: string };
}
