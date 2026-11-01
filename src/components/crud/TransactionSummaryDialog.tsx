"use client";

import React from "react";
import {
  Check,
  CheckCircle2,
  Circle,
  CreditCard,
  ExternalLink,
  Pencil,
  Receipt,
  ShieldCheck,
  Tag,
  Trash2,
} from "lucide-react";
import { Modal, dangerBtnCls, secondaryBtnCls, primaryBtnCls } from "@/components/ui/crud";
import { formatCurrency, formatShortDate } from "@/lib/utils";
import type { SerializedTransaction } from "@/modules/transactions/schemas";

const TYPE_LABELS: Record<string, { label: string; sign: "+" | "-" | "↔" }> = {
  PURCHASE: { label: "Compra / Gasto", sign: "-" },
  BILL_PAYMENT: { label: "Pago de Servicio", sign: "-" },
  CARD_PAYMENT: { label: "Pago de Tarjeta", sign: "↔" },
  LOAN_PAYMENT: { label: "Cuota de Préstamo", sign: "↔" },
  SALARY_INCOME: { label: "Nómina / Salario", sign: "+" },
  REMITTANCE_INCOME: { label: "Remesa Familiar", sign: "+" },
  TRANSFER: { label: "Transferencia", sign: "↔" },
};

export function TransactionSummaryDialog({
  tx,
  onClose,
  onEdit,
  onDelete,
}: {
  tx: SerializedTransaction | null;
  onClose: () => void;
  onEdit?: (tx: SerializedTransaction) => void;
  onDelete?: (tx: SerializedTransaction) => void;
}) {
  const meta = tx ? TYPE_LABELS[tx.transactionType] : undefined;
  const isMsi = (tx?.installmentsCount ?? 1) > 1;

  return (
    <Modal
      open={Boolean(tx)}
      onClose={onClose}
      title="Detalle De Transacción"
      description={meta?.label}
      maxWidth="sm:max-w-md"
    >
      {tx && meta && (
        <div className="flex flex-col gap-3.5">
          {/* Hero Header idéntico a detalle_de_transacci_n/screen.png */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#132226] via-[#111722] to-[#0d121c] border border-white/[0.07] p-5 text-center">
            <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 h-28 w-52 rounded-full bg-emerald-500/15 blur-2xl" />

            {/* Circular Icon with Green Verified Badge */}
            <div className="relative mx-auto mb-3 w-14 h-14">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg">
                <Receipt className="w-6 h-6" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-emerald-400 border-2 border-[#0d121c] flex items-center justify-center">
                <Check className="w-3 h-3 text-[#070a10] stroke-[3]" />
              </span>
            </div>

            <p className="relative text-base font-extrabold text-white tracking-tight">
              {tx.title}
            </p>
            <p className="relative text-xs text-slate-400 mt-0.5">
              {formatShortDate(tx.date)} • {meta.label}
            </p>

            <div className="relative mt-3 flex items-baseline justify-center gap-1.5">
              <span
                className={`text-3xl font-extrabold tabular-nums tracking-tight ${
                  meta.sign === "+"
                    ? "text-emerald-400"
                    : meta.sign === "-"
                    ? "text-white"
                    : "text-cyan-400"
                }`}
              >
                {meta.sign}
                {formatCurrency(tx.amount)}
              </span>
              <span className="text-xs font-semibold text-slate-400">USD</span>
            </div>

            <div className="relative mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {tx.isReconciled
                ? "COMPLETADO · CONCILIADO ACID"
                : "REGISTRADO · PENDIENTE CONCILIAR"}
            </div>
          </div>

          {/* Método de Pago Card (idéntico a detalle_de_transacci_n/screen.png) */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#131824] border border-white/[0.06]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#1c2230] flex items-center justify-center text-slate-200 shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  {tx.destinationAccountName ? "Cuenta Origen → Destino" : "Método de Pago"}
                </span>
                <span className="text-sm font-bold text-white truncate block">
                  {tx.accountName}
                  {tx.destinationAccountName
                    ? ` → ${tx.destinationAccountName}`
                    : ""}
                </span>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-[10px] font-bold shrink-0">
              Verificada
            </span>
          </div>

          {/* Categoría Contable Card */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#131824] border border-white/[0.06]">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: `${tx.categoryColor || "#4edea3"}22`,
                  color: tx.categoryColor || "#4edea3",
                }}
              >
                <Tag className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Categoría Contable
                </span>
                <span className="text-sm font-bold text-white truncate block">
                  {tx.categoryName}
                </span>
              </div>
            </div>
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: tx.categoryColor || "#4edea3" }}
            />
          </div>

          {/* Desglose Transparente Card */}
          <div className="rounded-2xl bg-[#131824] border border-white/[0.06] p-4 space-y-2.5">
            <span className="text-xs font-bold text-white block">
              Desglose transparente
            </span>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Importe bruto</span>
              <span className="font-bold text-white tabular-nums">
                {formatCurrency(tx.amount)} USD
              </span>
            </div>

            {isMsi && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Plan Meses Sin Intereses</span>
                <span className="font-bold text-cyan-400 tabular-nums">
                  {tx.currentInstallment}/{tx.installmentsCount} cuotas (
                  {formatCurrency(tx.amount / tx.installmentsCount)}/mes)
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Estado de conciliación</span>
              {tx.isReconciled ? (
                <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Conciliado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <Circle className="h-3.5 w-3.5" /> Por conciliar
                </span>
              )}
            </div>

            {tx.description && (
              <div className="flex items-start justify-between gap-3 text-xs pt-1 border-t border-white/[0.05]">
                <span className="text-slate-400 shrink-0">Referencia / Nota</span>
                <span className="text-white font-medium text-right">
                  {tx.description}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between rounded-xl bg-[#0b0f17] px-3.5 py-2.5 mt-1">
              <span className="text-xs font-bold text-slate-200">
                Total operación
              </span>
              <span className="text-base font-extrabold text-white tabular-nums">
                {formatCurrency(tx.amount)} USD
              </span>
            </div>
          </div>

          {tx.receiptUrl && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-400">
                Comprobante / Ticket adjunto
              </p>
              <a
                href={tx.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block overflow-hidden rounded-2xl border border-white/[0.08] bg-[#131824]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tx.receiptUrl}
                  alt={`Comprobante de ${tx.title}`}
                  className="max-h-56 w-full object-contain bg-[#070a10]"
                />
                <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-lg bg-[#131824]/90 border border-white/[0.1] px-2.5 py-1 text-[11px] font-semibold text-white shadow">
                  <ExternalLink className="h-3 w-3 text-emerald-400" /> Abrir
                </span>
              </a>
            </div>
          )}

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Protegido por motor transaccional ACID FinanzaPro</span>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-white/[0.06] pt-3 sm:flex-row sm:justify-end">
            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete(tx);
                }}
                className={`${dangerBtnCls} sm:mr-auto`}
              >
                <Trash2 className="h-4 w-4" /> Eliminar
              </button>
            )}
            <button type="button" onClick={onClose} className={secondaryBtnCls}>
              Cerrar
            </button>
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(tx);
                }}
                className={primaryBtnCls}
              >
                <Pencil className="h-4 w-4" /> Editar
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
