"use client";

import React, { useEffect, useState } from "react";
import {
  CalendarClock,
  Check,
  CreditCard,
  Home,
  Landmark,
  LogOut,
  PieChart,
  PiggyBank,
  Plus,
  Search,
  Tags,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { logoutAction } from "@/server/actions/auth.actions";
import { CategoriesManager } from "@/components/crud/EditDialogs";
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
  { id: "dashboard", label: "Inicio", short: "Inicio", icon: Home },
  { id: "cards", label: "Tarjetas", short: "Tarjetas", icon: CreditCard },
  { id: "transactions", label: "Análisis", short: "Movs.", icon: PieChart },
  { id: "savings", label: "Metas", short: "Metas", icon: PiggyBank },
  { id: "subscriptions", label: "Fijos", short: "Fijos", icon: CalendarClock },
  { id: "loans", label: "Deudas", short: "Deudas", icon: Landmark },
] as const;

export function FinanceAppShell({ initialData }: FinanceAppShellProps) {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
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

  const router = useRouter();
  useEffect(() => {
    const refresh = () => router.refresh();
    window.addEventListener("fp:data-changed", refresh);
    return () => window.removeEventListener("fp:data-changed", refresh);
  }, [router]);

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

  const firstName = (initialData.user.name || "Usuario").split(" ")[0];
  const initials = (initialData.user.name || "FP")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#070a10] text-slate-100 font-sans antialiased flex flex-col items-center selection:bg-emerald-500/20 selection:text-emerald-400">
      {/* Contenedor Móvil Nativo (App Frame estilo Veltis Obsidian Emerald) */}
      <div className="w-full max-w-[480px] min-h-screen bg-[#0b0f17] sm:border-x sm:border-white/[0.06] sm:shadow-[0_0_80px_rgba(0,0,0,0.85)] flex flex-col justify-between relative">
        {/* Top Sticky Area: App Bar Header */}
        <header className="sticky top-0 z-40 pt-safe bg-[#070a10]/85 backdrop-blur-xl border-b border-white/[0.05]">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {/* User Avatar with Verified Badge */}
              <button
                type="button"
                onClick={() => setActiveTab("dashboard")}
                className="relative shrink-0 text-left"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/30 via-[#151c2c] to-[#0b0f17] ring-2 ring-emerald-500/40 shadow-sm flex items-center justify-center text-xs font-extrabold text-emerald-300">
                  {initials}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#070a10] rounded-full flex items-center justify-center">
                  <Check className="w-2 h-2 text-[#070a10] stroke-[3.5]" />
                </span>
              </button>

              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-sm font-bold text-white tracking-tight truncate">
                    Hola, {firstName} 👋
                  </h1>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="hidden min-[420px]:inline text-[11px] text-slate-400 font-medium truncate">
                    Cuenta verificada
                  </span>
                  <PwaRegistrationAndBanner />
                </div>
              </div>
            </div>

            {/* Action Icons: Quick Add, Search, Categories, Logout */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleOpenQuickCapture("PURCHASE")}
                title="Nuevo movimiento"
                aria-label="Nuevo movimiento"
                className="relative w-9 h-9 rounded-full bg-emerald-500 text-[#070a10] flex items-center justify-center shadow-md shadow-emerald-500/25 hover:brightness-110 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4 stroke-[2.75]" />
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("transactions")}
                title="Buscar movimientos"
                aria-label="Buscar movimientos"
                className="w-9 h-9 rounded-full bg-[#101521] border border-white/[0.08] flex items-center justify-center text-slate-300 hover:text-white hover:bg-[#151c2c] active:scale-95 transition-all"
              >
                <Search className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setCategoriesOpen(true)}
                title="Categorías contables"
                aria-label="Categorías contables"
                className="relative w-9 h-9 rounded-full bg-[#101521] border border-white/[0.08] flex items-center justify-center text-slate-300 hover:text-white hover:bg-[#151c2c] active:scale-95 transition-all"
              >
                <Tags className="w-4 h-4" />
                <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-2 ring-[#070a10]" />
              </button>

              <form action={logoutAction}>
                <button
                  type="submit"
                  title="Cerrar sesión"
                  aria-label="Cerrar sesión"
                  className="w-9 h-9 rounded-full bg-[#101521] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-[#151c2c] active:scale-95 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </header>

        {/* Main Scrollable App Content */}
        <main className="flex-1 w-full px-4 pt-3 pb-28 flex flex-col gap-4">
          {activeTab === "dashboard" && (
            <ExecutiveDashboard
              netWorth={initialData.netWorth}
              monthlyCashflow={initialData.monthlyCashflow}
              accounts={initialData.accounts}
              transactions={initialData.transactions}
              onOpenQuickCapture={handleOpenQuickCapture}
              onNavigateTab={setActiveTab}
              onOpenCategories={() => setCategoriesOpen(true)}
            />
          )}

          {activeTab === "transactions" && (
            <TransactionsLedger
              transactions={initialData.transactions}
              accounts={initialData.accounts}
              categories={initialData.categories}
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

        {/* Bottom Floating / Tab Navigation Bar (Always visible like a real native app) */}
        <nav
          aria-label="Navegación principal"
          className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
        >
          <div className="max-w-[480px] mx-auto bg-[#070a10]/92 backdrop-blur-xl border-t border-white/[0.07] pb-[env(safe-area-inset-bottom,6px)] shadow-[0_-8px_30px_rgba(0,0,0,0.6)] pointer-events-auto">
            <div className="h-16 px-2 flex items-center justify-around">
              {NAVIGATION_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex flex-col items-center justify-center min-w-[52px] py-1 gap-1 transition-all active:scale-95 ${
                      isActive
                        ? "text-emerald-400"
                        : "text-slate-400 hover:text-slate-100"
                    }`}
                  >
                    <div
                      className={`flex h-7 w-10 items-center justify-center rounded-full transition-all ${
                        isActive
                          ? "bg-emerald-500/15 text-emerald-400"
                          : ""
                      }`}
                    >
                      <Icon className="w-[19px] h-[19px]" />
                    </div>
                    <span
                      className={`text-[10px] tracking-tight ${
                        isActive ? "font-bold text-emerald-400" : "font-medium"
                      }`}
                    >
                      {tab.short}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      </div>

      <CategoriesManager
        open={categoriesOpen}
        categories={initialData.categories}
        onClose={() => setCategoriesOpen(false)}
      />

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
