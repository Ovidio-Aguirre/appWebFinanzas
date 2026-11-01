"use client";

import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Estilos compartidos de formulario (Obsidian Emerald Design System)
// ---------------------------------------------------------------------------
export const inputCls =
  "w-full rounded-xl border border-white/[0.08] bg-surface-container-low px-3.5 py-2.5 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:bg-surface-container-lowest disabled:text-outline";

export const primaryBtnCls =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary shadow-lg shadow-primary/25 transition hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryBtnCls =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-white/[0.1] bg-surface-container-high px-4 py-2 text-sm font-semibold text-on-surface transition hover:bg-surface-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:opacity-60";

export const dangerBtnCls =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[#93000a] border border-tertiary/30 px-4 py-2 text-sm font-bold text-[#ffdad6] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary disabled:opacity-60";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-outline">{hint}</span>}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Modal accesible (Radix): foco atrapado, Esc, hoja inferior en móvil
// ---------------------------------------------------------------------------
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  maxWidth = "sm:max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-surface-container-lowest/80 backdrop-blur-md" />
        <Dialog.Content
          aria-describedby={description ? undefined : undefined}
          className={cn(
            "fixed z-50 flex max-h-[92dvh] w-full flex-col bg-surface-container border border-white/[0.10] text-on-surface shadow-2xl outline-none",
            "inset-x-0 bottom-0 rounded-t-3xl",
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl",
            maxWidth
          )}
        >
          <div className="w-12 h-1.5 bg-surface-container-highest rounded-full mx-auto mt-2.5 sm:hidden" />
          <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="font-display text-base font-bold text-on-surface">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-xs text-on-surface-variant">
                  {description}
                </Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Cerrar"
                className="-mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant transition hover:bg-surface-bright hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>
          <div className="overflow-y-auto px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-5 flex flex-col-reverse gap-2 border-t border-white/[0.06] pt-4 sm:flex-row sm:justify-end">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirmación de borrado
// ---------------------------------------------------------------------------
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Eliminar",
  pending = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  pending?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={description} maxWidth="sm:max-w-md">
      {children}
      <ModalFooter>
        <button type="button" onClick={onClose} className={secondaryBtnCls} disabled={pending}>
          Cancelar
        </button>
        <button type="button" onClick={onConfirm} className={dangerBtnCls} disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {confirmLabel}
        </button>
      </ModalFooter>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Botones editar / eliminar de cada fila (área táctil de 36px)
// ---------------------------------------------------------------------------
export function RowActions({
  onEdit,
  onDelete,
  label,
  className,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  label: string;
  className?: string;
}) {
  const base =
    "inline-flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Editar ${label}`}
          title="Editar"
          className={cn(base, "hover:bg-primary/15 hover:text-primary")}
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Eliminar ${label}`}
          title="Eliminar"
          className={cn(base, "hover:bg-tertiary/15 hover:text-tertiary")}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utilidad: ejecutar una acción de servidor y mostrar el resultado en un toast
// ---------------------------------------------------------------------------
/** Avisa al shell que los datos cambiaron para que recargue el servidor. */
export function notifyDataChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("fp:data-changed"));
  }
}

export async function runAction(
  action: () => Promise<{ success: boolean; message: string }>,
  onSuccess?: () => void
): Promise<boolean> {
  try {
    const res = await action();
    if (res.success) {
      toast.success(res.message);
      notifyDataChanged();
      onSuccess?.();
      return true;
    }
    toast.error(res.message);
    return false;
  } catch {
    toast.error("Ocurrió un error inesperado. Intenta de nuevo.");
    return false;
  }
}
