"use client";

import React, { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Calculator,
  CheckCircle2,
  Clock,
  Landmark,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  CreateLoanWithAmortizationSchema,
  type CreateLoanWithAmortizationInput,
  type SerializedLoanAccount,
} from "@/modules/loans/schemas";
import type { SerializedAccount } from "@/modules/accounts/schemas";
import {
  createLoanWithScheduleAction,
  payLoanInstallmentAction,
} from "@/server/actions/finance.actions";
import { formatCurrency, formatShortDate, todayLocalIso } from "@/lib/utils";
import { RowActions } from "@/components/ui/crud";
import { DeleteLoanDialog, EditLoanDialog } from "@/components/crud/EditDialogs";

interface LoansModuleProps {
  loans: SerializedLoanAccount[];
  accounts: SerializedAccount[];
}

export function LoansModule({ loans, accounts }: LoansModuleProps) {
  const [showNewLoanModal, setShowNewLoanModal] = useState(false);
  const [editingLoan, setEditingLoan] = useState<SerializedLoanAccount | null>(null);
  const [deletingLoan, setDeletingLoan] = useState<SerializedLoanAccount | null>(null);
  const [selectedOriginAccountId, setSelectedOriginAccountId] = useState<string>(
    () =>
      accounts.find((a) => a.type === "DEBIT" || a.type === "CASH")?.id ?? ""
  );
  const [payingInstallmentId, setPayingInstallmentId] = useState<string | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  const liquidAccounts = accounts.filter(
    (a) => a.type === "DEBIT" || a.type === "CASH"
  );

  const todayIso = todayLocalIso();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateLoanWithAmortizationInput>({
    resolver: zodResolver(CreateLoanWithAmortizationSchema),
    defaultValues: {
      name: "",
      institution: "",
      principalAmount: 5000,
      annualInterestRate: 12.0,
      termMonths: 12,
      firstDueDate: todayIso,
      currency: "USD",
    },
  });

  const handlePayInstallment = (installmentId: string) => {
    if (!selectedOriginAccountId) {
      toast.error("Selecciona una cuenta de débito o efectivo para pagar.");
      return;
    }

    setPayingInstallmentId(installmentId);
    startTransition(async () => {
      const res = await payLoanInstallmentAction({
        installmentId,
        originAccountId: selectedOriginAccountId,
      });
      setPayingInstallmentId(null);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    });
  };

  const onSubmitNewLoan = async (values: CreateLoanWithAmortizationInput) => {
    const res = await createLoanWithScheduleAction(values);
    if (!res.success) {
      toast.error(res.message);
      return;
    }
    toast.success(res.message);
    reset();
    setShowNewLoanModal(false);
  };

  const totalLoanDebt = loans.reduce((acc, l) => acc + l.currentBalance, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Hero Card de Financiamientos y Préstamos (Estilo Banca Móvil) */}
      <div className="relative overflow-hidden rounded-2xl bg-[#111622] border border-white/[0.08] p-5 shadow-xl flex flex-col gap-3.5">
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2">
            <span className="inline-flex p-1.5 rounded-full bg-rose-500/15 text-rose-400">
              <Landmark className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Pasivos y Amortización
            </span>
          </div>
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#1b2233] text-rose-300 font-bold">
            {loans.length} préstamos
          </span>
        </div>

        <div className="relative z-10">
          <span className="text-[11px] text-slate-400 block">
            Saldo Pasivo Total Pendiente
          </span>
          <span className="text-3xl font-extrabold text-white tracking-tight tabular-nums">
            {formatCurrency(totalLoanDebt)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.06] relative z-10">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="text-[11px] text-slate-400 shrink-0">Origen:</span>
            <select
              value={selectedOriginAccountId}
              onChange={(e) => setSelectedOriginAccountId(e.target.value)}
              className="w-full rounded-xl border border-white/[0.08] bg-[#0b0f17] px-2.5 py-1.5 text-xs font-semibold text-white focus:border-emerald-500/60 focus:outline-none"
            >
              {liquidAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({formatCurrency(acc.currentBalance)})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowNewLoanModal(true)}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:brightness-110 active:scale-[0.98] px-3.5 py-2 text-xs font-extrabold text-[#070a10] shadow-md shadow-emerald-500/20 transition"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Nuevo</span>
          </button>
        </div>
      </div>

      {/* 2. Tarjetas de Préstamo con Lista Nativa de Cuotas */}
      {loans.map((loan) => {
        const paidCount = loan.installments.filter(
          (i) => i.status === "PAID"
        ).length;
        const progressPercent =
          loan.installments.length > 0
            ? Math.round((paidCount / loan.installments.length) * 100)
            : 0;

        return (
          <div
            key={loan.id}
            className="rounded-2xl border border-white/[0.08] bg-[#0d121c] overflow-hidden shadow-xl flex flex-col"
          >
            {/* Cabecera del Préstamo */}
            <div className="p-4 border-b border-white/[0.06] bg-gradient-to-b from-[#141b29] to-[#0d121c] space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-300">
                      Amortizable
                    </span>
                    <span className="text-xs text-slate-400 truncate">
                      {loan.institution || "Entidad Financiera"}
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-white mt-1 truncate">
                    {loan.name}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Inicial: {formatCurrency(loan.originalPrincipal)} • Tasa{" "}
                    {loan.interestRate}% • {loan.termMonths} meses
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">
                      Pendiente
                    </span>
                    <span className="text-base font-extrabold text-rose-300 tabular-nums">
                      {formatCurrency(loan.currentBalance, loan.currency)}
                    </span>
                  </div>
                  <RowActions
                    label={loan.name}
                    onEdit={() => setEditingLoan(loan)}
                    onDelete={() => setDeletingLoan(loan)}
                  />
                </div>
              </div>

              {/* Barra de progreso */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Avance de liquidación</span>
                  <span className="font-bold text-emerald-400 tabular-nums">
                    {paidCount}/{loan.installments.length} cuotas (
                    {progressPercent}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#1b2233] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Lista de Cuotas estilo App Móvil */}
            <div className="divide-y divide-white/[0.05] max-h-[380px] overflow-y-auto">
              {loan.installments.map((inst) => {
                const isPaid = inst.status === "PAID";
                const isThisPaying =
                  isPending && payingInstallmentId === inst.id;

                return (
                  <div
                    key={inst.id}
                    className={`p-3.5 flex items-center justify-between gap-3 transition ${
                      isPaid
                        ? "bg-emerald-500/[0.03] opacity-75"
                        : "hover:bg-[#131a28]"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">
                          Cuota {inst.installmentNumber}/
                          {inst.totalInstallments}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          • {formatShortDate(inst.dueDate)}
                        </span>
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.2 text-[10px] font-bold text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" /> Pagada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.2 text-[10px] font-bold text-amber-300">
                            <Clock className="h-3 w-3" /> Pendiente
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 text-[11px] text-slate-400 mt-1 tabular-nums">
                        <span>
                          Cap:{" "}
                          <strong className="text-emerald-400">
                            {formatCurrency(inst.capitalAmount)}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          Int:{" "}
                          <strong className="text-amber-300">
                            {formatCurrency(inst.interestAmount)}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>Resta: {formatCurrency(inst.remainingBalance)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-xs font-mono font-extrabold text-white tabular-nums">
                        {formatCurrency(inst.amount)}
                      </span>
                      {!isPaid && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handlePayInstallment(inst.id)}
                          className="inline-flex items-center gap-1 rounded-xl bg-emerald-500 hover:brightness-110 px-3 py-1.5 text-[11px] font-extrabold text-[#070a10] shadow-sm transition"
                        >
                          {isThisPaying && (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          )}
                          <span>Pagar</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Modal para Registrar Nuevo Préstamo con Amortización */}
      <EditLoanDialog loan={editingLoan} onClose={() => setEditingLoan(null)} />
      <DeleteLoanDialog loan={deletingLoan} onClose={() => setDeletingLoan(null)} />

      {showNewLoanModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-surface-container-lowest/80 backdrop-blur-md p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl border border-white/[0.10] bg-surface-container backdrop-blur-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="w-12 h-1.5 bg-surface-container-highest rounded-full mx-auto mb-3 sm:hidden" />
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                <h3 className="font-display text-base font-bold text-on-surface">
                  Nuevo Financiamiento con Tabla de Amortización
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewLoanModal(false)}
                className="rounded-full p-1.5 bg-surface-container-high text-on-surface-variant hover:bg-surface-bright hover:text-on-surface"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmitNewLoan)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1">
                    Nombre del Préstamo *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Crédito Automotriz / Hipotecario"
                    {...register("name")}
                    className="w-full rounded-xl border border-white/[0.08] bg-surface-container-low px-3 py-2.5 text-xs text-on-surface placeholder:text-outline focus:border-primary/60 focus:outline-none"
                  />
                  {errors.name && (
                    <p className="text-[11px] text-tertiary mt-1">
                      {errors.name.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1">
                    Institución Financiera
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Banco Agrícola / BAC"
                    {...register("institution")}
                    className="w-full rounded-xl border border-white/[0.08] bg-surface-container-low px-3 py-2.5 text-xs text-on-surface placeholder:text-outline focus:border-primary/60 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1">
                    Monto Inicial (USD) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...register("principalAmount")}
                    className="w-full rounded-xl border border-white/[0.08] bg-surface-container-low px-3 py-2.5 text-xs text-on-surface focus:border-primary/60 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1">
                    Tasa Anual (%) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    {...register("annualInterestRate")}
                    className="w-full rounded-xl border border-white/[0.08] bg-surface-container-low px-3 py-2.5 text-xs text-on-surface focus:border-primary/60 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1">
                    Plazo (Meses) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={360}
                    {...register("termMonths")}
                    className="w-full rounded-xl border border-white/[0.08] bg-surface-container-low px-3 py-2.5 text-xs text-on-surface focus:border-primary/60 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">
                  Fecha de Primera Cuota *
                </label>
                <input
                  type="date"
                  {...register("firstDueDate")}
                  className="w-full rounded-xl border border-white/[0.08] bg-surface-container-low px-3 py-2.5 text-xs text-on-surface focus:border-primary/60 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowNewLoanModal(false)}
                  className="rounded-xl border border-white/[0.1] bg-surface-container-high px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-bright"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary hover:brightness-110 px-4 py-2 text-xs font-bold text-on-primary shadow-lg shadow-primary/25"
                >
                  {isSubmitting && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  <span>Generar Tabla de Amortización</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
