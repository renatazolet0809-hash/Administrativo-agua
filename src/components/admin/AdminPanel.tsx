"use client";

import { useState, useEffect } from "react";
import {
  Droplets, LayoutDashboard, Package, Users2, ClipboardList, Truck,
  Radar, UserCog, LogOut, Menu, X, BarChart3, Settings as SettingsIcon, KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dashboard } from "@/components/admin/Dashboard";
import { Products } from "@/components/admin/Products";
import { Customers } from "@/components/admin/Customers";
import { Orders } from "@/components/admin/Orders";
import { Routes } from "@/components/admin/Routes";
import { Tracking } from "@/components/admin/Tracking";
import { Users } from "@/components/admin/Users";
import { Roles } from "@/components/admin/Roles";
import {
  SettingsHome, SettingsAppearance, SettingsCompany, SettingsSecurity,
} from "@/components/admin/Settings";
import { Reports } from "@/components/admin/Reports";
import { NotificationBell } from "@/components/shared/NotificationBell";
import { useSystemConfig } from "@/components/shared/system-config";
import { api, clearToken } from "@/components/shared/api";

export interface SessionUser {
  id: number; name: string; email: string; roleName: string; permissions: string[];
}

interface NavItem { id: string; label: string; icon: typeof LayoutDashboard; perms: string[] }

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Operación",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, perms: ["dashboard.view"] },
      { id: "products", label: "Productos e Inventario", icon: Package, perms: ["products.view"] },
      { id: "customers", label: "Clientes", icon: Users2, perms: ["customers.view"] },
      { id: "orders", label: "Pedidos", icon: ClipboardList, perms: ["orders.view"] },
      { id: "routes", label: "Rutas de Despacho", icon: Truck, perms: ["routes.view"] },
      { id: "tracking", label: "Seguimiento GPS", icon: Radar, perms: ["tracking.view"] },
      { id: "reports", label: "Reportes de Ventas", icon: BarChart3, perms: ["reports.view"] },
    ],
  },
  {
    label: "Configuración",
    items: [
      { id: "settings", label: "Configuración", icon: SettingsIcon, perms: ["settings.manage", "users.manage", "roles.manage"] },
      { id: "users", label: "Usuarios", icon: UserCog, perms: ["users.manage"] },
      { id: "roles", label: "Roles y Permisos", icon: KeyRound, perms: ["roles.manage"] },
    ],
  },
];

export function AdminPanel({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const [section, setSection] = useState<string>("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const { systemName, logo } = useSystemConfig();

  const hasPerm = (p: string) => user.permissions.includes(p);
  const hasAny = (ps: string[]) => ps.some(hasPerm);
  const visibleGroups = NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((n) => hasAny(n.perms)) }))
    .filter((g) => g.items.length > 0);
  const visibleNav = visibleGroups.flatMap((g) => g.items);

  // Si el rol no permite la sección actual, abre la primera visible
  useEffect(() => {
    const currentAllowed = section.startsWith("settings")
      ? hasAny(["settings.manage", "users.manage", "roles.manage"])
      : !!visibleNav.find((n) => n.id === section);
    if (!currentAllowed) setSection(visibleNav[0]?.id || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.permissions]);

  // Resalta "Configuración" cuando se navega una sub-vista de configuración
  const activeNavId = section.startsWith("settings") && section !== "settings"
    ? "settings" : section;

  function openSection(id: string) {
    setSection(id);
    setMenuOpen(false);
  }

  async function logout() {
    try { await api("/api/auth/logout", { method: "POST" }); } catch { /* noop */ }
    clearToken();
    onLogout();
  }

  const initials = user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4">
          <Button size="icon" variant="ghost" className="lg:hidden" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <div className="flex items-center gap-2.5">
            {logo
              ? <img src={logo} alt={systemName} className="h-8 w-8 object-contain" />
              : <div className="p-1.5 bg-teal-600 text-white rounded-lg"><Droplets className="h-5 w-5" /></div>}
            <div>
              <span className="font-bold leading-none">{systemName}</span>
              <p className="text-[10px] text-muted-foreground">Panel Administrativo</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium leading-none">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <NotificationBell />
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-teal-100 text-teal-800 text-xs font-bold">{initials}</AvatarFallback>
            </Avatar>
            <Button size="icon" variant="ghost" onClick={logout} title="Cerrar sesión">
              <LogOut className="h-4.5 w-4.5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className={`${menuOpen ? "block" : "hidden"} lg:block fixed lg:sticky inset-x-0 top-14 bottom-0 lg:top-0 z-30 w-64 shrink-0 border-r bg-white overflow-y-auto`}>
          <nav className="p-3 space-y-1">
            {visibleGroups.map((g) => (
              <div key={g.label} className={g.label === "Configuración" ? "pt-3 mt-1 border-t" : ""}>
                {visibleGroups.length > 1 && (
                  <p className={`text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-3.5 ${g.label === "Configuración" ? "pb-1.5" : "pb-1.5"}`}>
                    {g.label}
                  </p>
                )}
                <div className="space-y-1">
                  {g.items.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => openSection(n.id)}
                      className={`w-full flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition
                        ${activeNavId === n.id ? "bg-teal-600 text-white shadow-sm" : "text-muted-foreground hover:bg-teal-50 hover:text-teal-800"}`}
                    >
                      <n.icon className="h-4.5 w-4.5 shrink-0" />
                      {n.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className="p-3 border-t mx-0 mt-2">
            <div className="rounded-lg bg-teal-50 p-3 text-xs text-teal-900">
              <p className="font-semibold mb-1 flex items-center gap-1.5">
                <Badge variant="outline" className="bg-white text-[10px] h-5">{user.roleName}</Badge>
              </p>
              <p className="text-teal-700 leading-relaxed">
                Su rol determina las secciones visibles y las acciones permitidas en el sistema.
              </p>
            </div>
          </div>
        </aside>

        {/* Contenido */}
        <main className="flex-1 p-4 lg:p-6 max-w-[1600px] mx-auto w-full min-w-0">
          {section === "dashboard" && <Dashboard />}
          {section === "products" && (
            <Products canManage={hasPerm("products.manage")} canInventory={hasPerm("inventory.manage")} />
          )}
          {section === "customers" && <Customers canManage={hasPerm("customers.manage")} />}
          {section === "orders" && <Orders canManage={hasPerm("orders.manage")} />}
          {section === "routes" && <Routes canManage={hasPerm("routes.manage")} canViewAll={hasPerm("routes.view")} />}
          {section === "tracking" && <Tracking />}
          {section === "reports" && <Reports canView={hasPerm("reports.view")} />}
          {section === "settings" && (
            <SettingsHome
              onOpen={openSection}
              perms={{
                settings: hasPerm("settings.manage"),
                users: hasPerm("users.manage"),
                roles: hasPerm("roles.manage"),
              }}
            />
          )}
          {section === "settings-appearance" && <SettingsAppearance onBack={() => openSection("settings")} />}
          {section === "settings-company" && <SettingsCompany onBack={() => openSection("settings")} />}
          {section === "settings-security" && <SettingsSecurity onBack={() => openSection("settings")} />}
          {section === "users" && <Users />}
          {section === "roles" && <Roles />}
        </main>
      </div>

      <footer className="border-t py-3 px-4 text-center text-xs text-muted-foreground mt-auto leading-relaxed">
        {systemName} — Sistema de control y despacho de agua embotellada · Backend API REST + Web Admin + App Chofer
      </footer>
    </div>
  );
}
