"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Droplets, MapPin, ShieldCheck, UserPlus, Loader2, X,
  KeyRound, MousePointerClick, History, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { api, setToken } from "@/components/shared/api";
import { useSystemConfig } from "@/components/shared/system-config";
import {
  recordLogin, getQuickAccounts, removeQuickAccount, decodePass, type QuickAccount,
} from "@/components/shared/quick-access";
import { toast } from "sonner";

interface LoginResponse {
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
    roleName: string;
    permissions: string[];
  };
}

const ZONES = [
  "Los Palos Grandes", "Chuao", "Chacao", "Las Mercedes",
  "El Cafetal", "El Hatillo", "Caracas Centro",
];

const EMPTY_REG = { name: "", email: "", password: "", phone: "", address: "", zone: "" };

export function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const { systemName, logo, config } = useSystemConfig();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [reg, setReg] = useState(EMPTY_REG);
  const [registering, setRegistering] = useState(false);

  // Acceso rápido dinámico (por frecuencia de uso en este navegador)
  const threshold = Number(config.quickAccessThreshold ?? "1");
  const [quickAccounts, setQuickAccounts] = useState<QuickAccount[]>([]);
  const passwordRef = useRef<HTMLInputElement>(null);

  const refreshQuick = useCallback(() => {
    setQuickAccounts(getQuickAccounts(Number.isFinite(threshold) ? threshold : 1));
  }, [threshold]);

  useEffect(() => { refreshQuick(); }, [refreshQuick]);

  async function handleLogin(e?: React.FormEvent, dEmail?: string, dPass?: string, opts?: { remember?: boolean }) {
    e?.preventDefault();
    const usedEmail = dEmail || email;
    const usedPass = dPass || password;
    const usedRemember = opts?.remember ?? remember;
    setLoading(true);
    setLoginError(null);
    try {
      const res = await api<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: { email: usedEmail, password: usedPass },
      });
      setToken(res.token);
      // Registra el ingreso para el acceso rápido de este navegador
      recordLogin({
        email: usedEmail,
        name: res.user.name,
        roleName: res.user.roleName,
        password: usedPass,
        remember: usedRemember,
      });
      toast.success(`Bienvenido, ${res.user.name}`);
      onLogin();
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Error al iniciar sesión";
      // Mensajes claros y visibles: toast + alerta inline dentro del formulario
      const msg =
        raw === "Error en la solicitud"
          ? "No se pudo conectar con el servidor. Verifique su conexión e intente nuevamente."
          : raw;
      setLoginError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function quickLogin(acc: QuickAccount) {
    const pass = decodePass(acc);
    if (pass) {
      // Ingreso directo: la contraseña quedó recordada en este dispositivo
      handleLogin(undefined, acc.email, pass, { remember: true });
    } else {
      // Completa el correo y pide la contraseña
      setEmail(acc.email);
      setPassword("");
      toast.info(`Ingrese la contraseña de ${acc.email}`, { icon: <KeyRound className="h-4 w-4" /> });
      setTimeout(() => passwordRef.current?.focus(), 50);
    }
  }

  function removeFromQuick(acc: QuickAccount) {
    removeQuickAccount(acc.email);
    refreshQuick();
    toast.success(`${acc.email} eliminada del acceso rápido`);
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegistering(true);
    try {
      const res = await api<LoginResponse>("/api/auth/register", {
        method: "POST",
        body: reg,
      });
      setToken(res.token);
      recordLogin({
        email: res.user.email, name: res.user.name, roleName: res.user.roleName,
        password: reg.password, remember: true,
      });
      toast.success(`¡Cuenta creada! Bienvenido al portal, ${res.user.name}`);
      onLogin();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al registrar la cuenta");
    } finally {
      setRegistering(false);
    }
  }

  const brandIcon = logo
    ? <img src={logo} alt={systemName} className="h-9 w-9 object-contain" />
    : <div className="p-3 bg-white/15 rounded-2xl backdrop-blur"><Droplets className="h-9 w-9" /></div>;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-gradient-to-br from-teal-50 via-background to-cyan-100">
      {/* Panel de marca */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-gradient-to-br from-teal-600 to-cyan-800 text-white">
        <div className="flex items-center gap-3">
          {logo
            ? <div className="bg-white/90 rounded-2xl p-2"><img src={logo} alt={systemName} className="h-9 w-9 object-contain" /></div>
            : <div className="p-3 bg-white/15 rounded-2xl backdrop-blur"><Droplets className="h-9 w-9" /></div>}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{systemName}</h1>
            <p className="text-teal-100 text-sm">Control y Despacho de Agua Embotellada</p>
          </div>
        </div>
        <div className="space-y-6 max-w-md">
          <h2 className="text-3xl font-bold leading-tight">
            De los 5 litros al 20 litros, cada botellón bajo control
          </h2>
          <ul className="space-y-4 text-teal-50">
            <li className="flex gap-3">
              <MapPin className="h-6 w-6 shrink-0 mt-0.5" />
              <span><strong>Seguimiento GPS en tiempo real</strong> — la ruta del chofer hacia el cliente, visible desde el panel administrativo.</span>
            </li>
            <li className="flex gap-3">
              <Droplets className="h-6 w-6 shrink-0 mt-0.5" />
              <span><strong>Comprobantes fotográficos</strong> — cada entrega con su evidencia fotográfica y ubicación GPS.</span>
            </li>
            <li className="flex gap-3">
              <UserPlus className="h-6 w-6 shrink-0 mt-0.5" />
              <span><strong>Portal de clientes</strong> — sus clientes se registran y hacen pedidos en línea, sin llamadas telefónicas.</span>
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="h-6 w-6 shrink-0 mt-0.5" />
              <span><strong>Roles y permisología por usuario</strong> — administrador, supervisor, bodega, chofer y cliente, cada uno con su alcance.</span>
            </li>
          </ul>
        </div>
        <p className="text-teal-200 text-xs">Backend API REST · Web Admin · App Chofer · Portal Cliente</p>
      </div>

      {/* Formulario */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden flex items-center gap-3 justify-center pt-6">
            {logo
              ? <img src={logo} alt={systemName} className="h-10 w-10 object-contain" />
              : <div className="p-2.5 bg-teal-600 text-white rounded-xl"><Droplets className="h-7 w-7" /></div>}
            <h1 className="text-2xl font-bold">{systemName}</h1>
          </div>

          <Card className="shadow-xl border-teal-100">
            <CardHeader>
              <CardTitle className="text-xl">Bienvenido</CardTitle>
              <CardDescription>Acceda al sistema o cree su cuenta de cliente</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="login">
                <TabsList className="grid grid-cols-2 w-full mb-4">
                  <TabsTrigger value="login">Iniciar sesión</TabsTrigger>
                  <TabsTrigger value="registro">Soy cliente nuevo</TabsTrigger>
                </TabsList>

                {/* ---- LOGIN ---- */}
                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Correo o usuario</Label>
                      <Input
                        id="email"
                        type="text"
                        inputMode="email"
                        autoComplete="username"
                        placeholder="admin o admin@aqua.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setLoginError(null); }}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Contraseña</Label>
                      <Input
                        id="password"
                        ref={passwordRef}
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setLoginError(null); }}
                        required
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="remember"
                        checked={remember}
                        onCheckedChange={(v) => setRemember(v === true)}
                      />
                      <Label htmlFor="remember" className="text-xs font-normal text-muted-foreground cursor-pointer">
                        Recordar la cuenta en este dispositivo (acceso rápido con ingreso directo)
                      </Label>
                    </div>
                    {loginError && (
                      <div
                        role="alert"
                        className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
                      >
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-600" />
                        <span>{loginError}</span>
                      </div>
                    )}
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Verificando..." : "Ingresar"}
                    </Button>
                    <p className="text-[11px] text-muted-foreground text-center">
                      Puede usar su correo completo o solo el usuario (ej. <span className="font-mono">admin</span>).
                    </p>
                  </form>
                </TabsContent>

                {/* ---- REGISTRO CLIENTE ---- */}
                <TabsContent value="registro">
                  <form onSubmit={handleRegister} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-name" className="text-xs">Nombre y apellido</Label>
                      <Input id="reg-name" placeholder="Ej: Elena Gutiérrez" value={reg.name}
                        onChange={(e) => setReg({ ...reg, name: e.target.value })} required />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="reg-email" className="text-xs">Correo</Label>
                        <Input id="reg-email" type="email" placeholder="correo@ejemplo.com" value={reg.email}
                          onChange={(e) => setReg({ ...reg, email: e.target.value })} required />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="reg-phone" className="text-xs">Teléfono</Label>
                        <Input id="reg-phone" placeholder="0412-0000000" value={reg.phone}
                          onChange={(e) => setReg({ ...reg, phone: e.target.value })} required />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-pass" className="text-xs">Contraseña (mín. 6 caracteres)</Label>
                      <Input id="reg-pass" type="password" placeholder="••••••••" value={reg.password}
                        onChange={(e) => setReg({ ...reg, password: e.target.value })} required minLength={6} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-addr" className="text-xs">Dirección de entrega</Label>
                      <Input id="reg-addr" placeholder="Calle, edificio, apto…" value={reg.address}
                        onChange={(e) => setReg({ ...reg, address: e.target.value })} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Zona</Label>
                      <Select value={reg.zone} onValueChange={(v) => setReg({ ...reg, zone: v })} required>
                        <SelectTrigger><SelectValue placeholder="Seleccione su zona" /></SelectTrigger>
                        <SelectContent>
                          {ZONES.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" className="w-full gap-1.5" disabled={registering}>
                      {registering ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                      {registering ? "Creando cuenta…" : "Crear mi cuenta y entrar"}
                    </Button>
                    <p className="text-[11px] text-muted-foreground text-center">
                      Su dirección queda registrada para las rutas de despacho con GPS.
                    </p>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* ---- ACCESO RÁPIDO DINÁMICO ---- */}
          {quickAccounts.length > 0 && (
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <History className="h-4 w-4" /> Acceso rápido
                </CardTitle>
                <CardDescription className="text-xs">
                  Cuentas con más de {threshold} ingreso{threshold === 1 ? "" : "s"} desde este navegador.
                  Las que tienen <KeyRound className="h-3 w-3 inline -mt-0.5" /> entran directamente.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                {quickAccounts.map((acc) => {
                  const hasPass = !!acc.pass;
                  return (
                    <div
                      key={acc.email}
                      className="group flex items-center gap-2 rounded-lg border bg-white hover:border-teal-300 hover:shadow-sm transition"
                    >
                      <button
                        type="button"
                        className="flex-1 flex items-center gap-2.5 px-3 py-2.5 text-left rounded-lg disabled:opacity-60"
                        disabled={loading}
                        onClick={() => quickLogin(acc)}
                        title={hasPass ? "Ingresar directamente" : "Completar correo y pedir contraseña"}
                      >
                        <div className="h-8 w-8 shrink-0 rounded-full bg-teal-100 text-teal-800 text-[11px] font-bold flex items-center justify-center">
                          {acc.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                        </div>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-1.5">
                            <span className="text-sm font-medium truncate">{acc.name}</span>
                            <Badge variant="outline" className="text-[9px] h-4 px-1 hidden sm:inline-flex">{acc.roleName}</Badge>
                          </span>
                          <span className="block text-xs text-muted-foreground truncate">{acc.email}</span>
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                          {hasPass
                            ? <><KeyRound className="h-3.5 w-3.5 text-emerald-600" /> directo</>
                            : <><MousePointerClick className="h-3.5 w-3.5" /> pide clave</>}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="mr-2 h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-red-600 hover:bg-red-50 transition"
                        title={`Eliminar ${acc.email} del acceso rápido`}
                        onClick={() => removeFromQuick(acc)}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  El contador de ingresos y las contraseñas recordadas se guardan solo en este navegador
                  (no en el servidor). Recomendable en dispositivos personales.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
