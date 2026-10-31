"use client";

import React from "react";
import { CheckCircle2, Circle, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { Modal, dangerBtnCls, secondaryBtnCls, primaryBtnCls } from "@/components/ui/crud";
import { formatCurrency, formatShortDate } from "@/lib/utils";
import type { SerializedTransaction } from "@/modules/transactions/schemas";

const TYPE_LABELS: Record<string, { label: string; sign: "+" | "-" | "↔" }> = {
  PURCHASE: { label: "Compra / gasto", sign: "-" },
  BILL_PAYMENT: { label: "Pago de servicio", sign: "-" },
  CARD_PAYMENT: { label: "Pago de tarjeta", sign: "↔" },
  LOAN_PAYMENT: { label: "Cuota de préstamo", sign: "↔" },
  SALARY_INCOME: { label: "Nómina", sign: "+" },
  REMITTANCE_INCOME: { label: "Remesa", sign: "+" },
  TRANSFER: { label: "Transferencia", sign: "↔" },
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="text-right text-sm font-semibold text-slate-900">{children}</dd>
    </div>
  );
}

export function TransactionSummaryDialog({
  tx,
  onClose,
  onEdit,
  onDelete,
}: {
  tx: SerializedTransaction | null;
  onClose: () => void;
  onEdit: (tx: SerializedTransaction) => void;
  onDelete: (tx: SerializedTransaction) => void;
}) {
  const meta = tx ? TYPE_LABELS[tx.transactionType] : undefined;
  const isMsi = (tx?.installmentsCount ?? 1) > 1;

  return (
    <Modal
      open={Boolean(tx)}
      onClose={onClose}
      title="Resumen del movimiento"
      description={meta?.label}
      maxWidth="sm:max-w-md"
    >
      {tx && meta && (
        <>
          <div className="rounded-2xl bg-slate-50 p-4 text-center">
            <p className="text-sm font-semibold text-slate-700">{tx.title}</p>
            <p
              className={`mt-1 text-3xl font-extrabold tabular-nums ${
                meta.sign === "+"
                  ? "text-emerald-600"
                  : meta.sign === "-"
                  ? "text-rose-600"
                  : "text-sky-600"
              }`}
            >
              {meta.sign}
              {formatCurrency(tx.amount)}
            </p>
          </div>

          <dl className="mt-3 divide-y divide-slate-100">
            <Row label="Fecha">{formatShortDate(tx.date)}</Row>
            <Row label={tx.destinationAccountName ? "Desde" : "Cuenta"}>{tx.accountName}</Row>
            {tx.destinationAccountName && <Row label="Hacia">{tx.destinationAccountName}</Row>}
            <Row label="Categoría">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: tx.categoryColor }}
                  aria-hidden
                />
                {tx.categoryName}
              </span>
            </Row>
            {isMsi && (
              <Row label="Meses sin intereses">
                {tx.currentInstallment}/{tx.installmentsCount} pagadas
                <span className="block text-[11px] font-normal text-slate-500">
                  {formatCurrency(tx.amount / tx.installmentsCount)} por mes ·{" "}
                  {formatCurrency(
                    (tx.amount / tx.installmentsCount) *
                      (tx.installmentsCount - tx.currentInstallment)
                  )}{" "}
                  restantes
                </span>
              </Row>
            )}
            <Row label="Conciliación">
              {tx.isReconciled ? (
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" /> Conciliado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-slate-500">
                  <Circle className="h-4 w-4" /> Por conciliar
                </span>
              )}
            </Row>
            {tx.isRecurring && <Row label="Origen">Programación recurrente</Row>}
            {tx.description && <Row label="Nota">{tx.description}</Row>}
          </dl>

          {tx.receiptUrl && (
            <div className="mt-3">
              <p className="mb-1.5 text-xs font-medium text-slate-500">Comprobante</p>
              <a
                href={tx.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block overflow-hidden rounded-xl border border-slate-200"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tx.receiptUrl}
                  alt={`Comprobante de ${tx.title}`}
                  className="max-h-56 w-full object-contain bg-slate-50"
                />
                <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 text-[11px] font-semibold text-slate-700 shadow">
                  <ExternalLink className="h-3 w-3" /> Abrir
                </span>
              </a>
            </div>
          )}

          <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
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
            <button type="button" onClick={onClose} className={secondaryBtnCls}>
              Cerrar
            </button>
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
          </div>
        </>
      )}
    </Modal>
  );
}
