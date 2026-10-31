import { prisma, toNumber } from "@/lib/prisma";
import type {
  ContributeToSavingsGoalInput,
  CreateSavingsGoalInput,
  SerializedSavingsGoal,
} from "./schemas";

export async function getSavingsGoalsByUser(
  userId: string
): Promise<SerializedSavingsGoal[]> {
  const goals = await prisma.savingsGoal.findMany({
    where: { userId },
    include: {
      vaultAccount: { select: { name: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });

  return goals.map((goal) => {
    const target = toNumber(goal.targetAmount);
    const current = toNumber(goal.currentAmount);
    const progressPercent =
      target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

    return {
      id: goal.id,
      userId: goal.userId,
      vaultAccountId: goal.vaultAccountId,
      vaultAccountName: goal.vaultAccount?.name ?? null,
      name: goal.name,
      icon: goal.icon,
      color: goal.color,
      targetAmount: target,
      currentAmount: current,
      progressPercent,
      deadline: goal.deadline ? goal.deadline.toISOString() : null,
      status: goal.status,
    };
  });
}

export async function createSavingsGoalACID(
  userId: string,
  input: CreateSavingsGoalInput
): Promise<SerializedSavingsGoal> {
  return prisma.$transaction(async (tx) => {
    // Crear cuenta tipo SAVINGS_VAULT vinculada para reflejar en Patrimonio Líquido
    const vaultAccount = await tx.account.create({
      data: {
        userId,
        name: `Bóveda: ${input.name}`,
        institution: "FinanzaPro Vault",
        type: "SAVINGS_VAULT",
        currency: "USD",
        currentBalance: input.initialAmount,
        color: input.color,
      },
    });

    const status =
      input.initialAmount >= input.targetAmount ? "COMPLETED" : "ACTIVE";

    const created = await tx.savingsGoal.create({
      data: {
        userId,
        vaultAccountId: vaultAccount.id,
        name: input.name,
        icon: input.icon,
        color: input.color,
        targetAmount: input.targetAmount,
        currentAmount: input.initialAmount,
        deadline: input.deadline ? new Date(input.deadline) : null,
        status,
      },
      include: {
        vaultAccount: { select: { name: true } },
      },
    });

    const target = toNumber(created.targetAmount);
    const current = toNumber(created.currentAmount);

    return {
      id: created.id,
      userId: created.userId,
      vaultAccountId: created.vaultAccountId,
      vaultAccountName: created.vaultAccount?.name ?? null,
      name: created.name,
      icon: created.icon,
      color: created.color,
      targetAmount: target,
      currentAmount: current,
      progressPercent:
        target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0,
      deadline: created.deadline ? created.deadline.toISOString() : null,
      status: created.status,
    };
  });
}

/**
 * Transfiere saldo de forma atómica (ACID) desde una cuenta corriente/efectivo
 * hacia una Bóveda de Ahorro (SavingsGoal + cuenta SAVINGS_VAULT).
 */
export async function contributeToSavingsGoalACID(
  userId: string,
  input: ContributeToSavingsGoalInput
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const goal = await tx.savingsGoal.findFirst({
      where: { id: input.savingsGoalId, userId },
    });

    if (!goal) {
      throw new Error("No se encontró la bóveda de ahorro seleccionada.");
    }

    const originAccount = await tx.account.findFirst({
      where: { id: input.originAccountId, userId },
    });

    if (!originAccount) {
      throw new Error("No se encontró la cuenta corriente de origen.");
    }

    const originBalance = toNumber(originAccount.currentBalance);
    const amount = input.amount;

    if (originBalance < amount) {
      throw new Error(
        `Saldo insuficiente en ${originAccount.name} para transferir $${amount.toFixed(
          2
        )}.`
      );
    }

    // 1. Descontar saldo de cuenta origen
    await tx.account.update({
      where: { id: originAccount.id },
      data: { currentBalance: { decrement: amount } },
    });

    // 2. Incrementar saldo en la cuenta SAVINGS_VAULT asociada (o crear una si no tenía)
    let vaultAccountId = goal.vaultAccountId;
    if (vaultAccountId) {
      await tx.account.update({
        where: { id: vaultAccountId },
        data: { currentBalance: { increment: amount } },
      });
    } else {
      const mainVault = await tx.account.findFirst({
        where: { userId, type: "SAVINGS_VAULT" },
      });
      if (mainVault) {
        vaultAccountId = mainVault.id;
        await tx.account.update({
          where: { id: mainVault.id },
          data: { currentBalance: { increment: amount } },
        });
      }
    }

    // 3. Actualizar progreso de la meta de ahorro
    const newCurrent = toNumber(goal.currentAmount) + amount;
    const target = toNumber(goal.targetAmount);
    const nextStatus = newCurrent >= target ? "COMPLETED" : goal.status;

    await tx.savingsGoal.update({
      where: { id: goal.id },
      data: {
        currentAmount: newCurrent,
        status: nextStatus,
      },
    });

    // 4. Obtener categoría para el aporte
    let category = await tx.category.findFirst({
      where: { type: "INVESTMENT" },
    });
    if (!category) {
      category = await tx.category.create({
        data: {
          name: "Ahorro e Inversión",
          icon: "PiggyBank",
          color: "#0d9488",
          type: "INVESTMENT",
        },
      });
    }

    // 5. Registrar transacción de transferencia a bóveda
    await tx.transaction.create({
      data: {
        userId,
        accountId: originAccount.id,
        destinationAccountId: vaultAccountId,
        categoryId: category.id,
        savingsGoalId: goal.id,
        title: `Aporte a Bóveda: ${goal.name}`,
        description: input.note || "Transferencia programada a meta de ahorro",
        amount,
        date: new Date(),
        transactionType: "TRANSFER",
        isRecurring: false,
        isReconciled: true,
      },
    });
  });
}
