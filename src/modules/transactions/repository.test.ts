import { describe, it, expect } from "vitest";
import { calculateMonthlyCashflow } from "./repository";
import type { SerializedTransaction } from "./schemas";

function makeTx(
  overrides: Partial<SerializedTransaction> &
    Pick<SerializedTransaction, "amount" | "date" | "transactionType">
): SerializedTransaction {
  return {
    id: crypto.randomUUID(),
    userId: "user",
    accountId: "acc",
    accountName: "Cuenta",
    accountType: "DEBIT",
    destinationAccountId: null,
    destinationAccountName: null,
    categoryId: overrides.categoryId ?? "cat",
    categoryName: overrides.categoryName ?? "Categoría",
    categoryIcon: "Tag",
    categoryColor: "#000",
    categoryType: "EXPENSE",
    title: "Tx",
    description: null,
    amount: overrides.amount,
    date: overrides.date,
    transactionType: overrides.transactionType,
    receiptUrl: null,
    installmentsCount: 1,
    currentInstallment: 1,
    isRecurring: false,
    isReconciled: true,
    ...overrides,
  };
}

describe("calculateMonthlyCashflow", () => {
  const ref = new Date(2026, 9, 15); // 15 de octubre de 2026

  it("suma ingresos y gastos del mes en curso", () => {
    const txs = [
      makeTx({ amount: 500, date: "2026-10-05", transactionType: "SALARY_INCOME" }),
      makeTx({ amount: 100, date: "2026-10-10", transactionType: "PURCHASE" }),
      makeTx({ amount: 50, date: "2026-10-12", transactionType: "BILL_PAYMENT" }),
    ];

    const r = calculateMonthlyCashflow(txs, ref);
    expect(r.totalIncome).toBe(500);
    expect(r.totalExpenses).toBe(150);
    expect(r.netCashflow).toBe(350);
  });

  it("ignora transacciones de otros meses", () => {
    const txs = [
      makeTx({ amount: 999, date: "2026-09-15", transactionType: "SALARY_INCOME" }),
      makeTx({ amount: 100, date: "2026-10-15", transactionType: "PURCHASE" }),
    ];

    const r = calculateMonthlyCashflow(txs, ref);
    expect(r.totalIncome).toBe(0);
    expect(r.totalExpenses).toBe(100);
  });
});
