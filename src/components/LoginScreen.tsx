"use client";

import { useState } from "react";
import { Droplets, MapPin, Users, ShieldCheck, UserPlus, ShoppingBag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { api, setToken } from "@/components/shared/api";
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

const DEMO_USERS = [
  { email: "admin@aqua.com", password: "admin123", label: "Administrador", icon: ShieldCheck },
  { email: "supervisor@aqua.com", password: "super123", label: "Supervisor", icon: Users },
  { email: "chofer@aqua.com", password: "chofer123", label: "Chofer (App móvil)", icon: MapPin },
  { email: "cliente@aqua.com", password: "cliente123", label: "Cliente (Portal web)", icon: ShoppingBag },
];

const EMPTY_REG = { name: "", email: "", password: "", phone: "", address: "", zone: "" };

export function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("admin@aqua.com");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [reg, setReg] = useState(EMPTY_REG);
  const [registering, setRegistering] = useState(false);

  async function handleLogin(e?: React.FormEvent, dEmail?: string, dPass?: string) {
    e?.preventDefault();
    setLoading(true);
    try {
      const res = await api<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: { email: dEmail || email, password: dPass || password },
      });
      setToken(res.token);
      toast.success(`Bienvenido, ${res.user.name}`);
      onLogin();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
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
      toast.success(`¡Cuenta creada! Bienvenido al portal, ${res.user.name}`);
      onLogin();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al registrar la cuenta");
    } finally {
      setRegistering(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-gradient-to-br from-teal-50 via-background to-cyan-100">
      {/* Panel de marca */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-gradient-to-br from-teal-600 to-cyan-800 text-white">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white/15 rounded-2xl backdrop-blur">
            <Droplets className="h-9 w-9" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AquaGestión</h1>
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
            <div className="p-2.5 bg-teal-600 text-white rounded-xl">
              <Droplets className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold">AquaGestión</h1>
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
                      <Label htmlFor="email">Correo electrónico</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="usuario@aqua.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Contraseña</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Verificando..." : "Ingresar"}
                    </Button>
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

          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Acceso rápido de demostración
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {DEMO_USERS.map((u) => (
                <Button
                  key={u.email}
                  variant="outline"
                  className="justify-start gap-2 h-11"
                  disabled={loading}
                  onClick={() => handleLogin(undefined, u.email, u.password)}
                >
                  <u.icon className="h-4 w-4 text-teal-600" />
                  <span className="flex-1 text-left">{u.label}</span>
                  <span className="text-xs text-muted-foreground">{u.email}</span>
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
