import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { requireUser } from "@/lib/auth";
import { logger, serializeError } from "@/lib/logger";

/**
 * Detecta el tipo de imagen real a partir de sus magic bytes.
 * Devuelve la extensión ("webp" | "jpg" | "png") o null si no es una imagen permitida.
 * No se confía en el Content-Type declarado por el cliente (A5).
 */
function detectImageType(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  const b = buffer;

  // WebP: "RIFF" .... "WEBP"
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  ) {
    return "webp";
  }

  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return "jpg";
  }

  // PNG: 89 50 4E 47
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return "png";
  }

  return null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await requireUser();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No se proporcionó ningún archivo de comprobante válido." },
        { status: 400 }
      );
    }

    // Validar tamaño máximo (5 MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "El archivo excede el límite permitido de 5 MB." },
        { status: 413 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // A5: validar el contenido real con magic bytes, no el tipo declarado.
    const ext = detectImageType(buffer);
    if (!ext) {
      return NextResponse.json(
        { error: "Formato de archivo no permitido. Usa WebP, JPEG o PNG." },
        { status: 415 }
      );
    }

    const uniqueName = `receipt-${Date.now()}-${crypto
      .randomBytes(4)
      .toString("hex")}.${ext}`;

    const provider = process.env.STORAGE_PROVIDER ?? "local";

    // 1. Soporte para Supabase Storage REST API
    if (
      provider === "supabase" &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      const bucket = process.env.SUPABASE_RECEIPTS_BUCKET ?? "receipts";
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
      const uploadRes = await fetch(
        `${supabaseUrl}/storage/v1/object/${bucket}/${uniqueName}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": file.type || "image/webp",
            "x-upsert": "true",
          },
          body: buffer,
        }
      );

      if (uploadRes.ok) {
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${uniqueName}`;
        return NextResponse.json({ url: publicUrl, provider: "supabase" });
      }
    }

    // 2. Fallback / Local Storage optimizado en /public/uploads/receipts
    const uploadDir = path.join(process.cwd(), "public", "uploads", "receipts");
    await mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, uniqueName);
    await writeFile(filePath, buffer);

    return NextResponse.json({
      url: `/uploads/receipts/${uniqueName}`,
      provider: "local-vault",
    });
  } catch (error) {
    logger.error("receipt_upload_failed", { error: serializeError(error) });
    return NextResponse.json(
      { error: "Error interno al almacenar el comprobante." },
      { status: 500 }
    );
  }
}
