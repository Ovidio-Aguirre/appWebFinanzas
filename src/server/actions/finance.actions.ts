"use server";

import { revalidatePath } from "next/cache";
import { startOfMonth, endOfMonth } from "date-fns";
import { ensureUserExists } from "@/lib/prisma/bootstrap";
import { prisma } from "@/lib/prisma";
import {
  CreateAccountSchema,
  type CreateAccountInput,
  type SerializedAccount,
} from "@/modules/accounts/schemas";
import {
  calculateNetWorthBreakdown,
  createAccountInDb,
  getAccountsByUser,
  type NetWorthBreakdown,
} from "@/modules/accounts/repository";
import {
  CreateCategorySchema,
  type CreateCategoryInput,
  QuickCaptureTransactionSchema,
  type QuickCaptureTransactionInput,
  type SerializedTransaction,
} from "@/modules/transactions/schemas";
import {
  calculateMonthlyCashflow,
  getTransactionsByUser,
  getTransactionsInRange,
  recordTransactionACID,
  toggleTransactionReconciledInDb,
  type MonthlyCashflowSummary,
} from "@/modules/transactions/repository";
import {
  CreateRecurringRuleSchema,
  type CreateRecurringRuleInput,
  type SerializedRecurringRule,
} from "@/modules/subscriptions/schemas";
import {
  createRecurringRuleInDb,
  executeRecurringRuleACID,
  getRecurringRulesByUser,
  toggleRecurringRuleAutoPostInDb,
} from "@/modules/subscriptions/repository";
import {
  CreateLoanWithAmortizationSchema,
  PayLoanInstallmentSchema,
  type CreateLoanWithAmortizationInput,
  type PayLoanInstallmentInput,
  type SerializedLoanAccount,
} from "@/modules/loans/schemas";
import {
  createLoanWithScheduleACID,
  getLoansWithInstallmentsByUser,
  payLoanInstallmentACID,
} from "@/modules/loans/repository";
import {
  ContributeToSavingsGoalSchema,
  CreateSavingsGoalSchema,
  type ContributeToSavingsGoalInput,
  type CreateSavingsGoalInput,
  type SerializedSavingsGoal,
} from "@/modules/savings/schemas";
import {
  contributeToSavingsGoalACID,
  createSavingsGoalACID,
  getSavingsGoalsByUser,
} from "@/modules/savings/repository";

export interface ActionResult<T = undefined> {
  success: boolean;
  message: string;
  data?: T;
}

export interface SerializedCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER" | "INVESTMENT";
}

export interface FinancialWorkspaceSnapshot {
  user: {
    id: string;
    name: string;
    email: string;
    preferredCurrency: string;
    locale: string;
  };
  accounts: SerializedAccount[];
  categories: SerializedCategory[];
  transactions: SerializedTransaction[];
  recurringRules: SerializedRecurringRule[];
  loans: SerializedLoanAccount[];
  savingsGoals: SerializedSavingsGoal[];
  netWorth: NetWorthBreakdown;
  monthlyCashflow: MonthlyCashflowSummary;
}

/**
 * Carga todo el estado financiero normalizado para el Dashboard y los 6 módulos.
 */
export async function getFinancialWorkspaceData(): Promise<FinancialWorkspaceSnapshot> {
  const user = await ensureUserExists();

  const [accounts, categoriesRaw, transactions, recurringRules, loans, savingsGoals] =
    await Promise.all([
      getAccountsByUser(user.id),
      prisma.category.findMany({ orderBy: { name: "asc" } }),
      getTransactionsByUser(user.id, 100),
      getRecurringRulesByUser(user.id),
      getLoansWithInstallmentsByUser(user.id),
      getSavingsGoalsByUser(user.id),
    ]);

  const netWorth = calculateNetWorthBreakdown(accounts);

  // Flujo de caja sobre todas las transacciones del mes (no limitado a 100).
  const now = new Date();
  const monthTransactions = await getTransactionsInRange(
    user.id,
    startOfMonth(now),
    endOfMonth(now)
  );
  const monthlyCashflow = calculateMonthlyCashflow(monthTransactions);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      preferredCurrency: user.preferredCurrency,
      locale: user.locale,
    },
    accounts,
    categories: categoriesRaw.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
      type: c.type,
    })),
    transactions,
    recurringRules,
    loans,
    savingsGoals,
    netWorth,
    monthlyCashflow,
  };
}

