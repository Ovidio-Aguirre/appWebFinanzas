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
import { formatCurrency, todayLocalIso } from "@/lib/utils";
import { notifyDataChanged } from "@/components/ui/crud";

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

  const todayIso = todayLocalIso();

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
      setValue("categoryId", result.data.id);
      notifyDataChanged();
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

  const originAvailableDisplay = selectedOriginAccount
    ? selectedOriginAccount.type === "CREDIT_CARD"
      ? Math.max(
          0,
          (selectedOriginAccount.creditLimit ?? 0) -
            selectedOriginAccount.currentBalance
        )
      : selectedOriginAccount.currentBalance
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-capture-title"
    >
      <div className="w-full max-w-[480px] rounded-t-3xl sm:rounded-3xl bg-[#0b0f17] border border-white/[0.10] shadow-2xl max-h-[94vh] overflow-y-auto">
        <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-white/15 sm:hidden" />

        {/* Header estilo App Nativa (transferir_dinero/screen.png) */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-[#0b0f17]/95 px-5 py-3.5 backdrop-blur-xl">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#131824] border border-white/[0.08] flex items-center justify-center text-slate-300 hover:text-white transition"
            aria-label="Cerrar modal"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="text-center">
            <h2
              id="quick-capture-title"
              className="text-sm font-extrabold text-white tracking-tight"
            >
              Registrar Movimiento
            </h2>
            <p className="text-[11px] font-semibold text-emerald-400">
              Instantáneo & Conciliación ACID
            </p>
          </div>

          <div className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Sparkles className="h-4 w-4" />
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          {/* 1. Tarjeta de Cuenta Activa (Idéntico al bloque superior de transferir_dinero/screen.png) */}
          {selectedOriginAccount && (
            <div className="rounded-2xl bg-gradient-to-br from-[#16242c] via-[#121926] to-[#0d121c] border border-white/[0.08] p-4 flex items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                      {actionMode === "INCOME"
                        ? "CUENTA DESTINO"
                        : "CUENTA ORIGEN"}
                    </span>
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-extrabold uppercase">
                      ACTIVA
                    </span>
                  </div>
                  <p className="text-sm font-extrabold text-white truncate mt-0.5">
                    {selectedOriginAccount.name}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {selectedOriginAccount.institution || "Banca Patrimonial"}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] text-slate-400 block">
                  Disponible
                </span>
                <span className="text-lg font-extrabold text-emerald-400 tabular-nums">
                  {formatCurrency(
                    originAvailableDisplay,
                    selectedOriginAccount.currency
                  )}
                </span>
              </div>
            </div>
          )}

          {/* 2. Selector Segmentado de Tipo de Operación (Idéntico a TIPO DE TRANSFERENCIA en transferir_dinero/screen.png) */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 px-1">
              Tipo de Operación
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[#111520] border border-white/[0.06]">
              <button
                type="button"
                onClick={() => handleModeSwitch("EXPENSE")}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 px-2 text-[11px] font-bold transition-all ${
                  actionMode === "EXPENSE"
                    ? "bg-[#1c2436] text-emerald-400 border border-emerald-500/30 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Receipt className="h-4 w-4" />
                <span>Gasto / Compra</span>
              </button>

              <button
                type="button"
                onClick={() => handleModeSwitch("DEBT_PAYMENT")}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 px-2 text-[11px] font-bold transition-all ${
                  actionMode === "DEBT_PAYMENT"
                    ? "bg-[#1c2436] text-cyan-400 border border-cyan-500/30 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <ArrowRightLeft className="h-4 w-4" />
                <span>Pago Tarjeta</span>
              </button>

              <button
                type="button"
                onClick={() => handleModeSwitch("INCOME")}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 px-2 text-[11px] font-bold transition-all ${
                  actionMode === "INCOME"
                    ? "bg-[#1c2436] text-emerald-400 border border-emerald-500/30 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <ArrowDownLeft className="h-4 w-4" />
                <span>Ingreso</span>
              </button>
            </div>
          </div>

          {/* 3. Tarjeta Hero de Importe (Idéntica al bloque central $450.00 de transferir_dinero/screen.png) */}
          <div className="rounded-2xl bg-[#111622] border border-white/[0.08] p-4 text-center space-y-3 shadow-inner">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#192132] border border-white/[0.06]">
              <span className="text-[11px] text-slate-400">Modalidad:</span>
              <select
                {...register("transactionType")}
                className="bg-transparent text-[11px] font-bold text-emerald-400 focus:outline-none cursor-pointer"
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

            <div className="flex items-center justify-center gap-1">
              <span className="text-2xl font-bold text-slate-400">$</span>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register("amount")}
                className="w-48 bg-transparent text-center text-4xl font-extrabold text-white tracking-tight tabular-nums placeholder:text-slate-600 focus:outline-none"
              />
              <span className="px-2 py-0.5 rounded-lg bg-[#192132] text-[11px] font-bold text-cyan-400">
                USD
              </span>
            </div>

            {errors.amount && (
              <p className="text-xs text-rose-400">{errors.amount.message}</p>
            )}

            <p className="text-[11px] text-emerald-400 font-medium flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Sin comisión • Acreditación inmediata en balance</span>
            </p>

            {/* Quick Amount Chips */}
            <div className="flex items-center justify-center gap-2 flex-wrap pt-0.5">
              {[25, 50, 100, 250].map((presetVal) => (
                <button
                  key={presetVal}
                  type="button"
                  onClick={() =>
                    setValue("amount", presetVal, { shouldValidate: true })
                  }
                  className="px-3 py-1 rounded-full bg-[#192132] hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-400 text-xs font-bold border border-white/[0.06] transition-all"
                >
                  +${presetVal}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Concepto y Fecha (Estilo input nativo de transferir_dinero/screen.png) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Concepto o referencia *
              </label>
              <input
                type="text"
                placeholder={
                  actionMode === "EXPENSE"
                    ? "Ej. Supermercado, Gasolinera, Cena..."
                    : actionMode === "DEBT_PAYMENT"
                    ? "Ej. Abono a tarjeta de crédito..."
                    : "Ej. Nómina Quincenal, Remesa..."
                }
                {...register("title")}
                className="w-full rounded-xl border border-white/[0.08] bg-[#131824] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/60 focus:outline-none"
              />
              {errors.title && (
                <p className="mt-1 text-xs text-rose-400">
                  {errors.title.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Fecha *
              </label>
              <input
                type="date"
                {...register("date")}
                className="w-full rounded-xl border border-white/[0.08] bg-[#131824] px-3 py-2.5 text-sm text-white focus:border-emerald-500/60 focus:outline-none"
              />
            </div>
          </div>

          {/* 5. Selección de Cuentas y Categoría */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {actionMode === "INCOME"
                  ? "Cuenta Destino del Ingreso *"
                  : "Cuenta de Origen (Cargo) *"}
              </label>
              <select
                {...register("accountId")}
                className="w-full rounded-xl border border-white/[0.08] bg-[#131824] px-3.5 py-2.5 text-xs font-semibold text-white focus:border-emerald-500/60 focus:outline-none"
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
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Tarjeta / Cuenta Destino (Abono) *
                </label>
                <select
                  {...register("destinationAccountId")}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#131824] px-3.5 py-2.5 text-xs font-semibold text-white focus:border-emerald-500/60 focus:outline-none"
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
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Categoría Contable *
                  </label>
                  {creatingCategory ? (
                    <button
                      type="button"
                      onClick={() => setCreatingCategory(false)}
                      className="text-xs text-rose-400 hover:underline"
                    >
                      Cancelar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCreatingCategory(true)}
                      className="text-xs text-emerald-400 font-bold hover:underline flex items-center gap-0.5"
                    >
                      <span>+ Nueva</span>
                    </button>
                  )}
                </div>
                {creatingCategory ? (
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Nombre categoría"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="flex-1 rounded-xl border border-white/[0.08] bg-[#131824] px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-emerald-500/60 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCreateCategory}
                      disabled={!newCategoryName.trim()}
                      className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-extrabold text-[#070a10] hover:brightness-110 disabled:opacity-50"
                    >
                      Crear
                    </button>
                  </div>
                ) : (
                  <select
                    {...register("categoryId")}
                    className="w-full rounded-xl border border-white/[0.08] bg-[#131824] px-3.5 py-2.5 text-xs font-semibold text-white focus:border-emerald-500/60 focus:outline-none"
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
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-3.5 space-y-2">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-cyan-400 shrink-0" />
                  <label className="text-xs font-bold text-cyan-300">
                    Asignar pago a una compra a Tasa Cero (opcional)
                  </label>
                </div>
                <select
                  {...register("msiTransactionId")}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#0b0f17] px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
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
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <CreditCard className="h-5 w-5 text-cyan-400 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-cyan-300">
                      Plazo con {selectedOriginAccount.name}
                    </p>
                    <p className="text-[11px] text-slate-300">
                      Contado o Meses Sin Intereses (MSI)
                    </p>
                  </div>
                </div>
                <select
                  {...register("installmentsCount")}
                  className="rounded-xl border border-cyan-500/30 bg-[#0b0f17] px-3 py-1.5 text-xs font-bold text-white"
                >
                  <option value={1}>1 mes (Contado)</option>
                  <option value={3}>3 MSI</option>
                  <option value={6}>6 MSI</option>
                  <option value={12}>12 MSI</option>
                  <option value={18}>18 MSI</option>
                </select>
              </div>
            )}

          {/* Subida de Ticket / Factura con Compresión Automática */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#111622] p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Camera className="h-4 w-4 text-emerald-400" />
                Añadir ticket o factura
              </span>
              <span className="text-[10px] text-emerald-400 font-semibold">
                Optimización WebP
              </span>
            </div>

            {!compressedReceipt ? (
              <label className="flex cursor-pointer items-center justify-center gap-2.5 rounded-xl border border-dashed border-white/[0.12] bg-[#0b0f17] py-3 px-3 hover:border-emerald-500/40 transition">
                {isCompressing ? (
                  <div className="flex items-center gap-2 text-xs text-emerald-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Comprimiendo comprobante...</span>
                  </div>
                ) : (
                  <>
                    <FileImage className="h-5 w-5 text-emerald-400 shrink-0" />
                    <div className="text-left">
                      <span className="text-xs font-bold text-white block">
                        Tomar foto o adjuntar imagen
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        Compresión automática sin pérdida visual
                      </span>
                    </div>
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
              <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={compressedReceipt.previewDataUrl}
                    alt="Vista previa de comprobante"
                    className="h-11 w-11 rounded-lg object-cover border border-emerald-500/30 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-emerald-400 truncate flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      {compressedReceipt.file.name}
                    </p>
                    <p className="text-[10px] text-slate-300">
                      {compressedReceipt.originalSizeKB} KB →{" "}
                      <strong className="text-emerald-400">
                        {compressedReceipt.compressedSizeKB} KB
                      </strong>{" "}
                      (-{compressedReceipt.compressionRatioPercent}%)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCompressedReceipt(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/15 hover:text-rose-400 transition shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Notas adicionales y conciliación */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
            <input
              type="text"
              placeholder="Nota adicional o folio (opcional)..."
              {...register("description")}
              className="w-full rounded-xl border border-white/[0.08] bg-[#131824] px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:border-emerald-500/60 focus:outline-none"
            />
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none px-1">
              <input
                type="checkbox"
                {...register("isReconciled")}
                className="h-4 w-4 rounded border-white/20 bg-[#131824] text-emerald-500 focus:ring-emerald-500"
              />
              <span>Conciliado con banco</span>
            </label>
          </div>

          {/* Botón CTA Principal (Idéntico al botón inferior esmeralda de transferir_dinero/screen.png) */}
          <div className="pt-1">
            <button
              type="submit"
              disabled={isSubmitting || isCompressing || isUploading}
              className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:brightness-110 active:scale-[0.99] disabled:opacity-60 text-sm font-extrabold text-[#070a10] shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all"
            >
              {(isSubmitting || isUploading) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 stroke-[2.5]" />
              )}
              <span>
                {isUploading
                  ? "Subiendo comprobante..."
                  : isSubmitting
                  ? "Procesando transacción..."
                  : "Confirmar y Guardar Movimiento"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
