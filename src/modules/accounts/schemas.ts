import { z } from "zod";

export const AccountTypeEnum = z.enum([
  "CASH",
  "DEBIT",
  "CREDIT_CARD",
  "LOAN_LIABILITY",
  "SAVINGS_VAULT",
]);

export type AccountTypeValue = z.infer<typeof AccountTypeEnum>;

export const CreateAccountSchema = z
  .object({
    name: z
      .string()
      .min(2, "El nombre de la cuenta debe tener al menos 2 caracteres")
      .max(60, "Máximo 60 caracteres"),
    institution: z.string().max(50).optional().or(z.literal("")),
    type: AccountTypeEnum,
    currency: z.string().default("USD"),
    currentBalance: z.coerce
      .number()
      .min(0, "El saldo o deuda actual no puede ser negativo"),
    lastFourDigits: z
      .string()
      .max(4, "Máximo 4 dígitos")
      .optional()
      .or(z.literal("")),
    color: z.string().default("#0d9488"),

    // Específicos de tarjeta de crédito / pasivo
    creditLimit: z.coerce.number().min(0).optional(),
    cutoffDay: z.coerce.number().int().min(1).max(31).optional(),
    paymentDueDay: z.coerce.number().int().min(1).max(31).optional(),
    interestRate: z.coerce.number().min(0).max(200).optional(),
    noInterestPayment: z.coerce.number().min(0).optional(),
    minimumPayment: z.coerce.number().min(0).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "CREDIT_CARD") {
      if (!data.creditLimit || data.creditLimit <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["creditLimit"],
          message: "Las tarjetas de crédito requieren un límite de crédito mayor a 0",
        });
      }
      if (!data.cutoffDay) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cutoffDay"],
          message: "Indica el día de corte (1-31)",
        });
      }
      if (!data.paymentDueDay) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["paymentDueDay"],
          message: "Indica el día límite de pago (1-31)",
        });
      }
    }
  });

export type CreateAccountInput = z.infer<typeof CreateAccountSchema>;

export interface SerializedAccount {
  id: string;
  userId: string;
  name: string;
  institution: string | null;
  type: AccountTypeValue;
  currency: string;
  currentBalance: number;
  color: string | null;
  lastFourDigits: string | null;
  creditLimit: number | null;
  cutoffDay: number | null;
  paymentDueDay: number | null;
  interestRate: number | null;
  noInterestPayment: number | null;
  minimumPayment: number | null;
  originalPrincipal: number | null;
  termMonths: number | null;
}
