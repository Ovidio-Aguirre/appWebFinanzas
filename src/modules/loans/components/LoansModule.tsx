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
import { formatCurrency, formatShortDate } from "@/lib/utils";

interface LoansModuleProps {
  loans: SerializedLoanAccount[];
  accounts: SerializedAccount[];
}

export function LoansModule({ loans, accounts }: LoansModuleProps) {
  const [showNewLoanModal, setShowNewLoanModal] = useState(false);
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

  const todayIso = new Date().toISOString().slice(0, 10);

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

  return (
    <div className="space-y-6">
      {/* Barra superior: Selector de cuenta de pago para cuotas y alta de préstamo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-5">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Landmark className="h-5 w-5 text-teal-400" />
            Financiamientos a Plazo Fijo y Tabla de Amortización
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Cada pago de cuota descuenta el capital del pasivo total y genera la transacción contable ACID
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Pagar cuotas desde:</span>
            <select
              value={selectedOriginAccountId}
              onChange={(e) => setSelectedOriginAccountId(e.target.value)}
              className="rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-xs text-white"
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
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 hover:brightness-110 px-4 py-2.5 text-xs font-bold text-slate-950 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Registrar Préstamo</span>
          </button>
        </div>
      </div>

      {/* Listado de Préstamos y su Tabla de Amortización */}
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
            className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl overflow-hidden shadow-xl"
          >
            {/* Cabecera del Préstamo */}
            <div className="p-5 border-b border-white/10 bg-gradient-to-r from-slate-900 to-slate-800/70 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-300">
                    Pasivo Amortizable
                  </span>
                  <span className="text-xs text-slate-400">
                    {loan.institution || "Entidad Financiera"}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mt-1">
                  {loan.name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Monto Inicial: {formatCurrency(loan.originalPrincipal)} • Tasa
                  Anual: {loan.interestRate}% • Plazo: {loan.termMonths} meses
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <span className="text-xs text-slate-400">
                    Saldo Pasivo Pendiente
                  </span>
                  <p className="text-xl font-extrabold text-rose-400 tabular-nums">
                    {formatCurrency(loan.currentBalance, loan.currency)}
                  </p>
                </div>

                <div className="min-w-[160px]">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Avance de Cuotas</span>
                    <span className="font-bold text-teal-400">
                      {paidCount}/{loan.installments.length} ({progressPercent}
                      %)
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-950 overflow-hidden border border-white/10">
                    <div
                      className="h-full bg-teal-500 transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Tabla Interactiva de Cuotas */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-slate-950/45 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4"># Cuota</th>
                    <th className="py-3 px-4">Vencimiento</th>
                    <th className="py-3 px-4 text-right">Cuota Total</th>
                    <th className="py-3 px-4 text-right">Abono a Capital</th>
                    <th className="py-3 px-4 text-right">Interés</th>
                    <th className="py-3 px-4 text-right">Saldo Insoluto</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-xs">
                  {loan.installments.map((inst) => {
                    const isPaid = inst.status === "PAID";
                    const isThisPaying =
                      isPending && payingInstallmentId === inst.id;

                    return (
                      <tr
                        key={inst.id}
                        className={`transition ${
                          isPaid
                            ? "bg-emerald-950/10 text-slate-400"
                            : "hover:bg-slate-800/40 text-slate-200"
                        }`}
                      >
                        <td className="py-3 px-4 font-bold">
                          Cuota {inst.installmentNumber} /{" "}
                          {inst.totalInstallments}
                        </td>
                        <td className="py-3 px-4">
                          {formatShortDate(inst.dueDate)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-white tabular-nums">
                          {formatCurrency(inst.amount)}
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-400 font-medium tabular-nums">
                          {formatCurrency(inst.capitalAmount)}
                        </td>
                        <td className="py-3 px-4 text-right text-amber-400 tabular-nums">
                          {formatCurrency(inst.interestAmount)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-300 tabular-nums">
                          {formatCurrency(inst.remainingBalance)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                              <CheckCircle2 className="h-3 w-3" /> Pagada
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                              <Clock className="h-3 w-3" /> Pendiente
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {isPaid ? (
                            <span className="text-[11px] text-slate-500">
                              Liquidada
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handlePayInstallment(inst.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500 hover:text-slate-950 border border-teal-500/40 px-3 py-1.5 text-xs font-bold text-teal-300 transition"
                            >
                              {isThisPaying && (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              )}
                              <span>Pagar Cuota</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Modal para Registrar Nuevo Préstamo con Amortización */}
      {showNewLoanModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900/90 backdrop-blur-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-teal-400" />
                <h3 className="text-base font-bold text-white">
                  Nuevo Financiamiento con Tabla de Amortización
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewLoanModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmitNewLoan)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Nombre del Préstamo *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Crédito Automotriz / Hipotecario"
                    {...register("name")}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-xs text-white"
                  />
                  {errors.name && (
                    <p className="text-[11px] text-rose-400 mt-1">
                      {errors.name.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Institución Financiera
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Banco Agrícola / BAC"
                    {...register("institution")}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Monto Inicial (USD) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...register("principalAmount")}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Tasa Anual (%) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    {...register("annualInterestRate")}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Plazo (Meses) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={360}
                    {...register("termMonths")}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Fecha de Primera Cuota *
                </label>
                <input
                  type="date"
                  {...register("firstDueDate")}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowNewLoanModal(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 hover:brightness-110 px-4 py-2 text-xs font-bold text-slate-950"
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
