import { prisma, toNumber } from "../src/lib/prisma";
import { recordTransactionACID } from "../src/modules/transactions/repository";
import {
  deleteTransactionACID,
  updateTransactionACID,
} from "../src/modules/transactions/mutations";
import {
  createLoanWithScheduleACID,
  payLoanInstallmentACID,
} from "../src/modules/loans/repository";
import { deleteLoanInDb, updateLoanInDb } from "../src/modules/loans/mutations";
import {
  contributeToSavingsGoalACID,
  createSavingsGoalACID,
} from "../src/modules/savings/repository";
import { deleteSavingsGoalInDb } from "../src/modules/savings/mutations";
import { deleteAccountInDb, updateAccountInDb } from "../src/modules/accounts/mutations";

let failures = 0;
function check(name: string, actual: number | string, expected: number | string) {
  const ok = String(actual) === String(expected);
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}: ${actual}${ok ? "" : ` (esperado ${expected})`}`);
}
const bal = async (id: string) =>
  toNumber((await prisma.account.findUniqueOrThrow({ where: { id } })).currentBalance);
const noInt = async (id: string) =>
  toNumber((await prisma.account.findUniqueOrThrow({ where: { id } })).noInterestPayment);

async function main() {
  const user = await prisma.user.create({
    data: { email: `e2e-${Date.now()}@test.local`, name: "E2E" },
  });
  const uid = user.id;
  const cat = await prisma.category.upsert({
    where: { name_type: { name: "E2E-cat", type: "EXPENSE" } },
    update: {},
    create: { name: "E2E-cat", type: "EXPENSE" },
  });
  const mk = (name: string, type: "DEBIT" | "CASH" | "CREDIT_CARD", balance = 0) =>
    prisma.account.create({
      data: {
        userId: uid, name, type, currentBalance: balance,
        ...(type === "CREDIT_CARD" ? { creditLimit: 5000, cutoffDay: 5, paymentDueDay: 20, noInterestPayment: 0 } : {}),
      },
    });
  const A = await mk("A", "DEBIT", 1000);
  const B = await mk("B", "CASH", 0);
  const C = await mk("C", "CREDIT_CARD", 0);

  const base = {
    title: "t", description: "", amount: 100, date: "2026-10-31",
    transactionType: "PURCHASE" as const, accountId: A.id, destinationAccountId: "",
    msiTransactionId: "", categoryId: cat.id, receiptUrl: "", installmentsCount: 1,
    isRecurring: false, isReconciled: false,
  };

  try {
    // 1. Compra: crear -> editar monto -> borrar
    const p = await recordTransactionACID(uid, base);
    check("compra: A=900", await bal(A.id), 900);
    await updateTransactionACID(uid, p.id, { ...base, amount: 150 });
    check("compra editada a 150: A=850", await bal(A.id), 850);
    await updateTransactionACID(uid, p.id, { ...base, amount: 150, accountId: B.id }).catch((e) =>
      check("editar a cuenta sin saldo falla", e.message.includes("insuficiente") ? "falla" : e.message, "falla")
    );
    check("tras fallo, A sigue 850 (rollback)", await bal(A.id), 850);
    await deleteTransactionACID(uid, p.id);
    check("compra borrada: A=1000", await bal(A.id), 1000);

    // 2. Transferencia
    const t = await recordTransactionACID(uid, { ...base, transactionType: "TRANSFER", amount: 200, destinationAccountId: B.id });
    check("transfer: A=800", await bal(A.id), 800);
    check("transfer: B=200", await bal(B.id), 200);
    await updateTransactionACID(uid, t.id, { ...base, transactionType: "TRANSFER", amount: 300, destinationAccountId: B.id });
    check("transfer editada: A=700", await bal(A.id), 700);
    check("transfer editada: B=300", await bal(B.id), 300);
    await deleteTransactionACID(uid, t.id);
    check("transfer borrada: A=1000", await bal(A.id), 1000);
    check("transfer borrada: B=0", await bal(B.id), 0);

    // 3. Tarjeta MSI + pago de tarjeta
    const cp = await recordTransactionACID(uid, { ...base, amount: 300, accountId: C.id, installmentsCount: 3 });
    check("tarjeta: deuda 300", await bal(C.id), 300);
    check("tarjeta: sin intereses 100", await noInt(C.id), 100);
    const pay = await recordTransactionACID(uid, { ...base, transactionType: "CARD_PAYMENT", amount: 100, destinationAccountId: C.id });
    check("pago TC: A=900", await bal(A.id), 900);
    check("pago TC: deuda 200", await bal(C.id), 200);
    await deleteTransactionACID(uid, pay.id);
    check("pago TC borrado: A=1000", await bal(A.id), 1000);
    check("pago TC borrado: deuda 300", await bal(C.id), 300);
    await deleteTransactionACID(uid, cp.id);
    check("compra TC borrada: deuda 0", await bal(C.id), 0);
    check("compra TC borrada: sin intereses 0", await noInt(C.id), 0);

    // 4. Ingreso: borrar revierte; si ya se gastó, falla sin cambios
    const inc = await recordTransactionACID(uid, { ...base, transactionType: "SALARY_INCOME", amount: 500 });
    check("ingreso: A=1500", await bal(A.id), 1500);
    const spend = await recordTransactionACID(uid, { ...base, amount: 1400 });
    await deleteTransactionACID(uid, inc.id).catch((e) =>
      check("borrar ingreso ya gastado falla", e.message.includes("No se puede revertir") ? "falla" : e.message, "falla")
    );
    check("tras fallo, A=100", await bal(A.id), 100);
    await deleteTransactionACID(uid, spend.id);
    await deleteTransactionACID(uid, inc.id);
    check("ingreso y gasto borrados: A=1000", await bal(A.id), 1000);

    // 5. Préstamo: pagar cuota y borrar el movimiento reabre la cuota
    const loan = await createLoanWithScheduleACID(uid, {
      name: "L", institution: "", principalAmount: 1200, annualInterestRate: 0, termMonths: 12,
      firstDueDate: "2026-11-30", currency: "USD",
    });
    const inst = loan.installments[0]!;
    await payLoanInstallmentACID(uid, { installmentId: inst.id, originAccountId: A.id, receiptUrl: "" });
    check("cuota pagada: A=900", await bal(A.id), 900);
    check("cuota pagada: deuda 1100", await bal(loan.id), 1100);
    const loanTx = await prisma.transaction.findFirstOrThrow({ where: { loanInstallmentId: inst.id } });
    await deleteTransactionACID(uid, loanTx.id);
    check("pago cuota borrado: A=1000", await bal(A.id), 1000);
    check("pago cuota borrado: deuda 1200", await bal(loan.id), 1200);
    check("cuota vuelve a PENDING", (await prisma.loanInstallment.findUniqueOrThrow({ where: { id: inst.id } })).status, "PENDING");
    // editar condiciones sin cuotas pagadas regenera tabla
    await updateLoanInDb(uid, { loanId: loan.id, name: "L2", institution: "", principalAmount: 600, annualInterestRate: 0, termMonths: 6, firstDueDate: "2026-12-31", currency: "USD" });
    check("préstamo regenerado: 6 cuotas", await prisma.loanInstallment.count({ where: { accountId: loan.id } }), 6);
    check("préstamo regenerado: deuda 600", await bal(loan.id), 600);
    await deleteLoanInDb(uid, loan.id);
    check("préstamo borrado", await prisma.account.count({ where: { id: loan.id } }), 0);

    // 6. Bóveda: aportar, borrar aporte, aportar y borrar bóveda devolviendo fondos
    const goal = await createSavingsGoalACID(uid, { name: "G", targetAmount: 500, initialAmount: 0, deadline: "", color: "#0d9488", icon: "PiggyBank" });
    await contributeToSavingsGoalACID(uid, { savingsGoalId: goal.id, originAccountId: A.id, amount: 100, note: "" });
    check("aporte: A=900", await bal(A.id), 900);
    const sTx = await prisma.transaction.findFirstOrThrow({ where: { savingsGoalId: goal.id } });
    await deleteTransactionACID(uid, sTx.id);
    check("aporte borrado: A=1000", await bal(A.id), 1000);
    check("aporte borrado: meta 0", toNumber((await prisma.savingsGoal.findUniqueOrThrow({ where: { id: goal.id } })).currentAmount), 0);
    await contributeToSavingsGoalACID(uid, { savingsGoalId: goal.id, originAccountId: A.id, amount: 250, note: "" });
    await deleteSavingsGoalInDb(uid, goal.id, A.id);
    check("bóveda borrada devolviendo fondos: A=1000", await bal(A.id), 1000);
    check("bóveda borrada", await prisma.savingsGoal.count({ where: { id: goal.id } }), 0);

    // 7. Cuentas: editar, archivar con historial, borrar sin historial
    await updateAccountInDb(uid, A.id, { name: "A2", color: "#112233", currentBalance: 1000, institution: "", lastFourDigits: "" });
    check("cuenta renombrada", (await prisma.account.findUniqueOrThrow({ where: { id: A.id } })).name, "A2");
    const del1 = await deleteAccountInDb(uid, B.id);
    check("cuenta B (sin historial) se borra", String(del1.archived), "false");
    const del2 = await deleteAccountInDb(uid, A.id);
    check("cuenta A (con historial) se archiva", String(del2.archived), "true");
  } finally {
    await prisma.transaction.deleteMany({ where: { userId: uid } });
    await prisma.user.delete({ where: { id: uid } });
    await prisma.$disconnect();
  }
  console.log(failures === 0 ? "\nTODO OK" : `\n${failures} FALLOS`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch(async (e) => {
  console.error("ERROR", e);
  process.exitCode = 1;
  await prisma.$disconnect();
});
