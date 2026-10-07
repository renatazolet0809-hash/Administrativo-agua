"use client";

import { useEffect, useState } from "react";
import {
  Users, ClipboardList, Package, Truck, AlertTriangle, Droplet, TrendingUp, Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Legend,
} from "recharts";
import { api, money, fmtDate, STATUS_LABELS, STATUS_COLORS } from "@/components/shared/api";

interface DashboardData {
  kpis: {
    totalCustomers: number; todayOrders: number; pendingOrders: number;
    todayDelivered: number; activeRoutes: number; lowStock: number;
  };
  inventory: { id: number; name: string; sizeLiters: number; stock: number; minStock: number; low: boolean }[];
  salesByDay: { date: string; total: number; pedidos: number }[];
  salesBySize: { name: string; botellones: number }[];
  recentOrders: { id: number; customer: string; status: string; total: number; createdAt: string }[];
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api<DashboardData>("/api/dashboard").then(setData).catch(() => {});
  }, []);

  if (!data) {
    return <div className="space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />)}
    </div>;
  }

  const kpis = [
    { label: "Clientes activos", value: data.kpis.totalCustomers, icon: Users, color: "text-teal-600 bg-teal-50" },
    { label: "Pedidos de hoy", value: data.kpis.todayOrders, icon: ClipboardList, color: "text-cyan-600 bg-cyan-50" },
    { label: "Pedidos pendientes", value: data.kpis.pendingOrders, icon: Package, color: "text-amber-600 bg-amber-50" },
    { label: "Entregas de hoy", value: data.kpis.todayDelivered, icon: Droplet, color: "text-emerald-600 bg-emerald-50" },
    { label: "Rutas en curso", value: data.kpis.activeRoutes, icon: Truck, color: "text-violet-600 bg-violet-50" },
    { label: "Productos en stock bajo", value: data.kpis.lowStock, icon: AlertTriangle, color: "text-red-600 bg-red-50" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 xl:grid-cols-6">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <div className={`inline-flex p-2 rounded-lg mb-3 ${k.color}`}>
              <k.icon className="h-5 w-5" />
            </div>
            <div className="text-2xl font-bold">{k.value}</div>
            <p className="text-xs text-muted-foreground mt-0.5">{k.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-teal-600" /> Ventas últimos 7 días
            </CardTitle>
            <CardDescription>Monto total facturado por día (pedidos no cancelados)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.salesByDay}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0e9aa7" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0e9aa7" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" fontSize={12} tickLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Area type="monotone" dataKey="total" stroke="#0e9aa7" strokeWidth={2.5} fill="url(#salesGrad)" name="Ventas" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-teal-600" /> Botellones entregados por formato
            </CardTitle>
            <CardDescription>Unidades despachadas históricamente por tamaño</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.salesBySize}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" fontSize={12} tickLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="botellones" fill="#0e9aa7" radius={[6, 6, 0, 0]} name="Botellones" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estado del inventario</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.inventory.map((p) => (
              <div key={p.id} className="flex items-center gap-4">
                <div className="w-24 text-sm font-medium">{p.sizeLiters}L</div>
                <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${p.low ? "bg-red-500" : "bg-teal-600"}`}
                    style={{ width: `${Math.min(100, (p.stock / (p.minStock * 4)) * 100)}%` }}
                  />
                </div>
                <div className="text-sm tabular-nums w-32 text-right">
                  {p.stock} und
                  {p.low && <Badge variant="destructive" className="ml-2 text-[10px] px-1.5">Bajo</Badge>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pedidos recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5 max-h-72 overflow-y-auto">
              {data.recentOrders.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-2 text-sm border-b pb-2.5 last:border-0">
                  <div>
                    <span className="font-medium">#{o.id}</span> · {o.customer}
                    <div className="text-xs text-muted-foreground">{fmtDate(o.createdAt)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums font-medium">{money(o.total)}</span>
                    <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[o.status] || ""}`}>
                      {STATUS_LABELS[o.status] || o.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
