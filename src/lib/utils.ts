import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { addWeeks, addMonths, addYears, differenceInCalendarDays, startOfDay } from "date-fns";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number,
  currency = "USD",
  locale = "es-MX"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Las fechas "de calendario" (vencimientos, fechas de movimiento) se guardan como
 * medianoche UTC. Mostrarlas con la zona local las corre un día atrás (UTC-6).
 * Esta función devuelve un Date local con el MISMO día de calendario guardado.
 * Los instantes con hora real (no medianoche UTC) se dejan tal cual.
 */
export function calendarDate(dateInput: string | Date): Date {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  ) {
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  return d;
}

/** Fecha de hoy en formato YYYY-MM-DD según la zona horaria LOCAL (no UTC). */
export function todayLocalIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatShortDate(dateInput: string | Date): string {
  const date = calendarDate(dateInput);
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Calcula cuántos días faltan desde hoy hasta la próxima ocurrencia de un día del mes (1-31),
 * ideal para Fecha de Corte (cutoffDay) y Fecha Límite de Pago (paymentDueDay).
 */
export function getDaysUntilDayOfMonth(
  targetDay: number | null | undefined,
  referenceDate: Date = new Date()
): { daysRemaining: number; nextDate: Date } {
  const day = Math.min(Math.max(targetDay ?? 1, 1), 31);
  const today = startOfDay(referenceDate);
  const nextDate = nextOccurrenceOfDay(day, today);
  const daysRemaining = differenceInCalendarDays(nextDate, today);
  return { daysRemaining, nextDate };
}

/**
 * Devuelve la próxima ocurrencia de un día del mes (1-31) a partir de `from`.
 * Si el mes no tiene ese día (p. ej. 31 en febrero), devuelve el último día del mes.
 */
function nextOccurrenceOfDay(day: number, from: Date): Date {
  const year = from.getFullYear();
  const month = from.getMonth();

  let candidate = new Date(year, month, day);
  if (candidate.getDate() < day) {
    // El mes no tiene ese día → último día del mes actual.
    candidate = new Date(year, month + 1, 0);
  }

  if (candidate < from) {
    // Ya pasó → intentar el mes siguiente.
    candidate = new Date(year, month + 1, day);
    if (candidate.getDate() < day) {
      candidate = new Date(year, month + 2, 0);
    }
  }

  return candidate;
}

/**
 * Calcula la siguiente fecha de ejecución para reglas recurrentes
 */
export function calculateNextExecutionDate(
  currentDate: Date,
  frequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "YEARLY"
): Date {
  switch (frequency) {
    case "WEEKLY":
      return addWeeks(currentDate, 1);
    case "BIWEEKLY":
      return addWeeks(currentDate, 2);
    case "MONTHLY":
      return addMonths(currentDate, 1);
    case "YEARLY":
      return addYears(currentDate, 1);
  }
}

/**
 * Avanza una fecha de regla recurrente un periodo, en UTC y anclada al día
 * original (p. ej. ancla 31 = "fin de mes": 28/29 feb, 30 abr, 31 may…),
 * evitando el desplazamiento acumulado de addMonths (31→30→30…).
 */
export function advanceRecurringDate(
  date: Date,
  frequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "YEARLY",
  anchorDay: number = date.getUTCDate()
): Date {
  if (frequency === "WEEKLY" || frequency === "BIWEEKLY") {
    const days = frequency === "WEEKLY" ? 7 : 14;
    return new Date(date.getTime() + days * 86_400_000);
  }
  const monthsToAdd = frequency === "MONTHLY" ? 1 : 12;
  const targetMonth = date.getUTCMonth() + monthsToAdd;
  const year = date.getUTCFullYear() + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(anchorDay, daysInMonth),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds()
    )
  );
}

export interface AmortizationRow {
  installmentNumber: number;
  totalInstallments: number;
  amount: number;
  capitalAmount: number;
  interestAmount: number;
  remainingBalance: number;
  dueDate: Date;
}

/**
 * Genera una tabla de amortización francesa (cuota fija) para préstamos a plazo fijo
 */
export function generateAmortizationSchedule(params: {
  principal: number;
  annualInterestRate: number;
  termMonths: number;
  firstDueDate: Date;
}): AmortizationRow[] {
  const { principal, annualInterestRate, termMonths, firstDueDate } = params;
  const monthlyRate = annualInterestRate / 100 / 12;

  const fixedPayment =
    monthlyRate > 0
      ? (principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths))) /
        (Math.pow(1 + monthlyRate, termMonths) - 1)
      : principal / termMonths;

  let balance = principal;
  const schedule: AmortizationRow[] = [];

  for (let i = 1; i <= termMonths; i++) {
    const interest = balance * monthlyRate;
    let capital = fixedPayment - interest;
    if (i === termMonths) {
      capital = balance;
    }
    const installmentAmount = Number((capital + interest).toFixed(2));
    balance = Math.max(0, Number((balance - capital).toFixed(2)));

    schedule.push({
      installmentNumber: i,
      totalInstallments: termMonths,
      amount: installmentAmount,
      capitalAmount: Number(capital.toFixed(2)),
      interestAmount: Number(interest.toFixed(2)),
      remainingBalance: balance,
      dueDate: addMonths(firstDueDate, i - 1),
    });
  }

  return schedule;
}
