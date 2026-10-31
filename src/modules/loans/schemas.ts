import { z } from "zod";

export const CreateLoanWithAmortizationSchema = z.object({
  name: z
    .string()
    .min(2, "Ingresa el nombre del financiamiento o préstamo")
    .max(70, "Máximo 70 caracteres"),
  institution: z.string().max(60).optional().or(z.literal("")),
  principalAmount: z.coerce
    .number()
    .positive("El monto inicial del préstamo debe ser mayor a $0"),
  annualInterestRate: z.coerce
    .number()
    .min(0, "La tasa de interés no puede ser negativa")
    .max(200, "Tasa anual máxima 200%"),
  termMonths: z.coerce
    .number()
    .int()
    .min(1, "El plazo mínimo es 1 mes")
    .max(360, "El plazo máximo es 360 meses"),
  firstDueDate: z.string().min(1, "Indica la fecha de la primera cuota"),
  currency: z.string().default("USD"),
});

export type CreateLoanWithAmortizationInput = z.infer<
  typeof CreateLoanWithAmortizationSchema
>;

export const PayLoanInstallmentSchema = z.object({
  installmentId: z.string().min(1, "Cuota inválida"),
  originAccountId: z.string().min(1, "Selecciona la cuenta de pago"),
  receiptUrl: z.string().optional().or(z.literal("")),
});

export type PayLoanInstallmentInput = z.infer<typeof PayLoanInstallmentSchema>;

export interface SerializedLoanInstallment {
  id: string;
  accountId: string;
  installmentNumber: number;
  totalInstallments: number;
  amount: number;
  capitalAmount: number;
  interestAmount: number;
  remainingBalance: number;
  dueDate: string;
  paidAt: string | null;
  status: "PENDING" | "PAID" | "OVERDUE";
}

export interface SerializedLoanAccount {
  id: string;
  name: string;
  institution: string | null;
  currency: string;
  currentBalance: number;
  originalPrincipal: number;
  interestRate: number;
  termMonths: number;
  paymentDueDay: number | null;
  installments: SerializedLoanInstallment[];
}
