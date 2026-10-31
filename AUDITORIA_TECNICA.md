# INFORME DE AUDITORÍA TÉCNICA — FinanzaPro PWA (`WebFinanzas`)

> Fecha: 2026-10-31 · Modo: solo lectura (no se modificó ningún archivo del código).
> Alcance: ~7.100 líneas de `src/` y `prisma/`, configuración y historial de git.
> No se ejecutó la app: las afirmaciones sobre comportamiento en runtime están marcadas como "verificar".

---

## 1. Executive Summary & Domain Map

### Fase 1 — Descubrimiento

**Propósito y dominio.** App personal de finanzas en PWA. Registra cuentas (efectivo, débito, tarjeta de crédito, préstamo, bóveda de ahorro) y movimientos con tickets fotográficos. Maneja compras a meses sin intereses (MSI), suscripciones e ingresos recurrentes, préstamos con amortización francesa, metas de ahorro y un dashboard de patrimonio líquido y flujo de caja. Hoy es **un solo usuario** hardcodeado como `usuario@finanzapro.app` (`src/lib/prisma/bootstrap.ts:3`). Flujo principal: *captura rápida → `recordTransactionACID` → actualización de saldos*.

**Stack y patrones.**
- Next.js 15 (App Router), React 19, TypeScript estricto (`strict` + `noUncheckedIndexedAccess`), Tailwind, Radix.
- Prisma 6 sobre PostgreSQL 16 (Docker), Zod, react-hook-form, `@ducanh2912/next-pwa`.
- Monolito modular por feature (`src/modules/*` con `schemas`, `repository`, `components`).
- API = **Server Actions** en un único archivo (`finance.actions.ts`) + API Route `/api/upload`.
- No hay capa de servicios de dominio: los repositorios contienen la lógica de negocio.

**Superficie de riesgo (flujos catastróficos).**
1. Mutaciones de saldo (`recordTransactionACID`, pago de cuota, aporte a ahorro, ejecución recurrente).
2. Exposición de datos financieros: sin autenticación; las server actions son endpoints públicos.
3. `/api/upload`: escritura de archivos sin autenticación en un directorio servido públicamente.
4. Concurrencia sobre saldos (lecturas y escrituras no atómicas).
5. Integridad contable por tipo de cuenta (pagos y transferencias que invierten el signo del pasivo).

**Veredicto ejecutivo.** Diseño modular limpio y tipado disciplinado: sirve como prototipo local de un solo usuario. **No es desplegable a internet tal como está**: sin autenticación/autorización, con fallas de integridad contable y concurrencia, sin tests y sin observabilidad.

---

## 2. Matriz de Hallazgos Críticos

