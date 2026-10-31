import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";
import type { CreateRecurringRuleInput } from "./schemas";

export async function updateRecurringRuleInDb(
  userId: string,
  ruleId: string,
  input: CreateRecurringRuleInput
): Promise<void> {
  const rule = await prisma.recurringRule.findFirst({
    where: { id: ruleId, userId },
  });
  if (!rule) throw new DomainError("No se encontró la programación.");

  const account = await prisma.account.findFirst({
    where: { id: input.accountId, userId, isActive: true },
  });
  if (!account) throw new DomainError("La cuenta seleccionada no es válida.");

  const category = await prisma.category.findUnique({
    where: { id: input.categoryId },
  });
  if (!category) throw new DomainError("La categoría seleccionada no existe.");

  await prisma.recurringRule.update({
    where: { id: rule.id },
    data: {
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
    },
  });
}

export async function deleteRecurringRuleInDb(
  userId: string,
  ruleId: string
): Promise<void> {
  const r = await prisma.recurringRule.deleteMany({
    where: { id: ruleId, userId },
  });
  if (r.count === 0) throw new DomainError("No se encontró la programación.");
}

export async function setRecurringRuleActiveInDb(
  userId: string,
  ruleId: string,
  active: boolean
): Promise<void> {
  const r = await prisma.recurringRule.updateMany({
    where: { id: ruleId, userId },
    data: { active },
  });
  if (r.count === 0) throw new DomainError("No se encontró la programación.");
}
