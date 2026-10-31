"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRightLeft,
  Calendar,
  CheckCircle2,
  Loader2,
  PiggyBank,
  Plus,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  ContributeToSavingsGoalSchema,
  CreateSavingsGoalSchema,
  type ContributeToSavingsGoalInput,
  type CreateSavingsGoalInput,
  type SerializedSavingsGoal,
} from "@/modules/savings/schemas";
import type { SerializedAccount } from "@/modules/accounts/schemas";
import {
  contributeToSavingsGoalAction,
  createSavingsGoalAction,
} from "@/server/actions/finance.actions";
import { formatCurrency, formatShortDate } from "@/lib/utils";
import { RowActions } from "@/components/ui/crud";
import { DeleteGoalDialog, EditGoalDialog } from "@/components/crud/EditDialogs";

interface SavingsModuleProps {
  savingsGoals: SerializedSavingsGoal[];
  accounts: SerializedAccount[];
}

export function SavingsModule({ savingsGoals, accounts }: SavingsModuleProps) {
  const [showNewGoalModal, setShowNewGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SerializedSavingsGoal | null>(null);
  const [deletingGoal, setDeletingGoal] = useState<SerializedSavingsGoal | null>(null);
  const [transferGoal, setTransferGoal] =
    useState<SerializedSavingsGoal | null>(null);

  const checkingAccounts = accounts.filter(
    (a) => a.type === "DEBIT" || a.type === "CASH"
  );

  const totalSavedInGoals = savingsGoals.reduce(
    (acc, g) => acc + g.currentAmount,
    0
  );
  const totalTargetInGoals = savingsGoals.reduce(
    (acc, g) => acc + g.targetAmount,
    0
  );

  // Formulario de Nueva Meta
  const createForm = useForm<CreateSavingsGoalInput>({
    resolver: zodResolver(CreateSavingsGoalSchema),
    defaultValues: {
      name: "",
      targetAmount: 3000,
      initialAmount: 0,
      deadline: "",
      color: "#0d9488",
      icon: "PiggyBank",
    },
  });

  // Formulario de Transferencia a Bóveda
  const contributeForm = useForm<ContributeToSavingsGoalInput>({
    resolver: zodResolver(ContributeToSavingsGoalSchema),
    defaultValues: {
      savingsGoalId: "",
      originAccountId: checkingAccounts[0]?.id ?? "",
      amount: 100,
      note: "",
    },
  });

  const openTransferModal = (goal: SerializedSavingsGoal) => {
    setTransferGoal(goal);
    contributeForm.reset({
      savingsGoalId: goal.id,
      originAccountId: checkingAccounts[0]?.id ?? "",
      amount: Math.min(250, Math.max(50, goal.targetAmount - goal.currentAmount)),
      note: `Aporte a ${goal.name}`,
    });
  };

  const onSubmitCreateGoal = async (values: CreateSavingsGoalInput) => {
    const res = await createSavingsGoalAction(values);
    if (!res.success) {
      toast.error(res.message);
      return;
    }
    toast.success(res.message);
    createForm.reset();
    setShowNewGoalModal(false);
  };

  const onSubmitContribute = async (values: ContributeToSavingsGoalInput) => {
    const res = await contributeToSavingsGoalAction(values);
    if (!res.success) {
      toast.error(res.message);
      return;
    }
    toast.success(res.message);
    setTransferGoal(null);
  };

  return (
    <div className="space-y-6">
      {/* Resumen de Bóvedas de Ahorro */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <PiggyBank className="h-5 w-5 text-teal-600" />
            Bóvedas de Ahorro y Metas Patrimoniales
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Acumulado en alcancías virtuales:{" "}
            <strong className="text-emerald-600">
              {formatCurrency(totalSavedInGoals)}
            </strong>{" "}
            de {formatCurrency(totalTargetInGoals)} objetivo
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowNewGoalModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 hover:brightness-110 px-4 py-2.5 text-xs font-bold text-slate-950 transition"
        >
          <Plus className="h-4 w-4" />
          <span>Nueva Bóveda de Ahorro</span>
        </button>
      </div>

      {/* Tarjetas de Alcancías Virtuales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {savingsGoals.map((goal) => {
          const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
          const isCompleted =
            goal.status === "COMPLETED" || goal.progressPercent >= 100;

          return (
            <div
              key={goal.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between space-y-5 shadow-lg"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-teal-300 bg-teal-100 text-teal-600"
                      style={{
                        borderColor: `${goal.color}55`,
                        backgroundColor: `${goal.color}22`,
                      }}
                    >
                      <Target className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {goal.name}
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        {goal.vaultAccountName || "FinanzaPro Vault"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                      isCompleted
                        ? "bg-emerald-100 text-emerald-600 border-emerald-300"
                        : "bg-teal-100 text-teal-600 border-teal-300"
                    }`}
                  >
                    {goal.progressPercent}%
                  </span>
                  <RowActions
                    label={goal.name}
                    onEdit={() => setEditingGoal(goal)}
                    onDelete={() => setDeletingGoal(goal)}
                  />
                  </div>
                </div>

                {/* Monto ahorrado vs objetivo */}
                <div className="pt-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-extrabold text-emerald-600 tabular-nums">
                      {formatCurrency(goal.currentAmount)}
                    </span>
                    <span className="text-xs text-slate-500">
                      de {formatCurrency(goal.targetAmount)}
                    </span>
                  </div>

                  {/* Barra de progreso porcentual */}
                  <div className="mt-2 h-3 w-full rounded-full bg-white overflow-hidden border border-slate-200">
                    <div
                      className="h-full transition-all duration-500 rounded-full"
                      style={{
                        width: `${goal.progressPercent}%`,
                        backgroundColor: isCompleted ? "#10b981" : goal.color,
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <span>
                    {isCompleted
                      ? "¡Meta completada!"
                      : `Faltan ${formatCurrency(remaining)}`}
                  </span>
                  {goal.deadline && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-slate-500" />
                      {formatShortDate(goal.deadline)}
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => openTransferModal(goal)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 hover:bg-teal-500 hover:text-slate-950 border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 transition"
                >
                  {isCompleted ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>Agregar Aporte Extra</span>
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="h-4 w-4" />
                      <span>Transferir desde Cuenta Corriente</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal para Transferir Saldo desde Cuenta Corriente a Bóveda */}
      {transferGoal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-md p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white backdrop-blur-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-teal-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Transferir a Bóveda: {transferGoal.name}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Actual: {formatCurrency(transferGoal.currentAmount)} / Meta:{" "}
                    {formatCurrency(transferGoal.targetAmount)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTransferGoal(null)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={contributeForm.handleSubmit(onSubmitContribute)}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Cuenta Corriente / Débito de Origen *
                </label>
                <select
                  {...contributeForm.register("originAccountId")}
                  className="w-full rounded-xl border border-slate-200 bg-white/75 px-3 py-2.5 text-xs text-slate-900"
                >
                  {checkingAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (Disponible:{" "}
                      {formatCurrency(acc.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Monto a Transferir (USD) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...contributeForm.register("amount")}
                  className="w-full rounded-xl border border-slate-200 bg-white/75 px-3 py-2.5 text-sm font-bold text-slate-900"
                />
                {contributeForm.formState.errors.amount && (
                  <p className="text-[11px] text-rose-600 mt-1">
                    {contributeForm.formState.errors.amount.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Nota del Aporte
                </label>
                <input
                  type="text"
                  {...contributeForm.register("note")}
                  className="w-full rounded-xl border border-slate-200 bg-white/75 px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setTransferGoal(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={contributeForm.formState.isSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 hover:brightness-110 px-4 py-2 text-xs font-bold text-slate-950"
                >
                  {contributeForm.formState.isSubmitting && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  <span>Confirmar Transferencia ACID</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Crear Nueva Bóveda de Ahorro */}
      <EditGoalDialog goal={editingGoal} onClose={() => setEditingGoal(null)} />
      <DeleteGoalDialog goal={deletingGoal} accounts={accounts} onClose={() => setDeletingGoal(null)} />

      {showNewGoalModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-md p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white backdrop-blur-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-teal-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Crear Nueva Bóveda de Ahorro
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewGoalModal(false)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={createForm.handleSubmit(onSubmitCreateGoal)}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Nombre de la Alcancía / Meta *
                </label>
                <input
                  type="text"
                  placeholder="Ej. Mi meta de ahorro..."
                  {...createForm.register("name")}
                  className="w-full rounded-xl border border-slate-200 bg-white/75 px-3 py-2 text-xs text-slate-900"
                />
                {createForm.formState.errors.name && (
                  <p className="text-[11px] text-rose-600 mt-1">
                    {createForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Meta Objetivo (USD) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...createForm.register("targetAmount")}
                    className="w-full rounded-xl border border-slate-200 bg-white/75 px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Saldo Inicial (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...createForm.register("initialAmount")}
                    className="w-full rounded-xl border border-slate-200 bg-white/75 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Fecha Meta (Opcional)
                  </label>
                  <input
                    type="date"
                    {...createForm.register("deadline")}
                    className="w-full rounded-xl border border-slate-200 bg-white/75 px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Color Identificador
                  </label>
                  <input
                    type="color"
                    {...createForm.register("color")}
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white/75 p-1 cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowNewGoalModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createForm.formState.isSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 hover:brightness-110 px-4 py-2 text-xs font-bold text-slate-950"
                >
                  {createForm.formState.isSubmitting && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  <span>Crear Bóveda</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
