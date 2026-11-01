"use client";

import React, { useState, useTransition } from "react";
import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  Eye,
  FileCheck2,
  Plus,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type {
  SerializedTransaction,
  TransactionTypeValue,
} from "@/modules/transactions/schemas";
import { toggleReconciledAction } from "@/server/actions/finance.actions";
import { formatCurrency, formatShortDate } from "@/lib/utils";
import type { SerializedAccount } from "@/modules/accounts/schemas";
import type { SerializedCategory } from "@/server/actions/finance.actions";
import { RowActions } from "@/components/ui/crud";
import { TransactionSummaryDialog } from "@/components/crud/TransactionSummaryDialog";
import {
  DeleteTransactionDialog,
  EditTransactionDialog,
} from "@/components/crud/EditDialogs";

interface TransactionsLedgerProps {
  transactions: SerializedTransaction[];
  accounts: SerializedAccount[];
  categories: SerializedCategory[];
  onOpenQuickCapture: (type?: TransactionTypeValue) => void;
}

const TRANSACTION_TYPE_LABELS: Record<
  TransactionTypeValue,
  { label: string; badgeClass: string; sign: "+" | "-" | "↔" }
> = {
  PURCHASE: {
    label: "Compra",
    badgeClass: "bg-tertiary/15 text-tertiary border-tertiary/30",
    sign: "-",
  },
  BILL_PAYMENT: {
    label: "Servicio",
    badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    sign: "-",
  },
  CARD_PAYMENT: {
    label: "Pago TC",
    badgeClass: "bg-secondary/15 text-secondary border-secondary/30",
    sign: "↔",
  },
  LOAN_PAYMENT: {
    label: "Cuota Préstamo",
    badgeClass: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    sign: "↔",
  },
  SALARY_INCOME: {
    label: "Salario",
    badgeClass: "bg-primary/15 text-primary border-primary/30",
    sign: "+",
  },
  REMITTANCE_INCOME: {
    label: "Remesa",
    badgeClass: "bg-primary/15 text-primary-fixed border-primary/30",
    sign: "+",
  },
  TRANSFER: {
    label: "Transferencia",
    badgeClass: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    sign: "↔",
  },
};

