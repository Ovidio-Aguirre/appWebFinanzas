import { describe, it, expect } from "vitest";
import {
  getDaysUntilDayOfMonth,
  generateAmortizationSchedule,
} from "./utils";

describe("getDaysUntilDayOfMonth", () => {
  it("devuelve el mismo día del mes si aún no ha pasado", () => {
    // 10 de enero → próximo 15 de enero (5 días)
    const r = getDaysUntilDayOfMonth(15, new Date(2026, 0, 10));
    expect(r.daysRemaining).toBe(5);
    expect(r.nextDate.getDate()).toBe(15);
    expect(r.nextDate.getMonth()).toBe(0);
  });

  it("devuelve el día del mes siguiente si ya pasó", () => {
    // 20 de enero → próximo 15 de febrero
    const r = getDaysUntilDayOfMonth(15, new Date(2026, 0, 20));
    expect(r.nextDate.getMonth()).toBe(1);
    expect(r.nextDate.getDate()).toBe(15);
  });

  it("soporta cortes el día 30 y 31 en meses que no los tienen", () => {
    // Abril tiene 30 días. Corte el 31 → debe caer el 30 de abril.
    const r31 = getDaysUntilDayOfMonth(31, new Date(2026, 3, 10));
    expect(r31.nextDate.getDate()).toBe(30);
    expect(r31.nextDate.getMonth()).toBe(3);
  });

  it("soporta febrero (mes de 28 días) con corte 29-31", () => {
    // Febrero 2026 tiene 28 días. Corte el 30 → debe caer el 28 de febrero.
    const r = getDaysUntilDayOfMonth(30, new Date(2026, 1, 10));
    expect(r.nextDate.getDate()).toBe(28);
    expect(r.nextDate.getMonth()).toBe(1);
  });
});

describe("generateAmortizationSchedule", () => {
  it("genera una tabla de amortización francesa correcta", () => {
    const schedule = generateAmortizationSchedule({
      principal: 600,
      annualInterestRate: 24.46,
      termMonths: 60,
      firstDueDate: new Date(2026, 10, 17),
    });

    expect(schedule).toHaveLength(60);

    // La cuota fija debe ser ≈ $17.42 (con tolerancia de centavos).
    expect(schedule[0]!.amount).toBeCloseTo(17.42, 1);

    // La suma de capitales debe devolver el principal.
    const totalCapital = schedule.reduce((acc, r) => acc + r.capitalAmount, 0);
    expect(totalCapital).toBeCloseTo(600, 1);

    // El saldo final debe ser 0.
    expect(schedule[59]!.remainingBalance).toBe(0);
  });

  it("con tasa 0 divide el principal en cuotas iguales", () => {
    const schedule = generateAmortizationSchedule({
      principal: 1200,
      annualInterestRate: 0,
      termMonths: 12,
      firstDueDate: new Date(2026, 0, 1),
    });
    expect(schedule).toHaveLength(12);
    expect(schedule[0]!.amount).toBeCloseTo(100, 2);
  });
});
