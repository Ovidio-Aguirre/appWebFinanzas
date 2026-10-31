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
    badgeClass: "bg-rose-100 text-rose-600 border-rose-300",
    sign: "-",
  },
  BILL_PAYMENT: {
    label: "Servicio",
    badgeClass: "bg-amber-100 text-amber-600 border-amber-300",
    sign: "-",
  },
  CARD_PAYMENT: {
    label: "Pago TC",
    badgeClass: "bg-sky-100 text-sky-600 border-sky-300",
    sign: "↔",
  },
  LOAN_PAYMENT: {
    label: "Cuota Préstamo",
    badgeClass: "bg-indigo-100 text-indigo-600 border-indigo-300",
    sign: "↔",
  },
  SALARY_INCOME: {
    label: "Salario",
    badgeClass: "bg-emerald-100 text-emerald-600 border-emerald-300",
    sign: "+",
  },
  REMITTANCE_INCOME: {
    label: "Remesa",
    badgeClass: "bg-teal-100 text-teal-600 border-teal-300",
    sign: "+",
  },
  TRANSFER: {
    label: "Transferencia",
    badgeClass: "bg-purple-100 text-purple-600 border-purple-300",
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

  return (
    <div className="space-y-4">
      {/* Barra superior de filtros y botón de captura rápida */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por comercio, categoría o cuenta..."
            className="w-full rounded-xl border border-slate-200 bg-white/75 pl-10 pr-4 py-2 text-xs text-slate-900 focus:border-teal-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white/75 px-3 py-2 text-xs text-slate-700 focus:border-teal-500 focus:outline-none"
          >
            <option value="ALL">Todos los tipos ({transactions.length})</option>
            <option value="PURCHASE">Compras</option>
            <option value="CARD_PAYMENT">Pagos de Tarjeta</option>
            <option value="LOAN_PAYMENT">Cuotas de Préstamo</option>
            <option value="SALARY_INCOME">Ingresos de Salario</option>
            <option value="REMITTANCE_INCOME">Remesas</option>
            <option value="WITH_RECEIPT">Con Ticket / Comprobante</option>
            <option value="UNRECONCILED">Pendientes de Conciliar</option>
          </select>

          <button
            type="button"
            onClick={() => onOpenQuickCapture("PURCHASE")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 hover:brightness-110 px-3.5 py-2 text-xs font-bold text-slate-950 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Nuevo Movimiento</span>
          </button>
        </div>
      </div>

      {/* Lista de Movimientos */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No se encontraron movimientos con los filtros seleccionados.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filtered.map((tx) => {
              const meta = TRANSACTION_TYPE_LABELS[tx.transactionType];
              const isPositive = meta.sign === "+";
              const isNeutral = meta.sign === "↔";

              return (
                <div
                  key={tx.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-slate-100 transition"
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
                    className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                  >
                    <div
                      className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                        isPositive
                          ? "bg-emerald-50 border-emerald-300 text-emerald-600"
                          : isNeutral
                          ? "bg-sky-50 border-sky-300 text-sky-600"
                          : "bg-rose-50 border-rose-300 text-rose-600"
                      }`}
                    >
                      {isPositive ? (
                        <ArrowDownLeft className="h-5 w-5" />
                      ) : isNeutral ? (
                        <ArrowRightLeft className="h-5 w-5" />
                      ) : (
                        <ArrowUpRight className="h-5 w-5" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">
                          {tx.title}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${meta.badgeClass}`}
                        >
                          {meta.label}
                        </span>
                        {tx.installmentsCount > 1 && (
                          <span className="inline-flex items-center rounded-md bg-indigo-100 border border-indigo-300 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">
                            {tx.currentInstallment}/{tx.installmentsCount} MSI
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span>{formatShortDate(tx.date)}</span>
                        <span>•</span>
                        <span className="text-slate-600 font-medium">
                          {tx.accountName}
                          {tx.destinationAccountName
                            ? ` → ${tx.destinationAccountName}`
                            : ""}
                        </span>
                        <span>•</span>
                        <span>{tx.categoryName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                    {tx.receiptUrl && (
                      <button
                        type="button"
                        onClick={() => setActiveReceipt(tx)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 text-xs font-medium text-teal-600 transition"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Ver Ticket</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleToggleReconciled(tx)}
                      title={
                        tx.isReconciled
                          ? "Conciliado con estado de cuenta (clic para desmarcar)"
                          : "Pendiente de conciliar (clic para conciliar)"
                      }
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                        tx.isReconciled
                          ? "border-emerald-300 bg-emerald-50 text-emerald-600"
                          : "border-slate-300 bg-slate-100 text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {tx.isReconciled ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="hidden md:inline">Conciliado</span>
                        </>
                      ) : (
                        <>
                          <Circle className="h-3.5 w-3.5" />
                          <span className="hidden md:inline">Por conciliar</span>
                        </>
                      )}
                    </button>

                    <div
                      className={`text-right text-sm font-bold tabular-nums min-w-[95px] ${
                        isPositive
                          ? "text-emerald-600"
                          : isNeutral
                          ? "text-sky-600"
                          : "text-rose-600"
                      }`}
                    >
                      {meta.sign}
                      {formatCurrency(tx.amount)}
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
      </div>

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
          className="fixed inset-0 z-50 flex items-center justify-center bg-white/85 backdrop-blur-md p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white backdrop-blur-xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-5 w-5 text-teal-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Comprobante Digitalizado
                  </h3>
                  <p className="text-xs text-slate-500">
                    {activeReceipt.title} •{" "}
                    {formatCurrency(activeReceipt.amount)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveReceipt(null)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex justify-center rounded-xl bg-white p-3 border border-slate-200">
              <img
                src={activeReceipt.receiptUrl ?? ""}
                alt={`Comprobante de ${activeReceipt.title}`}
                className="max-h-[60vh] w-auto rounded-lg object-contain"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Cuenta: {activeReceipt.accountName}</span>
              <span>Fecha: {formatShortDate(activeReceipt.date)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