| Severidad | Archivo y línea | Problema detectado | Riesgo real de negocio |
| :--- | :--- | :--- | :--- |
| **Crítico** | `finance.actions.ts:1,102`; `bootstrap.ts:3,11` | Sin autenticación. Todo corre como un usuario fijo. `"use server"` expone **todas** las funciones exportadas como endpoints públicos, incluida `getFinancialWorkspaceData`. | Si se despliega, cualquiera con la URL lee y modifica todas las finanzas. |
| **Crítico** | `transactions/repository.ts:220-249` | `CARD_PAYMENT`/`LOAN_PAYMENT` usan `Math.max(0, deuda - monto)` y descuentan el monto completo al origen. No validan el tipo del destino ni limitan el pago a la deuda. | El sobrante desaparece (se debita sin reducir deuda). Se puede "pagar" una cuenta CASH. Patrimonio corrupto. |
| **Crítico** | `transactions/repository.ts:250-278` | `TRANSFER` no valida tipos de cuenta. Transferir a una tarjeta **suma** deuda; desde una tarjeta compara deuda contra monto. | Saldos que no reflejan la realidad; puede inflar el patrimonio. |
| **Alto** | `transactions/repository.ts:154-195,214,255`; `loans/repository.ts:162,172-188`; `savings/repository.ts:126,164-173` | *Read-check-write* sin bloqueo, con escrituras de valor absoluto (`currentBalance: updatedDebt`, `currentAmount: newCurrent`). Aislamiento READ COMMITTED. | Sobregiro, actualizaciones perdidas y saldos incorrectos con operaciones simultáneas. |
| **Alto** | `transactions/repository.ts:282-296` | `msiTransactionId` se consulta con `findUnique({id})` **sin `userId`** y se actualiza sin validar propiedad ni que sea MSI. | IDOR: modifica transacciones ajenas / avanza cuotas de cualquier transacción. |
| **Alto** | `subscriptions/repository.ts:49-63,100-150` | `createRecurringRuleInDb` no valida que `accountId`/`categoryId` pertenezcan al usuario; luego `execute…` mueve el saldo de esa cuenta. | IDOR de escritura sobre saldos ajenos en escenario multiusuario. |
| **Alto** | `subscriptions/repository.ts:100-186` | `executeRecurringRuleACID` no es idempotente (sin lock ni check de `nextExecutionDate`). | Doble clic o reintento duplica nómina o cargo. |
| **Alto** | `savings/repository.ts:143-161` | Si la meta no tiene `vaultAccountId` y no existe otra bóveda, se debita el origen y **no se acredita nada**, pero se crea la transacción. | El dinero desaparece silenciosamente. |
| **Alto** | `api/upload/route.ts:6-79` | Sin autenticación ni rate limit. Confía en `file.type` (controlado por el cliente). No valida contenido (magic bytes). Escribe en `public/`. | Abuso de disco/DoS y subida de archivos arbitrarios renombrados `.jpg`. |
| **Alto** | `docker-compose.yml:12-13`, `.env.example:2` | Postgres publica `5442` en **todas las interfaces** con contraseña `webfinanzas_secret_2026` versionada. | Cualquier host de la LAN accede a la BD; probable reutilización en producción. |
| **Alto** | todo `src/` | **Cero tests**, sin framework ni CI. | Cualquier cambio puede introducir regresiones silenciosas en saldos. |
| **Medio** | `finance.actions.ts` (todos los `catch`) | Devuelve `error.message` crudo al cliente (incl. errores de Prisma). No loguea nada en servidor. | Fuga de detalles internos y fallos invisibles en producción. |
| **Medio** | `schemas.ts` (todos), `repository.ts` | Montos con `z.coerce.number().positive()` sin `.finite()`, tope ni 2 decimales; fechas `z.string().min(1)`; `receiptUrl` acepta cualquier string. | `Infinity`, `1e20` o fechas inválidas llegan a Prisma y revientan con errores crudos; riesgo de redondeo. |
| **Medio** | dominio monetario | Dinero como `number` JS (`toNumber`); `Decimal` solo en almacenamiento; amortización con flotantes. | Deriva de centavos y errores de redondeo acumulados. |
| **Medio** | `loans/repository.ts:201-214`; `savings/repository.ts:177-189` | `category.findFirst({ where: { type } })` toma **cualquier** categoría de ese tipo; `Category` es global (sin `userId`). | Clasificación al azar y fuga de categorías entre usuarios. |
| **Medio** | `loans/repository.ts:144-150`; `transactions/repository.ts` (LOAN_PAYMENT) | `LOAN_PAYMENT` de la captura rápida reduce deuda **sin tocar `LoanInstallment`**. | Tabla de amortización y saldo del pasivo desincronizados. |
| **Medio** | `transactions/repository.ts:66-82`; `finance.actions.ts:109` | Flujo de caja calculado sobre solo las últimas 100 transacciones y luego filtrado por mes. | Totales del mes incompletos con más de 100 movimientos. |
| **Medio** | `utils.ts:41` | `getDaysUntilDayOfMonth` limita el día a 28. | Cortes del 29 al 31 muestran fechas/alertas erróneas. |
| **Medio** | `next.config.mjs:17-20,24` | `remotePatterns` con `hostname: "**"` (proxy de imágenes), `bodySizeLimit: 8mb` innecesario, sin cabeceras de seguridad ni CSP. | Superficie de abuso (SSRF/proxy) y sin defensa en profundidad. |
| **Medio** | `public/sw-offline.js` (~38-55) | El Service Worker cachea con stale-while-revalidate todos los GET del mismo origen, incl. `/` con datos financieros. | Datos persistentes en dispositivo compartido y servidos obsoletos. |
| **Medio** | `schema.prisma` + `prisma/` | Sin carpeta `migrations/` (se usa `db push`); sin `CHECK` de saldos. | Esquema no reproducible ni auditable; nada impide saldos negativos en BD. |
| **Medio** | `PROJECT_MEMORY.md` vs. código | `autoPost` no tiene scheduler; `s3`/`cloudinary` documentados pero no implementados. | Funcionalidad prometida que no existe. |
| **Bajo** | `schema.prisma` (~64,70) | `@@index([email])` redundante con `@unique`; `@@index([date])` cubierto por otros. | Costo de escritura extra, menor. |
| **Bajo** | `public/sw.js`, `swe-worker-*.js` | Artefactos generados por next-pwa versionados (solo se ignoran `workbox-*`). | Ruido y conflictos de merge. |
| **Bajo** | `package.json` (`lint`) | `next lint` sin config de ESLint. | El script falla o pide configuración interactiva. |
| **Bajo** | `finance.actions.ts:159` | `const user` sin usar en `createCategoryAction`. | Código muerto. |

