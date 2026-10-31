import { prisma, toNumber } from "@/lib/prisma";
import { calculateNextExecutionDate } from "@/lib/utils";
import { DomainError } from "@/lib/errors";
import type {
  CreateRecurringRuleInput,
  SerializedRecurringRule,
} from "./schemas";

export async function getRecurringRulesByUser(
  userId: string
): Promise<SerializedRecurringRule[]> {
  const rules = await prisma.recurringRule.findMany({
    where: { userId },
    include: {
      account: { select: { name: true, type: true } },
      category: { select: { name: true, icon: true, color: true } },
    },
    orderBy: [{ active: "desc" }, { nextExecutionDate: "asc" }],
  });

  return rules.map((r) => ({
    id: r.id,
    userId: r.userId,
    accountId: r.accountId,
    accountName: r.account.name,
    accountType: r.account.type,
    categoryId: r.categoryId,
    categoryName: r.category.name,
    categoryIcon: r.category.icon,
    categoryColor: r.category.color,
    title: r.title,
    provider: r.provider,
    amount: toNumber(r.amount),
    frequency: r.frequency,
    startDate: r.startDate.toISOString(),
    nextExecutionDate: r.nextExecutionDate.toISOString(),
    lastExecutedDate: r.lastExecutedDate
      ? r.lastExecutedDate.toISOString()
      : null,
    autoPost: r.autoPost,
    active: r.active,
    ruleType: r.ruleType,
  }));
}

export async function createRecurringRuleInDb(
  userId: string,
  input: CreateRecurringRuleInput
): Promise<SerializedRecurringRule> {
  // A2: validar que la cuenta pertenezca al usuario y la categoría exista.
  const account = await prisma.account.findFirst({
    where: { id: input.accountId, userId },
  });
  if (!account) {
    throw new DomainError("La cuenta seleccionada no existe o no te pertenece.");
  }

  const category = await prisma.category.findUnique({
    where: { id: input.categoryId },
  });
  if (!category) {
    throw new DomainError("La categoría seleccionada no existe.");
  }

  const created = await prisma.recurringRule.create({
    data: {
      userId,
      accountId: input.accountId,
      categoryId: input.categoryId,
      title: input.title,
      provider: input.provider || null,
      amount: input.amount,
      frequency: input.frequency,
      ruleType: input.ruleType,
      startDate: new Date(input.startDate),
      nextExecutionDate: new Date(input.nextExecutionDate),
      autoPost: input.autoPost,
      active: true,
    },
    include: {
      account: { select: { name: true, type: true } },
      category: { select: { name: true, icon: true, color: true } },
    },
  });

  return {
    id: created.id,
    userId: created.userId,
    accountId: created.accountId,
    accountName: created.account.name,
    accountType: created.account.type,
    categoryId: created.categoryId,
    categoryName: created.category.name,
    categoryIcon: created.category.icon,
    categoryColor: created.category.color,
    title: created.title,
    provider: created.provider,
    amount: toNumber(created.amount),
    frequency: created.frequency,
    startDate: created.startDate.toISOString(),
    nextExecutionDate: created.nextExecutionDate.toISOString(),
    lastExecutedDate: created.lastExecutedDate
      ? created.lastExecutedDate.toISOString()
      : null,
    autoPost: created.autoPost,
    active: created.active,
    ruleType: created.ruleType,
  };
}

/**
 * Ejecuta una regla recurrente (Suscripción, Nómina, Remesa o Cuota Fija)
 * en una transacción ACID: genera la Transaction, actualiza el saldo de la cuenta
 * y avanza nextExecutionDate según la frecuencia configurada.
 */
export async function executeRecurringRuleACID(
  userId: string,
  ruleId: string
): Promise<{ nextExecutionDate: string }> {
  return prisma.$transaction(async (tx) => {
    const rule = await tx.recurringRule.findFirst({
      where: { id: ruleId, userId },
      include: { account: true },
    });

    if (!rule) {
      throw new DomainError("No se encontró la regla recurrente especificada.");
    }

    const amount = toNumber(rule.amount);
    const isIncome =
      rule.ruleType === "PAYROLL" || rule.ruleType === "REMITTANCE";

    const transactionType =
      rule.ruleType === "PAYROLL"
        ? "SALARY_INCOME"
        : rule.ruleType === "REMITTANCE"
        ? "REMITTANCE_INCOME"
        : "BILL_PAYMENT";

    const now = new Date();
    const nextDate = calculateNextExecutionDate(
      rule.nextExecutionDate > now ? rule.nextExecutionDate : now,
      rule.frequency
    );

    // A3: bloqueo optimista. Reclama la ejecución avanzando nextExecutionDate
    // solo si nadie más lo hizo ya (comparando el valor previo).
    const claimed = await tx.recurringRule.updateMany({
      where: {
        id: rule.id,
        userId,
        active: true,
        nextExecutionDate: rule.nextExecutionDate,
      },
      data: {
        lastExecutedDate: now,
        nextExecutionDate: nextDate,
      },
    });
    if (claimed.count === 0) {
      throw new DomainError("Esta regla ya fue ejecutada. Recarga la página.");
    }

    // Actualizar saldo de la cuenta asociada (A1: operaciones atómicas).
    if (isIncome) {
      await tx.account.update({
        where: { id: rule.accountId },
        data: { currentBalance: { increment: amount } },
      });
    } else if (rule.account.type === "CREDIT_CARD") {
      await tx.account.update({
        where: { id: rule.accountId },
        data: {
          currentBalance: { increment: amount },
          noInterestPayment: { increment: amount },
        },
      });
    } else {
      const debited = await tx.account.updateMany({
        where: {
          id: rule.accountId,
          userId,
          currentBalance: { gte: amount },
        },
        data: { currentBalance: { decrement: amount } },
      });
      if (debited.count === 0) {
        throw new DomainError(
          `Saldo insuficiente en ${rule.account.name} para ejecutar ${rule.title}.`
        );
      }
    }

    // Crear la transacción correspondiente
    await tx.transaction.create({
      data: {
        userId,
        accountId: rule.accountId,
        categoryId: rule.categoryId,
        title: `${rule.title} (Ejecución Recurrente)`,
        description: `Generado desde programación ${rule.frequency}`,
        amount,
        date: now,
        transactionType,
        isRecurring: true,
        isReconciled: rule.autoPost,
      },
    });

    return {
      nextExecutionDate: nextDate.toISOString(),
    };
  });
}

export async function toggleRecurringRuleAutoPostInDb(
  userId: string,
  ruleId: string,
  autoPost: boolean
): Promise<void> {
  await prisma.recurringRule.updateMany({
    where: { id: ruleId, userId },
    data: { autoPost },
  });
}
