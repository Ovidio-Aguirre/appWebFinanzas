import { prisma, toNumber } from "@/lib/prisma";
import type { CreateAccountInput, SerializedAccount } from "./schemas";

export async function getAccountsByUser(
  userId: string
): Promise<SerializedAccount[]> {
  const accounts = await prisma.account.findMany({
    where: { userId, isActive: true },
    orderBy: [{ type: "asc" }, { createdAt: "asc" }],
  });

  return accounts.map((acc) => ({
    id: acc.id,
    userId: acc.userId,
    name: acc.name,
    institution: acc.institution,
    type: acc.type,
    currency: acc.currency,
    currentBalance: toNumber(acc.currentBalance),
    color: acc.color,
    lastFourDigits: acc.lastFourDigits,
    creditLimit: acc.creditLimit !== null ? toNumber(acc.creditLimit) : null,
    cutoffDay: acc.cutoffDay,
    paymentDueDay: acc.paymentDueDay,
    interestRate: acc.interestRate !== null ? toNumber(acc.interestRate) : null,
    noInterestPayment:
      acc.noInterestPayment !== null ? toNumber(acc.noInterestPayment) : null,
    minimumPayment:
      acc.minimumPayment !== null ? toNumber(acc.minimumPayment) : null,
    originalPrincipal:
      acc.originalPrincipal !== null ? toNumber(acc.originalPrincipal) : null,
    termMonths: acc.termMonths,
  }));
}

export interface NetWorthBreakdown {
  cashTotal: number;
  debitTotal: number;
  savingsVaultTotal: number;
  liquidAssetsTotal: number; // Efectivo + Débito + Bóvedas
  creditCardDebtTotal: number;
  loanLiabilityTotal: number;
  totalLiabilities: number; // Deuda Tarjetas + Préstamos
  realLiquidNetWorth: number; // (Efectivo + Débito + Bóvedas) - (Deuda Tarjetas + Préstamos)
  totalCreditLimit: number;
  overallCreditUtilizationPercent: number;
}

export function calculateNetWorthBreakdown(
  accounts: SerializedAccount[]
): NetWorthBreakdown {
  let cashTotal = 0;
  let debitTotal = 0;
  let savingsVaultTotal = 0;
  let creditCardDebtTotal = 0;
  let loanLiabilityTotal = 0;
  let totalCreditLimit = 0;

  for (const acc of accounts) {
    switch (acc.type) {
      case "CASH":
        cashTotal += acc.currentBalance;
        break;
      case "DEBIT":
        debitTotal += acc.currentBalance;
        break;
      case "SAVINGS_VAULT":
        savingsVaultTotal += acc.currentBalance;
        break;
      case "CREDIT_CARD":
        creditCardDebtTotal += acc.currentBalance;
        totalCreditLimit += acc.creditLimit ?? 0;
        break;
      case "LOAN_LIABILITY":
        loanLiabilityTotal += acc.currentBalance;
        break;
    }
  }

  const liquidAssetsTotal = cashTotal + debitTotal + savingsVaultTotal;
  const totalLiabilities = creditCardDebtTotal + loanLiabilityTotal;
  const realLiquidNetWorth = liquidAssetsTotal - totalLiabilities;
  const overallCreditUtilizationPercent =
    totalCreditLimit > 0
      ? Math.min(100, Math.round((creditCardDebtTotal / totalCreditLimit) * 100))
      : 0;

  return {
    cashTotal,
    debitTotal,
    savingsVaultTotal,
    liquidAssetsTotal,
    creditCardDebtTotal,
    loanLiabilityTotal,
    totalLiabilities,
    realLiquidNetWorth,
    totalCreditLimit,
    overallCreditUtilizationPercent,
  };
}

export async function createAccountInDb(
  userId: string,
  input: CreateAccountInput
): Promise<SerializedAccount> {
  const created = await prisma.account.create({
    data: {
      userId,
      name: input.name,
      institution: input.institution || null,
      type: input.type,
      currency: input.currency,
      currentBalance: input.currentBalance,
      color: input.color,
      lastFourDigits: input.lastFourDigits || null,
      creditLimit:
        input.type === "CREDIT_CARD" ? (input.creditLimit ?? 0) : null,
      cutoffDay: input.type === "CREDIT_CARD" ? (input.cutoffDay ?? null) : null,
      paymentDueDay:
        input.type === "CREDIT_CARD" ? (input.paymentDueDay ?? null) : null,
      interestRate:
        input.type === "CREDIT_CARD" || input.type === "LOAN_LIABILITY"
          ? (input.interestRate ?? null)
          : null,
      noInterestPayment:
        input.type === "CREDIT_CARD"
          ? (input.noInterestPayment ?? input.currentBalance)
          : null,
      minimumPayment:
        input.type === "CREDIT_CARD"
          ? (input.minimumPayment ?? Math.round(input.currentBalance * 0.1))
          : null,
    },
  });

  return {
    id: created.id,
    userId: created.userId,
    name: created.name,
    institution: created.institution,
    type: created.type,
    currency: created.currency,
    currentBalance: toNumber(created.currentBalance),
    color: created.color,
    lastFourDigits: created.lastFourDigits,
    creditLimit:
      created.creditLimit !== null ? toNumber(created.creditLimit) : null,
    cutoffDay: created.cutoffDay,
    paymentDueDay: created.paymentDueDay,
    interestRate:
      created.interestRate !== null ? toNumber(created.interestRate) : null,
    noInterestPayment:
      created.noInterestPayment !== null
        ? toNumber(created.noInterestPayment)
        : null,
    minimumPayment:
      created.minimumPayment !== null ? toNumber(created.minimumPayment) : null,
    originalPrincipal:
      created.originalPrincipal !== null
        ? toNumber(created.originalPrincipal)
        : null,
    termMonths: created.termMonths,
  };
}