---

## 3. Desglose Técnico de Hallazgos Críticos y Altos

### C1. Sin autenticación ni autorización (Crítico)
**Problema.** Cada acción llama a `ensureUserExists()`, que devuelve siempre el mismo usuario por email fijo. El archivo tiene `"use server"`, así que todas sus exportaciones son invocables por POST desde cualquier cliente. La propiedad del recurso se filtra por `userId`, pero ese `userId` es siempre el mismo: el control es nominal.

```ts
// bootstrap.ts
export const DEFAULT_USER_EMAIL = "usuario@finanzapro.app";
export async function ensureUserExists() {
  const existingUser = await prisma.user.findUnique({ where: { email: DEFAULT_USER_EMAIL } });
```
**Corrección conceptual.**
```ts
// Antes del despliegue: sesión real (Auth.js / Clerk / Sign in with Vercel)
export async function requireUser() {
  const session = await auth();                 // lee cookie firmada
  if (!session?.user?.id) throw new UnauthorizedError();
  return session.user;                          // id real, no email fijo
}
// Mover lecturas a un módulo sin "use server" (getFinancialWorkspaceData
// no debería ser endpoint callable salvo que pase por requireUser()).
```

### C2. Pagos de deuda con dinero que desaparece y destino sin validar (Crítico)
**Problema.** El pago resta `amount` completo del origen, pero la deuda se recorta con `Math.max(0, …)`. Pagar $500 sobre una deuda de $300 debita $500 y deja la deuda en 0: se pierden $200. No se verifica que el destino sea `CREDIT_CARD` o `LOAN_LIABILITY`. Además `currentBalance: updatedDebt` escribe un valor calculado en JS, no un decremento.

```ts
const updatedDebt = Math.max(0, currentDebt - amount);
await tx.account.update({ where: { id: originAccount.id }, data: { currentBalance: { decrement: amount } } });
await tx.account.update({ where: { id: destinationAccount.id }, data: { currentBalance: updatedDebt, ... } });
```
**Corrección conceptual.**
```ts
if (!["CREDIT_CARD", "LOAN_LIABILITY"].includes(destination.type)) throw new DomainError("Destino inválido");
const applied = Decimal.min(amount, destination.currentBalance);   // o rechazar sobrepago
await tx.account.update({ where: { id: origin.id },      data: { currentBalance: { decrement: applied } } });
await tx.account.update({ where: { id: destination.id }, data: { currentBalance: { decrement: applied } } });
// registrar `applied` como monto de la transacción
```

### C3. `TRANSFER` ignora la semántica activo/pasivo (Crítico)
**Problema.** El saldo de una tarjeta o préstamo es **deuda** (positiva). `TRANSFER` aplica `decrement` al origen e `increment` al destino sin mirar el tipo: transferir $100 a una tarjeta aumenta su deuda en $100. Como origen, una tarjeta con deuda de $50 no puede transferir $60 aunque tenga línea disponible.

**Corrección conceptual.** Restringir `TRANSFER` a activos y canalizar pagos de pasivo por la ruta de C2.
```ts
const ASSET = new Set(["CASH", "DEBIT", "SAVINGS_VAULT"]);
if (!ASSET.has(origin.type) || !ASSET.has(destination.type)) throw new DomainError("Transferencia solo entre activos");
```

### A1. Condiciones de carrera en saldos (Alto)
**Problema.** El saldo se lee, se compara en memoria y se escribe. Dos requests concurrentes (dos taps, un reintento de la PWA) leen el mismo saldo y ambos pasan la validación. En `payLoanInstallmentACID`, `updatedLoanDebt` se calcula con el valor leído y se escribe como absoluto, así que un pago concurrente se pisa. Para la doble cuota hay un amortiguador (`loanInstallmentId @unique` hace fallar el segundo `create`), pero el usuario ve un mensaje crudo de Prisma. El resto de flujos no tiene protección.

