import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
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

    const ext = file.type === "image/webp" ? "webp" : "jpg";
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
    console.error("[Receipt Upload Error]:", error);
    return NextResponse.json(
      { error: "Error interno al almacenar el comprobante." },
      { status: 500 }
    );
  }
}
