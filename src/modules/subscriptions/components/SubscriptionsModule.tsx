"use client";

import React, { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  BellRing,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  Play,
  Plus,
  Repeat,
  Sparkles,
  X,
} from "lucide-react";
import { differenceInCalendarDays, startOfDay } from "date-fns";
import { toast } from "sonner";
import { CreateCategorySchema } from "@/modules/transactions/schemas";
import {
  CreateRecurringRuleSchema,
  type CreateRecurringRuleInput,
  type FrequencyValue,
  type RuleTypeValue,
  type SerializedRecurringRule,
} from "@/modules/subscriptions/schemas";
import type { SerializedAccount } from "@/modules/accounts/schemas";
import type { SerializedCategory } from "@/server/actions/finance.actions";
import {
  createCategoryAction,
  createRecurringRuleAction,
  executeRecurringRuleAction,
  toggleRecurringAutoPostAction,
} from "@/server/actions/finance.actions";
import { Pause } from "lucide-react";
import { RowActions, runAction, notifyDataChanged } from "@/components/ui/crud";
import { setRecurringRuleActiveAction } from "@/server/actions/crud.actions";
import { DeleteRuleDialog, EditRuleDialog } from "@/components/crud/EditDialogs";
import {
  calendarDate,
  formatCurrency,
  formatShortDate,
  todayLocalIso,
} from "@/lib/utils";

interface SubscriptionsModuleProps {
  rules: SerializedRecurringRule[];
  accounts: SerializedAccount[];
  categories: SerializedCategory[];
}

const FREQUENCY_LABELS: Record<FrequencyValue, string> = {
  WEEKLY: "Semanal",
  BIWEEKLY: "Quincenal",
  MONTHLY: "Mensual",
  YEARLY: "Anual",
};

const RULE_TYPE_LABELS: Record<
  RuleTypeValue,
  { label: string; badge: string; isIncome: boolean }
> = {
  SUBSCRIPTION: {
    label: "Suscripción / Cargo",
    badge: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    isIncome: false,
  },
  PAYROLL: {
    label: "Nómina / Salario",
    badge: "bg-primary/15 text-primary border-primary/30",
    isIncome: true,
  },
  REMITTANCE: {
    label: "Remesa Periódica",
    badge: "bg-secondary/15 text-secondary border-secondary/30",
    isIncome: true,
  },
  FIXED_FINANCING_INSTALLMENT: {
    label: "Cuota Fija",
    badge: "bg-tertiary/15 text-tertiary border-tertiary/30",
    isIncome: false,
  },
};

