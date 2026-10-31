"use client";

import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Estilos compartidos de formulario
// ---------------------------------------------------------------------------
export const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:bg-slate-50 disabled:text-slate-400";

export const primaryBtnCls =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryBtnCls =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-60";

export const dangerBtnCls =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2 disabled:opacity-60";

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
      <span className="mb-1 block text-xs font-semibold text-slate-600">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
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
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={description ? undefined : undefined}
          className={cn(
            "fixed z-50 flex max-h-[92dvh] w-full flex-col bg-white shadow-2xl outline-none",
            "inset-x-0 bottom-0 rounded-t-3xl",
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl",
            maxWidth
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="text-base font-bold text-slate-900">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-xs text-slate-500">
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
                className="-mr-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              >
                <X className="h-5 w-5" />
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
    <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
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
    "inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600";
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Editar ${label}`}
          title="Editar"
          className={cn(base, "hover:bg-teal-50 hover:text-teal-700")}
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
          className={cn(base, "hover:bg-rose-50 hover:text-rose-600")}
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
export async function runAction(
  action: () => Promise<{ success: boolean; message: string }>,
  onSuccess?: () => void
): Promise<boolean> {
  try {
    const res = await action();
    if (res.success) {
      toast.success(res.message);
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
