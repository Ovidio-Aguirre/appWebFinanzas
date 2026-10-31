import { prisma, toNumber } from "@/lib/prisma";
import { startOfMonth, endOfMonth } from "date-fns";
import { DomainError } from "@/lib/errors";
import type {
  QuickCaptureTransactionInput,
  SerializedTransaction,
} from "./schemas";

// Cuentas de activo (dinero a favor del usuario): pueden transferirse entre sí.
const ASSET_TYPES = new Set(["CASH", "DEBIT", "SAVINGS_VAULT"]);
// Cuentas de pasivo (deuda): solo pueden recibir pagos, nunca transferencias.
const LIABILITY_TYPES = new Set(["CREDIT_CARD", "LOAN_LIABILITY"]);

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

/**
 * Obtiene las transacciones de un rango de fechas (p. ej. el mes en curso) sin
 * el límite de 100 filas, para calcular el flujo de caja de forma completa.
 */
export async function getTransactionsInRange(
  userId: string,
  start: Date,
  end: Date
): Promise<SerializedTransaction[]> {
  const rows = await prisma.transaction.findMany({
    where: { userId, date: { gte: start, lte: end } },
    include: {
      account: { select: { name: true, type: true } },
      destinationAccount: { select: { name: true } },
      category: {
        select: { name: true, icon: true, color: true, type: true },
      },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
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
      throw new DomainError("La cuenta de origen seleccionada no existe.");
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
          throw new DomainError(
            `Esta compra excede el disponible de la tarjeta (${originAccount.name}).`
          );
        }
        const installmentAddition =
          input.installmentsCount > 1
            ? amount / input.installmentsCount
            : amount;

        await tx.account.update({
          where: { id: originAccount.id },
          data: {
            currentBalance: { increment: amount },
            noInterestPayment: { increment: installmentAddition },
          },
        });
      } else {
        // A1: validar y descontar en una sola operación atómica.
        const debited = await tx.account.updateMany({
          where: {
            id: originAccount.id,
            userId,
            currentBalance: { gte: amount },
          },
          data: { currentBalance: { decrement: amount } },
        });
        if (debited.count === 0) {
          throw new DomainError(
            `Saldo insuficiente en ${originAccount.name} para cubrir este gasto.`
          );
        }
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
      // Los pagos de préstamo se gestionan desde el módulo de Préstamos
      // (payLoanInstallmentACID) para mantener la tabla de amortización en sincronía.
      if (input.transactionType === "LOAN_PAYMENT") {
        throw new DomainError(
          "Los pagos de préstamo se realizan desde el módulo de Préstamos (cuotas)."
        );
      }

      if (!input.destinationAccountId) {
        throw new DomainError("Debes indicar la tarjeta o deuda a pagar.");
      }

      const destinationAccount = await tx.account.findFirst({
        where: { id: input.destinationAccountId, userId },
      });

      if (!destinationAccount) {
        throw new DomainError("La cuenta o tarjeta destino no existe.");
      }

      // C2: el destino del pago debe ser un pasivo (tarjeta o préstamo).
      if (!LIABILITY_TYPES.has(destinationAccount.type)) {
        throw new DomainError(
          "El destino del pago debe ser una tarjeta de crédito o un préstamo."
        );
      }

      const currentDebt = toNumber(destinationAccount.currentBalance);

      // C2: rechazar sobrepago para que el dinero no desaparezca.
      if (amount > currentDebt) {
        throw new DomainError(
          `El monto excede la deuda actual de ${destinationAccount.name} ($${currentDebt.toFixed(
            2
          )}). Ajusta el pago.`
        );
      }

      // A1: descontar el origen de forma atómica (condición en la propia UPDATE).
      const debited = await tx.account.updateMany({
        where: { id: originAccount.id, userId, currentBalance: { gte: amount } },
        data: { currentBalance: { decrement: amount } },
      });
      if (debited.count === 0) {
        throw new DomainError(
          `Saldo insuficiente en ${originAccount.name} para realizar el pago.`
        );
      }

      const currentNoInterest = toNumber(destinationAccount.noInterestPayment);

      // Reducir pasivo con decrement (nunca escritura de valor absoluto).
      await tx.account.update({
        where: { id: destinationAccount.id },
        data: {
          currentBalance: { decrement: amount },
          ...(destinationAccount.type === "CREDIT_CARD"
            ? {
                noInterestPayment: {
                  decrement: Math.min(amount, currentNoInterest),
                },
              }
            : {}),
        },
      });
    } else if (input.transactionType === "TRANSFER") {
      if (!input.destinationAccountId) {
        throw new DomainError("Selecciona la cuenta destino para la transferencia.");
      }

      const destinationAccount = await tx.account.findFirst({
        where: { id: input.destinationAccountId, userId },
      });

      if (!destinationAccount) {
        throw new DomainError("La cuenta destino no existe.");
      }

      // C3: las transferencias solo se permiten entre cuentas de activo.
      if (
        !ASSET_TYPES.has(originAccount.type) ||
        !ASSET_TYPES.has(destinationAccount.type)
      ) {
        throw new DomainError(
          "Las transferencias solo se permiten entre cuentas de activo (efectivo, débito o ahorro)."
        );
      }

      // A1: descontar origen de forma atómica.
      const debited = await tx.account.updateMany({
        where: { id: originAccount.id, userId, currentBalance: { gte: amount } },
        data: { currentBalance: { decrement: amount } },
      });
      if (debited.count === 0) {
        throw new DomainError(
          `Saldo insuficiente en ${originAccount.name} para transferir.`
        );
      }

      await tx.account.update({
        where: { id: destinationAccount.id },
        data: { currentBalance: { increment: amount } },
      });
    }

    // Si el pago corresponde a una cuota de una compra a tasa cero específica,
    // avanzar el contador de cuotas pagadas de esa compra (MSI).
    // A2: validar propiedad (userId) y que efectivamente sea una compra MSI.
    if (input.msiTransactionId) {
      const msiTx = await tx.transaction.findFirst({
        where: {
          id: input.msiTransactionId,
          userId,
          installmentsCount: { gt: 1 },
        },
      });

      if (!msiTx?.currentInstallment) {
        throw new DomainError("La compra a tasa cero seleccionada no es válida.");
      }

      await tx.transaction.update({
        where: { id: msiTx.id },
        data: {
          currentInstallment: Math.min(
            msiTx.installmentsCount ?? msiTx.currentInstallment,
            msiTx.currentInstallment + 1
          ),
        },
      });
    }

    // Crear el registro de transacción unificado
    const created = await tx.transaction.create({
      data: {
        userId,
        accountId: originAccount.id,
        destinationAccountId: input.destinationAccountId || null,
        msiTransactionId: input.msiTransactionId || null,
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
