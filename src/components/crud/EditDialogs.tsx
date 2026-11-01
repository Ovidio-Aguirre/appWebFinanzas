"use client";

import React, { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import {
  ConfirmDialog,
  Field,
  Modal,
  ModalFooter,
  RowActions,
  inputCls,
  primaryBtnCls,
  runAction,
  secondaryBtnCls,
} from "@/components/ui/crud";
import { calendarDate, formatCurrency, todayLocalIso } from "@/lib/utils";
import type { SerializedTransaction } from "@/modules/transactions/schemas";
import type { SerializedAccount } from "@/modules/accounts/schemas";
import type { SerializedRecurringRule } from "@/modules/subscriptions/schemas";
import type { SerializedLoanAccount } from "@/modules/loans/schemas";
import type { SerializedSavingsGoal } from "@/modules/savings/schemas";
import type { SerializedCategory } from "@/server/actions/finance.actions";
import { createCategoryAction } from "@/server/actions/finance.actions";
import {
  deleteAccountAction,
  deleteCategoryAction,
  deleteLoanAction,
  deleteRecurringRuleAction,
  deleteSavingsGoalAction,
  deleteTransactionAction,
  updateAccountAction,
  updateCategoryAction,
  updateLoanAction,
  updateRecurringRuleAction,
  updateSavingsGoalAction,
  updateTransactionAction,
} from "@/server/actions/crud.actions";

const toDateInput = (iso: string) => todayLocalIso(calendarDate(iso));

const TYPE_LABELS: Record<string, string> = {
  PURCHASE: "Compra / gasto",
  BILL_PAYMENT: "Pago de servicio",
  CARD_PAYMENT: "Pago de tarjeta",
  LOAN_PAYMENT: "Pago de préstamo",
  SALARY_INCOME: "Nómina",
  REMITTANCE_INCOME: "Remesa",
  TRANSFER: "Transferencia",
};

function SubmitButtons({
  pending,
  onClose,
  label = "Guardar cambios",
}: {
  pending: boolean;
  onClose: () => void;
  label?: string;
}) {
  return (
    <ModalFooter>
      <button type="button" onClick={onClose} className={secondaryBtnCls} disabled={pending}>
        Cancelar
      </button>
      <button type="submit" className={primaryBtnCls} disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {label}
      </button>
    </ModalFooter>
  );
}

// ===========================================================================
// MOVIMIENTOS
// ===========================================================================
export function EditTransactionDialog({
  tx,
  accounts,
  categories,
  onClose,
}: {
  tx: SerializedTransaction | null;
  accounts: SerializedAccount[];
  categories: SerializedCategory[];
  onClose: () => void;
}) {
  return (
    <Modal
      open={Boolean(tx)}
      onClose={onClose}
      title="Editar movimiento"
      description={tx ? TYPE_LABELS[tx.transactionType] : undefined}
    >
      {tx && (
        <TransactionForm
          key={tx.id}
          tx={tx}
          accounts={accounts}
          categories={categories}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

function TransactionForm({
  tx,
  accounts,
  categories,
  onClose,
}: {
  tx: SerializedTransaction;
  accounts: SerializedAccount[];
  categories: SerializedCategory[];
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [f, setF] = useState({
    title: tx.title,
    description: tx.description ?? "",
    amount: String(tx.amount),
    date: toDateInput(tx.date),
    accountId: tx.accountId,
    destinationAccountId: tx.destinationAccountId ?? "",
    categoryId: tx.categoryId,
    installmentsCount: String(tx.installmentsCount),
    isReconciled: tx.isReconciled,
  });
  const set = (k: keyof typeof f, v: string | boolean) =>
    setF((p) => ({ ...p, [k]: v }));

  const needsDestination = ["CARD_PAYMENT", "LOAN_PAYMENT", "TRANSFER"].includes(
    tx.transactionType
  );
  const isCardPurchase =
    tx.transactionType === "PURCHASE" && tx.accountType === "CREDIT_CARD";
  const selectable = accounts.filter((a) => a.type !== "LOAN_LIABILITY");
  const destinations = accounts.filter((a) =>
    tx.transactionType === "TRANSFER"
      ? ["CASH", "DEBIT", "SAVINGS_VAULT"].includes(a.type)
      : ["CREDIT_CARD", "LOAN_LIABILITY"].includes(a.type)
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      await runAction(
        () =>
          updateTransactionAction(tx.id, {
            title: f.title,
            description: f.description,
            amount: Number(f.amount),
            date: f.date,
            transactionType: tx.transactionType,
            accountId: f.accountId,
            destinationAccountId: f.destinationAccountId,
            msiTransactionId: "",
            categoryId: f.categoryId,
            receiptUrl: tx.receiptUrl ?? "",
            installmentsCount: Number(f.installmentsCount) || 1,
            isRecurring: tx.isRecurring,
            isReconciled: f.isReconciled,
          }),
        onClose
      );
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <Field label="Concepto">
        <input className={inputCls} value={f.title} onChange={(e) => set("title", e.target.value)} required minLength={2} maxLength={90} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Monto (USD)">
          <input className={inputCls} type="number" step="0.01" min="0.01" inputMode="decimal" value={f.amount} onChange={(e) => set("amount", e.target.value)} required />
        </Field>
        <Field label="Fecha">
          <input className={inputCls} type="date" value={f.date} onChange={(e) => set("date", e.target.value)} required />
        </Field>
      </div>
      <Field label={needsDestination ? "Cuenta de origen" : "Cuenta"}>
        <select className={inputCls} value={f.accountId} onChange={(e) => set("accountId", e.target.value)}>
          {selectable.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </Field>
      {needsDestination && (
        <Field label="Cuenta destino">
          <select className={inputCls} value={f.destinationAccountId} onChange={(e) => set("destinationAccountId", e.target.value)}>
            <option value="">Selecciona…</option>
            {destinations.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Categoría">
        <select className={inputCls} value={f.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </Field>
      {isCardPurchase && (
        <Field label="Meses sin intereses (1 = pago único)">
          <input className={inputCls} type="number" min="1" max="48" value={f.installmentsCount} onChange={(e) => set("installmentsCount", e.target.value)} />
        </Field>
      )}
      <Field label="Nota (opcional)">
        <input className={inputCls} value={f.description} onChange={(e) => set("description", e.target.value)} maxLength={240} />
      </Field>
      <label className="flex min-h-10 items-center gap-2 text-sm text-on-surface">
        <input type="checkbox" className="h-4 w-4 accent-[#4edea3]" checked={f.isReconciled} onChange={(e) => set("isReconciled", e.target.checked)} />
        Conciliado con estado de cuenta
      </label>
      <p className="rounded-xl bg-surface-container-low border border-white/[0.06] p-2.5 text-[11px] text-on-surface-variant">
        Al cambiar monto o cuentas, los saldos se corrigen automáticamente (se revierte el efecto anterior y se aplica el nuevo).
      </p>
      <SubmitButtons pending={pending} onClose={onClose} />
    </form>
  );
}

export function DeleteTransactionDialog({
  tx,
  onClose,
}: {
  tx: SerializedTransaction | null;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  return (
    <ConfirmDialog
      open={Boolean(tx)}
      onClose={onClose}
      pending={pending}
      title="Eliminar movimiento"
      description={
        tx
          ? `Se eliminará "${tx.title}" (${formatCurrency(tx.amount)}) y los saldos de las cuentas se revertirán.`
          : ""
      }
      onConfirm={() =>
        tx && start(async () => void (await runAction(() => deleteTransactionAction(tx.id), onClose)))
      }
    />
  );
}

// ===========================================================================
// CUENTAS / TARJETAS
// ===========================================================================
export function EditAccountDialog({
  account,
  onClose,
}: {
  account: SerializedAccount | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={Boolean(account)}
      onClose={onClose}
      title={account?.type === "CREDIT_CARD" ? "Editar tarjeta" : "Editar cuenta"}
      description="Puedes ajustar el saldo para corregir diferencias con tu banco."
    >
      {account && <AccountForm key={account.id} account={account} onClose={onClose} />}
    </Modal>
  );
}

function AccountForm({
  account,
  onClose,
}: {
  account: SerializedAccount;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const isCard = account.type === "CREDIT_CARD";
  const [f, setF] = useState({
    name: account.name,
    institution: account.institution ?? "",
    color: account.color ?? "#0d9488",
    lastFourDigits: account.lastFourDigits ?? "",
    currentBalance: String(account.currentBalance),
    creditLimit: String(account.creditLimit ?? ""),
    cutoffDay: String(account.cutoffDay ?? ""),
    paymentDueDay: String(account.paymentDueDay ?? ""),
    interestRate: String(account.interestRate ?? ""),
    noInterestPayment: String(account.noInterestPayment ?? ""),
    minimumPayment: String(account.minimumPayment ?? ""),
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const opt = (v: string) => (v === "" ? undefined : Number(v));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      await runAction(
        () =>
          updateAccountAction(account.id, {
            name: f.name,
            institution: f.institution,
            color: f.color,
            lastFourDigits: f.lastFourDigits,
            currentBalance: Number(f.currentBalance),
            creditLimit: opt(f.creditLimit),
            cutoffDay: opt(f.cutoffDay),
            paymentDueDay: opt(f.paymentDueDay),
            interestRate: opt(f.interestRate),
            noInterestPayment: opt(f.noInterestPayment),
            minimumPayment: opt(f.minimumPayment),
          }),
        onClose
      );
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <Field label="Nombre">
        <input className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} required minLength={2} maxLength={60} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Institución">
          <input className={inputCls} value={f.institution} onChange={(e) => set("institution", e.target.value)} maxLength={50} />
        </Field>
        <Field label="Últimos 4 dígitos">
          <input className={inputCls} value={f.lastFourDigits} onChange={(e) => set("lastFourDigits", e.target.value)} maxLength={4} inputMode="numeric" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={isCard ? "Deuda actual (USD)" : "Saldo actual (USD)"}>
          <input className={inputCls} type="number" step="0.01" min="0" inputMode="decimal" value={f.currentBalance} onChange={(e) => set("currentBalance", e.target.value)} required />
        </Field>
        <Field label="Color">
          <input className={`${inputCls} h-[42px] p-1`} type="color" value={f.color} onChange={(e) => set("color", e.target.value)} />
        </Field>
      </div>
      {isCard && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Límite de crédito">
              <input className={inputCls} type="number" step="0.01" min="0" value={f.creditLimit} onChange={(e) => set("creditLimit", e.target.value)} required />
            </Field>
            <Field label="Tasa anual (%)">
              <input className={inputCls} type="number" step="0.01" min="0" max="200" value={f.interestRate} onChange={(e) => set("interestRate", e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Día de corte (1-31)">
              <input className={inputCls} type="number" min="1" max="31" value={f.cutoffDay} onChange={(e) => set("cutoffDay", e.target.value)} />
            </Field>
            <Field label="Día límite de pago (1-31)">
              <input className={inputCls} type="number" min="1" max="31" value={f.paymentDueDay} onChange={(e) => set("paymentDueDay", e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pago para no generar intereses">
              <input className={inputCls} type="number" step="0.01" min="0" value={f.noInterestPayment} onChange={(e) => set("noInterestPayment", e.target.value)} />
            </Field>
            <Field label="Pago mínimo">
              <input className={inputCls} type="number" step="0.01" min="0" value={f.minimumPayment} onChange={(e) => set("minimumPayment", e.target.value)} />
            </Field>
          </div>
        </>
      )}
      <SubmitButtons pending={pending} onClose={onClose} />
    </form>
  );
}

export function DeleteAccountDialog({
  account,
  onClose,
}: {
  account: SerializedAccount | null;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  return (
    <ConfirmDialog
      open={Boolean(account)}
      onClose={onClose}
      pending={pending}
      title="Eliminar cuenta"
      description={
        account
          ? `Se eliminará "${account.name}". Si ya tiene movimientos se archivará para conservar el historial y dejará de sumar a tu patrimonio.`
          : ""
      }
      onConfirm={() =>
        account &&
        start(async () => void (await runAction(() => deleteAccountAction(account.id), onClose)))
      }
    />
  );
}

// ===========================================================================
// RECURRENTES
// ===========================================================================
export function EditRuleDialog({
  rule,
  accounts,
  categories,
  onClose,
}: {
  rule: SerializedRecurringRule | null;
  accounts: SerializedAccount[];
  categories: SerializedCategory[];
  onClose: () => void;
}) {
  return (
    <Modal open={Boolean(rule)} onClose={onClose} title="Editar programación" description="Suscripciones, nómina, remesas y cuotas fijas.">
      {rule && <RuleForm key={rule.id} rule={rule} accounts={accounts} categories={categories} onClose={onClose} />}
    </Modal>
  );
}

function RuleForm({
  rule,
  accounts,
  categories,
  onClose,
}: {
  rule: SerializedRecurringRule;
  accounts: SerializedAccount[];
  categories: SerializedCategory[];
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [f, setF] = useState({
    title: rule.title,
    provider: rule.provider ?? "",
    amount: String(rule.amount),
    frequency: rule.frequency,
    ruleType: rule.ruleType,
    accountId: rule.accountId,
    categoryId: rule.categoryId,
    startDate: toDateInput(rule.startDate),
    nextExecutionDate: toDateInput(rule.nextExecutionDate),
    autoPost: rule.autoPost,
  });
  const set = (k: keyof typeof f, v: string | boolean) =>
    setF((p) => ({ ...p, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      await runAction(
        () =>
          updateRecurringRuleAction(rule.id, {
            title: f.title,
            provider: f.provider,
            amount: Number(f.amount),
            frequency: f.frequency,
            ruleType: f.ruleType,
            accountId: f.accountId,
            categoryId: f.categoryId,
            startDate: f.startDate,
            nextExecutionDate: f.nextExecutionDate,
            autoPost: f.autoPost,
          }),
        onClose
      );
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <Field label="Nombre">
        <input className={inputCls} value={f.title} onChange={(e) => set("title", e.target.value)} required minLength={2} maxLength={80} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Monto (USD)">
          <input className={inputCls} type="number" step="0.01" min="0.01" inputMode="decimal" value={f.amount} onChange={(e) => set("amount", e.target.value)} required />
        </Field>
        <Field label="Proveedor">
          <input className={inputCls} value={f.provider} onChange={(e) => set("provider", e.target.value)} maxLength={60} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo">
          <select className={inputCls} value={f.ruleType} onChange={(e) => set("ruleType", e.target.value)}>
            <option value="SUBSCRIPTION">Suscripción</option>
            <option value="PAYROLL">Nómina</option>
            <option value="REMITTANCE">Remesa</option>
            <option value="FIXED_FINANCING_INSTALLMENT">Cuota fija</option>
          </select>
        </Field>
        <Field label="Frecuencia">
          <select className={inputCls} value={f.frequency} onChange={(e) => set("frequency", e.target.value)}>
            <option value="WEEKLY">Semanal</option>
            <option value="BIWEEKLY">Quincenal</option>
            <option value="MONTHLY">Mensual</option>
            <option value="YEARLY">Anual</option>
          </select>
        </Field>
      </div>
      <Field label="Cuenta">
        <select className={inputCls} value={f.accountId} onChange={(e) => set("accountId", e.target.value)}>
          {accounts.filter((a) => a.type !== "LOAN_LIABILITY").map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Categoría">
        <select className={inputCls} value={f.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Día base (inicio)" hint="El día del mes se conserva: 31 = fin de mes.">
          <input className={inputCls} type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} required />
        </Field>
        <Field label="Próxima fecha">
          <input className={inputCls} type="date" value={f.nextExecutionDate} onChange={(e) => set("nextExecutionDate", e.target.value)} required />
        </Field>
      </div>
      <label className="flex min-h-10 items-center gap-2 text-sm text-on-surface">
        <input type="checkbox" className="h-4 w-4 accent-[#4edea3]" checked={f.autoPost} onChange={(e) => set("autoPost", e.target.checked)} />
        Registro automático (marcar como conciliado al ejecutar)
      </label>
      <SubmitButtons pending={pending} onClose={onClose} />
    </form>
  );
}

export function DeleteRuleDialog({
  rule,
  onClose,
}: {
  rule: SerializedRecurringRule | null;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  return (
    <ConfirmDialog
      open={Boolean(rule)}
      onClose={onClose}
      pending={pending}
      title="Eliminar programación"
      description={
        rule
          ? `Se eliminará "${rule.title}". Los movimientos ya generados no se borran.`
          : ""
      }
      onConfirm={() =>
        rule &&
        start(async () => void (await runAction(() => deleteRecurringRuleAction(rule.id), onClose)))
      }
    />
  );
}

// ===========================================================================
// PRÉSTAMOS
// ===========================================================================
export function EditLoanDialog({
  loan,
  onClose,
}: {
  loan: SerializedLoanAccount | null;
  onClose: () => void;
}) {
  return (
    <Modal open={Boolean(loan)} onClose={onClose} title="Editar préstamo" description="Si cambias monto, tasa o plazo se regenera la tabla de amortización.">
      {loan && <LoanForm key={loan.id} loan={loan} onClose={onClose} />}
    </Modal>
  );
}

function LoanForm({
  loan,
  onClose,
}: {
  loan: SerializedLoanAccount;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const paid = loan.installments.some((i) => i.status === "PAID");
  const first = loan.installments[0];
  const [f, setF] = useState({
    name: loan.name,
    institution: loan.institution ?? "",
    principalAmount: String(loan.originalPrincipal),
    annualInterestRate: String(loan.interestRate),
    termMonths: String(loan.termMonths),
    firstDueDate: first ? toDateInput(first.dueDate) : todayLocalIso(),
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      await runAction(
        () =>
          updateLoanAction({
            loanId: loan.id,
            name: f.name,
            institution: f.institution,
            principalAmount: Number(f.principalAmount),
            annualInterestRate: Number(f.annualInterestRate),
            termMonths: Number(f.termMonths),
            firstDueDate: f.firstDueDate,
            currency: loan.currency,
          }),
        onClose
      );
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <Field label="Nombre">
        <input className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} required minLength={2} maxLength={70} />
      </Field>
      <Field label="Institución">
        <input className={inputCls} value={f.institution} onChange={(e) => set("institution", e.target.value)} maxLength={60} />
      </Field>
      {paid && (
        <p className="rounded-xl bg-amber-500/15 border border-amber-500/30 p-2.5 text-[11px] text-amber-300">
          Ya hay cuotas pagadas: solo se pueden cambiar el nombre y la institución.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Monto del préstamo">
          <input className={inputCls} type="number" step="0.01" min="0.01" disabled={paid} value={f.principalAmount} onChange={(e) => set("principalAmount", e.target.value)} required />
        </Field>
        <Field label="Tasa anual (%)">
          <input className={inputCls} type="number" step="0.01" min="0" max="200" disabled={paid} value={f.annualInterestRate} onChange={(e) => set("annualInterestRate", e.target.value)} required />
        </Field>
        <Field label="Plazo (meses)">
          <input className={inputCls} type="number" min="1" max="360" disabled={paid} value={f.termMonths} onChange={(e) => set("termMonths", e.target.value)} required />
        </Field>
        <Field label="Primera cuota">
          <input className={inputCls} type="date" disabled={paid} value={f.firstDueDate} onChange={(e) => set("firstDueDate", e.target.value)} required />
        </Field>
      </div>
      <SubmitButtons pending={pending} onClose={onClose} />
    </form>
  );
}

export function DeleteLoanDialog({
  loan,
  onClose,
}: {
  loan: SerializedLoanAccount | null;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  return (
    <ConfirmDialog
      open={Boolean(loan)}
      onClose={onClose}
      pending={pending}
      title="Eliminar préstamo"
      description={
        loan
          ? `Se eliminará "${loan.name}" con su tabla de amortización. Si ya tiene cuotas pagadas se archivará para conservar el historial.`
          : ""
      }
      onConfirm={() =>
        loan && start(async () => void (await runAction(() => deleteLoanAction(loan.id), onClose)))
      }
    />
  );
}

// ===========================================================================
// BÓVEDAS
// ===========================================================================
export function EditGoalDialog({
  goal,
  onClose,
}: {
  goal: SerializedSavingsGoal | null;
  onClose: () => void;
}) {
  return (
    <Modal open={Boolean(goal)} onClose={onClose} title="Editar bóveda">
      {goal && <GoalForm key={goal.id} goal={goal} onClose={onClose} />}
    </Modal>
  );
}

function GoalForm({
  goal,
  onClose,
}: {
  goal: SerializedSavingsGoal;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [f, setF] = useState({
    name: goal.name,
    targetAmount: String(goal.targetAmount),
    deadline: goal.deadline ? toDateInput(goal.deadline) : "",
    color: goal.color,
    status: goal.status,
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      await runAction(
        () =>
          updateSavingsGoalAction({
            goalId: goal.id,
            name: f.name,
            targetAmount: Number(f.targetAmount),
            deadline: f.deadline,
            color: f.color,
            icon: goal.icon,
            status: f.status as SerializedSavingsGoal["status"],
          }),
        onClose
      );
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <Field label="Nombre">
        <input className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} required minLength={2} maxLength={70} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Meta (USD)">
          <input className={inputCls} type="number" step="0.01" min="0.01" inputMode="decimal" value={f.targetAmount} onChange={(e) => set("targetAmount", e.target.value)} required />
        </Field>
        <Field label="Fecha límite">
          <input className={inputCls} type="date" value={f.deadline} onChange={(e) => set("deadline", e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Estado">
          <select className={inputCls} value={f.status} onChange={(e) => set("status", e.target.value)}>
            <option value="ACTIVE">Activa</option>
            <option value="PAUSED">Pausada</option>
            <option value="COMPLETED">Completada</option>
            <option value="CANCELLED">Cancelada</option>
          </select>
        </Field>
        <Field label="Color">
          <input className={`${inputCls} h-[42px] p-1`} type="color" value={f.color} onChange={(e) => set("color", e.target.value)} />
        </Field>
      </div>
      <SubmitButtons pending={pending} onClose={onClose} />
    </form>
  );
}

export function DeleteGoalDialog({
  goal,
  accounts,
  onClose,
}: {
  goal: SerializedSavingsGoal | null;
  accounts: SerializedAccount[];
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const liquid = accounts.filter((a) => a.type === "CASH" || a.type === "DEBIT");
  const [target, setTarget] = useState("");
  const hasFunds = (goal?.currentAmount ?? 0) > 0;

  return (
    <ConfirmDialog
      open={Boolean(goal)}
      onClose={onClose}
      pending={pending}
      title="Eliminar bóveda"
      description={
        goal
          ? hasFunds
            ? `"${goal.name}" tiene ${formatCurrency(goal.currentAmount)}. Elige a qué cuenta se devuelven.`
            : `Se eliminará "${goal.name}".`
          : ""
      }
      onConfirm={() =>
        goal &&
        start(async () => void (await runAction(
          () => deleteSavingsGoalAction(goal.id, hasFunds ? target || liquid[0]?.id : undefined),
          onClose
        )))
      }
    >
      {hasFunds && (
        <Field label="Devolver fondos a">
          <select className={inputCls} value={target || liquid[0]?.id || ""} onChange={(e) => setTarget(e.target.value)}>
            {liquid.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </Field>
      )}
    </ConfirmDialog>
  );
}

// ===========================================================================
// CATEGORÍAS (administrador)
// ===========================================================================
const CATEGORY_TYPES: Record<SerializedCategory["type"], string> = {
  EXPENSE: "Gasto",
  INCOME: "Ingreso",
  TRANSFER: "Transferencia",
  INVESTMENT: "Ahorro / inversión",
};

export function CategoriesManager({
  open,
  categories,
  onClose,
}: {
  open: boolean;
  categories: SerializedCategory[];
  onClose: () => void;
}) {
  const [editing, setEditing] = useState<SerializedCategory | "new" | null>(null);
  const [deleting, setDeleting] = useState<SerializedCategory | null>(null);
  const [pending, start] = useTransition();

  return (
    <>
      <Modal open={open} onClose={onClose} title="Categorías" description="Crea, edita o elimina tus categorías." maxWidth="sm:max-w-xl">
        <button type="button" onClick={() => setEditing("new")} className={`${primaryBtnCls} mb-3 w-full sm:w-auto`}>
          <Plus className="h-4 w-4" /> Nueva categoría
        </button>
        {categories.length === 0 && (
          <p className="py-6 text-center text-sm text-on-surface-variant">Aún no hay categorías.</p>
        )}
        <ul className="divide-y divide-white/[0.06]">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-white/10" style={{ backgroundColor: c.color }} aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-on-surface">{c.name}</p>
                  <p className="text-[11px] text-on-surface-variant">{CATEGORY_TYPES[c.type]}</p>
                </div>
              </div>
              <RowActions label={c.name} onEdit={() => setEditing(c)} onDelete={() => setDeleting(c)} />
            </li>
          ))}
        </ul>
      </Modal>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing === "new" ? "Nueva categoría" : "Editar categoría"} maxWidth="sm:max-w-md">
        {editing && (
          <CategoryForm
            key={editing === "new" ? "new" : editing.id}
            category={editing === "new" ? null : editing}
            onClose={() => setEditing(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        pending={pending}
        title="Eliminar categoría"
        description={deleting ? `Se eliminará "${deleting.name}". Solo es posible si no tiene movimientos.` : ""}
        onConfirm={() =>
          deleting &&
          start(async () => void (await runAction(() => deleteCategoryAction(deleting.id), () => setDeleting(null))))
        }
      />
    </>
  );
}

function CategoryForm({
  category,
  onClose,
}: {
  category: SerializedCategory | null;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [f, setF] = useState({
    name: category?.name ?? "",
    type: category?.type ?? "EXPENSE",
    color: category?.color ?? "#0d9488",
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const payload = {
        name: f.name,
        type: f.type as SerializedCategory["type"],
        icon: category?.icon ?? "Tag",
        color: f.color,
      };
      await runAction(
        () =>
          category
            ? updateCategoryAction(category.id, payload)
            : createCategoryAction(payload),
        onClose
      );
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <Field label="Nombre">
        <input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} maxLength={50} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo">
          <select className={inputCls} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as SerializedCategory["type"] })}>
            {Object.entries(CATEGORY_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="Color">
          <input className={`${inputCls} h-[42px] p-1`} type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} />
        </Field>
      </div>
      <SubmitButtons pending={pending} onClose={onClose} label={category ? "Guardar cambios" : "Crear categoría"} />
    </form>
  );
}
