import { z } from "zod";
import { prisma, toNumber } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";

export const UpdateSavingsGoalSchema = z.object({
  goalId: z.string().min(1),
  name: z.string().min(2, "Mínimo 2 caracteres").max(70, "Máximo 70 caracteres"),
  targetAmount: z.coerce.number().finite().positive("La meta debe ser mayor a $0").max(1e12),
  deadline: z.string().optional().or(z.literal("")),
  color: z.string().min(1).default("#0d9488"),
  icon: z.string().min(1).default("PiggyBank"),
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"]),
});
export type UpdateSavingsGoalInput = z.infer<typeof UpdateSavingsGoalSchema>;

export async function updateSavingsGoalInDb(
  userId: string,
  input: UpdateSavingsGoalInput
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const goal = await tx.savingsGoal.findFirst({
      where: { id: input.goalId, userId },
    });
    if (!goal) throw new DomainError("No se encontró la bóveda.");

    await tx.savingsGoal.update({
      where: { id: goal.id },
      data: {
        name: input.name,
        targetAmount: input.targetAmount,
        deadline: input.deadline ? new Date(input.deadline) : null,
        color: input.color,
        icon: input.icon,
        status: input.status,
      },
    });
    if (goal.vaultAccountId) {
      await tx.account.update({
        where: { id: goal.vaultAccountId },
        data: { name: `Bóveda: ${input.name}`, color: input.color },
      });
    }
  });
}

/**
 * Elimina una bóveda. Si tiene fondos, se devuelven a la cuenta indicada
 * (debe ser una cuenta de efectivo/débito del usuario).
 */
export async function deleteSavingsGoalInDb(
  userId: string,
  goalId: string,
  returnToAccountId?: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const goal = await tx.savingsGoal.findFirst({
      where: { id: goalId, userId },
      include: { vaultAccount: true },
    });
    if (!goal) throw new DomainError("No se encontró la bóveda.");

    const vault = goal.vaultAccount;
    const funds = vault ? toNumber(vault.currentBalance) : 0;

    if (funds > 0) {
      if (!returnToAccountId) {
        throw new DomainError(
          "La bóveda tiene fondos. Elige a qué cuenta devolverlos."
        );
      }
      const target = await tx.account.findFirst({
        where: {
          id: returnToAccountId,
          userId,
          isActive: true,
          type: { in: ["CASH", "DEBIT"] },
        },
      });
      if (!target) {
        throw new DomainError("Elige una cuenta de efectivo o débito válida.");
      }
      await tx.account.update({
        where: { id: target.id },
        data: { currentBalance: { increment: funds } },
      });
    }

    await tx.savingsGoal.delete({ where: { id: goal.id } });

    if (vault) {
      const others = await tx.savingsGoal.count({
        where: { vaultAccountId: vault.id },
      });
      if (others === 0) {
        const origin = await tx.transaction.count({ where: { accountId: vault.id } });
        if (origin === 0) {
          await tx.account.delete({ where: { id: vault.id } });
        } else {
          await tx.account.update({
            where: { id: vault.id },
            data: { isActive: false, currentBalance: 0 },
          });
        }
      }
    }
  });
}
