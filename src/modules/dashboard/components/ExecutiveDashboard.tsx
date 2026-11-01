"use client";

import React, { useState } from "react";
import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  ChevronRight,
  CreditCard,
  Eye,
  EyeOff,
  Globe,
  Landmark,
  Layers,
  PieChart,
  Plus,
  Receipt,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
  Wifi,
} from "lucide-react";
import type { NetWorthBreakdown } from "@/modules/accounts/repository";
import type { SerializedAccount } from "@/modules/accounts/schemas";
import type { MonthlyCashflowSummary } from "@/modules/transactions/repository";
import type {
  SerializedTransaction,
  TransactionTypeValue,
} from "@/modules/transactions/schemas";
import {
  formatCurrency,
  formatShortDate,
  getDaysUntilDayOfMonth,
} from "@/lib/utils";
import { TransactionSummaryDialog } from "@/components/crud/TransactionSummaryDialog";

interface ExecutiveDashboardProps {
  netWorth: NetWorthBreakdown;
  monthlyCashflow: MonthlyCashflowSummary;
  accounts: SerializedAccount[];
  transactions?: SerializedTransaction[];
  onOpenQuickCapture: (
    type: TransactionTypeValue,
    destinationAccountId?: string,
    preset?: { accountId?: string; amount?: number; title?: string }
  ) => void;
  onNavigateTab: (tab: string) => void;
  onOpenCategories?: () => void;
}

