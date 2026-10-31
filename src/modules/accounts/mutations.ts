import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";

export const UpdateAccountSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres").max(60, "Máximo 60 caracteres"),
  institution: z.string().max(50).optional().or(z.literal("")),
  color: z.string().min(1).default("#0d9488"),
  lastFourDigits: z.string().max(4).optional().or(z.literal("")),
  // Ajuste manual de saldo / deuda (útil para corregir diferencias).
  currentBalance: z.coerce.number().finite().min(0, "No puede ser negativo").max(1e12),
  creditLimit: z.coerce.number().finite().min(0).max(1e12).optional(),
  cutoffDay: z.coerce.number().int().min(1).max(31).optional(),
  paymentDueDay: z.coerce.number().int().min(1).max(31).optional(),
  interestRate: z.coerce.number().finite().min(0).max(200).optional(),
  noInterestPayment: z.coerce.number().finite().min(0).max(1e12).optional(),
  minimumPayment: z.coerce.number().finite().min(0).max(1e12).optional(),
});
export type UpdateAccountInput = z.infer<typeof UpdateAccountSchema>;

export async function updateAccountInDb(
  userId: string,
  accountId: string,
  input: UpdateAccountInput
): Promise<void> {
  const acc = await prisma.account.findFirst({ where: { id: accountId, userId } });
  if (!acc) throw new DomainError("No se encontró la cuenta.");
  if (acc.type === "LOAN_LIABILITY") {
    throw new DomainError("Los préstamos se editan desde el módulo de Préstamos.");
  }

  const isCard = acc.type === "CREDIT_CARD";
  if (isCard && (!input.creditLimit || input.creditLimit <= 0)) {
    throw new DomainError("La tarjeta requiere un límite de crédito mayor a 0.");
  }

  await prisma.account.update({
    where: { id: acc.id },
    data: {
      name: input.name,
      institution: input.institution || null,
      color: input.color,
      lastFourDigits: input.lastFourDigits || null,
      currentBalance: input.currentBalance,
      ...(isCard
        ? {
            creditLimit: input.creditLimit ?? 0,
            cutoffDay: input.cutoffDay ?? null,
            paymentDueDay: input.paymentDueDay ?? null,
            interestRate: input.interestRate ?? null,
            noInterestPayment: input.noInterestPayment ?? null,
            minimumPayment: input.minimumPayment ?? null,
          }
        : {}),
    },
  });
}

/**
 * Elimina una cuenta. Si ya tiene historial (movimientos o programaciones) se
 * archiva en lugar de borrarse para no perder el historial contable.
 */
export async function deleteAccountInDb(
  userId: string,
  accountId: string
): Promise<{ archived: boolean }> {
  return prisma.$transaction(async (tx) => {
    const acc = await tx.account.findFirst({ where: { id: accountId, userId } });
    if (!acc) throw new DomainError("No se encontró la cuenta.");
    if (acc.type === "LOAN_LIABILITY") {
      throw new DomainError("Elimina los préstamos desde el módulo de Préstamos.");
    }
    if (acc.type === "SAVINGS_VAULT") {
      const goals = await tx.savingsGoal.count({
        where: { vaultAccountId: acc.id },
      });
      if (goals > 0) {
        throw new DomainError("Esta cuenta pertenece a una bóveda: elimínala desde Bóvedas.");
      }
    }

    const used =
      (await tx.transaction.count({
        where: { OR: [{ accountId: acc.id }, { destinationAccountId: acc.id }] },
      })) + (await tx.recurringRule.count({ where: { accountId: acc.id } }));

    if (used === 0) {
      await tx.account.delete({ where: { id: acc.id } });
      return { archived: false };
    }

    await tx.recurringRule.updateMany({
      where: { accountId: acc.id },
      data: { active: false },
    });
    await tx.account.update({ where: { id: acc.id }, data: { isActive: false } });
    return { archived: true };
  });
}
