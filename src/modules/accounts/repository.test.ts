import { describe, it, expect } from "vitest";
import { calculateNetWorthBreakdown } from "./repository";
import type { SerializedAccount } from "./schemas";

function makeAccount(
  type: SerializedAccount["type"],
  currentBalance: number,
  creditLimit: number | null = null
): SerializedAccount {
  return {
    id: `acc-${type}`,
    userId: "user",
    name: type,
    institution: null,
    type,
    currency: "USD",
    currentBalance,
    color: null,
    lastFourDigits: null,
    creditLimit,
    cutoffDay: null,
    paymentDueDay: null,
    interestRate: null,
    noInterestPayment: null,
    minimumPayment: null,
    originalPrincipal: null,
    termMonths: null,
  };
}

describe("calculateNetWorthBreakdown", () => {
  it("calcula activos líquidos y patrimonio real", () => {
    const accounts = [
      makeAccount("CASH", 100),
      makeAccount("DEBIT", 200),
      makeAccount("SAVINGS_VAULT", 300),
      makeAccount("CREDIT_CARD", 50, 1000),
      makeAccount("LOAN_LIABILITY", 150),
    ];

    const r = calculateNetWorthBreakdown(accounts);

    expect(r.cashTotal).toBe(100);
    expect(r.debitTotal).toBe(200);
    expect(r.savingsVaultTotal).toBe(300);
    expect(r.liquidAssetsTotal).toBe(600);
    expect(r.creditCardDebtTotal).toBe(50);
    expect(r.loanLiabilityTotal).toBe(150);
    expect(r.totalLiabilities).toBe(200);
    expect(r.realLiquidNetWorth).toBe(400);
  });

  it("suma la línea de crédito de las tarjetas", () => {
    const accounts = [
      makeAccount("CREDIT_CARD", 100, 500),
      makeAccount("CREDIT_CARD", 50, 300),
    ];
    const r = calculateNetWorthBreakdown(accounts);
    expect(r.totalCreditLimit).toBe(800);
  });
});
