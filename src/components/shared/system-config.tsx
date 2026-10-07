"use client";

// Proveedor de configuración pública del sistema (nombre, logo, moneda, umbral)
// Disponible para toda la app: login, panel admin, app chofer y portal cliente.

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { api, setCurrencySymbol } from "@/components/shared/api";

export interface SystemConfig {
  systemName: string;
  logo: string;
  currency: string;
  quickAccessThreshold: string;
  // Claves adicionales cuando hay sesión (no públicas)
  [key: string]: string;
}

interface Ctx {
  config: SystemConfig;
  refresh: () => Promise<void>;
  systemName: string;
  logo: string;
}

const DEFAULTS: SystemConfig = {
  systemName: "AquaGestión",
  logo: "",
  currency: "$",
  quickAccessThreshold: "1",
};

const SystemConfigContext = createContext<Ctx>({
  config: DEFAULTS,
  refresh: async () => {},
  systemName: DEFAULTS.systemName,
  logo: "",
});

export function useSystemConfig() {
  return useContext(SystemConfigContext);
}

export function SystemConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SystemConfig>(DEFAULTS);

  const refresh = useCallback(async () => {
    try {
      const data = await api<SystemConfig>("/api/settings");
      setConfig({ ...DEFAULTS, ...data });
    } catch {
      // sin conexión o endpoint no disponible: mantiene los valores por defecto
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Aplica la moneda configurada al formateador global money()
  useEffect(() => { setCurrencySymbol(config.currency || "$"); }, [config.currency]);

  // Título del documento dinámico
  useEffect(() => {
    document.title = `${config.systemName} | Control y Despacho de Agua Embotellada`;
  }, [config.systemName]);

  return (
    <SystemConfigContext.Provider
      value={{ config, refresh, systemName: config.systemName || "AquaGestión", logo: config.logo || "" }}
    >
      {children}
    </SystemConfigContext.Provider>
  );
}