export function SubscriptionsModule({
  rules,
  accounts,
  categories,
}: SubscriptionsModuleProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRule, setEditingRule] = useState<SerializedRecurringRule | null>(null);
  const [deletingRule, setDeletingRule] = useState<SerializedRecurringRule | null>(null);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const today = startOfDay(new Date());

  // Calcular totales mensuales estimados
  const monthlyExpenseTotal = rules
    .filter(
      (r) =>
        r.active &&
        (r.ruleType === "SUBSCRIPTION" ||
          r.ruleType === "FIXED_FINANCING_INSTALLMENT")
    )
    .reduce((acc, r) => {
      const mult =
        r.frequency === "WEEKLY"
          ? 4
          : r.frequency === "BIWEEKLY"
          ? 2
          : r.frequency === "YEARLY"
          ? 1 / 12
          : 1;
      return acc + r.amount * mult;
    }, 0);

  const monthlyRecurringIncome = rules
    .filter(
      (r) =>
        r.active && (r.ruleType === "PAYROLL" || r.ruleType === "REMITTANCE")
    )
    .reduce((acc, r) => {
      const mult =
        r.frequency === "WEEKLY"
          ? 4
          : r.frequency === "BIWEEKLY"
          ? 2
          : r.frequency === "YEARLY"
          ? 1 / 12
          : 1;
      return acc + r.amount * mult;
    }, 0);

  const todayIso = todayLocalIso();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateRecurringRuleInput>({
    resolver: zodResolver(CreateRecurringRuleSchema),
    defaultValues: {
      title: "",
      provider: "",
      amount: 0,
      frequency: "MONTHLY",
      ruleType: "SUBSCRIPTION",
      accountId: accounts[0]?.id ?? "",
      categoryId: categories[0]?.id ?? "",
      startDate: todayIso,
      nextExecutionDate: todayIso,
      autoPost: true,
    },
  });

  const handleConfirmExecution = (ruleId: string) => {
    setExecutingId(ruleId);
    startTransition(async () => {
      const res = await executeRecurringRuleAction(ruleId);
      setExecutingId(null);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    });
  };

  const handleToggleAutoPost = (rule: SerializedRecurringRule) => {
    startTransition(async () => {
      const res = await toggleRecurringAutoPostAction(rule.id, !rule.autoPost);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    });
  };

  const onSubmitNewRule = async (values: CreateRecurringRuleInput) => {
    const res = await createRecurringRuleAction(values);
    if (!res.success) {
      toast.error(res.message);
      return;
    }
    toast.success(res.message);
    reset();
    setShowCreateModal(false);
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    const result = await createCategoryAction({
      name: newCategoryName.trim(),
      type: "EXPENSE",
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

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Hero Card de Programación Recurrente (Estilo Banca Móvil Veltis) */}
      <div className="relative overflow-hidden rounded-2xl bg-[#111622] border border-white/[0.08] p-5 shadow-xl flex flex-col gap-3.5">
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2">
            <span className="inline-flex p-1.5 rounded-full bg-emerald-500/15 text-emerald-400">
              <CalendarDays className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Pagos e Ingresos Fijos
            </span>
          </div>
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#1b2233] text-emerald-400 font-bold">
            {rules.filter((r) => r.autoPost).length}/{rules.length} Auto
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 relative z-10">
          <div className="rounded-xl bg-[#0b0f17] border border-white/[0.05] p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Cargos Fijos / Mes
            </span>
            <p className="text-lg font-extrabold text-rose-300 tabular-nums mt-0.5">
              -{formatCurrency(monthlyExpenseTotal)}
            </p>
          </div>
          <div className="rounded-xl bg-[#0b0f17] border border-white/[0.05] p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Ingresos Fijos / Mes
            </span>
            <p className="text-lg font-extrabold text-emerald-400 tabular-nums mt-0.5">
              +{formatCurrency(monthlyRecurringIncome)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="relative z-10 w-full py-2.5 px-4 rounded-full bg-emerald-500 hover:brightness-110 active:scale-[0.98] text-xs font-extrabold text-[#070a10] shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>Programar Suscripción o Ingreso</span>
        </button>
      </div>

      {/* 2. Lista de Reglas Recurrentes (Tarjetas Nativas Individuales) */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-white tracking-tight">
            Cronograma Mensual ({rules.length})
          </h3>
          <span className="text-[11px] text-slate-400">
            Ordenado por vencimiento
          </span>
        </div>

        {rules.map((rule) => {
          const meta = RULE_TYPE_LABELS[rule.ruleType];
          const nextDate = startOfDay(calendarDate(rule.nextExecutionDate));
          const daysLeft = differenceInCalendarDays(nextDate, today);
          const isSoon = daysLeft >= 0 && daysLeft <= 5;
          const isDueTodayOrPast = daysLeft <= 0;

          return (
            <div
              key={rule.id}
              className="rounded-2xl bg-[#0d121c] border border-white/[0.06] p-3.5 flex flex-col gap-3 shadow-md"
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Día en calendario visual */}
                  <div
                    className={`flex flex-col items-center justify-center h-11 w-11 rounded-xl border text-center shrink-0 ${
                      isSoon || isDueTodayOrPast
                        ? "border-amber-500/35 bg-amber-500/15 text-amber-300"
                        : "border-white/[0.08] bg-[#151c2c] text-white"
                    }`}
                  >
                    <span className="text-[9px] uppercase font-bold text-slate-400">
                      {new Intl.DateTimeFormat("es-MX", {
                        month: "short",
                      }).format(nextDate)}
                    </span>
                    <span className="text-sm font-extrabold leading-none mt-0.5">
                      {nextDate.getDate()}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-white truncate">
                        {rule.title}
                      </span>
                      <span className="rounded bg-[#192132] px-1.5 py-0.2 text-[9px] font-bold text-slate-300">
                        {FREQUENCY_LABELS[rule.frequency]}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {rule.accountName} • {rule.categoryName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span
                    className={`text-sm font-mono font-extrabold tabular-nums ${
                      meta.isIncome ? "text-emerald-400" : "text-slate-100"
                    }`}
                  >
                    {meta.isIncome ? "+" : "-"}
                    {formatCurrency(rule.amount)}
                  </span>
                  <RowActions
                    label={rule.title}
                    onEdit={() => setEditingRule(rule)}
                    onDelete={() => setDeletingRule(rule)}
                  />
                </div>
              </div>

              {/* Barra inferior de acciones de la regla */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.05]">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleToggleAutoPost(rule)}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold transition ${
                      rule.autoPost
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : "border-white/[0.08] bg-[#151c2c] text-slate-400"
                    }`}
                  >
                    {rule.autoPost ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Auto</span>
                      </>
                    ) : (
                      <>
                        <Clock className="h-3 w-3" />
                        <span>Manual</span>
                      </>
                    )}
                  </button>

                  {(isSoon || isDueTodayOrPast) && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 border border-amber-500/30 px-2 py-1 text-[10px] font-bold text-amber-300">
                      <BellRing className="h-3 w-3" />
                      {daysLeft <= 0 ? "Hoy" : `${daysLeft}d`}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      void runAction(() =>
                        setRecurringRuleActiveAction(rule.id, !rule.active)
                      )
                    }
                    aria-label={
                      rule.active
                        ? `Pausar ${rule.title}`
                        : `Reactivar ${rule.title}`
                    }
                    title={rule.active ? "Pausar" : "Reactivar"}
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.06] transition ${
                      rule.active
                        ? "bg-[#151c2c] text-slate-400 hover:text-amber-300"
                        : "bg-amber-500/20 text-amber-300"
                    }`}
                  >
                    {rule.active ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={
                      !rule.active || (isPending && executingId === rule.id)
                    }
                    onClick={() => handleConfirmExecution(rule.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#192132] hover:bg-emerald-500 text-emerald-400 hover:text-[#070a10] border border-emerald-500/25 px-3 py-1 text-[11px] font-bold transition"
                  >
                    {isPending && executingId === rule.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                    <span>Ejecutar</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <EditRuleDialog
        rule={editingRule}
        accounts={accounts}
        categories={categories}
        onClose={() => setEditingRule(null)}
      />
      <DeleteRuleDialog rule={deletingRule} onClose={() => setDeletingRule(null)} />

      {/* Modal para Registrar Regla Recurrente */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-surface-container-lowest/80 backdrop-blur-md p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl border border-white/[0.10] bg-surface-container backdrop-blur-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="w-12 h-1.5 bg-surface-container-highest rounded-full mx-auto mb-3 sm:hidden" />
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Repeat className="h-5 w-5 text-primary" />
                <h3 className="font-display text-base font-bold text-on-surface">
                  Programar Suscripción, Salario o Remesa
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-full p-1.5 bg-surface-container-high text-on-surface-variant hover:bg-surface-bright hover:text-on-surface"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmitNewRule)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1">
                    Tipo de Regla Recurrente *
                  </label>
                  <select
                    {...register("ruleType")}
                    className="w-full rounded-xl border border-white/[0.08] bg-surface-container-low px-3 py-2.5 text-xs text-on-surface focus:border-primary/60 focus:outline-none"
                  >
                    <option value="SUBSCRIPTION">
                      Suscripción / servicio recurrente
                    </option>
                    <option value="PAYROLL">
                      Ingreso de Nómina / Salario Fijo
                    </option>
                    <option value="REMITTANCE">
                      Remesa Periódica / Honorarios
                    </option>
                    <option value="FIXED_FINANCING_INSTALLMENT">
                      Cuota de Financiamiento Fijo
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1">
                    Periodicidad *
                  </label>
                  <select
                    {...register("frequency")}
                    className="w-full rounded-xl border border-white/[0.08] bg-surface-container-low px-3 py-2.5 text-xs text-on-surface focus:border-primary/60 focus:outline-none"
                  >
                    <option value="BIWEEKLY">Quincenal (Cada 15 días)</option>
                    <option value="MONTHLY">Mensual</option>
                    <option value="WEEKLY">Semanal</option>
                    <option value="YEARLY">Anual</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1">
                    Concepto / Servicio *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Netflix, Gym, Salario..."
                    {...register("title")}
                    className="w-full rounded-xl border border-white/[0.08] bg-surface-container-low px-3 py-2.5 text-xs text-on-surface placeholder:text-outline focus:border-primary/60 focus:outline-none"
                  />
                  {errors.title && (
                    <p className="text-[11px] text-tertiary mt-1">
                      {errors.title.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1">
                    Monto (USD) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...register("amount")}
                    className="w-full rounded-xl border border-white/[0.08] bg-surface-container-low px-3 py-2.5 text-xs text-on-surface focus:border-primary/60 focus:outline-none"
                  />
                  {errors.amount && (
                    <p className="text-[11px] text-tertiary mt-1">
                      {errors.amount.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1">
                    Cuenta Asociada *
                  </label>
                  <select
                    {...register("accountId")}
                    className="w-full rounded-xl border border-white/[0.08] bg-surface-container-low px-3 py-2.5 text-xs text-on-surface focus:border-primary/60 focus:outline-none"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-xs font-medium text-on-surface-variant shrink-0">
                      Categoría *
                    </label>
                    {creatingCategory ? (
                      <button
                        type="button"
                        onClick={() => setCreatingCategory(false)}
                        className="text-xs text-tertiary hover:underline"
                      >
                        Cancelar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCreatingCategory(true)}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
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
                        className="rounded-xl border border-white/[0.08] bg-surface-container-low px-3 py-2 text-xs text-on-surface placeholder:text-outline focus:border-primary/60 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={!newCategoryName.trim()}
                        className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-on-primary hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Crear
                      </button>
                    </form>
                  ) : (
                    <select
                      {...register("categoryId")}
                      className="w-full rounded-xl border border-white/[0.08] bg-surface-container-low px-3 py-2.5 text-xs text-on-surface focus:border-primary/60 focus:outline-none"
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {errors.categoryId && (
                    <p className="text-[11px] text-tertiary mt-1">
                      {errors.categoryId.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1">
                    Fecha de Inicio *
                  </label>
                  <input
                    type="date"
                    {...register("startDate")}
                    className="w-full rounded-xl border border-white/[0.08] bg-surface-container-low px-3 py-2.5 text-xs text-on-surface focus:border-primary/60 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1">
                    Próximo Cobro / Abono *
                  </label>
                  <input
                    type="date"
                    {...register("nextExecutionDate")}
                    className="w-full rounded-xl border border-white/[0.08] bg-surface-container-low px-3 py-2.5 text-xs text-on-surface focus:border-primary/60 focus:outline-none"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-on-surface-variant pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  {...register("autoPost")}
                  className="h-4 w-4 rounded border-white/20 bg-surface-container-low accent-[#4edea3]"
                />
                <span>
                  Habilitar autoregistro automático al llegar la fecha programada
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-white/[0.1] bg-surface-container-high px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-bright"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary hover:brightness-110 px-4 py-2 text-xs font-bold text-on-primary shadow-lg shadow-primary/25"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  <span>Guardar Programación</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
