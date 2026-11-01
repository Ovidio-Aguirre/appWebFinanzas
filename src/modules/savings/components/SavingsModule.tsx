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

  const plainSavings = accounts.filter(
    (a) =>
      a.type === "SAVINGS_VAULT" &&
      !savingsGoals.some((g) => g.vaultAccountId === a.id)
  );

  const totalSavedInGoals =savingsGoals.reduce(
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

  const totalRemainingToTarget = Math.max(
    0,
    totalTargetInGoals - totalSavedInGoals
  );

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Ambient Hero Card (Idéntico a metas_y_presupuestos/code.html) */}
      <div className="relative w-full overflow-hidden rounded-2xl bg-[#111622] p-5 shadow-xl border border-white/[0.08]">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-36 h-36 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex p-1.5 rounded-full bg-emerald-500/15 text-emerald-400">
                <PiggyBank className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Bolsillos de Ahorro
              </span>
            </div>
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#1b2233] text-emerald-400 font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {savingsGoals.length} activos
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[34px] text-white font-extrabold tracking-tight leading-none tabular-nums">
              {formatCurrency(totalSavedInGoals)}
            </span>
            <p className="text-xs text-slate-400 flex items-center gap-1 flex-wrap">
              <span className="text-emerald-400 font-bold tabular-nums">
                {formatCurrency(totalRemainingToTarget)}
              </span>{" "}
              para alcanzar la meta total conjunta (
              {formatCurrency(totalTargetInGoals)})
            </p>
          </div>

          <div className="pt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowNewGoalModal(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-emerald-500 text-[#070a10] text-xs font-extrabold shadow-lg shadow-emerald-500/25 hover:brightness-110 active:scale-[0.98] transition-all"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Crear nuevo bolsillo</span>
            </button>
          </div>
        </div>
      </div>

      {/* 1b. Ahorros simples: cuentas de ahorro sin meta ni objetivo */}
      {plainSavings.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-white tracking-tight">
              Mis ahorros
            </h2>
            <span className="text-xs font-semibold text-emerald-400 tabular-nums">
              {formatCurrency(
                plainSavings.reduce((s, a) => s + a.currentBalance, 0)
              )}
            </span>
          </div>
          <div className="rounded-2xl bg-[#111622] border border-white/[0.08] divide-y divide-white/[0.06]">
            {plainSavings.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 px-4 py-3.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <PiggyBank className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {a.name}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {a.institution ?? "Ahorro"}
                    </p>
                  </div>
                </div>
                <span className="text-base font-extrabold text-white tabular-nums shrink-0">
                  {formatCurrency(a.currentBalance)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Active Goals Section (Idéntico a "Tus Bolsillos" de metas_y_presupuestos/code.html) */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white tracking-tight">
              Tus Bolsillos
            </h2>
            <span className="w-5 h-5 rounded-full bg-[#191f2e] text-slate-300 text-[11px] flex items-center justify-center font-bold">
              {savingsGoals.length}
            </span>
          </div>
          <span className="text-[11px] text-emerald-400 font-semibold">
            Transferencia ACID
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {savingsGoals.map((goal) => {
            const remaining = Math.max(
              0,
              goal.targetAmount - goal.currentAmount
            );
            const isCompleted =
              goal.status === "COMPLETED" || goal.progressPercent >= 100;
            const accentColor = goal.color || "#4edea3";

            return (
              <div
                key={goal.id}
                className="relative bg-[#0d121c] rounded-2xl p-4 flex flex-col gap-3.5 shadow-md border border-white/[0.06] overflow-hidden"
              >
                <div
                  className="absolute top-0 right-0 w-28 h-28 rounded-full blur-2xl pointer-events-none opacity-15"
                  style={{ backgroundColor: accentColor }}
                />

                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border"
                      style={{
                        backgroundColor: `${accentColor}20`,
                        borderColor: `${accentColor}40`,
                        color: accentColor,
                      }}
                    >
                      <Target className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm text-white font-bold truncate">
                          {goal.name}
                        </h3>
                        {isCompleted && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">
                            Completado
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-slate-400 text-xs mt-0.5">
                        <span className="truncate">
                          {goal.vaultAccountName || "FinanzaPro Vault"}
                        </span>
                        {goal.deadline && (
                          <>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1 text-cyan-400 font-medium shrink-0">
                              <Calendar className="w-3 h-3" />
                              {formatShortDate(goal.deadline)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <RowActions
                    label={goal.name}
                    onEdit={() => setEditingGoal(goal)}
                    onDelete={() => setDeletingGoal(goal)}
                  />
                </div>

                {/* Barra y Montos */}
                <div className="flex flex-col gap-2 relative z-10">
                  <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg text-white font-extrabold tabular-nums">
                        {formatCurrency(goal.currentAmount)}
                      </span>
                      <span className="text-xs text-slate-400 tabular-nums">
                        de {formatCurrency(goal.targetAmount)}
                      </span>
                    </div>
                    <span
                      className="text-xs font-extrabold tabular-nums"
                      style={{ color: isCompleted ? "#4edea3" : accentColor }}
                    >
                      {goal.progressPercent}%
                    </span>
                  </div>

                  <div className="w-full h-2 bg-[#1b2233] rounded-full overflow-hidden p-0.5 relative">
                    <div
                      className="h-full rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(78,222,163,0.5)]"
                      style={{
                        width: `${Math.min(100, goal.progressPercent)}%`,
                        backgroundColor: isCompleted ? "#4edea3" : accentColor,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-slate-400 text-[11px] pt-0.5">
                    <span>
                      {isCompleted ? (
                        <strong className="text-emerald-400">
                          ¡Objetivo alcanzado!
                        </strong>
                      ) : (
                        <>
                          Faltan{" "}
                          <strong className="text-white font-semibold tabular-nums">
                            {formatCurrency(remaining)}
                          </strong>
                        </>
                      )}
                    </span>
                    <span className="text-emerald-400/90 font-medium">
                      Disponibilidad inmediata
                    </span>
                  </div>
                </div>

                {/* Footer con botón + Aportar */}
                <div className="flex items-center justify-between pt-1 border-t border-white/[0.05] gap-2 relative z-10">
                  <span className="text-slate-400 text-[11px] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Sin penalización por retiro
                  </span>
                  <button
                    type="button"
                    onClick={() => openTransferModal(goal)}
                    className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-[#191f2e] hover:bg-emerald-500 text-emerald-400 hover:text-[#070a10] text-xs font-bold active:scale-95 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Aportar</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Modal Bottom-Sheet para Aportar a Bóveda (Idéntico a #quickDepositSheet en metas_y_presupuestos/code.html) */}
      {transferGoal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-2xl border border-white/[0.10] bg-[#131824] p-6 shadow-2xl space-y-4">
            <div className="w-12 h-1.5 bg-white/15 rounded-full mx-auto mb-1 sm:hidden" />

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-white">
                  Aportar a {transferGoal.name}
                </h3>
                <span className="text-xs text-slate-400 tabular-nums">
                  Actual: {formatCurrency(transferGoal.currentAmount)} / Meta:{" "}
                  {formatCurrency(transferGoal.targetAmount)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setTransferGoal(null)}
                className="w-8 h-8 rounded-full bg-[#1e2536] text-slate-400 flex items-center justify-center hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={contributeForm.handleSubmit(onSubmitContribute)}
              className="space-y-4"
            >
              {/* Huge Centered Amount Display */}
              <div className="flex flex-col items-center py-2 space-y-1 rounded-2xl bg-[#0b0f17] border border-white/[0.06]">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Importe a depositar (USD)
                </span>
                <div className="flex items-center justify-center">
                  <span className="text-2xl font-extrabold text-emerald-400 mr-1">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    {...contributeForm.register("amount")}
                    className="bg-transparent text-4xl font-extrabold text-white text-center w-44 focus:outline-none tabular-nums"
                  />
                </div>
                {contributeForm.formState.errors.amount && (
                  <p className="text-[11px] text-rose-400">
                    {contributeForm.formState.errors.amount.message}
                  </p>
                )}
              </div>

              {/* Quick Preset Chips (idéntico a metas_y_presupuestos/code.html) */}
              <div className="flex justify-center gap-2">
                {[25, 50, 100, 250].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() =>
                      contributeForm.setValue("amount", val, {
                        shouldValidate: true,
                      })
                    }
                    className="px-3.5 py-1.5 rounded-full bg-[#1e2536] text-slate-200 text-xs font-bold hover:bg-emerald-500/20 hover:text-emerald-400 border border-white/[0.06] transition-all"
                  >
                    +${val}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Desde Cuenta Corriente / Débito *
                </label>
                <select
                  {...contributeForm.register("originAccountId")}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#0b0f17] px-3 py-2.5 text-xs text-white focus:border-emerald-500/60 focus:outline-none"
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
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nota del Aporte
                </label>
                <input
                  type="text"
                  {...contributeForm.register("note")}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#0b0f17] px-3 py-2 text-xs text-white focus:border-emerald-500/60 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={contributeForm.formState.isSubmitting}
                className="w-full py-3.5 rounded-xl bg-emerald-500 text-[#070a10] text-xs font-extrabold shadow-lg shadow-emerald-500/25 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {contributeForm.formState.isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                <span>Confirmar Depósito</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Crear Nueva Bóveda de Ahorro */}
      <EditGoalDialog goal={editingGoal} onClose={() => setEditingGoal(null)} />
      <DeleteGoalDialog goal={deletingGoal} accounts={accounts} onClose={() => setDeletingGoal(null)} />

      {showNewGoalModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/[0.10] bg-surface-container backdrop-blur-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary border border-primary/25">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h3 className="text-base font-bold text-on-surface">
                  Crear Nueva Bóveda de Ahorro
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewGoalModal(false)}
                className="rounded-xl p-1.5 text-outline hover:bg-surface-container-high hover:text-on-surface transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={createForm.handleSubmit(onSubmitCreateGoal)}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                  Nombre de la Alcancía / Meta *
                </label>
                <input
                  type="text"
                  placeholder="Ej. Mi meta de ahorro..."
                  {...createForm.register("name")}
                  className="w-full rounded-xl border border-white/[0.08] bg-surface-container-highest px-3 py-2 text-xs text-on-surface placeholder:text-outline focus:border-primary/60 focus:outline-none"
                />
                {createForm.formState.errors.name && (
                  <p className="text-[11px] text-tertiary mt-1">
                    {createForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                    Meta Objetivo (USD) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...createForm.register("targetAmount")}
                    className="w-full rounded-xl border border-white/[0.08] bg-surface-container-highest px-3 py-2 text-xs text-on-surface tabular-nums focus:border-primary/60 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                    Saldo Inicial (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...createForm.register("initialAmount")}
                    className="w-full rounded-xl border border-white/[0.08] bg-surface-container-highest px-3 py-2 text-xs text-on-surface tabular-nums focus:border-primary/60 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                    Fecha Meta (Opcional)
                  </label>
                  <input
                    type="date"
                    {...createForm.register("deadline")}
                    className="w-full rounded-xl border border-white/[0.08] bg-surface-container-highest px-3 py-2 text-xs text-on-surface focus:border-primary/60 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                    Color Identificador
                  </label>
                  <input
                    type="color"
                    {...createForm.register("color")}
                    className="h-9 w-full rounded-xl border border-white/[0.08] bg-surface-container-highest p-1 cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.07]">
                <button
                  type="button"
                  onClick={() => setShowNewGoalModal(false)}
                  className="rounded-xl border border-white/[0.10] bg-surface-container-high hover:bg-surface-container-highest px-4 py-2 text-xs font-semibold text-on-surface-variant transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createForm.formState.isSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-primary to-primary-container hover:brightness-110 px-4 py-2 text-xs font-extrabold text-on-primary shadow-lg shadow-primary/20 transition"
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
