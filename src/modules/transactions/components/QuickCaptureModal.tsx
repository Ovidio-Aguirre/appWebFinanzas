"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowDownLeft,
  ArrowRightLeft,
  Camera,
  CheckCircle2,
  CreditCard,
  FileImage,
  Layers,
  Loader2,
  Receipt,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  QuickCaptureTransactionSchema,
  type QuickCaptureTransactionInput,
  type SerializedTransaction,
  type TransactionTypeValue,
} from "@/modules/transactions/schemas";
import type { SerializedAccount } from "@/modules/accounts/schemas";
import type { SerializedCategory } from "@/server/actions/finance.actions";
import {
  createCategoryAction,
  createQuickTransactionAction,
} from "@/server/actions/finance.actions";
import {
  compressReceiptImageClient,
  uploadCompressedReceipt,
  type CompressedReceiptResult,
} from "@/lib/storage/receipt-storage";
import { formatCurrency } from "@/lib/utils";

type ActionMode = "EXPENSE" | "DEBT_PAYMENT" | "INCOME";

interface QuickCaptureModalProps {
  open: boolean;
  onClose: () => void;
  accounts: SerializedAccount[];
  categories: SerializedCategory[];
  transactions: SerializedTransaction[];
  initialTransactionType?: TransactionTypeValue;
  preselectedDestinationAccountId?: string;
  preselectedAccountId?: string;
  defaultAmount?: number;
  defaultTitle?: string;
}

