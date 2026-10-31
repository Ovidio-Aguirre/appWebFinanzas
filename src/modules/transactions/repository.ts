import { prisma, toNumber } from "@/lib/prisma";
import { startOfMonth, endOfMonth } from "date-fns";
import type {
  QuickCaptureTransactionInput,
  SerializedTransaction,
} from "./schemas";

export async function getTransactionsByUser(
  userId: string,
  limit = 60
): Promise<SerializedTransaction[]> {
  const rows = await prisma.transaction.findMany({
    where: { userId },
    include: {
      account: { select: { name: true, type: true } },
      destinationAccount: { select: { name: true } },
      category: {
        select: { name: true, icon: true, color: true, type: true },
      },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: limit,
  });

  return rows.map((tx) => ({
    id: tx.id,
    userId: tx.userId,
    accountId: tx.accountId,
    accountName: tx.account.name,
    accountType: tx.account.type,
    destinationAccountId: tx.destinationAccountId,
    destinationAccountName: tx.destinationAccount?.name ?? null,
    categoryId: tx.categoryId,
    categoryName: tx.category.name,
    categoryIcon: tx.category.icon,
    categoryColor: tx.category.color,
    categoryType: tx.category.type,
    title: tx.title,
    description: tx.description,
    amount: toNumber(tx.amount),
    date: tx.date.toISOString(),
    transactionType: tx.transactionType,
    receiptUrl: tx.receiptUrl,
    installmentsCount: tx.installmentsCount ?? 1,
    currentInstallment: tx.currentInstallment ?? 1,
    isRecurring: tx.isRecurring,
    isReconciled: tx.isReconciled,
  }));
}

export interface MonthlyCashflowSummary {
  totalIncome: number;
  totalExpenses: number;
  netCashflow: number;
  savingsRatePercent: number;
  categoryBreakdown: Array<{
    categoryId: string;
    name: string;
    color: string;
    icon: string;
    amount: number;
    percentage: number;
  }>;
}

export function calculateMonthlyCashflow(
  transactions: SerializedTransaction[],
  referenceDate: Date = new Date()
): MonthlyCashflowSummary {
  const start = startOfMonth(referenceDate);
  const end = endOfMonth(referenceDate);

  let totalIncome = 0;
  let totalExpenses = 0;
  const categoryMap = new Map<
    string,
    { name: string; color: string; icon: string; amount: number }
  >();

  for (const tx of transactions) {
    const txDate = new Date(tx.date);
    if (txDate < start || txDate > end) continue;

    if (
      tx.transactionType === "SALARY_INCOME" ||
      tx.transactionType === "REMITTANCE_INCOME"
    ) {
      totalIncome += tx.amount;
    } else if (
      tx.transactionType === "PURCHASE" ||
      tx.transactionType === "BILL_PAYMENT"
    ) {
      totalExpenses += tx.amount;
      const existing = categoryMap.get(tx.categoryId);
      if (existing) {
        existing.amount += tx.amount;
      } else {
        categoryMap.set(tx.categoryId, {
          name: tx.categoryName,
          color: tx.categoryColor,
          icon: tx.categoryIcon,
          amount: tx.amount,
        });
      }
    }
  }

  const netCashflow = totalIncome - totalExpenses;
  const savingsRatePercent =
    totalIncome > 0
      ? Math.max(0, Math.round(((totalIncome - totalExpenses) / totalIncome) * 100))
      : 0;

  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([categoryId, item]) => ({
      categoryId,
      name: item.name,
      color: item.color,
      icon: item.icon,
      amount: Number(item.amount.toFixed(2)),
      percentage:
        totalExpenses > 0
          ? Math.round((item.amount / totalExpenses) * 100)
          : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    totalIncome: Number(totalIncome.toFixed(2)),
    totalExpenses: Number(totalExpenses.toFixed(2)),
    netCashflow: Number(netCashflow.toFixed(2)),
    savingsRatePercent,
    categoryBreakdown,
  };
}

/**
 * Registra una transacción en una operación ACID (prisma.$transaction)
 * actualizando de forma atómica los saldos de cuenta origen y destino.
 */
export async function recordTransactionACID(
  userId: string,
  input: QuickCaptureTransactionInput
): Promise<SerializedTransaction> {
  return prisma.$transaction(async (tx) => {
    const originAccount = await tx.account.findFirst({
      where: { id: input.accountId, userId },
    });

    if (!originAccount) {
      throw new Error("La cuenta de origen seleccionada no existe.");
    }

    const originBalance = toNumber(originAccount.currentBalance);
    const amount = input.amount;

    // 1. Evaluar movimiento según TransactionType
    if (
      input.transactionType === "PURCHASE" ||
      input.transactionType === "BILL_PAYMENT"
    ) {
      if (originAccount.type === "CREDIT_CARD") {
        const creditLimit = toNumber(originAccount.creditLimit);
        const newDebt = originBalance + amount;
        if (creditLimit > 0 && newDebt > creditLimit) {
          throw new Error(
            `Esta compra excede el disponible de la tarjeta (${originAccount.name}).`
          );
        }
        const currentNoInterest = toNumber(originAccount.noInterestPayment);
        const installmentAddition =
          input.installmentsCount > 1
            ? amount / input.installmentsCount
            : amount;

        await tx.account.update({
          where: { id: originAccount.id },
          data: {
            currentBalance: { increment: amount },
            noInterestPayment: currentNoInterest + installmentAddition,
          },
        });
      } else {
        if (originBalance < amount) {
          throw new Error(
            `Saldo insuficiente en ${originAccount.name} para cubrir este gasto.`
          );
        }
        await tx.account.update({
          where: { id: originAccount.id },
          data: {
            currentBalance: { decrement: amount },
          },
        });
      }
    } else if (
      input.transactionType === "SALARY_INCOME" ||
      input.transactionType === "REMITTANCE_INCOME"
    ) {
      await tx.account.update({
        where: { id: originAccount.id },
        data: {
          currentBalance: { increment: amount },
        },
      });
    } else if (
      input.transactionType === "CARD_PAYMENT" ||
      input.transactionType === "LOAN_PAYMENT"
    ) {
      if (!input.destinationAccountId) {
        throw new Error("Debes indicar la tarjeta o deuda a pagar.");
      }

      if (originBalance < amount) {
        throw new Error(
          `Saldo insuficiente en ${originAccount.name} para realizar el pago.`
        );
      }

      const destinationAccount = await tx.account.findFirst({
        where: { id: input.destinationAccountId, userId },
      });

      if (!destinationAccount) {
        throw new Error("La cuenta o tarjeta destino no existe.");
      }

      const currentDebt = toNumber(destinationAccount.currentBalance);
      const updatedDebt = Math.max(0, currentDebt - amount);
      const currentNoInterest = toNumber(destinationAccount.noInterestPayment);
      const updatedNoInterest = Math.max(0, currentNoInterest - amount);

      // Descontar saldo de cuenta líquida origen
      await tx.account.update({
        where: { id: originAccount.id },
        data: { currentBalance: { decrement: amount } },
      });

      // Reducir pasivo de tarjeta o préstamo destino
      await tx.account.update({
        where: { id: destinationAccount.id },
        data: {
          currentBalance: updatedDebt,
          noInterestPayment:
            destinationAccount.type === "CREDIT_CARD"
              ? updatedNoInterest
              : destinationAccount.noInterestPayment,
        },
      });
    } else if (input.transactionType === "TRANSFER") {
      if (!input.destinationAccountId) {
        throw new Error("Selecciona la cuenta destino para la transferencia.");
      }

      if (originBalance < amount) {
        throw new Error(
          `Saldo insuficiente en ${originAccount.name} para transferir.`
        );
      }

      const destinationAccount = await tx.account.findFirst({
        where: { id: input.destinationAccountId, userId },
      });

      if (!destinationAccount) {
        throw new Error("La cuenta destino no existe.");
      }

      await tx.account.update({
        where: { id: originAccount.id },
        data: { currentBalance: { decrement: amount } },
      });

      await tx.account.update({
        where: { id: destinationAccount.id },
        data: { currentBalance: { increment: amount } },
      });
    }

    // Crear el registro de transacción unificado
    const created = await tx.transaction.create({
      data: {
        userId,
        accountId: originAccount.id,
        destinationAccountId: input.destinationAccountId || null,
        categoryId: input.categoryId,
        title: input.title,
        description: input.description || null,
        amount,
        date: new Date(input.date),
        transactionType: input.transactionType,
        receiptUrl: input.receiptUrl || null,
        installmentsCount: input.installmentsCount ?? 1,
        currentInstallment: 1,
        isRecurring: input.isRecurring,
        isReconciled: input.isReconciled,
      },
      include: {
        account: { select: { name: true, type: true } },
        destinationAccount: { select: { name: true } },
        category: {
          select: { name: true, icon: true, color: true, type: true },
        },
      },
    });

    return {
      id: created.id,
      userId: created.userId,
      accountId: created.accountId,
      accountName: created.account.name,
      accountType: created.account.type,
      destinationAccountId: created.destinationAccountId,
      destinationAccountName: created.destinationAccount?.name ?? null,
      categoryId: created.categoryId,
      categoryName: created.category.name,
      categoryIcon: created.category.icon,
      categoryColor: created.category.color,
      categoryType: created.category.type,
      title: created.title,
      description: created.description,
      amount: toNumber(created.amount),
      date: created.date.toISOString(),
      transactionType: created.transactionType,
      receiptUrl: created.receiptUrl,
      installmentsCount: created.installmentsCount ?? 1,
      currentInstallment: created.currentInstallment ?? 1,
      isRecurring: created.isRecurring,
      isReconciled: created.isReconciled,
    };
  });
}

export async function toggleTransactionReconciledInDb(
  userId: string,
  transactionId: string,
  isReconciled: boolean
): Promise<void> {
  await prisma.transaction.updateMany({
    where: { id: transactionId, userId },
    data: { isReconciled },
  });
}
