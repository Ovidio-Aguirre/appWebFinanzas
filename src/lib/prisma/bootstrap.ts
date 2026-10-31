import { prisma } from "@/lib/prisma";

/**
 * Usuario único de la app. Configurable por variable de entorno para no
 * dejar el email hardcodeado. Para un despliegue real, reemplazar todo el
 * mecanismo de usuario fijo por una sesión real (Auth.js / Clerk), ver
 * `requireUser()` en `src/lib/auth.ts`.
 */
export const DEFAULT_USER_EMAIL =
  process.env.SINGLE_USER_EMAIL ?? "usuario@finanzapro.app";

/**
 * Garantiza que exista un usuario base en la base de datos.
 * No crea ningún dato financiero de ejemplo: cuentas, categorías,
 * transacciones, préstamos, suscripciones o bóvedas. El usuario comienza
 * con una hoja en blanco y registra su propia información desde la app.
 */
export async function ensureUserExists() {
  const existingUser = await prisma.user.findUnique({
    where: { email: DEFAULT_USER_EMAIL },
  });

  if (existingUser) {
    return existingUser;
  }

  return prisma.user.create({
    data: {
      email: DEFAULT_USER_EMAIL,
      name: "Usuario",
      preferredCurrency: "USD",
      locale: "es-MX",
    },
  });
}

/**
 * Mantener alias para compatibilidad con código existente.
 * Se delega a ensureUserExists sin crear datos de demostración.
 */
export const ensureDemoWorkspaceSeeded = ensureUserExists;