export function TransactionsLedger({
  transactions,
  accounts,
  categories,
  onOpenQuickCapture,
}: TransactionsLedgerProps) {
  const [summaryTx, setSummaryTx] = useState<SerializedTransaction | null>(null);
  const [editingTx, setEditingTx] = useState<SerializedTransaction | null>(null);
  const [deletingTx, setDeletingTx] = useState<SerializedTransaction | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [activeReceipt, setActiveReceipt] =
    useState<SerializedTransaction | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = transactions.filter((tx) => {
    const matchesSearch =
      tx.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.accountName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.categoryName.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (typeFilter === "ALL") return true;
    if (typeFilter === "WITH_RECEIPT") return Boolean(tx.receiptUrl);
    if (typeFilter === "UNRECONCILED") return !tx.isReconciled;
    return tx.transactionType === typeFilter;
  });

  const handleToggleReconciled = (tx: SerializedTransaction) => {
    startTransition(async () => {
      const res = await toggleReconciledAction(tx.id, !tx.isReconciled);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    });
  };

  const totalExpensesFiltered = filtered
    .filter(
      (tx) =>
        tx.transactionType === "PURCHASE" ||
        tx.transactionType === "BILL_PAYMENT"
    )
    .reduce((acc, tx) => acc + tx.amount, 0);

  const totalIncomeFiltered = filtered
    .filter(
      (tx) =>
        tx.transactionType === "SALARY_INCOME" ||
        tx.transactionType === "REMITTANCE_INCOME"
    )
    .reduce((acc, tx) => acc + tx.amount, 0);

  const expenseRatio =
    totalIncomeFiltered > 0
      ? Math.min(100, Math.round((totalExpensesFiltered / totalIncomeFiltered) * 100))
      : 65;

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Hero Card estilo Análisis de Gastos (an_lisis_de_gastos_2/screen.png) */}
      <section className="rounded-2xl bg-[#111622] border border-white/[0.08] p-5 shadow-xl flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Gasto del Periodo Filtrado
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {filtered.length} movimientos
          </span>
        </div>

        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight tabular-nums">
              {formatCurrency(totalExpensesFiltered)}
            </span>
            <span className="text-xs text-slate-400">
              en compras y servicios
            </span>
          </div>
          <button
            type="button"
            onClick={() => onOpenQuickCapture("PURCHASE")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:brightness-110 active:scale-[0.98] px-3 py-1.5 text-xs font-extrabold text-[#070a10] shadow-md shadow-emerald-500/20 transition"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Registrar</span>
          </button>
        </div>

        <div className="w-full h-2 rounded-full bg-[#1b2233] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-500"
            style={{ width: `${expenseRatio}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 pt-0.5">
          <span className="text-emerald-400 font-semibold tabular-nums">
            ↗ Ingresos: {formatCurrency(totalIncomeFiltered)}
          </span>
          <span className="tabular-nums">
            Conciliados: {filtered.filter((t) => t.isReconciled).length}/
            {filtered.length}
          </span>
        </div>
      </section>

      {/* 2. Buscador y Selector Segmentado estilo App Nativa */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar comercio, categoría o cuenta..."
              className="w-full rounded-xl border border-white/[0.08] bg-[#0d121c] pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-xl border border-white/[0.08] bg-[#0d121c] px-3 py-2.5 text-xs font-semibold text-slate-200 focus:border-emerald-500/50 focus:outline-none"
          >
            <option value="ALL">Todos ({transactions.length})</option>
            <option value="PURCHASE">Compras</option>
            <option value="CARD_PAYMENT">Pagos TC</option>
            <option value="LOAN_PAYMENT">Préstamos</option>
            <option value="SALARY_INCOME">Salario</option>
            <option value="REMITTANCE_INCOME">Remesas</option>
            <option value="WITH_RECEIPT">Con Ticket</option>
            <option value="UNRECONCILED">Por Conciliar</option>
          </select>
        </div>

        {/* Píldoras Rápidas de Filtro */}
        <div className="flex items-center p-1 bg-[#0d121c] rounded-xl border border-white/[0.06] text-xs font-semibold overflow-x-auto hide-scrollbar">
          {[
            { id: "ALL", label: "Todos" },
            { id: "PURCHASE", label: "Gastos" },
            { id: "SALARY_INCOME", label: "Nómina" },
            { id: "CARD_PAYMENT", label: "Pagos TC" },
            { id: "WITH_RECEIPT", label: "Tickets" },
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setTypeFilter(pill.id)}
              className={`flex-1 py-1.5 px-2.5 text-center rounded-lg whitespace-nowrap transition-all ${
                typeFilter === pill.id
                  ? "bg-emerald-500 text-[#070a10] font-bold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Lista de Movimientos — Tarjetas Nativas Individuales */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-[#0d121c] p-10 text-center text-xs text-slate-400">
          No se encontraron movimientos con los filtros seleccionados.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((tx) => {
            const meta = TRANSACTION_TYPE_LABELS[tx.transactionType];
            const isPositive = meta.sign === "+";
            const isNeutral = meta.sign === "↔";

            return (
              <div
                key={tx.id}
                className="flex items-center justify-between gap-2.5 p-3 rounded-xl bg-[#0d121c]/95 border border-white/[0.05] hover:border-white/[0.12] hover:bg-[#121826] transition-all"
              >
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`Ver resumen de ${tx.title}`}
                  onClick={() => setSummaryTx(tx)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSummaryTx(tx);
                    }
                  }}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left focus-visible:outline-none"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                      isPositive
                        ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                        : isNeutral
                        ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400"
                        : "bg-rose-500/15 border-rose-500/25 text-rose-400"
                    }`}
                  >
                    {isPositive ? (
                      <ArrowDownLeft className="h-[18px] w-[18px]" />
                    ) : isNeutral ? (
                      <ArrowRightLeft className="h-[18px] w-[18px]" />
                    ) : (
                      <ArrowUpRight className="h-[18px] w-[18px]" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white truncate">
                        {tx.title}
                      </span>
                      {tx.installmentsCount > 1 && (
                        <span className="shrink-0 rounded bg-cyan-500/15 border border-cyan-500/30 px-1.5 py-0.2 text-[9px] font-bold text-cyan-400">
                          {tx.currentInstallment}/{tx.installmentsCount} MSI
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate mt-0.5">
                      <span>{formatShortDate(tx.date)}</span>
                      <span>•</span>
                      <span className="truncate">{tx.categoryName}</span>
                    </div>
                  </div>
                </div>

                {/* Derecha: Acciones rápidas + Monto */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {tx.receiptUrl && (
                    <button
                      type="button"
                      onClick={() => setActiveReceipt(tx)}
                      title="Ver comprobante"
                      className="h-7 w-7 rounded-lg border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/20 transition"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleToggleReconciled(tx)}
                    title={
                      tx.isReconciled
                        ? "Conciliado (clic para desmarcar)"
                        : "Por conciliar (clic para conciliar)"
                    }
                    className={`h-7 w-7 rounded-lg border flex items-center justify-center transition ${
                      tx.isReconciled
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : "border-white/[0.08] bg-[#151c2c] text-slate-500 hover:text-white"
                    }`}
                  >
                    {tx.isReconciled ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <Circle className="h-3.5 w-3.5" />
                    )}
                  </button>

                  <div className="text-right min-w-[78px]">
                    <span
                      className={`block text-xs font-mono font-bold tabular-nums ${
                        isPositive
                          ? "text-emerald-400"
                          : isNeutral
                          ? "text-cyan-400"
                          : "text-slate-100"
                      }`}
                    >
                      {meta.sign}
                      {formatCurrency(tx.amount)}
                    </span>
                    <span className="block text-[10px] text-slate-400 truncate max-w-[90px]">
                      {tx.accountName}
                    </span>
                  </div>

                  <RowActions
                    label={tx.title}
                    onEdit={() => setEditingTx(tx)}
                    onDelete={() => setDeletingTx(tx)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TransactionSummaryDialog
        tx={summaryTx}
        onClose={() => setSummaryTx(null)}
        onEdit={setEditingTx}
        onDelete={setDeletingTx}
      />
      <EditTransactionDialog
        tx={editingTx}
        accounts={accounts}
        categories={categories}
        onClose={() => setEditingTx(null)}
      />
      <DeleteTransactionDialog tx={deletingTx} onClose={() => setDeletingTx(null)} />

      {/* Modal Visor de Ticket / Comprobante Digitalizado */}
      {activeReceipt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-surface-container-lowest/85 backdrop-blur-md p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/[0.10] bg-surface-container backdrop-blur-xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <FileCheck2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold text-on-surface">
                    Comprobante Digitalizado
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    {activeReceipt.title} •{" "}
                    {formatCurrency(activeReceipt.amount)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveReceipt(null)}
                className="rounded-full p-1.5 bg-surface-container-high text-on-surface-variant hover:bg-surface-bright hover:text-on-surface"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex justify-center rounded-xl bg-surface-container-lowest p-3 border border-white/[0.06]">
              <img
                src={activeReceipt.receiptUrl ?? ""}
                alt={`Comprobante de ${activeReceipt.title}`}
                className="max-h-[60vh] w-auto rounded-lg object-contain"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-on-surface-variant">
              <span>Cuenta: {activeReceipt.accountName}</span>
              <span>Fecha: {formatShortDate(activeReceipt.date)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
