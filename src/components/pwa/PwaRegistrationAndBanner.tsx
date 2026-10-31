"use client";

import React, { useEffect, useState } from "react";
import { Download, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaRegistrationAndBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Conexión restaurada. Sincronización activa.");
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning(
        "Modo Offline activo. Puedes seguir consultando tu portafolio."
      );
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw-offline.js")
        .catch((err) => console.warn("SW registro informativo:", err));
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      toast.success("FinanzaPro instalada en tu dispositivo.");
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${
          isOnline
            ? "bg-emerald-50 text-emerald-600 border-emerald-500/20"
            : "bg-amber-100 text-amber-600 border-amber-300"
        }`}
        title={
          isOnline
            ? "PWA Sincronizada y con soporte Offline-First"
            : "Modo sin conexión (Offline Cache activo)"
        }
      >
        {isOnline ? (
          <>
            <Wifi className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">PWA Online</span>
          </>
        ) : (
          <>
            <WifiOff className="h-3.5 w-3.5" />
            <span>Offline</span>
          </>
        )}
      </span>

      {deferredPrompt && (
        <button
          type="button"
          onClick={handleInstallClick}
          aria-label="Instalar la app"
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600/20 hover:bg-teal-600/30 border border-teal-300 px-2.5 py-1 text-xs font-semibold text-teal-600 transition"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Instalar App</span>
        </button>
      )}
    </div>
  );
}
