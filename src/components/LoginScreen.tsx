"use client";

import { useState } from "react";
import { Droplets, MapPin, Users, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const DEMO_USERS = [
  { email: "admin@aqua.com", password: "admin123", label: "Administrador", icon: ShieldCheck },
  { email: "supervisor@aqua.com", password: "super123", label: "Supervisor", icon: Users },
  { email: "chofer@aqua.com", password: "chofer123", label: "Chofer (App móvil)", icon: MapPin },
];

export function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("admin@aqua.com");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);

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
              <span><strong>Inventario inteligente</strong> — entrada, salida y despacho de botellones 5L, 10L, 12L y 20L.</span>
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="h-6 w-6 shrink-0 mt-0.5" />
              <span><strong>Roles y permisología por usuario</strong> — administrador, supervisor, bodega y chofer, cada uno con su alcance.</span>
            </li>
          </ul>
        </div>
        <p className="text-teal-200 text-xs">Backend API REST · Web Admin · App Chofer</p>
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
              <CardTitle className="text-xl">Iniciar sesión</CardTitle>
              <CardDescription>Ingrese sus credenciales para acceder al sistema</CardDescription>
            </CardHeader>
            <CardContent>
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