```ts
if (originBalance < amount) throw new Error("Saldo insuficiente…");   // check sobre dato potencialmente viejo
await tx.account.update({ where: { id }, data: { currentBalance: { decrement: amount } } });
```
**Corrección conceptual.**
```ts
const r = await tx.account.updateMany({
  where: { id: origin.id, userId, currentBalance: { gte: amount } },   // condición en la propia UPDATE
  data:  { currentBalance: { decrement: amount } },
});
if (r.count === 0) throw new DomainError("Saldo insuficiente");
// o bien: SELECT … FOR UPDATE vía $queryRaw, o isolationLevel: "Serializable" con reintentos
```
Aplica igual a `savings` (`currentAmount: { increment }`) y a `noInterestPayment` (usa `current + x` en JS).

### A2. IDOR en MSI y reglas recurrentes (Alto)
**Problema.** `msiTransactionId` y los IDs de cuenta/categoría de una regla recurrente llegan del cliente sin validarse contra el usuario.

```ts
const msiTx = await tx.transaction.findUnique({ where: { id: input.msiTransactionId } }); // sin userId
```
**Corrección conceptual.**
```ts
const msiTx = await tx.transaction.findFirst({
  where: { id: input.msiTransactionId, userId, installmentsCount: { gt: 1 } },
});
if (!msiTx) throw new DomainError("Compra MSI no válida");
// En createRecurringRuleInDb: verificar account.findFirst({id, userId}) y que la categoría exista.
```

### A3. Ejecución recurrente no idempotente (Alto)
**Problema.** Cada llamada ejecuta la regla sin comprobar que ya toca. Un doble clic duplica cargo o ingreso.

**Corrección conceptual.**
```ts
const claimed = await tx.recurringRule.updateMany({
  where: { id: ruleId, userId, active: true, nextExecutionDate: rule.nextExecutionDate }, // optimistic lock
  data:  { nextExecutionDate: next, lastExecutedDate: now },
});
if (claimed.count === 0) throw new DomainError("La regla ya fue ejecutada");
```
Además, `autoPost` hoy solo cambia `isReconciled`; no hay cron, por lo que el "autoregistro" no existe.

### A4. Aporte a bóveda sin cuenta destino (Alto)
**Problema.** Si `goal.vaultAccountId` es `null` y no hay otra bóveda, la rama no incrementa nada, pero igual se debita el origen y se crea la transacción con `destinationAccountId: null`. Tampoco se valida el estado de la meta (`CANCELLED`/`PAUSED`) ni el tipo de la cuenta de origen.

**Corrección conceptual.**
```ts
if (!goal.vaultAccountId) throw new DomainError("La meta no tiene bóveda asociada");
if (goal.status !== "ACTIVE") throw new DomainError("Meta no disponible");
```

### A5. `/api/upload` sin control (Alto)
**Problema.** Sin autenticación ni rate limit. `file.type` lo declara el cliente y el contenido nunca se inspecciona. El archivo cae en `public/`. Si el upload a Supabase falla, hace fallback silencioso a disco; en filesystems de solo lectura (serverless) devuelve 500. En `next start`, los archivos añadidos a `public/` tras el arranque pueden no servirse hasta reiniciar (verificar en runtime).

```ts
const ext = file.type === "image/webp" ? "webp" : "jpg";   // tipo declarado por el cliente
await writeFile(filePath, buffer);
```
**Corrección conceptual.**
```ts
await requireUser();
const head = buffer.subarray(0, 12);
if (!isWebp(head) && !isJpeg(head) && !isPng(head)) return 415;
// Rate limit por usuario; guardar fuera de /public (o bucket privado con URLs firmadas)
// y sin fallback silencioso: si el provider falla, responder 502.
```
Los recibos financieros no deberían estar en un bucket público; el código usa `/object/public/…`.

### A6. Postgres expuesto con credenciales conocidas (Alto)
```yaml
ports: - "5442:5432"
POSTGRES_PASSWORD: webfinanzas_secret_2026   # también en .env.example, versionado
```
**Corrección conceptual.**
```yaml
ports: ["127.0.0.1:5442:5432"]
environment:
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?define en .env}   # sin default versionado
```

### A7. Cero tests (Alto)
No hay un solo test, ni framework, ni CI. Es el riesgo que más multiplica a los demás: C2, C3, A1, A3 y A4 son bugs que un test de pocas líneas habría capturado.

---

## 4. Calificación Global (1–10)

