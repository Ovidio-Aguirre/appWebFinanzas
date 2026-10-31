import { z } from "zod";

export const CreateSavingsGoalSchema = z.object({
  name: z
    .string()
    .min(2, "Ingresa el nombre de la meta o bóveda")
    .max(70, "Máximo 70 caracteres"),
  targetAmount: z.coerce
    .number()
    .positive("La meta objetivo debe ser mayor a $0.00"),
  initialAmount: z.coerce
    .number()
    .min(0, "El saldo inicial no puede ser negativo")
    .default(0),
  deadline: z.string().optional().or(z.literal("")),
  color: z.string().default("#0d9488"),
  icon: z.string().default("PiggyBank"),
});

export type CreateSavingsGoalInput = z.infer<typeof CreateSavingsGoalSchema>;

export const ContributeToSavingsGoalSchema = z.object({
  savingsGoalId: z.string().min(1, "Selecciona la bóveda de ahorro"),
  originAccountId: z.string().min(1, "Selecciona la cuenta corriente de origen"),
  amount: z.coerce
    .number()
    .positive("El monto a transferir debe ser mayor a $0.00"),
  note: z.string().max(120).optional().or(z.literal("")),
});

export type ContributeToSavingsGoalInput = z.infer<
  typeof ContributeToSavingsGoalSchema
>;

export interface SerializedSavingsGoal {
  id: string;
  userId: string;
  vaultAccountId: string | null;
  vaultAccountName: string | null;
  name: string;
  icon: string;
  color: string;
  targetAmount: number;
  currentAmount: number;
  progressPercent: number;
  deadline: string | null;
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
}
