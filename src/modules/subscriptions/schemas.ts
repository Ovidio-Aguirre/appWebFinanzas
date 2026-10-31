import { z } from "zod";

export const FrequencyEnum = z.enum([
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
  "YEARLY",
]);

export const RuleTypeEnum = z.enum([
  "SUBSCRIPTION",
  "PAYROLL",
  "REMITTANCE",
  "FIXED_FINANCING_INSTALLMENT",
]);

export type FrequencyValue = z.infer<typeof FrequencyEnum>;
export type RuleTypeValue = z.infer<typeof RuleTypeEnum>;

export const CreateRecurringRuleSchema = z.object({
  title: z
    .string()
    .min(2, "Ingresa el nombre de la suscripción o ingreso recurrente")
    .max(80, "Máximo 80 caracteres"),
  provider: z.string().max(60).optional().or(z.literal("")),
  amount: z.coerce.number().positive("El monto debe ser mayor a $0.00"),
  frequency: FrequencyEnum,
  ruleType: RuleTypeEnum,
  accountId: z.string().min(1, "Selecciona la cuenta de cargo o abono"),
  categoryId: z.string().min(1, "Selecciona la categoría"),
  startDate: z.string().min(1, "Indica la fecha de inicio"),
  nextExecutionDate: z.string().min(1, "Indica la próxima fecha de ejecución"),
  autoPost: z.boolean().default(false),
});

export type CreateRecurringRuleInput = z.infer<typeof CreateRecurringRuleSchema>;

export interface SerializedRecurringRule {
  id: string;
  userId: string;
  accountId: string;
  accountName: string;
  accountType: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  title: string;
  provider: string | null;
  amount: number;
  frequency: FrequencyValue;
  startDate: string;
  nextExecutionDate: string;
  lastExecutedDate: string | null;
  autoPost: boolean;
  active: boolean;
  ruleType: RuleTypeValue;
}
