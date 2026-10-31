"use client";

import React, { useEffect, useState } from "react";
import {
  CalendarClock,
  CreditCard,
  Landmark,
  LayoutDashboard,
  PiggyBank,
  Plus,
  Receipt,
  ShieldCheck,
} from "lucide-react";
import type { FinancialWorkspaceSnapshot } from "@/server/actions/finance.actions";
import type { TransactionTypeValue } from "@/modules/transactions/schemas";
import { PwaRegistrationAndBanner } from "@/components/pwa/PwaRegistrationAndBanner";
import { ExecutiveDashboard } from "@/modules/dashboard/components/ExecutiveDashboard";
import { TransactionsLedger } from "@/modules/transactions/components/TransactionsLedger";
import { CreditCardsModule } from "@/modules/accounts/components/CreditCardsModule";
import { SubscriptionsModule } from "@/modules/subscriptions/components/SubscriptionsModule";
import { LoansModule } from "@/modules/loans/components/LoansModule";
import { SavingsModule } from "@/modules/savings/components/SavingsModule";
import { QuickCaptureModal } from "@/modules/transactions/components/QuickCaptureModal";

interface FinanceAppShellProps {
  initialData: FinancialWorkspaceSnapshot;
}

const NAVIGATION_TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "transactions", label: "Movimientos", icon: Receipt },
  { id: "cards", label: "Tarjetas y Cuentas", icon: CreditCard },
  { id: "subscriptions", label: "Recurrentes", icon: CalendarClock },
  { id: "loans", label: "Préstamos", icon: Landmark },
  { id: "savings", label: "Bóvedas", icon: PiggyBank },
] as const;

export function FinanceAppShell({ initialData }: FinanceAppShellProps) {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [quickCaptureType, setQuickCaptureType] =
    useState<TransactionTypeValue>("PURCHASE");
  const [preselectedDestinationId, setPreselectedDestinationId] = useState<
    string | undefined
  >(undefined);
  const [preselectedAccountId, setPreselectedAccountId] = useState<
    string | undefined
  >(undefined);
  const [defaultAmount, setDefaultAmount] = useState<number | undefined>(
    undefined
  );
  const [defaultTitle, setDefaultTitle] = useState<string | undefined>(
    undefined
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam) {
      setActiveTab(tabParam);
    }
    const quickParam = params.get("quickCapture") as TransactionTypeValue | null;
    if (quickParam) {
      setQuickCaptureType(quickParam);
      setQuickCaptureOpen(true);
    }
  }, []);

  const handleOpenQuickCapture = (
    type: TransactionTypeValue = "PURCHASE",
    destinationAccountId?: string,
    preset?: { accountId?: string; amount?: number; title?: string }
  ) => {
    setQuickCaptureType(type);
    setPreselectedDestinationId(destinationAccountId);
    setPreselectedAccountId(preset?.accountId);
    setDefaultAmount(preset?.amount);
    setDefaultTitle(preset?.title);
    setQuickCaptureOpen(true);
  };

  return (
    <div className="min-h-screen text-slate-100 pb-24 md:pb-12">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/55 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-emerald-600 text-slate-950 shadow-lg shadow-teal-500/30 ring-1 ring-white/10">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-base font-bold tracking-tight text-white">
                  FinanzaPro
                </span>
                <span className="hidden sm:inline-block rounded-full bg-teal-500/10 border border-teal-500/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-300">
                  PWA
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {initialData.user.name} • Portafolio Multicuenta
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <PwaRegistrationAndBanner />

            <button
              type="button"
              onClick={() => handleOpenQuickCapture("PURCHASE")}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 px-3.5 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-teal-500/25 transition-all hover:shadow-teal-500/40 hover:brightness-110 active:scale-[0.97]"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Captura Rápida</span>
              <span className="sm:hidden">Registrar</span>
            </button>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 hidden md:flex items-center gap-1.5 pb-2.5">
          {NAVIGATION_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-teal-500/15 text-teal-300 ring-1 ring-teal-500/30 shadow-inner"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Contenido Principal por Dominio */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">
        {activeTab === "dashboard" && (
          <ExecutiveDashboard
            netWorth={initialData.netWorth}
            monthlyCashflow={initialData.monthlyCashflow}
            accounts={initialData.accounts}
            onOpenQuickCapture={handleOpenQuickCapture}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === "transactions" && (
          <TransactionsLedger
            transactions={initialData.transactions}
            onOpenQuickCapture={handleOpenQuickCapture}
          />
        )}

        {activeTab === "cards" && (
          <CreditCardsModule
            accounts={initialData.accounts}
            transactions={initialData.transactions}
            onOpenQuickCapture={handleOpenQuickCapture}
          />
        )}

        {activeTab === "subscriptions" && (
          <SubscriptionsModule
            rules={initialData.recurringRules}
            accounts={initialData.accounts}
            categories={initialData.categories}
          />
        )}

        {activeTab === "loans" && (
          <LoansModule
            loans={initialData.loans}
            accounts={initialData.accounts}
          />
        )}

        {activeTab === "savings" && (
          <SavingsModule
            savingsGoals={initialData.savingsGoals}
            accounts={initialData.accounts}
          />
        )}
      </main>

      {/* Barra de Navegación Inferior Mobile-First (PWA) */}
      <nav
        aria-label="Navegación móvil"
        className="fixed bottom-0 inset-x-0 z-30 border-t border-white/5 bg-slate-950/80 backdrop-blur-xl md:hidden pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-6 h-16">
          {NAVIGATION_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors ${
                  isActive ? "text-teal-400" : "text-slate-400"
                }`}
              >
                <span
                  className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                    isActive ? "bg-teal-500/15" : ""
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="truncate max-w-[56px]">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modal Flotante de Captura Rápida (Módulo A) */}
      <QuickCaptureModal
        open={quickCaptureOpen}
        onClose={() => setQuickCaptureOpen(false)}
        accounts={initialData.accounts}
        categories={initialData.categories}
        transactions={initialData.transactions}
        initialTransactionType={quickCaptureType}
        preselectedDestinationAccountId={preselectedDestinationId}
        preselectedAccountId={preselectedAccountId}
        defaultAmount={defaultAmount}
        defaultTitle={defaultTitle}
      />
    </div>
  );
}
