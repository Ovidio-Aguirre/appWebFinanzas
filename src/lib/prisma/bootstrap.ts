import { prisma } from "@/lib/prisma";
import { generateAmortizationSchedule } from "@/lib/utils";
import { addDays, subDays, addMonths } from "date-fns";

export const DEFAULT_USER_EMAIL = "ovidio.aguirre@finanzapro.app";

export async function ensureDemoWorkspaceSeeded() {
  const existingUser = await prisma.user.findUnique({
    where: { email: DEFAULT_USER_EMAIL },
  });

  if (existingUser) {
    return existingUser;
  }

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: DEFAULT_USER_EMAIL,
        name: "Ovidio Aguirre",
        preferredCurrency: "USD",
        locale: "es-MX",
        monthlyBudget: 3500,
      },
    });

    // 1. Categorías base
    const categoriesData = [
      { name: "Nómina y Salario", icon: "Briefcase", color: "#10b981", type: "INCOME" as const },
      { name: "Remesas Internacionales", icon: "Globe", color: "#06b6d4", type: "INCOME" as const },
      { name: "Supermercado y Despensa", icon: "ShoppingCart", color: "#f59e0b", type: "EXPENSE" as const },
      { name: "Restaurantes y Café", icon: "Utensils", color: "#f97316", type: "EXPENSE" as const },
      { name: "Suscripciones Digitales", icon: "Tv", color: "#8b5cf6", type: "EXPENSE" as const },
      { name: "Tecnología y Equipos", icon: "Laptop", color: "#3b82f6", type: "EXPENSE" as const },
      { name: "Vivienda y Servicios", icon: "Home", color: "#ec4899", type: "EXPENSE" as const },
      { name: "Salud y Seguros", icon: "HeartPulse", color: "#ef4444", type: "EXPENSE" as const },
      { name: "Pagos de Tarjeta y Deuda", icon: "CreditCard", color: "#64748b", type: "TRANSFER" as const },
      { name: "Ahorro Patrimonial", icon: "PiggyBank", color: "#0d9488", type: "INVESTMENT" as const },
    ];

    const categoryMap = new Map<string, string>();
    for (const cat of categoriesData) {
      const createdCat = await tx.category.upsert({
        where: { name_type: { name: cat.name, type: cat.type } },
        update: {},
        create: cat,
      });
      categoryMap.set(cat.name, createdCat.id);
    }

    // 2. Cuentas (Efectivo, Débito, 2 Tarjetas de Crédito, 1 Préstamo, 3 Bóvedas)
    const cashAccount = await tx.account.create({
      data: {
        userId: user.id,
        name: "Efectivo Billetera",
        institution: "Liquidez Inmediata",
        type: "CASH",
        currency: "USD",
        currentBalance: 420.0,
        color: "#10b981",
      },
    });

    const debitAccount = await tx.account.create({
      data: {
        userId: user.id,
        name: "Cuenta Nómina Premier",
        institution: "Banco Cuscatlán / BAC",
        type: "DEBIT",
        currency: "USD",
        currentBalance: 4850.0,
        lastFourDigits: "7741",
        color: "#0284c7",
      },
    });

    const visaPlatinum = await tx.account.create({
      data: {
        userId: user.id,
        name: "Visa Platinum Infinite",
        institution: "BAC Credomatic",
        type: "CREDIT_CARD",
        currency: "USD",
        currentBalance: 1240.8,
        creditLimit: 5000.0,
        cutoffDay: 14,
        paymentDueDay: 4,
        interestRate: 28.5,
        noInterestPayment: 895.8,
        minimumPayment: 125.0,
        lastFourDigits: "4821",
        color: "#1e293b",
      },
    });

    const amexGold = await tx.account.create({
      data: {
        userId: user.id,
        name: "American Express Gold",
        institution: "AMEX",
        type: "CREDIT_CARD",
        currency: "USD",
        currentBalance: 685.0,
        creditLimit: 3500.0,
        cutoffDay: 22,
        paymentDueDay: 12,
        interestRate: 32.0,
        noInterestPayment: 361.67,
        minimumPayment: 70.0,
        lastFourDigits: "9012",
        color: "#b45309",
      },
    });

    // Bóvedas de ahorro
    const emergencyVault = await tx.account.create({
      data: {
        userId: user.id,
        name: "Bóveda: Fondo de Emergencia",
        institution: "FinanzaPro High-Yield",
        type: "SAVINGS_VAULT",
        currency: "USD",
        currentBalance: 6500.0,
        color: "#0d9488",
      },
    });

    const travelVault = await tx.account.create({
      data: {
        userId: user.id,
        name: "Bóveda: Viaje Europa 2027",
        institution: "FinanzaPro Vault",
        type: "SAVINGS_VAULT",
        currency: "USD",
        currentBalance: 1850.0,
        color: "#6366f1",
      },
    });

    // 3. Préstamo a plazo fijo con tabla de amortización de 12 meses
    const loanPrincipal = 4800.0;
    const loanRate = 11.5;
    const loanTerm = 12;
    const firstLoanDate = addDays(now, -55);

    const schedule = generateAmortizationSchedule({
      principal: loanPrincipal,
      annualInterestRate: loanRate,
      termMonths: loanTerm,
      firstDueDate: firstLoanDate,
    });

    // Las primeras 2 cuotas ya pagadas
    const remainingDebtAfterTwo = schedule[1]?.remainingBalance ?? 4035.12;

    const loanAccount = await tx.account.create({
      data: {
        userId: user.id,
        name: "Financiamiento Automotriz / Equipo",
        institution: "CrediAuto Preferencial",
        type: "LOAN_LIABILITY",
        currency: "USD",
        currentBalance: remainingDebtAfterTwo,
        originalPrincipal: loanPrincipal,
        interestRate: loanRate,
        termMonths: loanTerm,
        paymentDueDay: firstLoanDate.getDate(),
        color: "#e11d48",
      },
    });

    for (const row of schedule) {
      const isPaid = row.installmentNumber <= 2;
      await tx.loanInstallment.create({
        data: {
          accountId: loanAccount.id,
          installmentNumber: row.installmentNumber,
          totalInstallments: row.totalInstallments,
          amount: row.amount,
          capitalAmount: row.capitalAmount,
          interestAmount: row.interestAmount,
          remainingBalance: row.remainingBalance,
          dueDate: row.dueDate,
          paidAt: isPaid ? row.dueDate : null,
          status: isPaid ? "PAID" : "PENDING",
        },
      });
    }

    // 4. Metas de Ahorro (SavingsGoals)
    await tx.savingsGoal.createMany({
      data: [
        {
          userId: user.id,
          vaultAccountId: emergencyVault.id,
          name: "Fondo de Emergencia (6 Meses)",
          icon: "ShieldCheck",
          color: "#0d9488",
          targetAmount: 10000.0,
          currentAmount: 6500.0,
          deadline: addMonths(now, 8),
          status: "ACTIVE",
        },
        {
          userId: user.id,
          vaultAccountId: travelVault.id,
          name: "Viaje Familiar a Europa",
          icon: "Plane",
          color: "#6366f1",
          targetAmount: 4500.0,
          currentAmount: 1850.0,
          deadline: addMonths(now, 10),
          status: "ACTIVE",
        },
        {
          userId: user.id,
          vaultAccountId: emergencyVault.id,
          name: "Renovación Setup & Estación IA",
          icon: "Laptop",
          color: "#f59e0b",
          targetAmount: 2200.0,
          currentAmount: 2200.0,
          deadline: addMonths(now, 1),
          status: "COMPLETED",
        },
      ],
    });

    // 5. Reglas Recurrentes (Suscripciones, Salario Quincenal y Remesa Mensual)
    await tx.recurringRule.createMany({
      data: [
        {
          userId: user.id,
          accountId: debitAccount.id,
          categoryId: categoryMap.get("Nómina y Salario")!,
          title: "Salario Quincenal Senior Architect",
          provider: "Tech Corp Global",
          amount: 2150.0,
          frequency: "BIWEEKLY",
          ruleType: "PAYROLL",
          startDate: subDays(now, 30),
          nextExecutionDate: addDays(now, 4),
          autoPost: true,
          active: true,
        },
        {
          userId: user.id,
          accountId: debitAccount.id,
          categoryId: categoryMap.get("Remesas Internacionales")!,
          title: "Remesa Familiar / Consultoría",
          provider: "Wise / Remitly",
          amount: 650.0,
          frequency: "MONTHLY",
          ruleType: "REMITTANCE",
          startDate: subDays(now, 25),
          nextExecutionDate: addDays(now, 7),
          autoPost: false,
          active: true,
        },
        {
          userId: user.id,
          accountId: visaPlatinum.id,
          categoryId: categoryMap.get("Suscripciones Digitales")!,
          title: "Netflix Ultra HD 4K",
          provider: "Netflix Inc.",
          amount: 19.99,
          frequency: "MONTHLY",
          ruleType: "SUBSCRIPTION",
          startDate: subDays(now, 60),
          nextExecutionDate: addDays(now, 2),
          autoPost: true,
          active: true,
        },
        {
          userId: user.id,
          accountId: visaPlatinum.id,
          categoryId: categoryMap.get("Suscripciones Digitales")!,
          title: "Spotify Duo Premium",
          provider: "Spotify AB",
          amount: 14.99,
          frequency: "MONTHLY",
          ruleType: "SUBSCRIPTION",
          startDate: subDays(now, 60),
          nextExecutionDate: addDays(now, 5),
          autoPost: true,
          active: true,
        },
        {
          userId: user.id,
          accountId: amexGold.id,
          categoryId: categoryMap.get("Tecnología y Equipos")!,
          title: "AWS Cloud & Vercel Pro",
          provider: "Amazon Web Services",
          amount: 48.5,
          frequency: "MONTHLY",
          ruleType: "SUBSCRIPTION",
          startDate: subDays(now, 90),
          nextExecutionDate: addDays(now, 9),
          autoPost: true,
          active: true,
        },
        {
          userId: user.id,
          accountId: visaPlatinum.id,
          categoryId: categoryMap.get("Salud y Seguros")!,
          title: "Seguro Gastos Médicos Mayores",
          provider: "MAPFRE / Sura",
          amount: 135.0,
          frequency: "MONTHLY",
          ruleType: "SUBSCRIPTION",
          startDate: subDays(now, 120),
          nextExecutionDate: addDays(now, 12),
          autoPost: false,
          active: true,
        },
      ],
    });

    // 6. Transacciones del mes en curso (con comprobantes y cuotas MSI)
    await tx.transaction.createMany({
      data: [
        {
          userId: user.id,
          accountId: debitAccount.id,
          categoryId: categoryMap.get("Nómina y Salario")!,
          title: "Pago de Quincena Octubre (1/2)",
          description: "Depósito directo nómina corporativa",
          amount: 2150.0,
          date: subDays(now, 12),
          transactionType: "SALARY_INCOME",
          isRecurring: true,
          isReconciled: true,
        },
        {
          userId: user.id,
          accountId: debitAccount.id,
          categoryId: categoryMap.get("Remesas Internacionales")!,
          title: "Remesa Consultoría Exterior",
          description: "Transferencia internacional liquidada",
          amount: 650.0,
          date: subDays(now, 8),
          transactionType: "REMITTANCE_INCOME",
          isRecurring: true,
          isReconciled: true,
        },
        {
          userId: user.id,
          accountId: visaPlatinum.id,
          categoryId: categoryMap.get("Supermercado y Despensa")!,
          title: "Supermercado Selecto — Despensa Mensual",
          description: "Compra con ticket digitalizado y comprimido",
          amount: 184.8,
          date: subDays(now, 5),
          transactionType: "PURCHASE",
          receiptUrl: "/uploads/receipts/sample-supermarket.svg",
          installmentsCount: 1,
          currentInstallment: 1,
          isRecurring: false,
          isReconciled: true,
        },
        {
          userId: user.id,
          accountId: amexGold.id,
          categoryId: categoryMap.get("Tecnología y Equipos")!,
          title: "Monitor UltraWide 34\" + Brazo Ergonómico",
          description: "Compra a 6 Meses Sin Intereses (MSI)",
          amount: 485.0,
          date: subDays(now, 4),
          transactionType: "PURCHASE",
          receiptUrl: "/uploads/receipts/sample-tech.svg",
          installmentsCount: 6,
          currentInstallment: 1,
          isRecurring: false,
          isReconciled: true,
        },
        {
          userId: user.id,
          accountId: debitAccount.id,
          categoryId: categoryMap.get("Vivienda y Servicios")!,
          title: "Internet Fibra Óptica 600 Mbps + Energía",
          description: "Pago mensual de servicios residenciales",
          amount: 142.0,
          date: subDays(now, 3),
          transactionType: "BILL_PAYMENT",
          isRecurring: true,
          isReconciled: true,
        },
        {
          userId: user.id,
          accountId: cashAccount.id,
          categoryId: categoryMap.get("Restaurantes y Café")!,
          title: "Cena Ejecutiva & Specialty Coffee",
          description: "Pago en efectivo",
          amount: 58.5,
          date: subDays(now, 1),
          transactionType: "PURCHASE",
          isRecurring: false,
          isReconciled: false,
        },
        {
          userId: user.id,
          accountId: debitAccount.id,
          destinationAccountId: visaPlatinum.id,
          categoryId: categoryMap.get("Pagos de Tarjeta y Deuda")!,
          title: "Abono Parcial a Visa Platinum",
          description: "Transferencia desde Cuenta Nómina Premier",
          amount: 350.0,
          date: subDays(now, 2),
          transactionType: "CARD_PAYMENT",
          isRecurring: false,
          isReconciled: true,
        },
      ],
    });

    return user;
  });
}