export function QuickCaptureModal({
  open,
  onClose,
  accounts,
  categories,
  transactions,
  initialTransactionType = "PURCHASE",
  preselectedDestinationAccountId,
  preselectedAccountId,
  defaultAmount,
  defaultTitle,
}: QuickCaptureModalProps) {
  const [actionMode, setActionMode] = useState<ActionMode>("EXPENSE");
  const [compressedReceipt, setCompressedReceipt] =
    useState<CompressedReceiptResult | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const liquidAccounts = accounts.filter(
    (a) => a.type === "CASH" || a.type === "DEBIT" || a.type === "SAVINGS_VAULT"
  );
  const expenseOriginAccounts = accounts.filter(
    (a) => a.type === "CASH" || a.type === "DEBIT" || a.type === "CREDIT_CARD"
  );
  const debtAndTargetAccounts = accounts.filter(
    (a) =>
      a.type === "CREDIT_CARD" ||
      a.type === "LOAN_LIABILITY" ||
      a.type === "SAVINGS_VAULT" ||
      a.type === "DEBIT"
  );

  const todayIso = new Date().toISOString().slice(0, 10);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<QuickCaptureTransactionInput>({
    resolver: zodResolver(QuickCaptureTransactionSchema),
    defaultValues: {
      title: "",
      description: "",
      amount: 0,
      date: todayIso,
      transactionType: initialTransactionType,
      accountId: expenseOriginAccounts[0]?.id ?? "",
      destinationAccountId: preselectedDestinationAccountId ?? "",
      msiTransactionId: "",
      categoryId: categories[0]?.id ?? "",
      receiptUrl: "",
      installmentsCount: 1,
      isRecurring: false,
      isReconciled: true,
    },
  });

  const selectedTransactionType = watch("transactionType");
  const selectedOriginAccountId = watch("accountId");
  const selectedOriginAccount = accounts.find(
    (a) => a.id === selectedOriginAccountId
  );
  const selectedDestinationAccountId = watch("destinationAccountId");

  // Compras a tasa cero (MSI) pendientes de la tarjeta destino seleccionada
  const pendingMsiTransactions = transactions.filter(
    (tx) =>
      tx.accountId === selectedDestinationAccountId &&
      tx.installmentsCount > 1 &&
      tx.currentInstallment < tx.installmentsCount
  );

  useEffect(() => {
    if (!open) return;

    if (
      initialTransactionType === "CARD_PAYMENT" ||
      initialTransactionType === "LOAN_PAYMENT" ||
      initialTransactionType === "TRANSFER"
    ) {
      setActionMode("DEBT_PAYMENT");
      setValue("transactionType", initialTransactionType);
      setValue("accountId", liquidAccounts[0]?.id ?? "");
      if (preselectedDestinationAccountId) {
        setValue("destinationAccountId", preselectedDestinationAccountId);
      } else {
        const firstCard = accounts.find((a) => a.type === "CREDIT_CARD");
        if (firstCard) setValue("destinationAccountId", firstCard.id);
      }
      const transferCat = categories.find((c) => c.type === "TRANSFER");
      if (transferCat) setValue("categoryId", transferCat.id);
    } else if (
      initialTransactionType === "SALARY_INCOME" ||
      initialTransactionType === "REMITTANCE_INCOME"
    ) {
      setActionMode("INCOME");
      setValue("transactionType", initialTransactionType);
      setValue(
        "accountId",
        preselectedAccountId ?? liquidAccounts[0]?.id ?? ""
      );
      const incomeCat = categories.find((c) => c.type === "INCOME");
      if (incomeCat) setValue("categoryId", incomeCat.id);
      if (defaultAmount !== undefined) setValue("amount", defaultAmount);
      if (defaultTitle !== undefined) setValue("title", defaultTitle);
    } else {
      setActionMode("EXPENSE");
      setValue("transactionType", "PURCHASE");
      setValue("accountId", expenseOriginAccounts[0]?.id ?? "");
      const expenseCat = categories.find((c) => c.type === "EXPENSE");
      if (expenseCat) setValue("categoryId", expenseCat.id);
    }
  }, [
    open,
    initialTransactionType,
    preselectedDestinationAccountId,
    preselectedAccountId,
    defaultAmount,
    defaultTitle,
  ]);

  const handleModeSwitch = (mode: ActionMode) => {
    setActionMode(mode);
    if (mode === "EXPENSE") {
      setValue("transactionType", "PURCHASE");
      setValue("accountId", expenseOriginAccounts[0]?.id ?? "");
      setValue("destinationAccountId", "");
      const cat = categories.find((c) => c.type === "EXPENSE");
      if (cat) setValue("categoryId", cat.id);
    } else if (mode === "DEBT_PAYMENT") {
      setValue("transactionType", "CARD_PAYMENT");
      setValue("accountId", liquidAccounts[0]?.id ?? "");
      const firstDebt = accounts.find(
        (a) => a.type === "CREDIT_CARD" || a.type === "LOAN_LIABILITY"
      );
      setValue("destinationAccountId", firstDebt?.id ?? "");
      const cat = categories.find((c) => c.type === "TRANSFER");
      if (cat) setValue("categoryId", cat.id);
    } else {
      setValue("transactionType", "SALARY_INCOME");
      setValue("accountId", liquidAccounts[0]?.id ?? "");
      setValue("destinationAccountId", "");
      const cat = categories.find((c) => c.type === "INCOME");
      if (cat) setValue("categoryId", cat.id);
    }
  };

  const handleReceiptChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    try {
      const result = await compressReceiptImageClient(file);
      setCompressedReceipt(result);
      toast.success(
        `Comprobante optimizado: ${result.originalSizeKB} KB → ${result.compressedSizeKB} KB (-${result.compressionRatioPercent}%)`
      );
    } catch {
      toast.error("No se pudo comprimir la imagen seleccionada.");
    } finally {
      setIsCompressing(false);
    }
  };

  const onSubmit = async (values: QuickCaptureTransactionInput) => {
    try {
      let finalReceiptUrl = values.receiptUrl || "";

      if (compressedReceipt) {
        setIsUploading(true);
        const uploaded = await uploadCompressedReceipt(compressedReceipt.file);
        finalReceiptUrl = uploaded.url;
        setIsUploading(false);
      }

      const result = await createQuickTransactionAction({
        ...values,
        receiptUrl: finalReceiptUrl,
      });

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      reset();
      setCompressedReceipt(null);
      onClose();
    } catch (error) {
      setIsUploading(false);
      toast.error(
        error instanceof Error
          ? error.message
          : "Ocurrió un error al registrar el movimiento."
      );
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    const actionModeType =
      actionMode === "INCOME" ? "INCOME" : actionMode === "DEBT_PAYMENT" ? "TRANSFER" : "EXPENSE";

    const result = await createCategoryAction({
      name: newCategoryName.trim(),
      type: actionModeType as "INCOME" | "EXPENSE" | "TRANSFER" | "INVESTMENT",
      icon: "Tag",
      color: "#0f766e",
    });

    if (result.success && result.data) {
      toast.success(result.message);
      setNewCategoryName("");
      setCreatingCategory(false);
    } else {
      toast.error(result.message ?? "No se pudo crear la categoría.");
    }
  };

  if (!open) return null;

  const needsDestination =
    selectedTransactionType === "CARD_PAYMENT" ||
    selectedTransactionType === "LOAN_PAYMENT" ||
    selectedTransactionType === "TRANSFER";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-md p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-capture-title"
    >
      <div className="w-full max-w-xl rounded-t-3xl sm:rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/15 text-teal-400 border border-teal-500/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="quick-capture-title"
                className="text-base font-bold text-white"
              >
                Captura Rápida de Movimiento
              </h2>
              <p className="text-xs text-slate-400">
                Transacción atómica ACID con soporte de ticket comprimido
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-5">
          {/* Selector de Acción Principal (3 modos solicitados) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              1. Selecciona el Tipo de Operación
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleModeSwitch("EXPENSE")}
                className={`flex items-center gap-2 rounded-xl border p-3 text-left text-xs font-semibold transition ${
                  actionMode === "EXPENSE"
                    ? "border-rose-500/60 bg-rose-500/15 text-rose-200 shadow-sm"
                    : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700"
                }`}
              >
                <Receipt className="h-4 w-4 text-rose-400 shrink-0" />
                <span>Registrar Compra / Gasto</span>
              </button>

              <button
                type="button"
                onClick={() => handleModeSwitch("DEBT_PAYMENT")}
                className={`flex items-center gap-2 rounded-xl border p-3 text-left text-xs font-semibold transition ${
                  actionMode === "DEBT_PAYMENT"
                    ? "border-sky-500/60 bg-sky-500/15 text-sky-200 shadow-sm"
                    : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700"
                }`}
              >
                <ArrowRightLeft className="h-4 w-4 text-sky-400 shrink-0" />
                <span>Pago de Tarjeta / Cuota</span>
              </button>

              <button
                type="button"
                onClick={() => handleModeSwitch("INCOME")}
                className={`flex items-center gap-2 rounded-xl border p-3 text-left text-xs font-semibold transition ${
                  actionMode === "INCOME"
                    ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200 shadow-sm"
                    : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700"
                }`}
              >
                <ArrowDownLeft className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Ingreso (Salario / Remesa)</span>
              </button>
            </div>
          </div>

          {/* Subtipo exacto de transacción y Monto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Subtipo de Transacción
              </label>
              <select
                {...register("transactionType")}
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3.5 py-2.5 text-sm text-white focus:border-teal-500 focus:outline-none"
              >
                {actionMode === "EXPENSE" && (
                  <>
                    <option value="PURCHASE">Compra en Comercio / TC</option>
                    <option value="BILL_PAYMENT">Pago de Servicio / Factura</option>
                  </>
                )}
                {actionMode === "DEBT_PAYMENT" && (
                  <>
                    <option value="CARD_PAYMENT">Pago de Tarjeta de Crédito</option>
                    <option value="LOAN_PAYMENT">Abono a Préstamo / Deuda</option>
                    <option value="TRANSFER">Transferencia entre Cuentas</option>
                  </>
                )}
                {actionMode === "INCOME" && (
                  <>
                    <option value="SALARY_INCOME">Salario / Nómina</option>
                    <option value="REMITTANCE_INCOME">Remesa / Honorarios</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Monto (USD) *
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register("amount")}
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3.5 py-2.5 text-sm font-semibold text-white focus:border-teal-500 focus:outline-none"
              />
              {errors.amount && (
                <p className="mt-1 text-xs text-rose-400">
                  {errors.amount.message}
                </p>
              )}
            </div>
          </div>

          {/* Concepto y Fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Concepto / Comercio *
              </label>
              <input
                type="text"
                placeholder={
                  actionMode === "EXPENSE"
                    ? "Ej. Supermercado, Gasolinera, Farmacia..."
                    : actionMode === "DEBT_PAYMENT"
                    ? "Ej. Pago de tarjeta de crédito..."
                    : "Ej. Salario, Remesa Familiar..."
                }
                {...register("title")}
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3.5 py-2.5 text-sm text-white focus:border-teal-500 focus:outline-none"
              />
              {errors.title && (
                <p className="mt-1 text-xs text-rose-400">
                  {errors.title.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Fecha *
              </label>
              <input
                type="date"
                {...register("date")}
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3.5 py-2.5 text-sm text-white focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Cuenta Origen y Cuenta Destino */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {actionMode === "INCOME"
                  ? "Cuenta Destino del Ingreso *"
                  : "Cuenta de Origen (Cargo) *"}
              </label>
              <select
                {...register("accountId")}
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3.5 py-2.5 text-sm text-white focus:border-teal-500 focus:outline-none"
              >
                {(actionMode === "EXPENSE"
                  ? expenseOriginAccounts
                  : liquidAccounts
                ).map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} (
                    {acc.type === "CREDIT_CARD"
                      ? `Disp: ${formatCurrency(
                          (acc.creditLimit ?? 0) - acc.currentBalance
                        )}`
                      : `Saldo: ${formatCurrency(acc.currentBalance)}`}
                    )
                  </option>
                ))}
              </select>
              {errors.accountId && (
                <p className="mt-1 text-xs text-rose-400">
                  {errors.accountId.message}
                </p>
              )}
            </div>

            {needsDestination ? (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Tarjeta / Cuenta Destino (Abono) *
                </label>
                <select
                  {...register("destinationAccountId")}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3.5 py-2.5 text-sm text-white focus:border-teal-500 focus:outline-none"
                >
                  <option value="">Selecciona destino...</option>
                  {debtAndTargetAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (
                      {acc.type === "CREDIT_CARD" ||
                      acc.type === "LOAN_LIABILITY"
                        ? `Deuda: ${formatCurrency(acc.currentBalance)}`
                        : `Saldo: ${formatCurrency(acc.currentBalance)}`}
                      )
                    </option>
                  ))}
                </select>
                {errors.destinationAccountId && (
                  <p className="mt-1 text-xs text-rose-400">
                    {errors.destinationAccountId.message}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <label className="text-xs font-medium text-slate-300 shrink-0">
                    Categoría Contable *
                  </label>
                  {creatingCategory ? (
                    <button
                      type="button"
                      onClick={() => setCreatingCategory(false)}
                      className="text-xs text-rose-400 hover:text-rose-300 underline"
                    >
                      Cancelar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCreatingCategory(true)}
                      className="text-xs text-teal-400 hover:text-teal-300 underline flex items-center gap-1"
                    >
                      <span className="h-3 w-3">+</span> Nueva
                    </button>
                  )}
                </div>
                {creatingCategory ? (
                  <form onSubmit={handleCreateCategory} className="flex flex-col gap-2">
                    <input
                      type="text"
                      placeholder="Nombre de la categoría"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!newCategoryName.trim()}
                      className="rounded-xl bg-teal-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Crear
                    </button>
                  </form>
                ) : (
                  <select
                    {...register("categoryId")}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3.5 py-2.5 text-sm text-white focus:border-teal-500 focus:outline-none"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                )}
                {errors.categoryId && (
                  <p className="mt-1 text-xs text-rose-400">
                    {errors.categoryId.message}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Si paga tarjeta con compras a tasa cero: asignar cuota específica */}
          {selectedTransactionType === "CARD_PAYMENT" &&
            pendingMsiTransactions.length > 0 && (
              <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3.5 space-y-2">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-indigo-400 shrink-0" />
                  <label className="text-xs font-semibold text-indigo-200">
                    Asignar pago a una compra a Tasa Cero (opcional)
                  </label>
                </div>
                <select
                  {...register("msiTransactionId")}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">
                    Pago general (sin asignar cuota específica)
                  </option>
                  {pendingMsiTransactions.map((tx) => (
                    <option key={tx.id} value={tx.id}>
                      {tx.title} — cuota {tx.currentInstallment}/
                      {tx.installmentsCount} (restan{" "}
                      {tx.installmentsCount - tx.currentInstallment})
                    </option>
                  ))}
                </select>
              </div>
            )}

          {/* Si es compra con Tarjeta de Crédito: Selector de Cuotas / MSI */}
          {actionMode === "EXPENSE" &&
            selectedOriginAccount?.type === "CREDIT_CARD" && (
              <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <CreditCard className="h-5 w-5 text-indigo-400 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-indigo-200">
                      Compra con {selectedOriginAccount.name}
                    </p>
                    <p className="text-[11px] text-indigo-300/80">
                      Elige si es pago de contado (1 mes) o diferido a Meses Sin Intereses (MSI)
                    </p>
                  </div>
                </div>
                <select
                  {...register("installmentsCount")}
                  className="rounded-lg border border-indigo-500/40 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <option value={1}>1 exhibición (Contado)</option>
                  <option value={3}>3 Meses Sin Intereses</option>
                  <option value={6}>6 Meses Sin Intereses</option>
                  <option value={12}>12 Meses Sin Intereses</option>
                  <option value={18}>18 Meses Sin Intereses</option>
                </select>
              </div>
            )}

          {/* Subida de Ticket / Factura con Compresión Automática en el Cliente */}
          <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/70/60 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Camera className="h-4 w-4 text-teal-400" />
                Comprobante / Ticket / Factura (Opcional)
              </span>
              <span className="text-[11px] text-teal-400 font-medium">
                Compresión WebP en cliente activa
              </span>
            </div>

            {!compressedReceipt ? (
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 py-4 px-3 hover:border-teal-500/40 hover:bg-slate-900 transition">
                {isCompressing ? (
                  <div className="flex items-center gap-2 text-xs text-teal-300">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Comprimiendo imagen en el navegador...</span>
                  </div>
                ) : (
                  <>
                    <FileImage className="h-6 w-6 text-slate-400 mb-1" />
                    <span className="text-xs font-medium text-slate-300">
                      Tomar foto del ticket o seleccionar imagen
                    </span>
                    <span className="text-[11px] text-slate-500 mt-0.5">
                      Optimización automática con browser-image-compression / Canvas
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleReceiptChange}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                <div className="flex items-center gap-3">
                  <img
                    src={compressedReceipt.previewDataUrl}
                    alt="Vista previa de comprobante"
                    className="h-12 w-12 rounded-lg object-cover border border-emerald-500/30"
                  />
                  <div>
                    <p className="text-xs font-semibold text-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      {compressedReceipt.file.name}
                    </p>
                    <p className="text-[11px] text-emerald-300/90">
                      Original: {compressedReceipt.originalSizeKB} KB →{" "}
                      <strong>{compressedReceipt.compressedSizeKB} KB</strong> (
                      Ahorro {compressedReceipt.compressionRatioPercent}%)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCompressedReceipt(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300 transition"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Notas adicionales y conciliación */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <input
              type="text"
              placeholder="Nota adicional o folio de referencia (opcional)..."
              {...register("description")}
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3.5 py-2 text-xs text-white focus:border-teal-500 focus:outline-none"
            />
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                {...register("isReconciled")}
                className="h-4 w-4 rounded border-white/10 bg-slate-950/70 text-teal-500 focus:ring-teal-500"
              />
              <span>Conciliado con estado de cuenta bancario</span>
            </label>
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isCompressing || isUploading}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 hover:brightness-110 disabled:opacity-60 px-5 py-2.5 text-xs font-bold text-slate-950 shadow-lg shadow-teal-500/20 transition"
            >
              {(isSubmitting || isUploading) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              <span>
                {isUploading
                  ? "Subiendo comprobante..."
                  : isSubmitting
                  ? "Procesando transacción ACID..."
                  : "Guardar Movimiento"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