/**
 * Crea una nueva categoría de gasto/ingreso para el usuario autenticado.
 */
export async function createCategoryAction(
  rawInput: CreateCategoryInput
): Promise<ActionResult<SerializedCategory>> {
  try {
    const parsed = CreateCategorySchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        message:
          parsed.error.issues[0]?.message ?? "Datos de categoría inválidos",
      };
    }

    const created = await prisma.category.create({
      data: {
        name: parsed.data.name,
        type: parsed.data.type,
        icon: parsed.data.icon,
        color: parsed.data.color,
      },
    });

    revalidatePath("/");
    return {
      success: true,
      message: `Categoría "${created.name}" creada exitosamente.`,
      data: {
        id: created.id,
        name: created.name,
        icon: created.icon,
        color: created.color,
        type: created.type,
      },
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Error al crear la categoría.",
    };
  }
}

/**
 * Módulo A: Registra una compra, pago de tarjeta/cuota, ingreso o transferencia con ACID
 */
export async function createQuickTransactionAction(
  rawInput: QuickCaptureTransactionInput
): Promise<ActionResult<SerializedTransaction>> {
  try {
    const parsed = QuickCaptureTransactionSchema.safeParse(rawInput);
    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message ?? "Datos del movimiento inválidos";
      return { success: false, message: firstError };
    }

    const user = await ensureUserExists();
    const created = await recordTransactionACID(user.id, parsed.data);

    revalidatePath("/");
    return {
      success: true,
      message: "Movimiento registrado y saldos actualizados correctamente.",
      data: created,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Error inesperado al registrar la transacción.";
    return { success: false, message };
  }
}

/**
 * Concilia una transacción con el estado de cuenta bancario
 */
export async function toggleReconciledAction(
  transactionId: string,
  isReconciled: boolean
): Promise<ActionResult> {
  try {
    const user = await ensureUserExists();
    await toggleTransactionReconciledInDb(user.id, transactionId, isReconciled);
    revalidatePath("/");
    return {
      success: true,
      message: isReconciled
        ? "Transacción conciliada con estado de cuenta."
        : "Conciliación removida.",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la conciliación.",
    };
  }
}

/**
 * Módulo B: Crea una nueva cuenta o tarjeta de crédito
 */
export async function createAccountAction(
  rawInput: CreateAccountInput
): Promise<ActionResult<SerializedAccount>> {
  try {
    const parsed = CreateAccountSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        message: parsed.error.issues[0]?.message ?? "Datos de cuenta inválidos",
      };
    }

    const user = await ensureUserExists();
    const created = await createAccountInDb(user.id, parsed.data);
    revalidatePath("/");

    return {
      success: true,
      message: `Cuenta "${created.name}" creada exitosamente.`,
      data: created,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Error al crear la cuenta financiera.",
    };
  }
}

/**
 * Módulo C: Crea una suscripción, salario o remesa recurrente
 */
export async function createRecurringRuleAction(
  rawInput: CreateRecurringRuleInput
): Promise<ActionResult<SerializedRecurringRule>> {
  try {
    const parsed = CreateRecurringRuleSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        message:
          parsed.error.issues[0]?.message ??
          "Datos de regla recurrente inválidos",
      };
    }

    const user = await ensureUserExists();
    const created = await createRecurringRuleInDb(user.id, parsed.data);
    revalidatePath("/");

    return {
      success: true,
      message: `Programación "${created.title}" guardada.`,
      data: created,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Error al guardar la regla recurrente.",
    };
  }
}

/**
 * Módulo C: Ejecuta una regla recurrente en una operación ACID
 */
