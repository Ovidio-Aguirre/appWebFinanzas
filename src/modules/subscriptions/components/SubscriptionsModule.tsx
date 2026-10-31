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
import { formatCurrency, formatShortDate } from "@/lib/utils";

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
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    isIncome: true,
  },
  REMITTANCE: {
    label: "Remesa Periódica",
    badge: "bg-teal-500/15 text-teal-300 border-teal-500/30",
    isIncome: true,
  },
  FIXED_FINANCING_INSTALLMENT: {
    label: "Cuota Fija",
    badge: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    isIncome: false,
  },
};

export function SubscriptionsModule({
  rules,
  accounts,
  categories,
}: SubscriptionsModuleProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
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

  const todayIso = new Date().toISOString().slice(0, 10);

  const {
    register,
    handleSubmit,
    reset,
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
      setNewCategoryName("");
      setCreatingCategory(false);
    } else {
      toast.error(result.message ?? "No se pudo crear la categoría.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado y métricas del cronograma mensual */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-5">
          <span className="text-xs font-medium text-slate-400">
            Suscripciones y Cargos Fijos / Mes
          </span>
          <p className="text-2xl font-extrabold text-rose-400 mt-1 tabular-nums">
            -{formatCurrency(monthlyExpenseTotal)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Suscripciones y servicios recurrentes
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-5">
          <span className="text-xs font-medium text-slate-400">
            Ingresos Recurrentes / Mes (Nómina + Remesas)
          </span>
          <p className="text-2xl font-extrabold text-emerald-400 mt-1 tabular-nums">
            +{formatCurrency(monthlyRecurringIncome)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Periodicidad quincenal y mensual configurada
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-5 flex flex-col justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400">
              Programación Automática
            </span>
            <p className="text-sm font-semibold text-white mt-1">
              {rules.filter((r) => r.autoPost).length} de {rules.length} con
              Autoregistro activo
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 hover:brightness-110 px-4 py-2.5 text-xs font-bold text-slate-950 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Nueva Suscripción / Ingreso Fijo</span>
          </button>
        </div>
      </div>

      {/* Cronograma / Calendario Mensual Ordenado por Próxima Fecha de Ejecución */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl overflow-hidden">
        <div className="border-b border-white/10 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-teal-400" />
            <div>
              <h3 className="text-base font-bold text-white">
                Cronograma Mensual de Cobros e Ingresos Programados
              </h3>
              <p className="text-xs text-slate-400">
                Alertas preventivas de vencimiento y ejecución manual o automática
              </p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-800/80">
          {rules.map((rule) => {
            const meta = RULE_TYPE_LABELS[rule.ruleType];
            const nextDate = startOfDay(new Date(rule.nextExecutionDate));
            const daysLeft = differenceInCalendarDays(nextDate, today);
            const isSoon = daysLeft >= 0 && daysLeft <= 5;
            const isDueTodayOrPast = daysLeft <= 0;

            return (
              <div
                key={rule.id}
                className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-800/30 transition"
              >
                <div className="flex items-start gap-3.5">
                  {/* Día en calendario visual */}
                  <div
                    className={`flex flex-col items-center justify-center h-12 w-12 rounded-xl border text-center shrink-0 ${
                      isSoon || isDueTodayOrPast
                        ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                        : "border-white/10 bg-slate-950 text-slate-300"
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold">
                      {new Intl.DateTimeFormat("es-MX", {
                        month: "short",
                      }).format(nextDate)}
                    </span>
                    <span className="text-sm font-extrabold leading-none mt-0.5">
                      {nextDate.getDate()}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-white">
                        {rule.title}
                      </span>
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${meta.badge}`}
                      >
                        {meta.label}
                      </span>
                      <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                        {FREQUENCY_LABELS[rule.frequency]}
                      </span>
                      {(isSoon || isDueTodayOrPast) && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                          <BellRing className="h-3 w-3" />
                          {daysLeft <= 0
                            ? "Programado para hoy"
                            : `En ${daysLeft} días`}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      <span>Cuenta: {rule.accountName}</span>
                      <span>•</span>
                      <span>Categoría: {rule.categoryName}</span>
                      <span>•</span>
                      <span>
                        Próxima fecha: {formatShortDate(rule.nextExecutionDate)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Controles: Switch Autoregistro, Monto y Botón Confirmar Ejecución */}
                <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-white/10">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleToggleAutoPost(rule)}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                      rule.autoPost
                        ? "border-teal-500/30 bg-teal-500/10 text-teal-300"
                        : "border-white/10 bg-slate-950/55 text-slate-400"
                    }`}
                  >
                    {rule.autoPost ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-teal-400" />
                        <span>Autoregistro Activo</span>
                      </>
                    ) : (
                      <>
                        <Clock className="h-3.5 w-3.5" />
                        <span>Manual</span>
                      </>
                    )}
                  </button>

                  <div
                    className={`text-base font-extrabold tabular-nums min-w-[100px] text-right ${
                      meta.isIncome ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {meta.isIncome ? "+" : "-"}
                    {formatCurrency(rule.amount)}
                  </div>

                  <button
                    type="button"
                    disabled={isPending && executingId === rule.id}
                    onClick={() => handleConfirmExecution(rule.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-teal-500 hover:text-slate-950 border border-slate-700 px-3.5 py-2 text-xs font-bold text-white transition"
                  >
                    {isPending && executingId === rule.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    <span>Confirmar ejecución</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal para Registrar Regla Recurrente */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900/90 backdrop-blur-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Repeat className="h-5 w-5 text-teal-400" />
                <h3 className="text-base font-bold text-white">
                  Programar Suscripción, Salario o Remesa
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmitNewRule)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Tipo de Regla Recurrente *
                  </label>
                  <select
                    {...register("ruleType")}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-xs text-white"
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
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Periodicidad *
                  </label>
                  <select
                    {...register("frequency")}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-xs text-white"
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
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Concepto / Servicio *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Netflix, Gym, Salario..."
                    {...register("title")}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-xs text-white"
                  />
                  {errors.title && (
                    <p className="text-[11px] text-rose-400 mt-1">
                      {errors.title.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Monto (USD) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...register("amount")}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-xs text-white"
                  />
                  {errors.amount && (
                    <p className="text-[11px] text-rose-400 mt-1">
                      {errors.amount.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Cuenta Asociada *
                  </label>
                  <select
                    {...register("accountId")}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-xs text-white"
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
                    <label className="text-xs font-medium text-slate-300 shrink-0">
                      Categoría *
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
                        className="rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none"
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
                      className="w-full rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none"
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {errors.categoryId && (
                    <p className="text-[11px] text-rose-400 mt-1">
                      {errors.categoryId.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Fecha de Inicio *
                  </label>
                  <input
                    type="date"
                    {...register("startDate")}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Próximo Cobro / Abono *
                  </label>
                  <input
                    type="date"
                    {...register("nextExecutionDate")}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-300 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  {...register("autoPost")}
                  className="h-4 w-4 rounded border-white/10 bg-slate-950/55 text-teal-500"
                />
                <span>
                  Habilitar autoregistro automático al llegar la fecha programada
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 hover:brightness-110 px-4 py-2 text-xs font-bold text-slate-950"
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
