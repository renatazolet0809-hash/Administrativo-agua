"use client";

import { useEffect, useState, useCallback } from "react";
import { Radio, Navigation2, RefreshCw, User, Package2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api, fmtDate, STATUS_LABELS, STATUS_COLORS, haversine } from "@/components/shared/api";
import dynamic from "next/dynamic";
import { toast } from "sonner";

const MapView = dynamic(() => import("@/components/shared/MapView"), {
  ssr: false,
  loading: () => <div className="h-full w-full rounded-xl bg-muted animate-pulse" />,
});

interface LiveDriver {
  routeId: number;
  routeName: string;
  driver: { id: number; name: string; phone: string };
  vehicle: { plate: string; model: string } | null;
  position: { lat: number; lng: number; speed: number; createdAt: string } | null;
  nextStop: { id: number; customer: { name: string; lat: number; lng: number; address: string } } | null;
  stops: { id: number; sequence: number; status: string; customer: { name: string; lat: number; lng: number } }[];
}

export function Tracking() {
  const [live, setLive] = useState<LiveDriver[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const data = await api<LiveDriver[]>("/api/tracking");
      setLive(data);
      setLastUpdate(new Date());
      if (selectedRoute && !data.find((d) => d.routeId === selectedRoute)) setSelectedRoute(null);
    } catch (e) {
      if (!silent) toast.error(e instanceof Error ? e.message : "Error cargando seguimiento");
    } finally {
      setRefreshing(false);
    }
  }, [selectedRoute]);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 8000); // auto-refresh cada 8s
    return () => clearInterval(interval);
  }, [load]);

  const active = live.find((d) => d.routeId === selectedRoute) || null;

  const markers = active
    ? [
        ...(active.position
          ? [{
              id: "driver",
              position: [active.position.lat, active.position.lng] as [number, number],
              label: active.driver.name,
              sublabel: `Velocidad: ${Math.round(active.position.speed || 0)} km/h · ${fmtDate(active.position.createdAt)}`,
              color: "#7c3aed",
              emoji: "🚚",
            }]
          : []),
        ...active.stops
          .filter((s) => s.status !== "ENTREGADO")
          .map((s) => ({
            id: `stop-${s.id}`,
            position: [s.customer.lat, s.customer.lng] as [number, number],
            label: `${s.sequence}. ${s.customer.name}`,
            sublabel: STATUS_LABELS[s.status],
            color: s.id === active.nextStop?.id ? "#f59e0b" : "#0e9aa7",
            emoji: "🏢",
          })),
      ]
    : live.flatMap((d) => [
        ...(d.position
          ? [{
              id: `d-${d.routeId}`,
              position: [d.position.lat, d.position.lng] as [number, number],
              label: d.driver.name,
              sublabel: d.routeName,
              color: "#7c3aed",
              emoji: "🚚",
            }]
          : []),
        ...(d.nextStop
          ? [{
              id: `n-${d.routeId}`,
              position: [d.nextStop.customer.lat, d.nextStop.customer.lng] as [number, number],
              label: d.nextStop.customer.name,
              sublabel: `Próxima parada de ${d.driver.name}`,
              color: "#f59e0b",
              emoji: "🏢",
            }]
          : []),
      ]);

  const polyline = active
    ? [
        ...(active.position ? [[active.position.lat, active.position.lng] as [number, number]] : []),
        ...(active.nextStop
          ? [[active.nextStop.customer.lat, active.nextStop.customer.lng] as [number, number]]
          : []),
      ]
    : [];

  const distanceToNext = active && active.position && active.nextStop
    ? haversine(
        [active.position.lat, active.position.lng],
        [active.nextStop.customer.lat, active.nextStop.customer.lng]
      )
    : null;

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {/* Panel de choferes activos */}
      <div className="lg:col-span-1 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Radio className="h-4 w-4 text-violet-600 animate-pulse" /> Choferes en ruta
          </h3>
          <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={() => load()}>
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Actualizar
          </Button>
        </div>

        <ScrollArea className="h-[420px] lg:h-[calc(100vh-260px)]">
          <div className="space-y-2.5 pr-3">
            {live.map((d) => (
              <Card key={d.routeId}
                className={`p-3.5 cursor-pointer transition hover:border-teal-300 ${selectedRoute === d.routeId ? "border-teal-500 ring-1 ring-teal-500" : ""}`}
                onClick={() => setSelectedRoute(selectedRoute === d.routeId ? null : d.routeId)}>
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                    <User className="h-4.5 w-4.5 text-violet-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{d.driver.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{d.routeName}</div>
                  </div>
                  <span className={`h-2.5 w-2.5 rounded-full ${d.position ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`}
                    title={d.position ? "GPS activo" : "Sin señal GPS"} />
                </div>
                <div className="mt-2.5 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Package2 className="h-3 w-3" />
                    {d.stops.filter((s) => s.status === "ENTREGADO").length}/{d.stops.length} entregas
                  </span>
                  {d.position && (
                    <span className="text-violet-600 tabular-nums">{Math.round(d.position.speed || 0)} km/h</span>
                  )}
                </div>
                {d.vehicle && (
                  <div className="mt-1 text-[10px] text-muted-foreground">Vehículo: {d.vehicle.plate} · {d.vehicle.model}</div>
                )}
              </Card>
            ))}
            {live.length === 0 && (
              <Card className="p-8 text-center">
                <TruckIcon />
                <p className="text-sm text-muted-foreground mt-2">
                  Ningún chofer tiene rutas en curso ahora mismo
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Las posiciones aparecen cuando la app del chofer envía GPS
                </p>
              </Card>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Mapa */}
      <div className="lg:col-span-3 space-y-3">
        {active && active.nextStop && (
          <Card>
            <CardContent className="p-3.5 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2.5 flex-1 min-w-48">
                <Navigation2 className="h-5 w-5 text-amber-600 shrink-0" />
                <div>
                  <div className="text-xs text-muted-foreground">Próxima parada</div>
                  <div className="font-medium text-sm">{active.nextStop.customer.name}</div>
                  <div className="text-xs text-muted-foreground">{active.nextStop.customer.address}</div>
                </div>
              </div>
              {distanceToNext !== null && (
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Distancia directa</div>
                  <div className="font-bold text-teal-700 tabular-nums">{distanceToNext.toFixed(1)} km</div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="overflow-hidden">
          <CardContent className="p-3">
            <MapView
              markers={markers}
              polyline={polyline}
              polylineColor="#7c3aed"
              fitAll={false}
              center={[10.4806, -66.9036]}
              zoom={12}
              className="h-[420px] lg:h-[calc(100vh-260px)] min-h-[400px] w-full"
            />
          </CardContent>
        </Card>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-600 inline-block" /> Chofer</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block" /> Próxima parada</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-teal-600 inline-block" /> Parada pendiente</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-0.5 bg-violet-400 inline-block" style={{height:'10px'}} /> Rumbo directo</span>
          </span>
          {lastUpdate && <span>Última actualización: {lastUpdate.toLocaleTimeString("es-VE")}</span>}
        </div>

        {/* Paradas de la ruta seleccionada */}
        {active && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Paradas de {active.routeName}</CardTitle>
              <CardDescription>Estado en tiempo real de cada entrega</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {active.stops.map((s) => (
                  <div key={s.id} className="flex items-center gap-2.5 border rounded-lg p-2.5 text-sm">
                    <span className="h-6 w-6 shrink-0 rounded-full bg-teal-50 text-teal-700 text-xs font-bold flex items-center justify-center">
                      {s.sequence}
                    </span>
                    <span className="flex-1 truncate">{s.customer.name}</span>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${STATUS_COLORS[s.status] || ""}`}>
                      {STATUS_LABELS[s.status] || s.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function TruckIcon() {
  return <Navigation2 className="h-8 w-8 text-muted-foreground mx-auto" />;
}
