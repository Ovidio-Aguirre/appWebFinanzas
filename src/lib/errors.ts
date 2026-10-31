/**
 * Errores de dominio: mensajes seguros para mostrar al usuario.
 * Los errores inesperados (infraestructura, Prisma, etc.) NO deben
 * exponerse al cliente; se loguean y se devuelve un mensaje genérico.
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

/**
 * Convierte un error desconocido en un mensaje seguro para el usuario.
 * - DomainError → devuelve su mensaje (es información de negocio).
 * - Cualquier otro → loguea en servidor y devuelve el fallback genérico.
 */
export function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof DomainError) {
    return error.message;
  }
  console.error("[unhandled]", error);
  return fallback;
}
