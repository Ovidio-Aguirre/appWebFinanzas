import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";
import { generateAmortizationSchedule } from "@/lib/utils";
import { CreateLoanWithAmortizationSchema } from "./schemas";

export const UpdateLoanSchema = CreateLoanWithAmortizationSchema.extend({
  loanId: z.string().min(1),
});
export type UpdateLoanInput = z.infer<typeof UpdateLoanSchema>;

/**
 * Edita un préstamo. Nombre e institución siempre se pueden cambiar; las condiciones
 * (monto, tasa, plazo, primera fecha) solo si no hay cuotas pagadas, en cuyo caso se
 * regenera la tabla de amortización.
 */
export async function updateLoanInDb(
  userId: string,
  input: UpdateLoanInput
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const loan = await tx.account.findFirst({
      where: { id: input.loanId, userId, type: "LOAN_LIABILITY" },
      include: { loanInstallments: true },
    });
    if (!loan) throw new DomainError("No se encontró el préstamo.");

    const paid = loan.loanInstallments.filter((i) => i.status === "PAID").length;
    const first = [...loan.loanInstallments].sort(
      (a, b) => a.installmentNumber - b.installmentNumber
    )[0];

    const termsChanged =
      Number(loan.originalPrincipal ?? 0) !== input.principalAmount ||
      Number(loan.interestRate ?? 0) !== input.annualInterestRate ||
      (loan.termMonths ?? 0) !== input.termMonths ||
      (first
        ? first.dueDate.toISOString().slice(0, 10) !== input.firstDueDate.slice(0, 10)
        : true);

    if (termsChanged && paid > 0) {
      throw new DomainError(
        "Ya hay cuotas pagadas: solo puedes cambiar el nombre y la institución. Para cambiar monto, tasa o plazo, elimina el préstamo y regístralo de nuevo."
      );
    }

    if (termsChanged) {
      const firstDueDate = new Date(input.firstDueDate);
      const schedule = generateAmortizationSchedule({
        principal: input.principalAmount,
        annualInterestRate: input.annualInterestRate,
        termMonths: input.termMonths,
        firstDueDate,
      });
      await tx.loanInstallment.deleteMany({ where: { accountId: loan.id } });
      await tx.loanInstallment.createMany({
        data: schedule.map((row) => ({
          accountId: loan.id,
          installmentNumber: row.installmentNumber,
          totalInstallments: row.totalInstallments,
          amount: row.amount,
          capitalAmount: row.capitalAmount,
          interestAmount: row.interestAmount,
          remainingBalance: row.remainingBalance,
          dueDate: row.dueDate,
          status: "PENDING" as const,
        })),
      });
      await tx.account.update({
        where: { id: loan.id },
        data: {
          name: input.name,
          institution: input.institution || null,
          currency: input.currency,
          currentBalance: input.principalAmount,
          originalPrincipal: input.principalAmount,
          interestRate: input.annualInterestRate,
          termMonths: input.termMonths,
          paymentDueDay: firstDueDate.getDate(),
        },
      });
    } else {
      await tx.account.update({
        where: { id: loan.id },
        data: { name: input.name, institution: input.institution || null },
      });
    }
  });
}

/** Elimina un préstamo; si ya tiene cuotas pagadas se archiva para conservar el historial. */
export async function deleteLoanInDb(
  userId: string,
  loanId: string
): Promise<{ archived: boolean }> {
  return prisma.$transaction(async (tx) => {
    const loan = await tx.account.findFirst({
      where: { id: loanId, userId, type: "LOAN_LIABILITY" },
    });
    if (!loan) throw new DomainError("No se encontró el préstamo.");

    const paid = await tx.loanInstallment.count({
      where: { accountId: loan.id, status: "PAID" },
    });
    if (paid > 0) {
      await tx.account.update({ where: { id: loan.id }, data: { isActive: false } });
      return { archived: true };
    }
    await tx.account.delete({ where: { id: loan.id } });
    return { archived: false };
  });
}