| Pilar | Nota | Justificación breve |
| :--- | :-: | :--- |
| 1. Arquitectura y mantenibilidad | **6** | Módulos limpios y repositorios separados. Falta capa de dominio, lógica monetaria mezclada con acceso a datos, serializadores duplicados y `finance.actions.ts` de 516 líneas. |
| 2. Seguridad en profundidad | **2** | Sin autenticación, con IDOR, upload sin control, sin cabeceras/CSP, Postgres expuesto. Se salvan: secretos fuera del repo (`.env` ignorado) y Zod en los bordes. |
| 3. Calidad de código, tipado y errores | **6** | Strict TS, cero `any`/`@ts-ignore`. Penaliza el `catch` genérico con `error.message`, dinero como `number` y esquemas laxos. |
| 4. Rendimiento, concurrencia y resiliencia | **3** | Hay `$transaction` e índices razonables, pero validación de saldos no atómica; sin locks, idempotencia, timeouts ni rate limiting. |
| 5. Observabilidad y logging | **1** | Un solo `console.error` en upload; server actions sin logs, sin request IDs. |
| 6. Idoneidad tecnológica y buenas prácticas | **6** | Stack moderno y apropiado. Penaliza `db push` sin migraciones, artefactos generados versionados, `lint` sin config y proveedores sin implementar. |
| 7. Estrategia de pruebas | **1** | No existe ninguna. |
| 8. Entorno y despliegue | **3** | Sin validación de env al arrancar, sin Dockerfile de la app, sin CI; compose útil en local pero inseguro. |

**Calificación global ponderada: ≈ 3.5 / 10** como producto desplegable. Como prototipo local de un solo usuario sube a ≈ 5.5.

---

## 5. Plan de Remediación Priorizado

**Fase 0 — Bloqueantes antes de cualquier despliegue**
1. Implementar autenticación (sesión real) y un `requireUser()` en cada acción y ruta; dejar de exportar lecturas sensibles desde un archivo `"use server"` sin ese guard (C1).
2. Enlazar Postgres a `127.0.0.1`, rotar la contraseña y sacarla del repo con variables de entorno obligatorias (A6). Si se usó en otro lugar, tratarla como comprometida.

**Fase 1 — Integridad contable (antes de confiar en los números)**
3. Capa de dominio de dinero: `Decimal` en lugar de `number`, con una función por tipo de movimiento y reglas de signo activo/pasivo (C2, C3).
4. Validaciones de saldo como `updateMany` condicional o `FOR UPDATE`, usando siempre `increment`/`decrement`, nunca escrituras absolutas (A1).
5. Cerrar los IDOR validando propiedad de `msiTransactionId`, `accountId` y `categoryId` (A2).
6. Idempotencia en la ejecución recurrente con bloqueo optimista; definir qué hace `autoPost` realmente (cron/worker) o retirar la opción (A3).
7. Corregir el flujo de ahorro (A4) y la categoría arbitraria por `findFirst` (usar categorías por clave); unificar `LOAN_PAYMENT` con las cuotas.
8. `CHECK (currentBalance >= 0)` para activos y adoptar `prisma migrate` con carpeta `migrations/`.

**Fase 2 — Endurecimiento de bordes**
9. Endurecer `/api/upload`: autenticación, magic bytes, rate limit, almacenamiento privado con URLs firmadas, sin fallback silencioso (A5).
10. Reforzar los esquemas Zod: `.finite()`, tope máximo, 2 decimales, fechas validadas, `receiptUrl` restringido a tu origen/bucket.
11. Cabeceras de seguridad y CSP en `next.config`; restringir `remotePatterns` al host de storage real y bajar `bodySizeLimit`.
12. Revisar el Service Worker: no cachear documentos/RSC con datos privados y vaciar caches al cerrar sesión.

**Fase 3 — Calidad operativa**
13. Logger estructurado (pino) con request ID; mapear errores de dominio a mensajes seguros y registrar los inesperados sin devolverlos al cliente.
14. Validar variables de entorno al arrancar con un esquema Zod.
15. Vitest con tests de tabla para funciones monetarias y reglas de transferencia, pago y amortización (incluidas pruebas de concurrencia contra Postgres real); CI en GitHub Actions con `tsc`, lint y tests.
16. Corregir `getDaysUntilDayOfMonth` (cortes 29–31), calcular el flujo de caja con consulta agregada por mes (no sobre 100 filas) y limpiar índices redundantes, artefactos generados y config de ESLint.

**Cierre.** Las Fases 0 y 1 son prerrequisito para guardar datos reales de otras personas. Si el uso sigue siendo una herramienta local personal, bastan los pasos 3, 4, 7 y 15 para que los números sean confiables.
