import { ensureUserExists } from "@/lib/prisma/bootstrap";
import { DomainError } from "@/lib/errors";

/**
 * Obtiene el usuario autenticado para una operación.
 *
 * ⚠️ ESTADO ACTUAL — prototipo local de un solo usuario:
 * Devuelve el usuario único fijo (configurable con `SINGLE_USER_EMAIL`).
 * NO existe autenticación real: las server actions son endpoints públicos.
 *
 * ⚠️ ANTES DE DESPLEGAR A INTERNET, reemplazar por una sesión real:
 *
 *   import { auth } from "@/auth"; // Auth.js / Clerk / similar
 *   export async function requireUser() {
 *     const session = await auth();
 *     if (!session?.user?.id) {
 *       throw new DomainError("No autorizado");
 *     }
 *     return session.user;
 *   }
 *
 * Mientras tanto, mantener esta función como el ÚNICO punto por el que
 * pasa la identidad, para que migrar a auth real sea un cambio localizado.
 */
export async function requireUser() {
  return ensureUserExists();
}
