import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";
import type { CreateCategoryInput } from "./schemas";

export async function updateCategoryInDb(
  categoryId: string,
  input: CreateCategoryInput
): Promise<void> {
  const cat = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!cat) throw new DomainError("No se encontró la categoría.");

  const clash = await prisma.category.findFirst({
    where: { name: input.name, type: input.type, NOT: { id: categoryId } },
  });
  if (clash) throw new DomainError("Ya existe una categoría con ese nombre y tipo.");

  const used =
    (await prisma.transaction.count({ where: { categoryId } })) +
    (await prisma.recurringRule.count({ where: { categoryId } }));
  if (used > 0 && cat.type !== input.type) {
    throw new DomainError(
      "No puedes cambiar el tipo de una categoría que ya tiene movimientos."
    );
  }

  await prisma.category.update({
    where: { id: categoryId },
    data: {
      name: input.name,
      type: input.type,
      icon: input.icon,
      color: input.color,
    },
  });
}

export async function deleteCategoryInDb(categoryId: string): Promise<void> {
  const cat = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!cat) throw new DomainError("No se encontró la categoría.");

  const used =
    (await prisma.transaction.count({ where: { categoryId } })) +
    (await prisma.recurringRule.count({ where: { categoryId } }));
  if (used > 0) {
    throw new DomainError(
      "La categoría tiene movimientos o programaciones. Reasígnalos a otra categoría antes de eliminarla."
    );
  }
  await prisma.category.delete({ where: { id: categoryId } });
}