export async function executeRecurringRuleAction(
  ruleId: string
): Promise<ActionResult<{ nextExecutionDate: string }>> {
  try {
    const user = await ensureUserExists();
    const result = await executeRecurringRuleACID(user.id, ruleId);
    revalidatePath("/");
    return {
      success: true,
      message: "Ejecución confirmada. Se generó el movimiento y actualizó el saldo.",
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Error al ejecutar la programación recurrente.",
    };
  }
}

export async function toggleRecurringAutoPostAction(
  ruleId: string,
  autoPost: boolean
): Promise<ActionResult> {
  try {
    const user = await ensureUserExists();
    await toggleRecurringRuleAutoPostInDb(user.id, ruleId, autoPost);
    revalidatePath("/");
    return {
      success: true,
      message: autoPost
        ? "Autoregistro automático activado."
        : "Autoregistro cambiado a confirmación manual.",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "No se pudo cambiar la preferencia de autoregistro.",
    };
  }
}

/**
 * Módulo D: Registra un préstamo con su tabla de amortización completa
 */
export async function createLoanWithScheduleAction(
  rawInput: CreateLoanWithAmortizationInput
): Promise<ActionResult<SerializedLoanAccount>> {
  try {
    const parsed = CreateLoanWithAmortizationSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        message:
          parsed.error.issues[0]?.message ?? "Datos del préstamo inválidos",
      };
    }

    const user = await ensureUserExists();
    const created = await createLoanWithScheduleACID(user.id, parsed.data);
    revalidatePath("/");

    return {
      success: true,
      message: `Préstamo "${created.name}" creado con ${created.installments.length} cuotas amortizables.`,
      data: created,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Error al generar el financiamiento y su tabla de amortización.",
    };
  }
}

/**
 * Módulo D: Paga una cuota de préstamo descontando el pasivo total y creando la transacción (ACID)
 */
export async function payLoanInstallmentAction(
  rawInput: PayLoanInstallmentInput
): Promise<ActionResult> {
  try {
    const parsed = PayLoanInstallmentSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        message:
          parsed.error.issues[0]?.message ?? "Datos de pago de cuota inválidos",
      };
    }

    const user = await ensureUserExists();
    await payLoanInstallmentACID(user.id, parsed.data);
    revalidatePath("/");

    return {
      success: true,
      message:
        "Cuota pagada con éxito. Se amortizó el pasivo y se descontó de la cuenta origen.",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "No se pudo procesar el pago de la cuota.",
    };
  }
}

/**
 * Módulo E: Crea una nueva Bóveda / Meta de Ahorro
 */
export async function createSavingsGoalAction(
  rawInput: CreateSavingsGoalInput
): Promise<ActionResult<SerializedSavingsGoal>> {
  try {
    const parsed = CreateSavingsGoalSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        message:
          parsed.error.issues[0]?.message ?? "Datos de la meta inválidos",
      };
    }

    const user = await ensureUserExists();
    const created = await createSavingsGoalACID(user.id, parsed.data);
    revalidatePath("/");

    return {
      success: true,
      message: `Bóveda "${created.name}" creada exitosamente.`,
      data: created,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Error al crear la bóveda de ahorro.",
    };
  }
}

/**
 * Módulo E: Transfiere fondos desde una cuenta corriente hacia una bóveda de ahorro (ACID)
 */
export async function contributeToSavingsGoalAction(
  rawInput: ContributeToSavingsGoalInput
): Promise<ActionResult> {
  try {
    const parsed = ContributeToSavingsGoalSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        message:
          parsed.error.issues[0]?.message ?? "Datos de transferencia inválidos",
      };
    }

    const user = await ensureUserExists();
    await contributeToSavingsGoalACID(user.id, parsed.data);
    revalidatePath("/");

    return {
      success: true,
      message: "Fondos transferidos a la bóveda de ahorro exitosamente.",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Error al transferir fondos a la bóveda.",
    };
  }
}
