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

export function formatShortDate(dateInput: string | Date): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
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
  const safeDay = Math.min(Math.max(targetDay ?? 1, 1), 28);
  const today = startOfDay(referenceDate);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  let candidate = new Date(currentYear, currentMonth, safeDay);
  if (candidate < today) {
    candidate = new Date(currentYear, currentMonth + 1, safeDay);
  }

  const daysRemaining = differenceInCalendarDays(candidate, today);
  return { daysRemaining, nextDate: candidate };
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
