"use client";

import { useState, useEffect } from "react";
import {
  Droplets, LayoutDashboard, Package, Users2, ClipboardList, Truck,
  Radar, UserCog, LogOut, Menu, X, BarChart3,
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
import { Reports } from "@/components/admin/Reports";
import { NotificationBell } from "@/components/shared/NotificationBell";
import { api, clearToken } from "@/components/shared/api";

export interface SessionUser {
  id: number; name: string; email: string; roleName: string; permissions: string[];
}

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, perm: "dashboard.view" },
  { id: "products", label: "Productos e Inventario", icon: Package, perm: "products.view" },
  { id: "customers", label: "Clientes", icon: Users2, perm: "customers.view" },
  { id: "orders", label: "Pedidos", icon: ClipboardList, perm: "orders.view" },
  { id: "routes", label: "Rutas de Despacho", icon: Truck, perm: "routes.view" },
  { id: "tracking", label: "Seguimiento GPS", icon: Radar, perm: "tracking.view" },
  { id: "reports", label: "Reportes de Ventas", icon: BarChart3, perm: "reports.view" },
  { id: "users", label: "Usuarios y Roles", icon: UserCog, perm: "users.manage" },
] as const;

export function AdminPanel({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const [section, setSection] = useState<string>("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);

  const hasPerm = (p: string) => user.permissions.includes(p);
  const visibleNav = NAV.filter((n) => hasPerm(n.perm));

  // Si el rol no permite el dashboard, abre la primera sección visible
  useEffect(() => {
    if (!visibleNav.find((n) => n.id === section)) {
      setSection(visibleNav[0]?.id || "");
    }
  }, [user.permissions]);

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
            <div className="p-1.5 bg-teal-600 text-white rounded-lg">
              <Droplets className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold leading-none">AquaGestión</span>
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
            {visibleNav.map((n) => (
              <button
                key={n.id}
                onClick={() => { setSection(n.id); setMenuOpen(false); }}
                className={`w-full flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition
                  ${section === n.id ? "bg-teal-600 text-white shadow-sm" : "text-muted-foreground hover:bg-teal-50 hover:text-teal-800"}`}
              >
                <n.icon className="h-4.5 w-4.5 shrink-0" />
                {n.label}
              </button>
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
        <main className="flex-1 p-4 lg:p-6 max-w-[1600px] mx-auto w-full">
          {section === "dashboard" && <Dashboard />}
          {section === "products" && (
            <Products canManage={hasPerm("products.manage")} canInventory={hasPerm("inventory.manage")} />
          )}
          {section === "customers" && <Customers canManage={hasPerm("customers.manage")} />}
          {section === "orders" && <Orders canManage={hasPerm("orders.manage")} />}
          {section === "routes" && <Routes canManage={hasPerm("routes.manage")} canViewAll={hasPerm("routes.view")} />}
          {section === "tracking" && <Tracking />}
          {section === "reports" && <Reports canView={hasPerm("reports.view")} />}
          {section === "users" && <Users canManageRoles={hasPerm("roles.manage")} />}
        </main>
      </div>

      <footer className="border-t py-3 text-center text-xs text-muted-foreground mt-auto">
        AquaGestión — Sistema de control y despacho de agua embotellada · Backend API REST + Web Admin + App Chofer
      </footer>
    </div>
  );
}
