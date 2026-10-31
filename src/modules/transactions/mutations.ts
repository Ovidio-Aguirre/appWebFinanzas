import type { Prisma } from "@prisma/client";
import { prisma, toNumber } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";
import { applyTransactionEffects } from "./repository";
import type {
  QuickCaptureTransactionInput,
  SerializedTransaction,
} from "./schemas";

// ============================================================================
// Editar / eliminar movimientos (revierte efectos y reaplica)
// ============================================================================

type Tx = Prisma.TransactionClient;

const TX_INCLUDE = {
  account: { select: { name: true, type: true } },
  destinationAccount: { select: { name: true } },
  category: { select: { name: true, icon: true, color: true, type: true } },
} as const;

function serializeRow(
  row: Prisma.TransactionGetPayload<{ include: typeof TX_INCLUDE }>
): SerializedTransaction {
  return {
    id: row.id,
    userId: row.userId,
    accountId: row.accountId,
    accountName: row.account.name,
    accountType: row.account.type,
    destinationAccountId: row.destinationAccountId,
    destinationAccountName: row.destinationAccount?.name ?? null,
    categoryId: row.categoryId,
    categoryName: row.category.name,
    categoryIcon: row.category.icon,
    categoryColor: row.category.color,
    categoryType: row.category.type,
    title: row.title,
    description: row.description,
    amount: toNumber(row.amount),
    date: row.date.toISOString(),
    transactionType: row.transactionType,
    receiptUrl: row.receiptUrl,
    installmentsCount: row.installmentsCount ?? 1,
    currentInstallment: row.currentInstallment ?? 1,
    isRecurring: row.isRecurring,
    isReconciled: row.isReconciled,
  };
}

/** Descuenta de un activo sin dejarlo en negativo (condición en la propia UPDATE). */
async function debitAsset(
  tx: Tx,
  accountId: string,
  amount: number,
  errorMsg: string
) {
  const r = await tx.account.updateMany({
    where: { id: accountId, currentBalance: { gte: amount } },
    data: { currentBalance: { decrement: amount } },
  });
  if (r.count === 0) throw new DomainError(errorMsg);
}

/** Revierte los efectos que un movimiento tuvo sobre cuentas, cuotas y metas. */
export async function reverseTransactionEffects(
  tx: Tx,
  userId: string,
  row: Prisma.TransactionGetPayload<object>
): Promise<void> {
  const amount = toNumber(row.amount);
  const origin = await tx.account.findFirst({
    where: { id: row.accountId, userId },
  });
  if (!origin) throw new DomainError("La cuenta del movimiento ya no existe.");

  switch (row.transactionType) {
    case "PURCHASE":
    case "BILL_PAYMENT": {
      if (origin.type === "CREDIT_CARD") {
        const debt = toNumber(origin.currentBalance);
        const noInt = toNumber(origin.noInterestPayment);
        const count = row.installmentsCount ?? 1;
        const add = count > 1 ? amount / count : amount;
        await tx.account.update({
          where: { id: origin.id },
          data: {
            currentBalance: { decrement: Math.min(amount, debt) },
            noInterestPayment: { decrement: Math.min(add, noInt) },
          },
        });
      } else {
        await tx.account.update({
          where: { id: origin.id },
          data: { currentBalance: { increment: amount } },
        });
      }
      break;
    }
    case "SALARY_INCOME":
    case "REMITTANCE_INCOME":
      await debitAsset(
        tx,
        origin.id,
        amount,
        `No se puede revertir: el saldo de ${origin.name} ya no alcanza para deshacer este ingreso.`
      );
      break;
    case "CARD_PAYMENT": {
      await tx.account.update({
        where: { id: origin.id },
        data: { currentBalance: { increment: amount } },
      });
      if (row.destinationAccountId) {
        const dest = await tx.account.findFirst({
          where: { id: row.destinationAccountId, userId },
        });
        if (dest) {
          await tx.account.update({
            where: { id: dest.id },
            data: {
              currentBalance: { increment: amount },
              ...(dest.type === "CREDIT_CARD"
                ? { noInterestPayment: { increment: amount } }
                : {}),
            },
          });
        }
      }
      break;
    }
    case "LOAN_PAYMENT": {
      await tx.account.update({
        where: { id: origin.id },
        data: { currentBalance: { increment: amount } },
      });
      if (row.loanInstallmentId) {
        const inst = await tx.loanInstallment.findUnique({
          where: { id: row.loanInstallmentId },
        });
        if (inst) {
          await tx.account.update({
            where: { id: inst.accountId },
            data: {
              currentBalance: { increment: toNumber(inst.capitalAmount) },
            },
          });
          await tx.loanInstallment.update({
            where: { id: inst.id },
            data: { status: "PENDING", paidAt: null },
          });
        }
      }
      break;
    }
    case "TRANSFER": {
      await tx.account.update({
        where: { id: origin.id },
        data: { currentBalance: { increment: amount } },
      });
      if (row.destinationAccountId) {
        await debitAsset(
          tx,
          row.destinationAccountId,
          amount,
          "No se puede revertir: la cuenta destino ya no tiene saldo suficiente."
        );
      }
      if (row.savingsGoalId) {
        const goal = await tx.savingsGoal.findUnique({
          where: { id: row.savingsGoalId },
        });
        if (goal) {
          const next = Math.max(0, toNumber(goal.currentAmount) - amount);
          await tx.savingsGoal.update({
            where: { id: goal.id },
            data: {
              currentAmount: next,
              status:
                goal.status === "COMPLETED" &&
                next < toNumber(goal.targetAmount)
                  ? "ACTIVE"
                  : goal.status,
            },
          });
        }
      }
      break;
    }
  }

  if (row.msiTransactionId) {
    const msi = await tx.transaction.findFirst({
      where: { id: row.msiTransactionId, userId },
    });
    if (msi?.currentInstallment && msi.currentInstallment > 1) {
      await tx.transaction.update({
        where: { id: msi.id },
        data: { currentInstallment: msi.currentInstallment - 1 },
      });
    }
  }
}

