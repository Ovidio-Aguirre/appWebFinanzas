import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireUser } from "@/lib/auth";

/**
 * Sirve los comprobantes subidos. Next en modo "standalone" no sirve archivos
 * que aparecen en /public después del build, por eso se leen desde disco aquí.
 * El middleware ya exige sesión; requireUser() es una segunda barrera.
 */
const NAME_RE = /^receipt-\d+-[a-f0-9]{8}\.(webp|jpg|png)$/;
const MIME: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  png: "image/png",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
): Promise<NextResponse> {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { name } = await params;
  if (!NAME_RE.test(name)) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  try {
    const file = await readFile(
      path.join(process.cwd(), "public", "uploads", "receipts", name)
    );
    const ext = name.split(".").pop() as string;
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
}
