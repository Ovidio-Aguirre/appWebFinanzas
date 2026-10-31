"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { toErrorMessage } from "@/lib/errors";
import {
  CreateCategorySchema,
  QuickCaptureTransactionSchema,
  type CreateCategoryInput,
  type QuickCaptureTransactionInput,
} from "@/modules/transactions/schemas";
import {
  deleteTransactionACID,
  updateTransactionACID,
} from "@/modules/transactions/mutations";
import {
  deleteCategoryInDb,
  updateCategoryInDb,
} from "@/modules/transactions/category-mutations";
import {
  UpdateAccountSchema,
  deleteAccountInDb,
  updateAccountInDb,
  type UpdateAccountInput,
} from "@/modules/accounts/mutations";
import {
  CreateRecurringRuleSchema,
  type CreateRecurringRuleInput,
} from "@/modules/subscriptions/schemas";
import {
  deleteRecurringRuleInDb,
  setRecurringRuleActiveInDb,
  updateRecurringRuleInDb,
} from "@/modules/subscriptions/mutations";
import {
  UpdateLoanSchema,
  deleteLoanInDb,
  updateLoanInDb,
  type UpdateLoanInput,
} from "@/modules/loans/mutations";
import {
  UpdateSavingsGoalSchema,
  deleteSavingsGoalInDb,
  updateSavingsGoalInDb,
  type UpdateSavingsGoalInput,
} from "@/modules/savings/mutations";

export interface CrudResult {
  success: boolean;
  message: string;
}

/** Ejecuta una mutación autenticada, revalida la vista y devuelve un resultado seguro. */
async function run(
  fallback: string,
  okMessage: string | ((r: never) => string),
  fn: (userId: string) => Promise<unknown>
): Promise<CrudResult> {
  try {
    const user = await requireUser();
    const result = await fn(user.id);
    revalidatePath("/");
    return {
      success: true,
      message:
        typeof okMessage === "function"
          ? okMessage(result as never)
          : okMessage,
    };
  } catch (error) {
    return { success: false, message: toErrorMessage(error, fallback) };
  }
}

function firstIssue(
  parsed: { success: false; error: { issues: { message: string }[] } },
  fallback: string
): CrudResult {
  return { success: false, message: parsed.error.issues[0]?.message ?? fallback };
}

// ---------------------------------------------------------------- Movimientos
export async function updateTransactionAction(
  transactionId: string,
  raw: QuickCaptureTransactionInput
): Promise<CrudResult> {
  const parsed = QuickCaptureTransactionSchema.safeParse(raw);
  if (!parsed.success) return firstIssue(parsed, "Datos del movimiento inválidos");
  return run("No se pudo actualizar el movimiento.", "Movimiento actualizado.", (uid) =>
    updateTransactionACID(uid, transactionId, parsed.data)
  );
}

export async function deleteTransactionAction(
  transactionId: string
): Promise<CrudResult> {
  return run(
    "No se pudo eliminar el movimiento.",
    "Movimiento eliminado y saldos revertidos.",
    (uid) => deleteTransactionACID(uid, transactionId)
  );
}

// ------------------------------------------------------------------ Categorías
export async function updateCategoryAction(
  categoryId: string,
  raw: CreateCategoryInput
): Promise<CrudResult> {
  const parsed = CreateCategorySchema.safeParse(raw);
  if (!parsed.success) return firstIssue(parsed, "Datos de categoría inválidos");
  return run("No se pudo actualizar la categoría.", "Categoría actualizada.", () =>
    updateCategoryInDb(categoryId, parsed.data)
  );
}

export async function deleteCategoryAction(categoryId: string): Promise<CrudResult> {
  return run("No se pudo eliminar la categoría.", "Categoría eliminada.", () =>
    deleteCategoryInDb(categoryId)
  );
}

// --------------------------------------------------------------------- Cuentas
export async function updateAccountAction(
  accountId: string,
  raw: UpdateAccountInput
): Promise<CrudResult> {
  const parsed = UpdateAccountSchema.safeParse(raw);
  if (!parsed.success) return firstIssue(parsed, "Datos de cuenta inválidos");
  return run("No se pudo actualizar la cuenta.", "Cuenta actualizada.", (uid) =>
    updateAccountInDb(uid, accountId, parsed.data)
  );
}

export async function deleteAccountAction(accountId: string): Promise<CrudResult> {
  return run(
    "No se pudo eliminar la cuenta.",
    (r: { archived: boolean }) =>
      r.archived
        ? "La cuenta tenía historial, por lo que se archivó (ya no aparece ni suma al patrimonio)."
        : "Cuenta eliminada.",
    (uid) => deleteAccountInDb(uid, accountId)
  );
}

// ----------------------------------------------------------------- Recurrentes
export async function updateRecurringRuleAction(
  ruleId: string,
  raw: CreateRecurringRuleInput
): Promise<CrudResult> {
  const parsed = CreateRecurringRuleSchema.safeParse(raw);
  if (!parsed.success) return firstIssue(parsed, "Datos de la programación inválidos");
  return run("No se pudo actualizar la programación.", "Programación actualizada.", (uid) =>
    updateRecurringRuleInDb(uid, ruleId, parsed.data)
  );
}

export async function deleteRecurringRuleAction(ruleId: string): Promise<CrudResult> {
  return run("No se pudo eliminar la programación.", "Programación eliminada.", (uid) =>
    deleteRecurringRuleInDb(uid, ruleId)
  );
}

export async function setRecurringRuleActiveAction(
  ruleId: string,
  active: boolean
): Promise<CrudResult> {
  return run(
    "No se pudo cambiar el estado.",
    active ? "Programación activada." : "Programación pausada.",
    (uid) => setRecurringRuleActiveInDb(uid, ruleId, active)
  );
}

// ------------------------------------------------------------------ Préstamos
export async function updateLoanAction(raw: UpdateLoanInput): Promise<CrudResult> {
  const parsed = UpdateLoanSchema.safeParse(raw);
  if (!parsed.success) return firstIssue(parsed, "Datos del préstamo inválidos");
  return run("No se pudo actualizar el préstamo.", "Préstamo actualizado.", (uid) =>
    updateLoanInDb(uid, parsed.data)
  );
}

export async function deleteLoanAction(loanId: string): Promise<CrudResult> {
  return run(
    "No se pudo eliminar el préstamo.",
    (r: { archived: boolean }) =>
      r.archived
        ? "El préstamo tenía cuotas pagadas, por lo que se archivó para conservar el historial."
        : "Préstamo eliminado.",
    (uid) => deleteLoanInDb(uid, loanId)
  );
}

// -------------------------------------------------------------------- Bóvedas
export async function updateSavingsGoalAction(
  raw: UpdateSavingsGoalInput
): Promise<CrudResult> {
  const parsed = UpdateSavingsGoalSchema.safeParse(raw);
  if (!parsed.success) return firstIssue(parsed, "Datos de la bóveda inválidos");
  return run("No se pudo actualizar la bóveda.", "Bóveda actualizada.", (uid) =>
    updateSavingsGoalInDb(uid, parsed.data)
  );
}

export async function deleteSavingsGoalAction(
  goalId: string,
  returnToAccountId?: string
): Promise<CrudResult> {
  return run("No se pudo eliminar la bóveda.", "Bóveda eliminada.", (uid) =>
    deleteSavingsGoalInDb(uid, goalId, returnToAccountId)
  );
}
