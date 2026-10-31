import { prisma, toNumber } from "@/lib/prisma";
import { generateAmortizationSchedule } from "@/lib/utils";
import type {
  CreateLoanWithAmortizationInput,
  PayLoanInstallmentInput,
  SerializedLoanAccount,
} from "./schemas";

export async function getLoansWithInstallmentsByUser(
  userId: string
): Promise<SerializedLoanAccount[]> {
  const loanAccounts = await prisma.account.findMany({
    where: { userId, type: "LOAN_LIABILITY", isActive: true },
    include: {
      loanInstallments: {
        orderBy: { installmentNumber: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return loanAccounts.map((acc) => ({
    id: acc.id,
    name: acc.name,
    institution: acc.institution,
    currency: acc.currency,
    currentBalance: toNumber(acc.currentBalance),
    originalPrincipal: toNumber(acc.originalPrincipal ?? acc.currentBalance),
    interestRate: toNumber(acc.interestRate),
    termMonths: acc.termMonths ?? acc.loanInstallments.length,
    paymentDueDay: acc.paymentDueDay,
    installments: acc.loanInstallments.map((inst) => ({
      id: inst.id,
      accountId: inst.accountId,
      installmentNumber: inst.installmentNumber,
      totalInstallments: inst.totalInstallments,
      amount: toNumber(inst.amount),
      capitalAmount: toNumber(inst.capitalAmount),
      interestAmount: toNumber(inst.interestAmount),
      remainingBalance: toNumber(inst.remainingBalance),
      dueDate: inst.dueDate.toISOString(),
      paidAt: inst.paidAt ? inst.paidAt.toISOString() : null,
      status: inst.status,
    })),
  }));
}

export async function createLoanWithScheduleACID(
  userId: string,
  input: CreateLoanWithAmortizationInput
): Promise<SerializedLoanAccount> {
  const firstDueDate = new Date(input.firstDueDate);
  const schedule = generateAmortizationSchedule({
    principal: input.principalAmount,
    annualInterestRate: input.annualInterestRate,
    termMonths: input.termMonths,
    firstDueDate,
  });

  return prisma.$transaction(async (tx) => {
    const account = await tx.account.create({
      data: {
        userId,
        name: input.name,
        institution: input.institution || null,
        type: "LOAN_LIABILITY",
        currency: input.currency,
        currentBalance: input.principalAmount,
        originalPrincipal: input.principalAmount,
        interestRate: input.annualInterestRate,
        termMonths: input.termMonths,
        paymentDueDay: firstDueDate.getDate(),
        color: "#e11d48",
      },
    });

    await tx.loanInstallment.createMany({
      data: schedule.map((row) => ({
        accountId: account.id,
        installmentNumber: row.installmentNumber,
        totalInstallments: row.totalInstallments,
        amount: row.amount,
        capitalAmount: row.capitalAmount,
        interestAmount: row.interestAmount,
        remainingBalance: row.remainingBalance,
        dueDate: row.dueDate,
        status: "PENDING",
      })),
    });

    const createdWithInstallments = await tx.account.findUniqueOrThrow({
      where: { id: account.id },
      include: {
        loanInstallments: { orderBy: { installmentNumber: "asc" } },
      },
    });

    return {
      id: createdWithInstallments.id,
      name: createdWithInstallments.name,
      institution: createdWithInstallments.institution,
      currency: createdWithInstallments.currency,
      currentBalance: toNumber(createdWithInstallments.currentBalance),
      originalPrincipal: toNumber(createdWithInstallments.originalPrincipal),
      interestRate: toNumber(createdWithInstallments.interestRate),
      termMonths:
        createdWithInstallments.termMonths ??
        createdWithInstallments.loanInstallments.length,
      paymentDueDay: createdWithInstallments.paymentDueDay,
      installments: createdWithInstallments.loanInstallments.map((inst) => ({
        id: inst.id,
        accountId: inst.accountId,
        installmentNumber: inst.installmentNumber,
        totalInstallments: inst.totalInstallments,
        amount: toNumber(inst.amount),
        capitalAmount: toNumber(inst.capitalAmount),
        interestAmount: toNumber(inst.interestAmount),
        remainingBalance: toNumber(inst.remainingBalance),
        dueDate: inst.dueDate.toISOString(),
        paidAt: inst.paidAt ? inst.paidAt.toISOString() : null,
        status: inst.status,
      })),
    };
  });
}

/**
 * Paga una cuota de la tabla de amortización de forma atómica (ACID):
 * 1. Descuenta el monto total de la cuota (capital + interés) de la cuenta origen.
 * 2. Descuenta el capital amortizado del saldo pasivo del préstamo (LOAN_LIABILITY).
 * 3. Marca la cuota como PAID.
 * 4. Crea la transacción LOAN_PAYMENT vinculada a loanInstallmentId.
 */
export async function payLoanInstallmentACID(
  userId: string,
  input: PayLoanInstallmentInput
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const installment = await tx.loanInstallment.findUnique({
      where: { id: input.installmentId },
      include: { account: true },
    });

    if (!installment || installment.account.userId !== userId) {
      throw new Error("No se encontró la cuota seleccionada.");
    }

    if (installment.status === "PAID") {
      throw new Error("Esta cuota ya fue pagada anteriormente.");
    }

    const originAccount = await tx.account.findFirst({
      where: { id: input.originAccountId, userId },
    });

    if (!originAccount) {
      throw new Error("La cuenta de origen seleccionada no es válida.");
    }

    const totalInstallmentAmount = toNumber(installment.amount);
    const capitalPart = toNumber(installment.capitalAmount);

    // A1: descontar el monto total de la cuenta origen de forma atómica.
    const debited = await tx.account.updateMany({
      where: {
        id: originAccount.id,
        userId,
        currentBalance: { gte: totalInstallmentAmount },
      },
      data: { currentBalance: { decrement: totalInstallmentAmount } },
    });
    if (debited.count === 0) {
      throw new Error(
        `Saldo insuficiente en ${originAccount.name} para cubrir la cuota de $${totalInstallmentAmount.toFixed(
          2
        )}.`
      );
    }

    // 2. Descontar el capital amortizado del pasivo (decrement, no valor absoluto).
    await tx.account.update({
      where: { id: installment.accountId },
      data: { currentBalance: { decrement: capitalPart } },
    });

    // 3. Marcar cuota como PAID
    const now = new Date();
    await tx.loanInstallment.update({
      where: { id: installment.id },
      data: {
        status: "PAID",
        paidAt: now,
      },
    });

    // 4. Obtener o crear categoría de Pago de Préstamo por clave única (no arbitraria).
    const loanCategory = await tx.category.upsert({
      where: {
        name_type: { name: "Amortización de Deuda", type: "TRANSFER" },
      },
      update: {},
      create: {
        name: "Amortización de Deuda",
        icon: "Landmark",
        color: "#0f766e",
        type: "TRANSFER",
      },
    });

    // 5. Generar transacción asociada
    await tx.transaction.create({
      data: {
        userId,
        accountId: originAccount.id,
        destinationAccountId: installment.accountId,
        categoryId: loanCategory.id,
        loanInstallmentId: installment.id,
        title: `Cuota ${installment.installmentNumber}/${installment.totalInstallments} — ${installment.account.name}`,
        description: `Capital: $${capitalPart.toFixed(2)} | Interés: $${toNumber(
          installment.interestAmount
        ).toFixed(2)}`,
        amount: totalInstallmentAmount,
        date: now,
        transactionType: "LOAN_PAYMENT",
        receiptUrl: input.receiptUrl || null,
        isRecurring: false,
        isReconciled: true,
      },
    });
  });
}
