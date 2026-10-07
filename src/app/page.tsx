"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { LoginScreen } from "@/components/LoginScreen";
import { AdminPanel, type SessionUser } from "@/components/admin/AdminPanel";
import { DriverApp } from "@/components/driver/DriverApp";
import { api, getToken } from "@/components/shared/api";

type AppState =
  | { status: "loading" }
  | { status: "login" }
  | { status: "admin"; user: SessionUser }
  | { status: "driver"; user: { id: number; name: string } };

export default function Home() {
  const [state, setState] = useState<AppState>({ status: "loading" });

  const loadSession = useCallback(async () => {
    try {
      // Si no hay token en localStorage pero sí cookie, /api/auth/me funciona igual
      const user = await api<SessionUser & { id: number }>("/api/auth/me");
      if (getToken()) {
        if (user.roleName === "CHOFER") {
          setState({ status: "driver", user: { id: user.id, name: user.name } });
        } else {
          setState({ status: "admin", user });
        }
      } else {
        // autenticado solo por cookie (p. ej. sesión de otro dispositivo): pide login
        setState({ status: "login" });
      }
    } catch {
      setState({ status: "login" });
    }
  }, []);

  useEffect(() => {
    loadSession();
    const onUnauthorized = () => setState({ status: "login" });
    window.addEventListener("aqua:unauthorized", onUnauthorized);
    return () => window.removeEventListener("aqua:unauthorized", onUnauthorized);
  }, [loadSession]);

  if (state.status === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-teal-50/40">
        <Loader2 className="h-8 w-8 text-teal-600 animate-spin" />
        <p className="text-sm text-muted-foreground mt-3">Cargando AquaGestión...</p>
      </div>
    );
  }

  if (state.status === "login") {
    return <LoginScreen onLogin={loadSession} />;
  }

  if (state.status === "driver") {
    return <DriverApp user={state.user} onLogout={() => setState({ status: "login" })} />;
  }

  return <AdminPanel user={state.user} onLogout={() => setState({ status: "login" })} />;
}
