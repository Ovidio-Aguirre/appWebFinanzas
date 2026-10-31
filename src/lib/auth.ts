import { cookies } from "next/headers";
import { ensureUserExists } from "@/lib/prisma/bootstrap";
import { DomainError } from "@/lib/errors";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/**
 * Usuario autenticado de la operación actual.
 * Login de usuario único (AUTH_USERNAME / AUTH_PASSWORD_HASH) con cookie
 * httpOnly firmada. Es el ÚNICO punto por el que pasa la identidad.
 * Lanza DomainError("No autorizado") si no hay sesión válida.
 */
export async function requireUser() {
  const store = await cookies();
  const username = await verifySessionToken(
    store.get(SESSION_COOKIE)?.value,
    process.env.AUTH_SECRET
  );
  if (!username) {
    throw new DomainError("No autorizado. Inicia sesión.");
  }
  return ensureUserExists();
}