export function ExecutiveDashboard({
  netWorth,
  monthlyCashflow,
  accounts,
  transactions = [],
  onOpenQuickCapture,
  onNavigateTab,
  onOpenCategories,
}: ExecutiveDashboardProps) {
  const [isBalanceHidden, setIsBalanceHidden] = useState(false);
  const [balanceView, setBalanceView] = useState<"LIQUID" | "NET_WORTH">(
    "LIQUID"
  );
  const [txFilter, setTxFilter] = useState<"ALL" | "EXPENSE" | "INCOME">("ALL");
  const [selectedTx, setSelectedTx] = useState<SerializedTransaction | null>(
    null
  );

  const creditCards = accounts.filter((a) => a.type === "CREDIT_CARD");
  const payrollAccount = accounts.find((a) => a.type === "DEBIT");
  const remittanceAccount = accounts.find((a) => a.type === "CASH");
  const PAYROLL_NET_DEFAULT = 224.38;

  const totalLiquidAvailable =
    netWorth.cashTotal + netWorth.debitTotal + netWorth.savingsVaultTotal;

  const displayedHeroAmount =
    balanceView === "LIQUID"
      ? totalLiquidAvailable
      : netWorth.realLiquidNetWorth;

  const maskOrFormat = (amount: number, currency = "USD") =>
    isBalanceHidden ? "••••••••" : formatCurrency(amount, currency);

  // Ordenar cuentas para el carrusel de tarjetas (primero tarjetas de crédito y débito principal)
  const featuredAccounts = [...accounts].sort((a, b) => {
    const order = { CREDIT_CARD: 1, DEBIT: 2, CASH: 3, SAVINGS_VAULT: 4, LOAN_LIABILITY: 5 };
    return (order[a.type] ?? 9) - (order[b.type] ?? 9);
  });

  // Filtrar transacciones recientes para el widget de Home
  const filteredRecentTx = transactions
    .filter((tx) => {
      if (txFilter === "EXPENSE") {
        return (
          tx.transactionType === "PURCHASE" ||
          tx.transactionType === "BILL_PAYMENT" ||
          tx.transactionType === "LOAN_PAYMENT"
        );
      }
      if (txFilter === "INCOME") {
        return (
          tx.transactionType === "SALARY_INCOME" ||
          tx.transactionType === "REMITTANCE_INCOME"
        );
      }
      return true;
    })
    .slice(0, 6);

  const totalCreditAvailable = Math.max(
    0,
    netWorth.totalCreditLimit - netWorth.creditCardDebtTotal
  );

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Account Balance Hero Card (Idéntico a inicio_dashboard_principal_2) */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#131926] to-[#0c1018] border border-white/[0.08] p-5 shadow-xl">
        {/* Glow effect */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header: Label & View Switcher */}
        <div className="flex items-center justify-between gap-2 relative z-10">
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              {balanceView === "LIQUID"
                ? "Balance Total Disponible"
                : "Patrimonio Líquido Real"}
            </span>
            <button
              type="button"
              onClick={() => setIsBalanceHidden((v) => !v)}
              aria-label="Mostrar u ocultar saldo"
              className="text-slate-400 hover:text-slate-200 transition-colors p-0.5"
            >
              {isBalanceHidden ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Toggle Líquido / Neto */}
          <div className="flex items-center bg-[#070a10]/80 p-0.5 rounded-lg border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setBalanceView("LIQUID")}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                balanceView === "LIQUID"
                  ? "bg-emerald-500 text-[#070a10] shadow-sm"
                  : "text-slate-400 hover:text-white font-semibold"
              }`}
            >
              Líquido
            </button>
            <button
              type="button"
              onClick={() => setBalanceView("NET_WORTH")}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                balanceView === "NET_WORTH"
                  ? "bg-emerald-500 text-[#070a10] shadow-sm"
                  : "text-slate-400 hover:text-white font-semibold"
              }`}
            >
              Neto
            </button>
          </div>
        </div>

        {/* Main Balance Display */}
        <div className="mt-2.5 flex items-baseline gap-2 relative z-10">
          <span
            className={`text-[34px] font-extrabold tracking-tight leading-none tabular-nums ${
              displayedHeroAmount >= 0 ? "text-white" : "text-rose-300"
            }`}
          >
            {maskOrFormat(displayedHeroAmount)}
          </span>
          <span className="text-xs font-semibold text-slate-400">USD</span>
        </div>

        {/* Micro-Pills de Ecuación Patrimonial */}
        <div className="mt-3 grid grid-cols-2 gap-2 relative z-10">
          <div className="rounded-lg bg-[#070a10]/55 border border-white/[0.05] px-2 py-1.5">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 block">
              Efectivo
            </span>
            <span className="text-[11px] font-bold text-emerald-400 tabular-nums truncate block">
              {maskOrFormat(netWorth.cashTotal)}
            </span>
          </div>
          <div className="rounded-lg bg-[#070a10]/55 border border-white/[0.05] px-2 py-1.5">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 block">
              Débito
            </span>
            <span className="text-[11px] font-bold text-emerald-400 tabular-nums truncate block">
              {maskOrFormat(netWorth.debitTotal)}
            </span>
          </div>
          <div className="rounded-lg bg-[#070a10]/55 border border-white/[0.05] px-2 py-1.5">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 block">
              Bóvedas
            </span>
            <span className="text-[11px] font-bold text-cyan-400 tabular-nums truncate block">
              {maskOrFormat(netWorth.savingsVaultTotal)}
            </span>
          </div>
          <div className="rounded-lg bg-[#070a10]/55 border border-rose-500/20 px-2 py-1.5">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 block">
              Deuda TC
            </span>
            <span className="text-[11px] font-bold text-rose-300 tabular-nums truncate block">
              -{maskOrFormat(netWorth.creditCardDebtTotal)}
            </span>
          </div>
        </div>

        {/* Trend + Details Footer */}
        <div className="mt-3.5 pt-3 border-t border-white/[0.06] flex items-center justify-between flex-wrap gap-2 relative z-10">
          <div
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              monthlyCashflow.netCashflow >= 0
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                : "bg-rose-500/15 border-rose-500/30 text-rose-300"
            }`}
          >
            {monthlyCashflow.netCashflow >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            <span>
              {monthlyCashflow.netCashflow >= 0 ? "+" : ""}
              {maskOrFormat(monthlyCashflow.netCashflow)} este mes
            </span>
          </div>

          <button
            type="button"
            onClick={() =>
              setBalanceView((v) => (v === "LIQUID" ? "NET_WORTH" : "LIQUID"))
            }
            className="inline-flex items-center gap-1.5 text-[11px] font-mono font-medium text-slate-400 hover:text-emerald-400 bg-[#070a10]/60 px-2.5 py-1 rounded-lg border border-white/[0.05] transition-colors"
          >
            <span>
              {balanceView === "LIQUID"
                ? `Neto: ${maskOrFormat(netWorth.realLiquidNetWorth)}`
                : `Líquido: ${maskOrFormat(totalLiquidAvailable)}`}
            </span>
            <ArrowRightLeft className="w-3 h-3 text-emerald-400" />
          </button>
        </div>
      </section>

      {/* 2. Core Quick Actions — 4-Column Native Squircle Grid (Idéntico a inicio_dashboard_principal_2) */}
      <section className="grid grid-cols-4 gap-2.5">
        <button
          type="button"
          onClick={() => onOpenQuickCapture("PURCHASE")}
          className="group flex flex-col items-center gap-1.5"
        >
          <div className="w-full py-3.5 rounded-2xl bg-emerald-500 text-[#070a10] font-bold flex items-center justify-center shadow-lg shadow-emerald-500/20 group-active:scale-95 transition-all hover:brightness-110">
            <ArrowUpRight className="w-[22px] h-[22px] stroke-[2.5]" />
          </div>
          <span className="text-xs font-semibold text-slate-200">Gasto</span>
        </button>

        <button
          type="button"
          onClick={() =>
            onOpenQuickCapture("SALARY_INCOME", undefined, {
              accountId: payrollAccount?.id,
              amount: PAYROLL_NET_DEFAULT,
              title: "Pago de Nómina",
            })
          }
          className="group flex flex-col items-center gap-1.5"
        >
          <div className="w-full py-3.5 rounded-2xl bg-[#101521]/90 border border-white/[0.08] hover:border-emerald-500/30 text-emerald-400 flex items-center justify-center group-active:scale-95 transition-all">
            <Plus className="w-[22px] h-[22px] stroke-[2.5]" />
          </div>
          <span className="text-xs font-semibold text-slate-200">Ingresar +</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenQuickCapture("CARD_PAYMENT")}
          className="group flex flex-col items-center gap-1.5"
        >
          <div className="w-full py-3.5 rounded-2xl bg-[#101521]/90 border border-white/[0.08] hover:border-emerald-500/30 text-cyan-400 flex items-center justify-center group-active:scale-95 transition-all">
            <CreditCard className="w-[21px] h-[21px]" />
          </div>
          <span className="text-xs font-semibold text-slate-200">Pagar TC</span>
        </button>

        <button
          type="button"
          onClick={() =>
            onOpenQuickCapture("REMITTANCE_INCOME", undefined, {
              accountId: remittanceAccount?.id,
              title: "Remesa Recibida",
            })
          }
          className="group flex flex-col items-center gap-1.5"
        >
          <div className="w-full py-3.5 rounded-2xl bg-[#101521]/90 border border-white/[0.08] hover:border-emerald-500/30 text-slate-200 flex items-center justify-center group-active:scale-95 transition-all">
            <Globe className="w-[21px] h-[21px] text-emerald-400" />
          </div>
          <span className="text-xs font-semibold text-slate-200">Remesa</span>
        </button>
      </section>

      {/* 3. Tarjetas Asociadas Widget — Carrusel Metálico con Chip EMV Dorado y Círculos Mastercard */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white tracking-tight">
              Tarjetas asociadas
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold">
              {accounts.length} Activas
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab("cards")}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 bg-[#101521] border border-white/[0.07] px-2.5 py-1 rounded-full transition-all"
          >
            <span>Ver todas</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Horizontal Swipeable Cards Carousel */}
        <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1 -mx-4 px-4 snap-x snap-mandatory">
          {featuredAccounts.map((acc, idx) => {
            const isCredit = acc.type === "CREDIT_CARD";
            const availableCredit = isCredit
              ? Math.max(0, (acc.creditLimit ?? 0) - acc.currentBalance)
              : acc.currentBalance;
            const fakeLast4 = (4091 + idx * 1357).toString().slice(-4);

            return (
              <div
                key={acc.id}
                onClick={() => onNavigateTab("cards")}
                className={`snap-center shrink-0 ${
                  featuredAccounts.length === 1 ? "w-full" : "w-[310px]"
                } cursor-pointer relative rounded-2xl p-5 bg-gradient-to-br from-[#121a24] via-[#0d131c] to-[#070b10] border ${
                  isCredit ? "border-emerald-500/25" : "border-cyan-500/20"
                } shadow-2xl overflow-hidden active:scale-[0.99] transition-transform`}
              >
                {/* Background emerald/cyan flare */}
                <div
                  className={`absolute -top-10 -right-10 w-40 h-40 rounded-full blur-2xl pointer-events-none ${
                    isCredit ? "bg-emerald-500/15" : "bg-cyan-500/15"
                  }`}
                />

                <div className="flex items-start justify-between relative z-10">
                  <div className="min-w-0 pr-2">
                    <span
                      className={`text-[12px] font-black tracking-widest uppercase truncate block ${
                        isCredit ? "text-emerald-400" : "text-cyan-400"
                      }`}
                    >
                      {acc.name}
                    </span>
                    <p className="text-[10px] text-slate-400 font-medium truncate">
                      {acc.institution ||
                        (isCredit
                          ? "World Credit • Línea Revolvente"
                          : acc.type === "DEBIT"
                          ? "Cuenta Nómina / Débito"
                          : acc.type === "CASH"
                          ? "Efectivo Disponible"
                          : "Bóveda Patrimonial")}
                    </p>
                  </div>
                  <Wifi
                    className={`w-5 h-5 rotate-90 shrink-0 ${
                      isCredit ? "text-emerald-400/80" : "text-cyan-400/80"
                    }`}
                  />
                </div>

                {/* EMV Chip & Masked Number */}
                <div className="my-5 flex items-center justify-between relative z-10">
                  <div className="w-10 h-7 rounded-md bg-gradient-to-tr from-amber-300 via-amber-200 to-yellow-400 p-[2px] shadow-sm flex flex-col justify-around">
                    <div className="h-[1px] bg-amber-700/40 w-full" />
                    <div className="h-[1px] bg-amber-700/40 w-full" />
                  </div>
                  <span className="font-mono text-sm font-semibold tracking-widest text-slate-100">
                    •••• •••• •••• {fakeLast4}
                  </span>
                </div>

                {/* Card Footer */}
                <div className="flex items-end justify-between pt-1 relative z-10">
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase font-semibold tracking-wider block">
                      {isCredit ? "Disponible TC" : "Saldo Disponible"}
                    </span>
                    <p className="text-sm font-extrabold text-white tracking-wide tabular-nums">
                      {maskOrFormat(availableCredit, acc.currency)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 uppercase font-semibold tracking-wider block">
                        {isCredit ? "DEUDA" : "MONEDA"}
                      </span>
                      <p className="text-xs font-mono font-semibold text-slate-200 tabular-nums">
                        {isCredit
                          ? maskOrFormat(acc.currentBalance, acc.currency)
                          : acc.currency}
                      </p>
                    </div>
                    {/* Mastercard circles */}
                    <div className="flex -space-x-2.5">
                      <div className="w-6 h-6 rounded-full bg-red-500/90 shadow-sm" />
                      <div className="w-6 h-6 rounded-full bg-amber-400/90 shadow-sm" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Financial Health / Credit Limit Pill (Idéntico a inicio_dashboard_principal_2) */}
      <section
        onClick={() => onNavigateTab("cards")}
        className="cursor-pointer rounded-xl bg-[#0d121c] border border-white/[0.06] hover:border-emerald-500/25 p-3.5 flex flex-col gap-2 transition-colors"
      >
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
            <PieChart className="w-4 h-4 text-emerald-400" />
            <span>Uso de línea de crédito</span>
          </div>
          <span
            className={`text-[11px] font-bold ${
              netWorth.overallCreditUtilizationPercent > 50
                ? "text-rose-400"
                : netWorth.overallCreditUtilizationPercent > 30
                ? "text-amber-400"
                : "text-emerald-400"
            }`}
          >
            {netWorth.overallCreditUtilizationPercent}% utilizado
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 rounded-full bg-[#151c2c] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
            style={{
              width: `${Math.min(100, netWorth.overallCreditUtilizationPercent)}%`,
            }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>
            Usado{" "}
            <strong className="text-white tabular-nums">
              {maskOrFormat(netWorth.creditCardDebtTotal)}
            </strong>{" "}
            de {maskOrFormat(netWorth.totalCreditLimit)}
          </span>
          <span className="text-slate-300 font-medium tabular-nums">
            Disp. {maskOrFormat(totalCreditAvailable)}
          </span>
        </div>
      </section>

      {/* 5. Recent Transactions (Movimientos recientes — Idéntico a inicio_dashboard_principal_2) */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold text-white tracking-tight">
            Movimientos recientes
          </h2>
          <button
            type="button"
            onClick={() => onNavigateTab("transactions")}
            className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Ver todos ({transactions.length})
          </button>
        </div>

        {/* Segmented Filters */}
        <div className="flex items-center p-1 bg-[#0d121c] rounded-xl border border-white/[0.06] text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTxFilter("ALL")}
            className={`flex-1 py-1.5 text-center rounded-lg transition-all ${
              txFilter === "ALL"
                ? "bg-emerald-500 text-[#070a10] font-bold shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setTxFilter("EXPENSE")}
            className={`flex-1 py-1.5 text-center rounded-lg transition-all ${
              txFilter === "EXPENSE"
                ? "bg-emerald-500 text-[#070a10] font-bold shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Gastos
          </button>
          <button
            type="button"
            onClick={() => setTxFilter("INCOME")}
            className={`flex-1 py-1.5 text-center rounded-lg transition-all ${
              txFilter === "INCOME"
                ? "bg-emerald-500 text-[#070a10] font-bold shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Ingresos
          </button>
        </div>

        {/* Transactions List */}
        {filteredRecentTx.length === 0 ? (
          <div className="rounded-xl bg-[#0d121c]/90 border border-white/[0.05] p-6 text-center text-xs text-slate-400">
            No hay movimientos registrados en este filtro.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredRecentTx.map((tx) => {
              const isIncome =
                tx.transactionType === "SALARY_INCOME" ||
                tx.transactionType === "REMITTANCE_INCOME";
              const isTransfer =
                tx.transactionType === "CARD_PAYMENT" ||
                tx.transactionType === "TRANSFER";

              return (
                <button
                  key={tx.id}
                  type="button"
                  onClick={() => setSelectedTx(tx)}
                  className="w-full text-left flex items-center justify-between p-3 rounded-xl bg-[#0d121c]/90 border border-white/[0.05] hover:border-white/[0.12] hover:bg-[#121826] transition-all active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center border ${
                        isIncome
                          ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                          : isTransfer
                          ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400"
                          : "bg-rose-500/15 border-rose-500/25 text-rose-400"
                      }`}
                    >
                      {isIncome ? (
                        <ArrowDownLeft className="w-[18px] h-[18px]" />
                      ) : isTransfer ? (
                        <ArrowRightLeft className="w-[18px] h-[18px]" />
                      ) : (
                        <Receipt className="w-[18px] h-[18px]" />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-white truncate">
                        {tx.title}
                      </span>
                      <span className="text-[11px] text-slate-400 truncate">
                        {formatShortDate(tx.date)} •{" "}
                        {tx.categoryName || "General"}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-2">
                    <span
                      className={`text-xs font-mono font-bold tabular-nums ${
                        isIncome
                          ? "text-emerald-400"
                          : isTransfer
                          ? "text-cyan-400"
                          : "text-slate-100"
                      }`}
                    >
                      {isIncome ? "+" : "-"}
                      {maskOrFormat(tx.amount)}
                    </span>
                    <p className="text-[10px] text-slate-400 truncate max-w-[110px]">
                      {tx.accountName}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 6. Distribución por Categorías (Idéntico a an_lisis_de_gastos_2) */}
      <section className="flex flex-col gap-3 pt-1">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">
              Distribución por Categorías
            </h2>
            <span className="text-[11px] text-slate-400">
              {monthlyCashflow.categoryBreakdown.length} grupos en seguimiento •{" "}
              {maskOrFormat(monthlyCashflow.totalExpenses)}
            </span>
          </div>
          {onOpenCategories && (
            <button
              type="button"
              onClick={onOpenCategories}
              className="px-2.5 py-1 rounded-lg bg-[#101521] border border-white/[0.08] text-[11px] font-semibold text-emerald-400 hover:bg-[#151c2c] transition-colors"
            >
              Gestionar
            </button>
          )}
        </div>

        {monthlyCashflow.categoryBreakdown.length === 0 ? (
          <div className="rounded-xl bg-[#0d121c] border border-white/[0.06] p-5 text-center text-xs text-slate-400">
            Aún no hay gastos categorizados este mes.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {monthlyCashflow.categoryBreakdown.map((cat) => (
              <div
                key={cat.categoryId}
                className="p-3.5 rounded-xl bg-[#0d121c] border border-white/[0.06] flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                      style={{
                        backgroundColor: `${cat.color}1f`,
                        borderColor: `${cat.color}40`,
                        color: cat.color,
                      }}
                    >
                      <Layers className="w-[18px] h-[18px]" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-white truncate">
                        {cat.name}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Consumo mensual acumulado
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-xs font-mono font-bold text-white tabular-nums">
                      {maskOrFormat(cat.amount)}
                    </span>
                    <span
                      className="text-[11px] font-semibold tabular-nums"
                      style={{ color: cat.color }}
                    >
                      {cat.percentage}%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-[#151c2c] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${cat.percentage}%`,
                      backgroundColor: cat.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 7. Banner de Seguridad / Acceso a Deudas y Cortes */}
      <section className="grid grid-cols-2 gap-2.5 pt-1">
        <button
          type="button"
          onClick={() => onNavigateTab("cards")}
          className="flex items-center justify-between p-3.5 rounded-2xl bg-[#0d121c] border border-white/[0.06] hover:border-emerald-500/30 transition-all text-left"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="w-[18px] h-[18px]" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-white block truncate">
                Cortes y MSI
              </span>
              <span className="text-[10px] text-slate-400 block truncate">
                {creditCards.length} tarjetas activas
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab("loans")}
          className="flex items-center justify-between p-3.5 rounded-2xl bg-[#0d121c] border border-white/[0.06] hover:border-rose-500/30 transition-all text-left"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 shrink-0">
              <Landmark className="w-[18px] h-[18px]" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-white block truncate">
                Préstamos
              </span>
              <span className="text-[10px] text-slate-400 block truncate">
                -{maskOrFormat(netWorth.loanLiabilityTotal)}
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
        </button>
      </section>

      <TransactionSummaryDialog
        tx={selectedTx}
        onClose={() => setSelectedTx(null)}
      />
    </div>
  );
}
