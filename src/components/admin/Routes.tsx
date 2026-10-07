"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Play, CheckCircle2, XCircle, Truck, MapPin, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api, money, fmtDate, STATUS_LABELS, STATUS_COLORS } from "@/components/shared/api";
import { toast } from "sonner";

interface Order {
  id: number; status: string; total: number;
  customer: { name: string; zone: string; address: string };
  items: { quantity: number; product: { name: string } }[];
}
interface Driver { id: number; name: string; role: { name: string }; }
interface Vehicle { id: number; plate: string; model: string; }
interface Stop {
  id: number; sequence: number; status: string; itemsSummary: string;
  customer: { name: string; zone: string; address: string };
}
interface Route {
  id: number; name: string; status: string; date: string; startedAt: string | null;
  completedAt: string | null;
  driver: { id: number; name: string };
  vehicle: { plate: string; model: string } | null;
  stops: Stop[];
}

export function Routes({ canManage }: { canManage: boolean; canViewAll: boolean }) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", driverId: "", vehicleId: "" });
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<Route[]>("/api/routes");
      setRoutes(r);
      if (canManage) {
        const [o, u, v] = await Promise.all([
          api<Order[]>("/api/orders"),
          api<Driver[]>("/api/users"),
          api<Vehicle[]>("/api/vehicles"),
        ]);
        setPendingOrders(o.filter((x) => x.status === "PENDIENTE" || x.status === "CONFIRMADO"));
        setDrivers(u.filter((x) => x.role.name === "CHOFER" && x.id));
        setVehicles(v);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error cargando rutas");
    }
  }, [canManage]);

  useEffect(() => { load(); }, [load]);

  async function createRoute() {
    try {
      await api("/api/routes", {
        method: "POST",
        body: {
          name: form.name,
          driverId: Number(form.driverId),
          vehicleId: form.vehicleId ? Number(form.vehicleId) : undefined,
          orderIds: selectedOrders,
        },
      });
      toast.success("Ruta creada con las paradas asignadas");
      setDialogOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error creando ruta");
    }
  }

  async function routeAction(route: Route, action: string, extra: Record<string, unknown> = {}) {
    try {
      await api(`/api/routes/${route.id}`, { method: "PUT", body: { action, ...extra } });
      toast.success(
        action === "START" ? `Ruta iniciada — inventario cargado` :
        action === "COMPLETE" ? "Ruta completada" :
        "Parada actualizada"
      );
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error ejecutando acción");
    }
  }

  async function cancelRoute(route: Route) {
    try {
      await api(`/api/routes/${route.id}`, { method: "DELETE" });
      toast.success("Ruta cancelada");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error cancelando ruta");
    }
  }

  const totalLiters = (order: Order) =>
    order.items.reduce((s, it) => s + it.quantity, 0);

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => { setForm({ name: "", driverId: "", vehicleId: "" }); setSelectedOrders([]); setDialogOpen(true); }}
            className="gap-1.5">
            <Plus className="h-4 w-4" /> Nueva ruta de despacho
          </Button>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {routes.map((r) => {
          const delivered = r.stops.filter((s) => s.status === "ENTREGADO").length;
          const progress = r.stops.length ? (delivered / r.stops.length) * 100 : 0;
          return (
            <Card key={r.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Truck className="h-4 w-4 text-teal-600" /> {r.name}
                    </CardTitle>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {fmtDate(r.date)}</span>
                      <span>Chofer: <strong>{r.driver.name}</strong></span>
                      {r.vehicle && <span>{r.vehicle.plate}</span>}
                    </div>
                  </div>
                  <Badge variant="outline" className={STATUS_COLORS[r.status] || ""}>{STATUS_LABELS[r.status] || r.status}</Badge>
                </div>
                {r.status === "EN_CURSO" && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{delivered}/{r.stops.length} paradas entregadas</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-teal-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  {r.stops.slice(0, expanded === r.id ? undefined : 3).map((s) => (
                    <div key={s.id} className="flex items-center gap-2.5 text-sm border rounded-lg p-2.5">
                      <span className="h-6 w-6 shrink-0 rounded-full bg-teal-50 text-teal-700 text-xs font-bold flex items-center justify-center">
                        {s.sequence}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{s.customer.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{s.itemsSummary}</div>
                      </div>
                      <Badge variant="outline" className={`shrink-0 text-[10px] ${STATUS_COLORS[s.status] || ""}`}>
                        {STATUS_LABELS[s.status] || s.status}
                      </Badge>
                    </div>
                  ))}
                  {r.stops.length > 3 && (
                    <Button variant="ghost" size="sm" className="w-full text-xs"
                      onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                      {expanded === r.id ? "Ver menos" : `Ver las ${r.stops.length} paradas`}
                    </Button>
                  )}
                </div>

                {canManage && (
                  <div className="flex gap-2 pt-1">
                    {r.status === "PLANIFICADA" && (
                      <Button size="sm" className="gap-1.5 flex-1" onClick={() => routeAction(r, "START")}>
                        <Play className="h-3.5 w-3.5" /> Iniciar ruta (cargar botellones)
                      </Button>
                    )}
                    {r.status === "EN_CURSO" && (
                      <Button size="sm" variant="outline" className="gap-1.5 flex-1"
                        onClick={() => routeAction(r, "COMPLETE", { force: true })}>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Finalizar ruta
                      </Button>
                    )}
                    {["PLANIFICADA", "COMPLETADA"].includes(r.status) && (
                      <Button size="sm" variant="outline" className="gap-1.5 text-red-600 hover:text-red-700"
                        onClick={() => cancelRoute(r)}>
                        <XCircle className="h-3.5 w-3.5" /> Cancelar
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {routes.length === 0 && (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            No hay rutas de despacho registradas
          </CardContent></Card>
        )}
      </div>

      {/* Diálogo nueva ruta */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Nueva ruta de despacho</DialogTitle>
            <DialogDescription>
              Asigne un chofer y seleccione los pedidos a despachar. Al iniciar la ruta se descargará el inventario.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 overflow-hidden flex-1">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2 col-span-3 sm:col-span-1">
                <Label>Nombre de ruta</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ruta Norte - Mañana" />
              </div>
              <div className="space-y-2">
                <Label>Chofer</Label>
                <Select value={form.driverId} onValueChange={(v) => setForm({ ...form, driverId: v })}>
                  <SelectTrigger><SelectValue placeholder="Chofer" /></SelectTrigger>
                  <SelectContent>
                    {drivers.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vehículo</Label>
                <Select value={form.vehicleId} onValueChange={(v) => setForm({ ...form, vehicleId: v })}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={String(v.id)}>{v.plate} — {v.model}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 flex-1 overflow-hidden">
              <Label>Pedidos a despachar ({selectedOrders.length} seleccionados)</Label>
              <ScrollArea className="h-72 border rounded-lg">
                <div className="p-2 space-y-1.5">
                  {pendingOrders.map((o) => (
                    <label key={o.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted cursor-pointer">
                      <Checkbox
                        checked={selectedOrders.includes(o.id)}
                        onCheckedChange={(checked) =>
                          setSelectedOrders(checked ? [...selectedOrders, o.id] : selectedOrders.filter((x) => x !== o.id))
                        }
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">#{o.id} · {o.customer.name}</div>
                        <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {o.customer.zone} — {o.customer.address}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm tabular-nums font-medium">{money(o.total)}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {o.items.map((it) => `${it.quantity}× ${it.product.name}`).join(", ")}
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${STATUS_COLORS[o.status]}`}>
                        {STATUS_LABELS[o.status]}
                      </Badge>
                    </label>
                  ))}
                  {pendingOrders.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-8">
                      No hay pedidos pendientes de despacho
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={createRoute} disabled={!form.name || !form.driverId || selectedOrders.length === 0}>
              Crear ruta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
