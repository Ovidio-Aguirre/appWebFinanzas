import { z } from "zod";

export const TransactionTypeEnum = z.enum([
  "PURCHASE",
  "BILL_PAYMENT",
  "CARD_PAYMENT",
  "LOAN_PAYMENT",
  "SALARY_INCOME",
  "REMITTANCE_INCOME",
  "TRANSFER",
]);

export type TransactionTypeValue = z.infer<typeof TransactionTypeEnum>;

export const QuickCaptureTransactionSchema = z
  .object({
    title: z
      .string()
      .min(2, "Ingresa un concepto descriptivo (mín. 2 caracteres)")
      .max(90, "Máximo 90 caracteres"),
    description: z.string().max(240).optional().or(z.literal("")),
    amount: z.coerce
      .number()
      .positive("El monto debe ser mayor a $0.00"),
    date: z.string().min(1, "La fecha es obligatoria"),
    transactionType: TransactionTypeEnum,
    accountId: z.string().min(1, "Selecciona la cuenta de origen"),
    destinationAccountId: z.string().optional().or(z.literal("")),
    msiTransactionId: z.string().optional().or(z.literal("")),
    categoryId: z.string().min(1, "Selecciona una categoría"),
    receiptUrl: z.string().optional().or(z.literal("")),
    installmentsCount: z.coerce.number().int().min(1).max(48).default(1),
    isRecurring: z.boolean().default(false),
    isReconciled: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    const needsDestination =
      data.transactionType === "CARD_PAYMENT" ||
      data.transactionType === "LOAN_PAYMENT" ||
      data.transactionType === "TRANSFER";

    if (needsDestination && !data.destinationAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destinationAccountId"],
        message: "Selecciona la cuenta o tarjeta destino",
      });
    }

    if (
      needsDestination &&
      data.destinationAccountId &&
      data.accountId === data.destinationAccountId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destinationAccountId"],
        message: "La cuenta destino debe ser distinta a la cuenta origen",
      });
    }
  });

export type QuickCaptureTransactionInput = z.infer<
  typeof QuickCaptureTransactionSchema
>;

export const CreateCategorySchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres").max(50, "Máximo 50 caracteres"),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER", "INVESTMENT"]),
  icon: z.string().min(1, "Selecciona un ícono").max(30),
  color: z.string().min(1, "Selecciona un color"),
});

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;

export interface SerializedTransaction {
  id: string;
  userId: string;
  accountId: string;
  accountName: string;
  accountType: string;
  destinationAccountId: string | null;
  destinationAccountName: string | null;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  categoryType: string;
  title: string;
  description: string | null;
  amount: number;
  date: string;
  transactionType: TransactionTypeValue;
  receiptUrl: string | null;
  installmentsCount: number;
  currentInstallment: number;
  isRecurring: boolean;
  isReconciled: boolean;
}
