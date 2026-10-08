"use client";

// Vista de Configuración: tarjetas de acceso a cada módulo de configuración
// + formularios (Personalización, Empresa, Seguridad).

import { useState, useEffect, useRef } from "react";
import {
  Palette, Building2, ShieldCheck, UserCog, KeyRound,
  ChevronRight, Save, ImagePlus, Trash2, ArrowLeft, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/components/shared/api";
import { useSystemConfig } from "@/components/shared/system-config";
import { toast } from "sonner";

interface PermFlags { settings: boolean; users: boolean; roles: boolean }

// ============ TARJETAS PRINCIPALES ============

export function SettingsHome({ onOpen, perms }: { onOpen: (id: string) => void; perms: PermFlags }) {
  const { systemName, logo } = useSystemConfig();

  const CARDS: {
    id: string; title: string; desc: string; icon: typeof Palette; show: boolean; hint?: string;
  }[] = [
    { id: "settings-appearance", title: "Personalización", icon: Palette, show: perms.settings,
      desc: "Nombre del sistema, logo y símbolo de moneda.",
      hint: logo ? "Logo configurado" : `Actualmente: ${systemName}` },
    { id: "settings-company", title: "Datos de la empresa", icon: Building2, show: perms.settings,
      desc: "Razón social, RIF, contacto y dirección. Aparecen en los reportes PDF." },
    { id: "settings-security", title: "Seguridad y sesión", icon: ShieldCheck, show: perms.settings,
      desc: "Duración de la sesión y umbral del acceso rápido por frecuencia de uso." },
    { id: "users", title: "Usuarios", icon: UserCog, show: perms.users,
      desc: "Alta, edición, rol asignado y activación de las cuentas de acceso." },
    { id: "roles", title: "Roles y Permisos", icon: KeyRound, show: perms.roles,
      desc: "Defina qué secciones y acciones puede realizar cada rol." },
  ];

  const visible = CARDS.filter((c) => c.show);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Configuración</h2>
        <p className="text-sm text-muted-foreground">
          Personalice el sistema, gestione la seguridad y administre el acceso de los usuarios.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((c) => (
          <button
            key={c.id}
            onClick={() => onOpen(c.id)}
            className="text-left rounded-xl border bg-white p-5 shadow-sm transition hover:border-teal-300 hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
          >
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-lg bg-teal-50 text-teal-700">
                <c.icon className="h-5 w-5" />
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 mt-1" />
            </div>
            <CardTitle className="text-base mt-3.5 mb-1">{c.title}</CardTitle>
            <p className="text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
            {c.hint && (
              <p className="text-xs text-teal-700 mt-2 font-medium truncate">{c.hint}</p>
            )}
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Su rol no tiene permisos de configuración.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============ SUB-VISTA GENÉRICA (título + botón volver) ============

function SettingsShell({ title, subtitle, onBack, children }: {
  title: string; subtitle: string; onBack: () => void; children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button size="icon" variant="outline" onClick={onBack} title="Volver a Configuración">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ============ PERSONALIZACIÓN (nombre, logo, moneda) ============

export function SettingsAppearance({ onBack }: { onBack: () => void }) {
  const { config, refresh, systemName, logo } = useSystemConfig();
  const [form, setForm] = useState({ systemName: "", currency: "$", logo: "" });
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm({ systemName: config.systemName || "AquaGestión", currency: config.currency || "$", logo: config.logo || "" });
  }, [config]);

  async function save() {
    setSaving(true);
    try {
      await api("/api/settings", {
        method: "PUT",
        body: { values: { systemName: form.systemName, currency: form.currency, logo: form.logo } },
      });
      await refresh();
      toast.success("Personalización guardada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error guardando la configuración");
    } finally {
      setSaving(false);
    }
  }

  function handleLogoFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Redimensiona a máx. 192px para mantener el dataURL liviano
        const scale = Math.min(1, 192 / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        setForm((f) => ({ ...f, logo: canvas.toDataURL("image/png") }));
        toast.success("Logo cargado. Presione Guardar para aplicarlo.");
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <SettingsShell
      title="Personalización"
      subtitle="Nombre del sistema, logo y símbolo de moneda"
      onBack={onBack}
    >
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Identidad visual del sistema</CardTitle>
          <CardDescription>
            El nombre y el logo se aplican en la pantalla de login, el panel administrativo,
            la app de chofer, el portal de clientes y los reportes PDF.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="sys-name">Nombre del sistema</Label>
            <Input id="sys-name" value={form.systemName} maxLength={40}
              onChange={(e) => setForm({ ...form, systemName: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Logo</Label>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-xl border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
                {form.logo
                  ? <img src={form.logo} alt="Logo" className="h-full w-full object-contain p-1" />
                  : <ImagePlus className="h-6 w-6 text-muted-foreground/40" />}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => fileRef.current?.click()}>
                  <ImagePlus className="h-3.5 w-3.5" /> Cargar imagen
                </Button>
                {form.logo && (
                  <Button type="button" size="sm" variant="ghost" className="gap-1.5 text-red-600 hover:text-red-700"
                    onClick={() => setForm({ ...form, logo: "" })}>
                    <Trash2 className="h-3.5 w-3.5" /> Quitar
                  </Button>
                )}
              </div>
              <input
                ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoFile(f); e.target.value = ""; }}
              />
            </div>
            <p className="text-xs text-muted-foreground">PNG o JPG, preferiblemente cuadrado. Se redimensiona automáticamente.</p>
          </div>

          <div className="space-y-2 max-w-[200px]">
            <Label htmlFor="sys-currency">Símbolo de moneda</Label>
            <Input id="sys-currency" value={form.currency} maxLength={6}
              onChange={(e) => setForm({ ...form, currency: e.target.value })} />
            <p className="text-xs text-muted-foreground">Se usa en precios, ventas y reportes. Ej.: $, Bs., USD</p>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={save} disabled={saving || !form.systemName.trim()} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </SettingsShell>
  );
}

// ============ DATOS DE LA EMPRESA ============

const COMPANY_FIELDS = [
  { key: "companyName", label: "Razón social", placeholder: "Hidro Distribuidora C.A." },
  { key: "companyRif", label: "RIF", placeholder: "J-00000000-0" },
  { key: "companyPhone", label: "Teléfono", placeholder: "0212-0000000" },
  { key: "companyEmail", label: "Correo", placeholder: "contacto@empresa.com" },
  { key: "companyAddress", label: "Dirección", placeholder: "Av. Principal, Edificio…" },
] as const;

export function SettingsCompany({ onBack }: { onBack: () => void }) {
  const { config, refresh } = useSystemConfig();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const f of COMPANY_FIELDS) next[f.key] = config[f.key] || "";
    setForm(next);
  }, [config]);

  async function save() {
    setSaving(true);
    try {
      await api("/api/settings", { method: "PUT", body: { values: form } });
      await refresh();
      toast.success("Datos de la empresa guardados");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error guardando la configuración");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsShell
      title="Datos de la empresa"
      subtitle="Información fiscal y de contacto que aparece en los reportes PDF"
      onBack={onBack}
    >
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Identificación fiscal</CardTitle>
          <CardDescription>
            Estos datos se imprimen en el pie de los reportes de ventas PDF y pueden usarse
            en futuros documentos (facturas, notas de entrega).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {COMPANY_FIELDS.map((f) => (
            <div key={f.key} className="space-y-2">
              <Label htmlFor={`co-${f.key}`}>{f.label}</Label>
              <Input
                id={`co-${f.key}`}
                placeholder={f.placeholder}
                value={form[f.key] || ""}
                maxLength={f.key === "companyAddress" ? 200 : 80}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
            </div>
          ))}
          <div className="flex justify-end pt-2">
            <Button onClick={save} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </SettingsShell>
  );
}

// ============ SEGURIDAD Y SESIÓN ============

export function SettingsSecurity({ onBack }: { onBack: () => void }) {
  const { config, refresh } = useSystemConfig();
  const [form, setForm] = useState({ sessionHours: "12", quickAccessThreshold: "1" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      sessionHours: config.sessionHours || "12",
      quickAccessThreshold: config.quickAccessThreshold || "1",
    });
  }, [config]);

  async function save() {
    setSaving(true);
    try {
      await api("/api/settings", { method: "PUT", body: { values: form } });
      await refresh();
      toast.success("Configuración de seguridad guardada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error guardando la configuración");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsShell
      title="Seguridad y sesión"
      subtitle="Duración de la sesión y comportamiento del acceso rápido"
      onBack={onBack}
    >
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Parámetros de seguridad</CardTitle>
          <CardDescription>
            La duración de sesión aplica a los próximos ingresos de todos los usuarios
            (web, app de chofer y portal de clientes).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2 max-w-[220px]">
            <Label htmlFor="sec-hours">Duración de la sesión (horas)</Label>
            <Input
              id="sec-hours" type="number" min={1} max={72}
              value={form.sessionHours}
              onChange={(e) => setForm({ ...form, sessionHours: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Entre 1 y 72 horas. Por defecto: 12 horas.</p>
          </div>

          <div className="space-y-2 max-w-[220px]">
            <Label htmlFor="sec-threshold">Ingresos para el acceso rápido (N)</Label>
            <Input
              id="sec-threshold" type="number" min={0} max={20}
              value={form.quickAccessThreshold}
              onChange={(e) => setForm({ ...form, quickAccessThreshold: e.target.value })}
            />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Una cuenta aparece en el acceso rápido de la pantalla de login cuando supera
              este número de ingresos desde el mismo navegador. Con 0 se muestran todas las
              cuentas usadas; con un valor alto solo las más frecuentes.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={save} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </SettingsShell>
  );
}
