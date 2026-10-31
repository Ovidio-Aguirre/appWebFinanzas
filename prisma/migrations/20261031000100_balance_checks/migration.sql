-- Invariantes monetarias a nivel de base de datos (defensa en profundidad).
-- Los saldos de activos y las deudas (tarjeta/préstamo) nunca son negativos.
ALTER TABLE "Account" ADD CONSTRAINT "Account_currentBalance_nonneg" CHECK ("currentBalance" >= 0);
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "SavingsGoal" ADD CONSTRAINT "SavingsGoal_currentAmount_nonneg" CHECK ("currentAmount" >= 0);
ALTER TABLE "SavingsGoal" ADD CONSTRAINT "SavingsGoal_targetAmount_positive" CHECK ("targetAmount" > 0);
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_amount_positive" CHECK ("amount" > 0);
