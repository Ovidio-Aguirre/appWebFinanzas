import { z } from "zod";
import { logger } from "@/lib/logger";

/**
 * Esquema de variables de entorno. Se valida al arrancar para fallar
 * rápido en producción en lugar de dejar errores silenciosos.
 */
const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL es obligatoria")
    .regex(/^postgres(ql)?:\/\//, "DATABASE_URL debe ser una URL de PostgreSQL"),
  STORAGE_PROVIDER: z
    .enum(["supabase", "s3", "cloudinary", "local"])
    .default("local"),
  SINGLE_USER_EMAIL: z.string().email().default("usuario@finanzapro.app"),
});

function loadEnv() {
  const candidate = {
    DATABASE_URL: process.env.DATABASE_URL,
    STORAGE_PROVIDER: process.env.STORAGE_PROVIDER,
    SINGLE_USER_EMAIL: process.env.SINGLE_USER_EMAIL,
  };

  const parsed = envSchema.safeParse(candidate);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Configuración de entorno inválida: ${details}`);
    }
    logger.warn("env_invalid", { details });
  }

  return {
    DATABASE_URL: process.env.DATABASE_URL ?? "",
    STORAGE_PROVIDER: (process.env.STORAGE_PROVIDER ?? "local") as
      | "supabase"
      | "s3"
      | "cloudinary"
      | "local",
    SINGLE_USER_EMAIL: process.env.SINGLE_USER_EMAIL ?? "usuario@finanzapro.app",
  };
}

export const env = loadEnv();
