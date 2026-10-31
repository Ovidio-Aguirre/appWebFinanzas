"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Layers,
  Loader2,
  Plus,
  ShieldAlert,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  CreateAccountSchema,
  type CreateAccountInput,
  type SerializedAccount,
} from "@/modules/accounts/schemas";
import type {
  SerializedTransaction,
  TransactionTypeValue,
} from "@/modules/transactions/schemas";
import { createAccountAction } from "@/server/actions/finance.actions";
import {
  formatCurrency,
  formatShortDate,
  getDaysUntilDayOfMonth,
} from "@/lib/utils";

interface CreditCardsModuleProps {
  accounts: SerializedAccount[];
  transactions: SerializedTransaction[];
  onOpenQuickCapture: (
    type: TransactionTypeValue,
    destinationAccountId?: string
  ) => void;
}

export function CreditCardsModule({
  accounts,
  transactions,
  onOpenQuickCapture,
}: CreditCardsModuleProps) {
  const [showNewAccountModal, setShowNewAccountModal] = useState(false);

  const creditCards = accounts.filter((a) => a.type === "CREDIT_CARD");
  const liquidAccounts = accounts.filter(
    (a) =>
      a.type === "CASH" || a.type === "DEBIT" || a.type === "SAVINGS_VAULT"
  );

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateAccountInput>({
    resolver: zodResolver(CreateAccountSchema),
    defaultValues: {
      name: "",
      institution: "",
      type: "CREDIT_CARD",
      currency: "USD",
      currentBalance: 0,
      lastFourDigits: "",
      color: "#0f766e",
      creditLimit: 3000,
      cutoffDay: 15,
      paymentDueDay: 5,
      interestRate: 29.9,
      noInterestPayment: 0,
      minimumPayment: 0,
    },
  });

  const watchedAccountType = watch("type");

  const onSubmitNewAccount = async (values: CreateAccountInput) => {
    const res = await createAccountAction(values);
    if (!res.success) {
      toast.error(res.message);
      return;
    }
    toast.success(res.message);
    reset();
    setShowNewAccountModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Encabezado y resumen de cuentas líquidas + botón de alta */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-teal-400" />
            Dashboard de Tarjetas de Crédito y Liquidez
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Control de fecha de corte, fecha límite de pago, pago para no generar intereses y proyección MSI
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowNewAccountModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 hover:brightness-110 px-4 py-2.5 text-xs font-bold text-slate-950 transition shadow-lg shadow-teal-500/15"
        >
          <Plus className="h-4 w-4" />
          <span>Nueva Tarjeta / Cuenta</span>
        </button>
      </div>

      {/* Tarjetas de Crédito Detalladas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {creditCards.map((card) => {
          const limit = card.creditLimit ?? 1;
          const consumed = card.currentBalance;
          const available = Math.max(0, limit - consumed);
          const utilizationPercent = Math.min(
            100,
            Math.round((consumed / limit) * 100)
          );

          const cutoffInfo = getDaysUntilDayOfMonth(card.cutoffDay);
          const dueInfo = getDaysUntilDayOfMonth(card.paymentDueDay);
          const noInterestAmount = card.noInterestPayment ?? consumed;

          // Cuotas MSI asociadas a esta tarjeta
          const cardInstallmentTxs = transactions.filter(
            (tx) => tx.accountId === card.id && tx.installmentsCount > 1
          );

          const monthlyInstallmentProjection = cardInstallmentTxs.reduce(
            (acc, tx) => acc + tx.amount / tx.installmentsCount,
            0
          );

          const isDueSoon = dueInfo.daysRemaining <= 7 && noInterestAmount > 0;

          return (
            <div
              key={card.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-xl flex flex-col justify-between"
            >
              {/* Banner Visual de la Tarjeta */}
              <div
                className="relative p-5 border-b border-white/5 overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${card.color}40 0%, rgba(15,23,42,0.92) 55%, rgba(15,23,42,0.97) 100%)`,
                }}
              >
                <div
                  className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full opacity-20 blur-2xl"
                  style={{ backgroundColor: card.color ?? "#0f766e" }}
                />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-teal-400">
                      {card.institution || "Banca Patrimonial"}
                    </span>
                    <h3 className="text-lg font-bold text-white mt-0.5">
                      {card.name}{" "}
                      {card.lastFourDigits && (
                        <span className="text-xs font-mono text-slate-400 ml-1">
                          •••• {card.lastFourDigits}
                        </span>
                      )}
                    </h3>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold border ${
                      utilizationPercent > 70
                        ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                        : utilizationPercent > 35
                        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                        : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                    }`}
                  >
                    Uso: {utilizationPercent}%
                  </span>
                </div>

                {/* Saldo Consumido vs Línea Disponible */}
                <div className="grid grid-cols-2 gap-4 mt-5">
                  <div>
                    <p className="text-xs text-slate-400">Saldo Consumido</p>
                    <p className="text-xl font-extrabold text-rose-400 tabular-nums">
                      {formatCurrency(consumed, card.currency)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Línea Disponible</p>
                    <p className="text-xl font-extrabold text-emerald-400 tabular-nums">
                      {formatCurrency(available, card.currency)}
                    </p>
                  </div>
                </div>

                {/* Barra de progreso de línea de crédito */}
                <div className="mt-3 space-y-1.5">
                  <div className="h-2.5 w-full rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                    <div
                      className={`h-full transition-all duration-500 ${
                        utilizationPercent > 70
                          ? "bg-rose-500"
                          : utilizationPercent > 35
                          ? "bg-amber-500"
                          : "bg-teal-500"
                      }`}
                      style={{ width: `${utilizationPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Límite Total: {formatCurrency(limit, card.currency)}</span>
                    <span>CAT / Tasa Anual: {card.interestRate ?? 28}%</span>
                  </div>
                </div>
              </div>

              {/* Cuerpo de Indicadores de Corte, Pago y Alertas */}
              <div className="p-5 space-y-4">
                {/* Indicadores visuales de días restantes para Corte y Pago */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <CalendarClock className="h-4 w-4 text-sky-400" />
                      <span>Fecha de Corte (Día {card.cutoffDay})</span>
                    </div>
                    <p className="mt-1.5 text-sm font-bold text-white">
                      Faltan {cutoffInfo.daysRemaining} días
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Próximo corte: {formatShortDate(cutoffInfo.nextDate)}
                    </p>
                  </div>

                  <div
                    className={`rounded-xl border p-3 ${
                      isDueSoon
                        ? "border-amber-500/40 bg-amber-500/10"
                        : "border-slate-800 bg-slate-950/70"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs text-slate-300">
                      <AlertTriangle
                        className={`h-4 w-4 ${
                          isDueSoon ? "text-amber-400" : "text-teal-400"
                        }`}
                      />
                      <span>Límite de Pago (Día {card.paymentDueDay})</span>
                    </div>
                    <p className="mt-1.5 text-sm font-bold text-white">
                      Faltan {dueInfo.daysRemaining} días
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Vence: {formatShortDate(dueInfo.nextDate)}
                    </p>
                  </div>
                </div>

                {/* Alerta de "Pago para no generar intereses" */}
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-amber-200">
                        Pago para no generar intereses:{" "}
                        <span className="text-sm underline decoration-amber-400/60">
                          {formatCurrency(noInterestAmount, card.currency)}
                        </span>
                      </p>
                      <p className="text-[11px] text-amber-300/80">
                        Pago mínimo exigido:{" "}
                        {formatCurrency(
                          card.minimumPayment ?? consumed * 0.1,
                          card.currency
                        )}{" "}
                        • Evita intereses del {card.interestRate ?? 28}% anual
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onOpenQuickCapture("CARD_PAYMENT", card.id)
                    }
                    className="shrink-0 rounded-xl bg-amber-400 hover:bg-amber-300 px-3.5 py-2 text-xs font-bold text-slate-950 transition"
                  >
                    Pagar Tarjeta
                  </button>
                </div>

                {/* Proyección de Cuotas Pendientes Asociadas a la Tarjeta */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Layers className="h-4 w-4 text-indigo-400" />
                      Proyección de Cuotas / MSI en esta Tarjeta
                    </span>
                    <span className="text-xs font-bold text-indigo-300">
                      {formatCurrency(monthlyInstallmentProjection)} / mes
                    </span>
                  </div>

                  {cardInstallmentTxs.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      Sin compras diferidas a cuotas activas en este corte.
                    </p>
                  ) : (
                    <div className="space-y-1.5 pt-1">
                      {cardInstallmentTxs.map((tx) => {
                        const monthlyQuota = tx.amount / tx.installmentsCount;
                        const remainingMonths =
                          tx.installmentsCount - tx.currentInstallment;
                        return (
                          <div
                            key={tx.id}
                            className="flex items-center justify-between text-xs bg-slate-900/90 rounded-lg px-3 py-2 border border-slate-800/80"
                          >
                            <div>
                              <p className="font-medium text-slate-200">
                                {tx.title}
                              </p>
                              <p className="text-[11px] text-slate-400">
                                Cuota {tx.currentInstallment} de{" "}
                                {tx.installmentsCount} ({remainingMonths}{" "}
                                restantes)
                              </p>
                            </div>
                            <span className="font-semibold text-indigo-300 tabular-nums">
                              {formatCurrency(monthlyQuota)}/mes
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cuentas de Efectivo, Débito y Ahorro */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Wallet className="h-4 w-4 text-emerald-400" />
          Cuentas Líquidas (Efectivo, Débito y Ahorro)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {liquidAccounts.map((acc) => (
            <div
              key={acc.id}
              className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 flex items-center justify-between"
            >
              <div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    acc.type === "CASH"
                      ? "text-emerald-400"
                      : acc.type === "DEBIT"
                      ? "text-sky-400"
                      : "text-teal-400"
                  }`}
                >
                  {acc.type === "CASH"
                    ? "Efectivo"
                    : acc.type === "DEBIT"
                    ? "Cuenta Débito"
                    : "Cuenta de Ahorro"}
                </span>
                <p className="text-sm font-bold text-white mt-0.5">
                  {acc.name}
                </p>
                <p className="text-xs text-slate-400">
                  {acc.institution || "Disponible inmediato"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-base font-extrabold text-emerald-400 tabular-nums">
                  {formatCurrency(acc.currentBalance, acc.currency)}
                </p>
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Activa
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal para Crear Nueva Tarjeta o Cuenta */}
      {showNewAccountModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-teal-400" />
                <h3 className="text-base font-bold text-white">
                  Registrar Nueva Tarjeta o Cuenta
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewAccountModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit(onSubmitNewAccount)}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Tipo de Cuenta *
                  </label>
                  <select
                    {...register("type")}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-white"
                  >
                    <option value="CREDIT_CARD">Tarjeta de Crédito</option>
                    <option value="DEBIT">Cuenta de Débito / Nómina</option>
                    <option value="CASH">Efectivo / Billetera</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Nombre de la Cuenta *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Mastercard Black"
                    {...register("name")}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-white"
                  />
                  {errors.name && (
                    <p className="text-[11px] text-rose-400 mt-1">
                      {errors.name.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Institución Bancaria
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. BBVA / BAC / Citi"
                    {...register("institution")}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    {watchedAccountType === "CREDIT_CARD"
                      ? "Saldo Consumido Actual (Deuda) *"
                      : "Saldo Disponible Inicial *"}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...register("currentBalance")}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              {watchedAccountType === "CREDIT_CARD" && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
                  <p className="text-xs font-semibold text-teal-400">
                    Parámetros de Línea de Crédito y Fechas
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Límite de Crédito (USD) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        {...register("creditLimit")}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white"
                      />
                      {errors.creditLimit && (
                        <p className="text-[11px] text-rose-400 mt-0.5">
                          {errors.creditLimit.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Tasa de Interés Anual (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        {...register("interestRate")}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Día de Corte (1-31) *
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        {...register("cutoffDay")}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Día Límite de Pago (1-31) *
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        {...register("paymentDueDay")}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewAccountModal(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 hover:brightness-110 px-4 py-2 text-xs font-bold text-slate-950"
                >
                  {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Crear Cuenta</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