/** Elimina un movimiento y revierte su efecto en los saldos. */
export async function deleteTransactionACID(
  userId: string,
  transactionId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const row = await tx.transaction.findFirst({
      where: { id: transactionId, userId },
    });
    if (!row) throw new DomainError("No se encontró el movimiento.");
    await reverseTransactionEffects(tx, userId, row);
    await tx.transaction.delete({ where: { id: row.id } });
  });
}

/**
 * Edita un movimiento. Los movimientos simples (compras, ingresos, pagos de tarjeta,
 * transferencias) se revierten y se reaplican con los datos nuevos. Los generados por
 * cuotas de préstamo o aportes a bóvedas solo permiten editar datos descriptivos.
 */
export async function updateTransactionACID(
  userId: string,
  transactionId: string,
  input: QuickCaptureTransactionInput
): Promise<SerializedTransaction> {
  return prisma.$transaction(async (tx) => {
    const row = await tx.transaction.findFirst({
      where: { id: transactionId, userId },
    });
    if (!row) throw new DomainError("No se encontró el movimiento.");

    const category = await tx.category.findUnique({
      where: { id: input.categoryId },
    });
    if (!category) throw new DomainError("La categoría seleccionada no existe.");

    const locked =
      Boolean(row.loanInstallmentId) ||
      Boolean(row.savingsGoalId) ||
      row.transactionType === "LOAN_PAYMENT";

    if (locked) {
      const changed =
        toNumber(row.amount) !== input.amount ||
        row.accountId !== input.accountId ||
        (row.destinationAccountId ?? "") !== (input.destinationAccountId || "") ||
        row.transactionType !== input.transactionType;
      if (changed) {
        throw new DomainError(
          "Este movimiento viene de una cuota de préstamo o aporte a bóveda: solo puedes editar título, nota, categoría, fecha y comprobante. Para cambiar montos, elimínalo y regístralo de nuevo."
        );
      }
    } else {
      await reverseTransactionEffects(tx, userId, row);
      await applyTransactionEffects(tx, userId, input);
    }

    const updated = await tx.transaction.update({
      where: { id: row.id },
      data: {
        title: input.title,
        description: input.description || null,
        categoryId: input.categoryId,
        date: new Date(input.date),
        receiptUrl: input.receiptUrl || null,
        isReconciled: input.isReconciled,
        ...(locked
          ? {}
          : {
              accountId: input.accountId,
              destinationAccountId: input.destinationAccountId || null,
              msiTransactionId: input.msiTransactionId || null,
              amount: input.amount,
              transactionType: input.transactionType,
              installmentsCount: input.installmentsCount ?? 1,
            }),
      },
      include: TX_INCLUDE,
    });
    return serializeRow(updated);
  });
}
