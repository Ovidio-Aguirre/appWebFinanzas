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
import { RowActions } from "@/components/ui/crud";
import {
  DeleteAccountDialog,
  EditAccountDialog,
} from "@/components/crud/EditDialogs";
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
  const [editingAccount, setEditingAccount] = useState<SerializedAccount | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<SerializedAccount | null>(null);

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

  const [activeSection, setActiveSection] = useState<"CREDIT" | "LIQUID">(
    creditCards.length > 0 ? "CREDIT" : "LIQUID"
  );
  const [selectedCardIdx, setSelectedCardIdx] = useState(0);
  const [showSensitive, setShowSensitive] = useState(false);

  const activeCard = creditCards[selectedCardIdx] ?? creditCards[0] ?? null;

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Selector Superior (Tabs Píldora idéntico a tarjetas_y_seguridad) */}
      <div className="flex items-center p-1 rounded-xl bg-[#111520] border border-white/[0.06]">
        <button
          type="button"
          onClick={() => setActiveSection("CREDIT")}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-200 ${
            activeSection === "CREDIT"
              ? "bg-[#1e2433] text-white shadow-sm"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <CreditCard className="w-4 h-4 text-emerald-400" />
          <span>Física / Crédito ({creditCards.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSection("LIQUID")}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-200 ${
            activeSection === "LIQUID"
              ? "bg-[#1e2433] text-white shadow-sm"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Wallet className="w-4 h-4 text-cyan-400" />
          <span>Cuentas Líquidas ({liquidAccounts.length})</span>
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
        </button>
      </div>

      {activeSection === "CREDIT" ? (
        <>
          {/* Si hay varias tarjetas, selector horizontal de plástico */}
          {creditCards.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-0.5">
              {creditCards.map((c, idx) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCardIdx(idx)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                    idx === selectedCardIdx
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                      : "bg-[#111520] border-white/[0.06] text-slate-400 hover:text-white"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          {activeCard ? (
            (() => {
              const card = activeCard;
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
              const cardInstallmentTxs = transactions.filter(
                (tx) => tx.accountId === card.id && tx.installmentsCount > 1
              );
              const monthlyInstallmentProjection = cardInstallmentTxs.reduce(
                (acc, tx) => acc + tx.amount / tx.installmentsCount,
                0
              );
              const last4 = card.lastFourDigits || "8842";

              return (
                <div className="flex flex-col gap-4">
                  {/* 2. Contenedor Tarjeta Visual Interactiva (Idéntico a tarjetas_y_seguridad/screen.png) */}
                  <div
                    className="relative w-full aspect-[1.586/1] rounded-2xl p-5 overflow-hidden flex flex-col justify-between shadow-2xl border border-white/[0.12] transition-all duration-300"
                    style={{
                      background: `radial-gradient(120% 120% at 85% 15%, ${
                        card.color ?? "#4edea3"
                      }38 0%, rgba(24, 29, 42, 0.96) 55%, #0b0f17 100%)`,
                    }}
                  >
                    <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-emerald-400/15 blur-2xl pointer-events-none" />

                    {/* Header de la Tarjeta */}
                    <div className="flex items-center justify-between z-10">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base text-white tracking-wider font-extrabold uppercase truncate">
                          {card.institution || "VELTIS"}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 shrink-0">
                          Black Elite
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex -space-x-2">
                          <div className="w-6 h-6 rounded-full bg-rose-400/85" />
                          <div className="w-6 h-6 rounded-full bg-cyan-400/85 mix-blend-screen" />
                        </div>
                        <RowActions
                          label={card.name}
                          onEdit={() => setEditingAccount(card)}
                          onDelete={() => setDeletingAccount(card)}
                        />
                      </div>
                    </div>

                    {/* Chip EMV Dorado */}
                    <div className="flex items-center justify-between z-10 my-auto">
                      <div className="w-11 h-8 rounded-md bg-gradient-to-tr from-amber-300 via-yellow-100 to-amber-400 p-1 flex flex-col justify-between shadow-sm relative overflow-hidden">
                        <div className="w-full h-[1px] bg-amber-700/40 my-auto" />
                        <div className="absolute inset-x-0 h-full flex justify-around items-center">
                          <div className="w-[1px] h-full bg-amber-700/30" />
                          <div className="w-[1px] h-full bg-amber-700/30" />
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-black/35 border border-white/[0.08] text-emerald-400 text-[11px] font-bold tabular-nums">
                        Disp: {formatCurrency(available, card.currency)}
                      </span>
                    </div>

                    {/* Footer de la Tarjeta: Números y Titular */}
                    <div className="flex flex-col gap-2 z-10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 font-mono text-lg tracking-widest text-white">
                          {showSensitive ? (
                            <>
                              <span>4532</span>
                              <span>9821</span>
                              <span>7041</span>
                              <span className="text-emerald-400 font-bold">
                                {last4}
                              </span>
                            </>
                          ) : (
                            <>
                              <span>••••</span>
                              <span>••••</span>
                              <span>••••</span>
                              <span className="text-emerald-400 font-bold">
                                {last4}
                              </span>
                            </>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowSensitive((v) => !v)}
                          className="px-2 py-1 rounded-lg bg-white/10 text-slate-300 hover:text-emerald-400 text-[10px] font-bold transition-colors"
                        >
                          {showSensitive ? "Ocultar" : "Ver PAN"}
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-300">
                        <div className="min-w-0 pr-2">
                          <span className="block text-[9px] text-slate-400 uppercase tracking-wider">
                            Plástico Activo
                          </span>
                          <span className="text-xs text-white font-bold uppercase tracking-wide truncate block">
                            {card.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-right shrink-0">
                          <div>
                            <span className="block text-[9px] text-slate-400 uppercase tracking-wider">
                              Corte
                            </span>
                            <span className="font-mono text-xs text-white font-semibold">
                              Día {card.cutoffDay}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[9px] text-slate-400 uppercase tracking-wider">
                              Pago
                            </span>
                            <span className="font-mono text-xs text-emerald-400 font-bold">
                              Día {card.paymentDueDay}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. Botonera Acciones Rápidas Primarias (Idéntico a tarjetas_y_seguridad/screen.png) */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        onOpenQuickCapture("CARD_PAYMENT", card.id)
                      }
                      className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-500 text-[#070a10] text-xs font-extrabold shadow-lg shadow-emerald-500/20 hover:brightness-110 transition-all active:scale-[0.98]"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Pagar Tarjeta</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNewAccountModal(true)}
                      className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#191f2e] hover:bg-[#232b3e] border border-white/[0.08] text-white text-xs font-bold transition-all active:scale-[0.98]"
                    >
                      <Plus className="w-4 h-4 text-cyan-400" />
                      <span>Nueva Tarjeta</span>
                    </button>
                  </div>

                  {/* 4. Barra Límite Mensual de Gasto (Idéntico a tarjetas_y_seguridad/screen.png) */}
                  <div className="p-4 rounded-2xl bg-[#111520] border border-white/[0.06] flex flex-col gap-2.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs text-white font-bold">
                          Límite Mensual de Gasto
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingAccount(card)}
                        className="text-[11px] text-emerald-400 hover:underline font-semibold"
                      >
                        Ajustar ✎
                      </button>
                    </div>

                    <div className="flex items-baseline justify-between mt-0.5">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-extrabold text-white tabular-nums">
                          {formatCurrency(consumed, card.currency)}
                        </span>
                        <span className="text-xs text-slate-400 tabular-nums">
                          / {formatCurrency(limit, card.currency)}
                        </span>
                      </div>
                      <span
                        className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold ${
                          utilizationPercent > 65
                            ? "bg-rose-500/15 text-rose-300"
                            : "bg-emerald-500/15 text-emerald-400"
                        }`}
                      >
                        {utilizationPercent}% usado
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-[#1b2233] overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full transition-all duration-500"
                        style={{ width: `${utilizationPercent}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-slate-400 text-[11px] pt-0.5">
                      <span>
                        Restante:{" "}
                        <strong className="text-white font-semibold tabular-nums">
                          {formatCurrency(available, card.currency)}
                        </strong>
                      </span>
                      <span>Corte en {cutoffInfo.daysRemaining} días</span>
                    </div>
                  </div>

                  {/* 5. Ajustes y Controles de Estado de Cuenta (Lista nativa agrupada) */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                      Estado de Cuenta y Fechas
                    </span>
                    <div className="rounded-2xl bg-[#111520] border border-white/[0.06] overflow-hidden divide-y divide-white/[0.06]">
                      {/* Pago para no generar intereses */}
                      <div className="flex items-center justify-between p-4 gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                            <ShieldAlert className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <span className="block text-sm font-bold text-white leading-tight">
                              Pago sin Intereses
                            </span>
                            <span className="text-xs text-slate-400 block truncate">
                              Mínimo:{" "}
                              {formatCurrency(
                                card.minimumPayment ?? consumed * 0.1,
                                card.currency
                              )}{" "}
                              • Tasa {card.interestRate ?? 28}%
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="block text-sm font-extrabold text-emerald-400 tabular-nums">
                            {formatCurrency(noInterestAmount, card.currency)}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              onOpenQuickCapture("CARD_PAYMENT", card.id)
                            }
                            className="text-[11px] font-bold text-cyan-400 hover:underline"
                          >
                            Abonar →
                          </button>
                        </div>
                      </div>

                      {/* Fecha de Corte */}
                      <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#191f2e] text-cyan-400 flex items-center justify-center shrink-0">
                            <CalendarClock className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="block text-sm font-bold text-white leading-tight">
                              Fecha de Corte (Día {card.cutoffDay})
                            </span>
                            <span className="text-xs text-slate-400">
                              Próximo cierre:{" "}
                              {formatShortDate(cutoffInfo.nextDate)}
                            </span>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-[#191f2e] text-xs font-bold text-slate-200">
                          {cutoffInfo.daysRemaining} días
                        </span>
                      </div>

                      {/* Fecha Límite de Pago */}
                      <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                            <AlertTriangle className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="block text-sm font-bold text-white leading-tight">
                              Fecha Límite (Día {card.paymentDueDay})
                            </span>
                            <span className="text-xs text-slate-400">
                              Vencimiento: {formatShortDate(dueInfo.nextDate)}
                            </span>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-xs font-bold text-amber-300">
                          {dueInfo.daysRemaining} días
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 6. Proyección de Cuotas / MSI */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Compras a Meses (MSI)
                      </span>
                      <span className="text-xs font-bold text-cyan-400 tabular-nums">
                        {formatCurrency(monthlyInstallmentProjection)} / mes
                      </span>
                    </div>

                    <div className="rounded-2xl bg-[#111520] border border-white/[0.06] overflow-hidden divide-y divide-white/[0.06]">
                      {cardInstallmentTxs.length === 0 ? (
                        <div className="p-4 text-xs text-slate-400 text-center">
                          Sin compras diferidas a cuotas activas en este plástico.
                        </div>
                      ) : (
                        cardInstallmentTxs.map((tx) => {
                          const monthlyQuota = tx.amount / tx.installmentsCount;
                          const remainingMonths =
                            tx.installmentsCount - tx.currentInstallment;
                          return (
                            <div
                              key={tx.id}
                              className="flex items-center justify-between p-4"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0">
                                  <Layers className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-white truncate">
                                    {tx.title}
                                  </p>
                                  <p className="text-xs text-slate-400">
                                    Cuota {tx.currentInstallment}/
                                    {tx.installmentsCount} ({remainingMonths}{" "}
                                    restantes)
                                  </p>
                                </div>
                              </div>
                              <span className="text-sm font-bold text-cyan-400 tabular-nums shrink-0 pl-2">
                                {formatCurrency(monthlyQuota)}/mes
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="rounded-2xl bg-[#111520] border border-white/[0.06] p-6 text-center space-y-3">
              <p className="text-xs text-slate-400">
                No tienes tarjetas de crédito registradas todavía.
              </p>
              <button
                type="button"
                onClick={() => setShowNewAccountModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-[#070a10]"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Tarjeta</span>
              </button>
            </div>
          )}
        </>
      ) : (
        /* Vista de Cuentas Líquidas (Efectivo, Débito y Ahorro) */
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Efectivo, Débito y Bóvedas
            </span>
            <button
              type="button"
              onClick={() => setShowNewAccountModal(true)}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-xs font-bold text-emerald-400"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nueva Cuenta</span>
            </button>
          </div>

          <div className="rounded-2xl bg-[#111520] border border-white/[0.06] overflow-hidden divide-y divide-white/[0.06]">
            {liquidAccounts.map((acc) => (
              <div
                key={acc.id}
                className="p-4 flex items-center justify-between gap-3 hover:bg-[#161c2a] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 flex items-center justify-center shrink-0">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                      {acc.type === "CASH"
                        ? "Efectivo"
                        : acc.type === "DEBIT"
                        ? "Cuenta Débito"
                        : "Bóveda de Ahorro"}
                    </span>
                    <p className="text-sm font-bold text-white truncate">
                      {acc.name}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {acc.institution || "Disponible inmediato"}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-extrabold text-emerald-400 tabular-nums">
                    {formatCurrency(acc.currentBalance, acc.currency)}
                  </p>
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    <span className="text-[10px] text-slate-400">Activa</span>
                    <RowActions
                      label={acc.name}
                      onEdit={() => setEditingAccount(acc)}
                      onDelete={() => setDeletingAccount(acc)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal para Crear Nueva Tarjeta o Cuenta */}
      <EditAccountDialog account={editingAccount} onClose={() => setEditingAccount(null)} />
      <DeleteAccountDialog account={deletingAccount} onClose={() => setDeletingAccount(null)} />

      {showNewAccountModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-surface-container-lowest/80 backdrop-blur-md p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl border border-white/[0.10] bg-surface-container backdrop-blur-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="w-12 h-1.5 bg-surface-container-highest rounded-full mx-auto mb-3 sm:hidden" />
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="font-display text-base font-bold text-on-surface">
                  Registrar Nueva Tarjeta o Cuenta
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewAccountModal(false)}
                className="rounded-full p-1.5 bg-surface-container-high text-on-surface-variant hover:bg-surface-bright hover:text-on-surface"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit(onSubmitNewAccount)}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1">
                    Tipo de Cuenta *
                  </label>
                  <select
                    {...register("type")}
                    className="w-full rounded-xl border border-white/[0.08] bg-surface-container-low px-3 py-2.5 text-xs text-on-surface focus:border-primary/60 focus:outline-none"
                  >
                    <option value="CREDIT_CARD">Tarjeta de Crédito</option>
                    <option value="DEBIT">Cuenta de Débito / Nómina</option>
                    <option value="CASH">Efectivo / Billetera</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1">
                    Nombre de la Cuenta *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Mastercard Black"
                    {...register("name")}
                    className="w-full rounded-xl border border-white/[0.08] bg-surface-container-low px-3 py-2.5 text-xs text-on-surface placeholder:text-outline focus:border-primary/60 focus:outline-none"
                  />
                  {errors.name && (
                    <p className="text-[11px] text-tertiary mt-1">
                      {errors.name.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1">
                    Institución Bancaria
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. BBVA / BAC / Citi"
                    {...register("institution")}
                    className="w-full rounded-xl border border-white/[0.08] bg-surface-container-low px-3 py-2.5 text-xs text-on-surface placeholder:text-outline focus:border-primary/60 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1">
                    {watchedAccountType === "CREDIT_CARD"
                      ? "Saldo Consumido Actual (Deuda) *"
                      : "Saldo Disponible Inicial *"}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...register("currentBalance")}
                    className="w-full rounded-xl border border-white/[0.08] bg-surface-container-low px-3 py-2.5 text-xs text-on-surface focus:border-primary/60 focus:outline-none"
                  />
                </div>
              </div>

              {watchedAccountType === "CREDIT_CARD" && (
                <div className="rounded-xl border border-white/[0.08] bg-surface-container-low p-4 space-y-3">
                  <p className="text-xs font-semibold text-primary">
                    Parámetros de Línea de Crédito y Fechas
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-on-surface-variant mb-1">
                        Límite de Crédito (USD) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        {...register("creditLimit")}
                        className="w-full rounded-lg border border-white/[0.08] bg-surface-container px-3 py-1.5 text-xs text-on-surface focus:border-primary/60 focus:outline-none"
                      />
                      {errors.creditLimit && (
                        <p className="text-[11px] text-tertiary mt-0.5">
                          {errors.creditLimit.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] text-on-surface-variant mb-1">
                        Tasa de Interés Anual (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        {...register("interestRate")}
                        className="w-full rounded-lg border border-white/[0.08] bg-surface-container px-3 py-1.5 text-xs text-on-surface focus:border-primary/60 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-on-surface-variant mb-1">
                        Día de Corte (1-31) *
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        {...register("cutoffDay")}
                        className="w-full rounded-lg border border-white/[0.08] bg-surface-container px-3 py-1.5 text-xs text-on-surface focus:border-primary/60 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-on-surface-variant mb-1">
                        Día Límite de Pago (1-31) *
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        {...register("paymentDueDay")}
                        className="w-full rounded-lg border border-white/[0.08] bg-surface-container px-3 py-1.5 text-xs text-on-surface focus:border-primary/60 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowNewAccountModal(false)}
                  className="rounded-xl border border-white/[0.1] bg-surface-container-high px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-bright"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary hover:brightness-110 px-4 py-2 text-xs font-bold text-on-primary shadow-lg shadow-primary/25"
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
