"use client";

import React from "react";
import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  CreditCard,
  Globe,
  Landmark,
  PieChart,
  Receipt,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { NetWorthBreakdown } from "@/modules/accounts/repository";
import type { SerializedAccount } from "@/modules/accounts/schemas";
import type { MonthlyCashflowSummary } from "@/modules/transactions/repository";
import type { TransactionTypeValue } from "@/modules/transactions/schemas";
import { formatCurrency, getDaysUntilDayOfMonth } from "@/lib/utils";

interface ExecutiveDashboardProps {
  netWorth: NetWorthBreakdown;
  monthlyCashflow: MonthlyCashflowSummary;
  accounts: SerializedAccount[];
  onOpenQuickCapture: (
    type: TransactionTypeValue,
    destinationAccountId?: string,
    preset?: { accountId?: string; amount?: number; title?: string }
  ) => void;
  onNavigateTab: (tab: string) => void;
}

export function ExecutiveDashboard({
  netWorth,
  monthlyCashflow,
  accounts,
  onOpenQuickCapture,
  onNavigateTab,
}: ExecutiveDashboardProps) {
  const creditCards = accounts.filter((a) => a.type === "CREDIT_CARD");
  const payrollAccount = accounts.find((a) => a.type === "DEBIT");
  const remittanceAccount = accounts.find((a) => a.type === "CASH");
  const liquidAccounts = accounts
    .filter(
      (a) =>
        a.type === "CASH" || a.type === "DEBIT" || a.type === "SAVINGS_VAULT"
    )
    .sort((a, b) => b.currentBalance - a.currentBalance);
  const PAYROLL_NET_DEFAULT = 224.38; // salario quincenal neto estimado

  // Construcción de segmentos SVG para el Donut Chart de Gastos por Categoría
  let cumulativePercent = 0;
  const donutSegments = monthlyCashflow.categoryBreakdown.map((cat) => {
    const startPercent = cumulativePercent;
    cumulativePercent += cat.percentage;
    return {
      ...cat,
      startPercent,
      dashArray: `${cat.percentage} ${100 - cat.percentage}`,
      dashOffset: 100 - startPercent + 25,
    };
  });

  return (
    <div className="space-y-6">
      {/* Acciones Rápidas Mobile-First (botones principales del Módulo A) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => onOpenQuickCapture("PURCHASE")}
          className="group flex items-center justify-between rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-500/15 via-white/[0.03] to-white/[0.01] p-4 text-left hover:border-rose-500/60 transition-all hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 active:scale-[0.98] shadow-lg"
        >
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
              Captura con Ticket
            </span>
            <p className="text-sm font-bold text-white mt-0.5">
              Registrar Compra / Gasto
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 text-rose-300 group-hover:scale-105 transition">
            <Receipt className="h-5 w-5" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onOpenQuickCapture("CARD_PAYMENT")}
          className="group flex items-center justify-between rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-500/15 via-white/[0.03] to-white/[0.01] p-4 text-left hover:border-sky-500/60 transition-all hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 active:scale-[0.98] shadow-lg"
        >
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
              Liquidación ACID
            </span>
            <p className="text-sm font-bold text-white mt-0.5">
              Pagar Tarjeta / Cuota
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-sky-300 group-hover:scale-105 transition">
            <ArrowRightLeft className="h-5 w-5" />
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            onOpenQuickCapture("REMITTANCE_INCOME", undefined, {
              accountId: remittanceAccount?.id,
              title: "Remesa Recibida",
            })
          }
          className="group flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 via-white/[0.03] to-white/[0.01] p-4 text-left hover:border-emerald-500/60 transition-all hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 active:scale-[0.98] shadow-lg"
        >
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Registrar Remesa
            </span>
            <p className="text-sm font-bold text-white mt-0.5">
              Ingreso de Remesa Semanal
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 group-hover:scale-105 transition">
            <Globe className="h-5 w-5" />
          </div>
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
          className="group flex items-center justify-between rounded-2xl border border-teal-500/30 bg-gradient-to-br from-teal-500/15 via-white/[0.03] to-white/[0.01] p-4 text-left hover:border-teal-500/60 transition-all hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 active:scale-[0.98] shadow-lg"
        >
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-400">
              Pago de Nómina
            </span>
            <p className="text-sm font-bold text-white mt-0.5">
              Registrar Salario Quincenal
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/20 text-teal-300 group-hover:scale-105 transition">
            <Wallet className="h-5 w-5" />
          </div>
        </button>
      </div>

      {/* KPI Principal: Patrimonio Líquido Real y Flujo de Caja del Mes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Tarjeta de Patrimonio Líquido Real (7 columnas) */}
        <div className="lg:col-span-7 rounded-2xl border border-teal-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950/40 p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/15 border border-teal-500/30 px-3 py-1 text-xs font-semibold text-teal-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                Patrimonio Líquido Real
              </span>
              <span className="text-xs text-slate-400 font-mono">
                (Efectivo + Débito + Bóvedas) − (Tarjetas + Préstamos)
              </span>
            </div>

            <div className="mt-4 flex items-baseline gap-3">
              <h2
                className={`font-display text-4xl sm:text-5xl font-bold tracking-tight tabular-nums ${
                  netWorth.realLiquidNetWorth >= 0
                    ? "text-white"
                    : "text-rose-400"
                }`}
              >
                {formatCurrency(netWorth.realLiquidNetWorth)}
              </h2>
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" /> Solvencia Positiva
              </span>
            </div>
          </div>

          {/* Desglose de la Ecuación Patrimonial */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-4 border-t border-white/10">
            <div className="rounded-xl bg-slate-950/45 border border-white/10 p-2.5">
              <span className="text-[10px] uppercase text-slate-400 block">
                Efectivo
              </span>
              <span className="text-xs font-bold text-emerald-400 tabular-nums">
                {formatCurrency(netWorth.cashTotal)}
              </span>
            </div>

            <div className="rounded-xl bg-slate-950/45 border border-white/10 p-2.5">
              <span className="text-[10px] uppercase text-slate-400 block">
                Débito
              </span>
              <span className="text-xs font-bold text-emerald-400 tabular-nums">
                {formatCurrency(netWorth.debitTotal)}
              </span>
            </div>

            <div className="rounded-xl bg-slate-950/45 border border-white/10 p-2.5">
              <span className="text-[10px] uppercase text-slate-400 block">
                Bóvedas
              </span>
              <span className="text-xs font-bold text-teal-400 tabular-nums">
                {formatCurrency(netWorth.savingsVaultTotal)}
              </span>
            </div>

            <div className="rounded-xl bg-slate-950/45 border border-rose-950/60 p-2.5">
              <span className="text-[10px] uppercase text-slate-400 block">
                Deuda TC
              </span>
              <span className="text-xs font-bold text-rose-400 tabular-nums">
                -{formatCurrency(netWorth.creditCardDebtTotal)}
              </span>
            </div>

            <div className="rounded-xl bg-slate-950/45 border border-rose-950/60 p-2.5 col-span-2 sm:col-span-1">
              <span className="text-[10px] uppercase text-slate-400 block">
                Préstamos
              </span>
              <span className="text-xs font-bold text-rose-400 tabular-nums">
                -{formatCurrency(netWorth.loanLiabilityTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Flujo de Caja del Mes en Curso (5 columnas) */}
        <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Flujo de Caja del Mes en Curso
              </span>
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                Tasa Ahorro: {monthlyCashflow.savingsRatePercent}%
              </span>
            </div>

            <div className="mt-3">
              <p className="text-xs text-slate-400">
                Balance Neto (Ingresos − Compras/Gastos)
              </p>
              <p
                className={`text-2xl sm:text-3xl font-extrabold mt-0.5 tabular-nums ${
                  monthlyCashflow.netCashflow >= 0
                    ? "text-emerald-400"
                    : "text-rose-400"
                }`}
              >
                {monthlyCashflow.netCashflow >= 0 ? "+" : ""}
                {formatCurrency(monthlyCashflow.netCashflow)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-white/10">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
              <div className="flex items-center gap-1.5 text-xs text-emerald-300">
                <ArrowDownLeft className="h-4 w-4" />
                <span>Ingresos del Mes</span>
              </div>
              <p className="text-base font-extrabold text-white mt-1 tabular-nums">
                {formatCurrency(monthlyCashflow.totalIncome)}
              </p>
            </div>

            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3">
              <div className="flex items-center gap-1.5 text-xs text-rose-300">
                <ArrowUpRight className="h-4 w-4" />
                <span>Compras y Gastos</span>
              </div>
              <p className="text-base font-extrabold text-white mt-1 tabular-nums">
                {formatCurrency(monthlyCashflow.totalExpenses)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Disponible por Cuenta (Liquidez detallada) */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-5 shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">
            Disponible por Cuenta
          </h3>
          <span className="text-xs text-slate-400">
            (Efectivo, Débito y Ahorro)
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {liquidAccounts.map((acc) => (
            <div
              key={acc.id}
              className="rounded-xl border border-white/10 bg-slate-950/45 p-3.5 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
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
                    ? "Débito"
                    : "Ahorro"}
                </span>
                <p className="text-sm font-bold text-white truncate">
                  {acc.name}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {acc.institution || "—"}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-base font-extrabold text-emerald-400 tabular-nums">
                  {formatCurrency(acc.currentBalance, acc.currency)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Gráficos: Desglose de Gastos por Categoría & Estado de Utilización de Crédito */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Desglose de Gastos por Categoría */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-teal-400" />
              <div>
                <h3 className="text-base font-bold text-white">
                  Desglose de Gastos por Categoría
                </h3>
                <p className="text-xs text-slate-400">
                  Distribución porcentual de compras y pagos de servicios
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-slate-300">
              Total: {formatCurrency(monthlyCashflow.totalExpenses)}
            </span>
          </div>

          {monthlyCashflow.categoryBreakdown.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Aún no hay gastos registrados en el mes en curso.
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Donut Chart SVG */}
              <div className="relative h-44 w-44 shrink-0">
                <svg
                  viewBox="0 0 42 42"
                  className="h-full w-full -rotate-90 transform"
                >
                  <circle
                    cx="21"
                    cy="21"
                    r="15.91549430918954"
                    fill="transparent"
                    stroke="#1e293b"
                    strokeWidth="5"
                  />
                  {donutSegments.map((seg) => (
                    <circle
                      key={seg.categoryId}
                      cx="21"
                      cy="21"
                      r="15.91549430918954"
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth="5.5"
                      strokeDasharray={seg.dashArray}
                      strokeDashoffset={seg.dashOffset}
                      strokeLinecap="butt"
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] uppercase text-slate-400 font-semibold">
                    Gastos Mes
                  </span>
                  <span className="text-sm font-extrabold text-white tabular-nums">
                    {formatCurrency(monthlyCashflow.totalExpenses)}
                  </span>
                </div>
              </div>

              {/* Leyenda y Barras por Categoría */}
              <div className="w-full space-y-3">
                {monthlyCashflow.categoryBreakdown.map((cat) => (
                  <div key={cat.categoryId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="font-medium text-slate-200">
                          {cat.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 tabular-nums">
                        <span className="font-bold text-white">
                          {formatCurrency(cat.amount)}
                        </span>
                        <span className="text-[11px] text-slate-400 w-9 text-right">
                          ({cat.percentage}%)
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-950 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${cat.percentage}%`,
                          backgroundColor: cat.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Estado de Utilización de Crédito y Alertas de Corte/Pago */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-teal-400" />
                <div>
                  <h3 className="text-base font-bold text-white">
                    Estado de Utilización de Crédito
                  </h3>
                  <p className="text-xs text-slate-400">
                    Recomendación financiera: mantener uso por debajo del 30%
                  </p>
                </div>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-xs font-extrabold border ${
                  netWorth.overallCreditUtilizationPercent > 50
                    ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                    : netWorth.overallCreditUtilizationPercent > 30
                    ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                    : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                }`}
              >
                Global: {netWorth.overallCreditUtilizationPercent}%
              </span>
            </div>

            {/* Barra Global de Uso de Crédito */}
            <div className="rounded-xl border border-white/10 bg-slate-950/45 p-4 mb-4">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-400">
                  Deuda Total TC:{" "}
                  <strong className="text-rose-400">
                    {formatCurrency(netWorth.creditCardDebtTotal)}
                  </strong>
                </span>
                <span className="text-slate-400">
                  Línea Total:{" "}
                  <strong className="text-white">
                    {formatCurrency(netWorth.totalCreditLimit)}
                  </strong>
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-900 overflow-hidden border border-white/10">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 via-sky-500 to-rose-500 transition-all duration-500"
                  style={{
                    width: `${netWorth.overallCreditUtilizationPercent}%`,
                  }}
                />
              </div>
            </div>

            {/* Tarjetas individuales */}
            <div className="space-y-3">
              {creditCards.map((card) => {
                const limit = card.creditLimit ?? 1;
                const pct = Math.min(
                  100,
                  Math.round((card.currentBalance / limit) * 100)
                );
                const dueInfo = getDaysUntilDayOfMonth(card.paymentDueDay);

                return (
                  <div
                    key={card.id}
                    className="rounded-xl border border-white/10 bg-slate-950/50 p-3.5 flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">
                          {card.name}
                        </span>
                        <span className="text-xs font-semibold text-slate-300 tabular-nums">
                          {formatCurrency(card.currentBalance)} /{" "}
                          {formatCurrency(limit)} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-900 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            pct > 60
                              ? "bg-rose-500"
                              : pct > 30
                              ? "bg-amber-500"
                              : "bg-teal-500"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                        <span>
                          Pago sin intereses:{" "}
                          <strong className="text-amber-300">
                            {formatCurrency(
                              card.noInterestPayment ?? card.currentBalance
                            )}
                          </strong>
                        </span>
                        <span>
                          Fecha límite en {dueInfo.daysRemaining} días
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onNavigateTab("cards")}
              className="text-xs font-bold text-teal-400 hover:text-teal-300 transition"
            >
              Ver detalle de corte y proyección MSI →
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab("loans")}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-300 hover:text-white transition"
            >
              <Landmark className="h-3.5 w-3.5 text-rose-400" />
              <span>Ver Préstamos</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
