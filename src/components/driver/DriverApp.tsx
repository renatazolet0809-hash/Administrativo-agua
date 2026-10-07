"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Droplets, LogOut, ArrowLeft, MapPin, Phone, Play, CheckCircle2,
  XCircle, Navigation2, Package2, Route as RouteIcon, Wifi, WifiOff, RefreshCw, Flag,
  Camera, ImagePlus, Loader2, MapPinned,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { api, clearToken, fmtDate, STATUS_LABELS, STATUS_COLORS, haversine } from "@/components/shared/api";
import { NotificationBell } from "@/components/shared/NotificationBell";
import dynamic from "next/dynamic";
import { toast } from "sonner";

const MapView = dynamic(() => import("@/components/shared/MapView"), {
  ssr: false,
  loading: () => <div className="h-full w-full rounded-xl bg-muted animate-pulse" />,
});

interface Stop {
  id: number; sequence: number; status: string; itemsSummary: string; orderId: number | null;
  customer: { id: number; name: string; address: string; zone: string; phone: string; lat: number; lng: number };
}
interface DriverRoute {
  id: number; name: string; status: string; date: string; startedAt: string | null;
  vehicle: { plate: string; model: string } | null;
  stops: Stop[];
}

const CARACAS: [number, number] = [10.4806, -66.9036];

// Comprime la foto tomada antes de subirla (ahorra datos móviles)
function compressImage(file: File, maxSize = 1024, quality = 0.62): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas no disponible"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("No se pudo leer la imagen"));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

export function DriverApp({ user, onLogout }: { user: { id: number; name: string }; onLogout: () => void }) {
  const [routes, setRoutes] = useState<DriverRoute[]>([]);
  const [activeRouteId, setActiveRouteId] = useState<number | null>(null);
  const [myPos, setMyPos] = useState<[number, number] | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"off" | "real" | "error">("off");
  const [simMode, setSimMode] = useState(false);
  const [loading, setLoading] = useState(false);
  // Modal de comprobante fotográfico de entrega
  const [proofStop, setProofStop] = useState<Stop | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [proofNote, setProofNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const watchId = useRef<number | null>(null);
  const lastSent = useRef<number>(0);
  const simTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeRoute = routes.find((r) => r.id === activeRouteId) || null;

  const loadRoutes = useCallback(async () => {
    try {
      const r = await api<DriverRoute[]>("/api/routes");
      setRoutes(r);
      return r;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error cargando rutas");
      return [];
    }
  }, []);

  useEffect(() => { loadRoutes(); }, [loadRoutes]);

  // Abrir una ruta desde una notificación push (campana)
  const openRouteFromNotif = useCallback(async (routeId: number) => {
    const r = await loadRoutes();
    if (r.find((x) => x.id === routeId)) setActiveRouteId(routeId);
    else toast.info("La ruta ya no está disponible");
  }, [loadRoutes]);

  const sendPosition = useCallback(async (lat: number, lng: number, speed = 0, routeId?: number) => {
    try {
      await api("/api/tracking", {
        method: "POST",
        body: { lat, lng, speed, accuracy: 10, routeId: routeId || activeRouteId || undefined },
      });
    } catch { /* silencioso: reintenta en el próximo tick */ }
  }, [activeRouteId]);

  // ----- GPS real -----
  useEffect(() => {
    if (simMode) return;
    if (!navigator.geolocation) {
      setGpsStatus("error");
      return;
    }
    setGpsStatus("off");
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsStatus("real");
        setMyPos([pos.coords.latitude, pos.coords.longitude]);
        const now = Date.now();
        if (activeRoute?.status === "EN_CURSO" && now - lastSent.current > 10000) {
          lastSent.current = now;
          sendPosition(pos.coords.latitude, pos.coords.longitude, (pos.coords.speed || 0) * 3.6);
        }
      },
      () => setGpsStatus("error"),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current); };
  }, [simMode, activeRoute?.status, sendPosition]);

  // ----- Modo simulación (demo sin GPS físico) -----
  const nextPendingStop = activeRoute?.stops.find((s) => s.status === "PENDIENTE" || s.status === "EN_CAMINO");

  useEffect(() => {
    if (simTimer.current) { clearInterval(simTimer.current); simTimer.current = null; }
    if (!simMode || activeRoute?.status !== "EN_CURSO") return;
    if (!myPos) setMyPos(CARACAS);
    setGpsStatus("off");
    simTimer.current = setInterval(() => {
      setMyPos((prev) => {
        const target = nextPendingStop
          ? ([nextPendingStop.customer.lat, nextPendingStop.customer.lng] as [number, number])
          : CARACAS;
        const cur: [number, number] = prev || CARACAS;
        const dLat = (target[0] - cur[0]) * 0.18;
        const dLng = (target[1] - cur[1]) * 0.18;
        const next: [number, number] = [cur[0] + dLat, cur[1] + dLng];
        const now = Date.now();
        if (now - lastSent.current > 8000) {
          lastSent.current = now;
          const dist = haversine(next, target);
          const speed = Math.min(45, dist * 60); // km/h simulado
          sendPosition(next[0], next[1], speed);
        }
        return next;
      });
    }, 2000);
    return () => { if (simTimer.current) { clearInterval(simTimer.current); simTimer.current = null; } };
  }, [simMode, activeRoute?.status, nextPendingStop?.id, sendPosition, myPos]);

  async function startRoute() {
    if (!activeRoute) return;
    setLoading(true);
    try {
      await api(`/api/routes/${activeRoute.id}`, { method: "PUT", body: { action: "START" } });
      toast.success("Ruta iniciada. ¡Buen viaje!");
      await loadRoutes();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error iniciando ruta");
    } finally {
      setLoading(false);
    }
  }

  async function completeRoute() {
    if (!activeRoute) return;
    setLoading(true);
    try {
      await api(`/api/routes/${activeRoute.id}`, { method: "PUT", body: { action: "COMPLETE", force: true } });
      toast.success("Ruta completada. Excelente trabajo");
      setActiveRouteId(null);
      await loadRoutes();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error finalizando ruta");
    } finally {
      setLoading(false);
    }
  }

  async function updateStop(stop: Stop, status: string) {
    if (!activeRoute) return;
    setLoading(true);
    try {
      await api(`/api/routes/${activeRoute.id}`, {
        method: "PUT",
        body: { action: "STOP_STATUS", stopId: stop.id, status },
      });
      toast.success(
        status === "ENTREGADO" ? `Entrega confirmada — ${stop.customer.name}`
        : status === "NO_ENTREGADO" ? `Registrado como no entregado`
        : "Parada actualizada"
      );
      await loadRoutes();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error actualizando parada");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try { await api("/api/auth/logout", { method: "POST" }); } catch { /* noop */ }
    clearToken();
    onLogout();
  }

  // ----- Comprobante fotográfico de entrega -----
  function openProofModal(stop: Stop) {
    setProofStop(stop);
    setPhoto(null);
    setProofNote("");
    // Asegurar una posición GPS aunque el tracking aún no haya reportado
    if (!myPos && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => setMyPos([p.coords.latitude, p.coords.longitude]),
        () => { /* sin GPS: el modal lo indica */ },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      setPhoto(dataUrl);
      toast.success("Foto lista para el comprobante");
    } catch {
      toast.error("No se pudo procesar la fotografía");
    }
    e.target.value = "";
  }

  async function submitProof() {
    if (!proofStop || !photo) return;
    setUploading(true);
    try {
      await api(`/api/stops/${proofStop.id}/proof`, {
        method: "POST",
        body: { photo, lat: myPos?.[0], lng: myPos?.[1], note: proofNote || undefined },
      });
      toast.success(`Entrega confirmada con comprobante — ${proofStop.customer.name}`);
      setProofStop(null);
      setPhoto(null);
      await loadRoutes();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error subiendo comprobante");
    } finally {
      setUploading(false);
    }
  }

  const navUrl = (lat: number, lng: number, name: string) =>
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=&travelmode=driving&query=${encodeURIComponent(name)}`;

  // ==================== VISTA: DETALLE DE RUTA ====================
  if (activeRoute) {
    const delivered = activeRoute.stops.filter((s) => s.status === "ENTREGADO").length;
    const progress = activeRoute.stops.length ? (delivered / activeRoute.stops.length) * 100 : 0;

    const markers = [
      ...(myPos ? [{
        id: "me", position: myPos,
        label: "Mi posición",
        sublabel: simMode ? "Simulación activa" : "GPS del teléfono",
        color: "#7c3aed", emoji: "🚚",
      }] : []),
      ...activeRoute.stops.filter((s) => s.status !== "ENTREGADO").map((s) => ({
        id: `s-${s.id}`,
        position: [s.customer.lat, s.customer.lng] as [number, number],
        label: `${s.sequence}. ${s.customer.name}`,
        sublabel: s.itemsSummary,
        color: s.id === nextPendingStop?.id ? "#f59e0b" : "#0e9aa7",
        emoji: "🏢",
      })),
    ];

    const polyline = myPos && nextPendingStop
      ? [myPos, [nextPendingStop.customer.lat, nextPendingStop.customer.lng] as [number, number]]
      : [];

    const distToNext = myPos && nextPendingStop
      ? haversine(myPos, [nextPendingStop.customer.lat, nextPendingStop.customer.lng])
      : null;

    return (
      <div className="min-h-screen bg-teal-50/50 flex flex-col">
        {/* Header móvil */}
        <header className="sticky top-0 z-40 bg-teal-700 text-white px-4 py-3 flex items-center gap-2 shadow-lg">
          <Button size="icon" variant="ghost" className="text-white hover:bg-teal-600" onClick={() => setActiveRouteId(null)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold truncate">{activeRoute.name}</h1>
            <p className="text-xs text-teal-100">{fmtDate(activeRoute.date)}{activeRoute.vehicle ? ` · ${activeRoute.vehicle.plate}` : ""}</p>
          </div>
          <NotificationBell dark onOpenRoute={openRouteFromNotif} />
          <Button size="icon" variant="ghost" className="text-white hover:bg-teal-600" onClick={logout} title="Salir">
            <LogOut className="h-5 w-5" />
          </Button>
        </header>

        <main className="flex-1 p-4 space-y-4 pb-8 max-w-md w-full mx-auto">
          {/* Estado GPS */}
          <Card className="p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm">
                {gpsStatus === "real" && <Wifi className="h-4 w-4 text-emerald-600" />}
                {gpsStatus === "off" && <WifiOff className="h-4 w-4 text-gray-400" />}
                {gpsStatus === "error" && <WifiOff className="h-4 w-4 text-amber-600" />}
                <span className="font-medium">
                  {gpsStatus === "real" ? "GPS activo — enviando posición" :
                   gpsStatus === "error" ? "GPS no disponible en este dispositivo" :
                   "GPS en espera"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Label htmlFor="sim" className="text-xs text-muted-foreground">Simular</Label>
                <Switch id="sim" checked={simMode} onCheckedChange={setSimMode} />
              </div>
            </div>
            {activeRoute.status === "EN_CURSO" && simMode && (
              <p className="text-xs text-amber-700 mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2">
                Modo demostración: su posición se mueve automáticamente hacia el próximo cliente.
                El panel administrativo la ve en tiempo real.
              </p>
            )}
          </Card>

          {/* Progreso */}
          <Card className="p-3.5">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium">{delivered} de {activeRoute.stops.length} entregas</span>
              <span className="text-muted-foreground">{Math.round(progress)}%</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-teal-600 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            {activeRoute.status === "EN_CURSO" && nextPendingStop && distToNext !== null && (
              <div className="mt-3 flex items-center gap-2 text-sm">
                <Navigation2 className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Próximo: <strong>{nextPendingStop.customer.name}</strong> a {distToNext.toFixed(1)} km</span>
              </div>
            )}
            <div className="flex gap-2 mt-3">
              {activeRoute.status === "PLANIFICADA" && (
                <Button className="flex-1 gap-1.5" onClick={startRoute} disabled={loading}>
                  <Play className="h-4 w-4" /> Iniciar ruta
                </Button>
              )}
              {activeRoute.status === "EN_CURSO" && (
                <Button variant="outline" className="flex-1 gap-1.5" onClick={completeRoute} disabled={loading}>
                  <Flag className="h-4 w-4" /> Finalizar ruta
                </Button>
              )}
              {activeRoute.status === "COMPLETADA" && (
                <div className="flex-1 text-center text-sm text-emerald-700 font-medium py-2">
                  Ruta completada ✓
                </div>
              )}
            </div>
          </Card>

          {/* Mapa */}
          <div className="h-72 rounded-xl overflow-hidden border shadow-sm">
            <MapView markers={markers} polyline={polyline} polylineColor="#7c3aed" fitAll={false}
              center={myPos || CARACAS} zoom={13} className="h-full w-full" />
          </div>

          {/* Paradas */}
          <div className="space-y-3">
            {activeRoute.stops.map((s) => (
              <Card key={s.id} className={`overflow-hidden ${s.id === nextPendingStop?.id && activeRoute.status === "EN_CURSO" ? "border-amber-400 ring-1 ring-amber-400" : ""}`}>
                <div className="flex">
                  <div className="w-11 shrink-0 bg-teal-600 text-white flex flex-col items-center justify-center py-3">
                    <span className="text-sm font-bold">{s.sequence}</span>
                  </div>
                  <div className="flex-1 p-3.5 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{s.customer.name}</div>
                        <div className="text-xs text-muted-foreground flex items-start gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                          <span>{s.customer.zone} — {s.customer.address}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className={`shrink-0 text-[10px] ${STATUS_COLORS[s.status] || ""}`}>
                        {STATUS_LABELS[s.status] || s.status}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1.5 mt-2 text-xs bg-teal-50 text-teal-900 rounded-lg px-2.5 py-1.5">
                      <Package2 className="h-3.5 w-3.5 shrink-0" />
                      {s.itemsSummary}
                    </div>

                    <div className="flex items-center gap-2 mt-2.5 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" /> {s.customer.phone}
                      <a href={navUrl(s.customer.lat, s.customer.lng, s.customer.name)} target="_blank"
                        rel="noreferrer" className="ml-auto flex items-center gap-1 text-teal-700 font-medium hover:underline">
                        <Navigation2 className="h-3.5 w-3.5" /> Navegar
                      </a>
                    </div>

                    {activeRoute.status === "EN_CURSO" && !["ENTREGADO"].includes(s.status) && (
                      <div className="flex gap-2 mt-3">
                        {s.status === "PENDIENTE" && (
                          <Button size="sm" variant="outline" className="flex-1 gap-1 h-9"
                            onClick={() => updateStop(s, "EN_CAMINO")} disabled={loading}>
                            <Navigation2 className="h-3.5 w-3.5" /> En camino
                          </Button>
                        )}
                        <Button size="sm" className="flex-1 gap-1 h-9 bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => openProofModal(s)} disabled={loading}>
                          <Camera className="h-3.5 w-3.5" /> Entregar
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 gap-1 h-9 text-red-600 hover:text-red-700"
                          onClick={() => updateStop(s, "NO_ENTREGADO")} disabled={loading}>
                          <XCircle className="h-3.5 w-3.5" /> No entregado
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </main>

        {/* Modal: comprobante fotográfico de entrega */}
        <Dialog open={!!proofStop} onOpenChange={(o) => !o && setProofStop(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-teal-600" /> Comprobante de entrega
              </DialogTitle>
              <DialogDescription>
                {proofStop?.customer.name} — {proofStop?.itemsSummary}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPickPhoto} />

              {photo ? (
                <div className="relative rounded-xl overflow-hidden border">
                  { }
                  <img src={photo} alt="Comprobante" className="w-full h-52 object-cover" />
                  <Button size="sm" variant="secondary" className="absolute bottom-2 right-2 gap-1"
                    onClick={() => fileRef.current?.click()}>
                    <ImagePlus className="h-3.5 w-3.5" /> Cambiar foto
                  </Button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="w-full h-44 rounded-xl border-2 border-dashed border-teal-300 bg-teal-50/60 flex flex-col items-center justify-center gap-2 text-teal-700 hover:bg-teal-50 transition">
                  <Camera className="h-9 w-9" />
                  <span className="text-sm font-medium">Tomar foto de la entrega</span>
                  <span className="text-xs text-teal-600/70">La cámara del teléfono se abrirá automáticamente</span>
                </button>
              )}

              <div className="rounded-lg bg-muted/60 border p-2.5 flex items-start gap-2 text-xs">
                <MapPinned className={`h-4 w-4 mt-0.5 shrink-0 ${myPos ? "text-emerald-600" : "text-amber-600"}`} />
                {myPos ? (
                  <span>Ubicación GPS registrada: <strong>{myPos[0].toFixed(5)}, {myPos[1].toFixed(5)}</strong> — se adjuntará al comprobante.</span>
                ) : (
                  <span className="text-amber-700">Esperando señal GPS… si no aparece, no podrá confirmar la entrega.</span>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="proof-note" className="text-xs">Nota (opcional)</Label>
                <Input id="proof-note" placeholder="Ej: recibido por el portero"
                  value={proofNote} onChange={(e) => setProofNote(e.target.value)} />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setProofStop(null)} disabled={uploading}>Cancelar</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700 gap-1.5" onClick={submitProof}
                disabled={!photo || !myPos || uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {uploading ? "Subiendo…" : "Confirmar entrega"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ==================== VISTA: LISTA DE RUTAS ====================
  return (
    <div className="min-h-screen bg-teal-50/50 flex flex-col">
      <header className="sticky top-0 z-40 bg-gradient-to-r from-teal-700 to-cyan-800 text-white px-4 py-4 shadow-lg">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="p-2 bg-white/15 rounded-xl backdrop-blur">
            <Droplets className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h1 className="font-bold">AquaGestión · Chofer</h1>
            <p className="text-xs text-teal-100">{user.name}</p>
          </div>
          <NotificationBell dark onOpenRoute={openRouteFromNotif} />
          <Button size="icon" variant="ghost" className="text-white hover:bg-teal-600" onClick={logout} title="Salir">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-4 pb-8 max-w-md w-full mx-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <RouteIcon className="h-4.5 w-4.5 text-teal-700" /> Mis rutas de hoy
          </h2>
          <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => loadRoutes()}>
            <RefreshCw className="h-3.5 w-3.5" /> Actualizar
          </Button>
        </div>

        {routes.map((r) => {
          const delivered = r.stops.filter((s) => s.status === "ENTREGADO").length;
          return (
            <Card key={r.id}
              className="p-4 cursor-pointer transition hover:border-teal-300 active:scale-[0.99]"
              onClick={() => setActiveRouteId(r.id)}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{r.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {fmtDate(r.date)}{r.vehicle ? ` · ${r.vehicle.plate}` : ""}
                  </div>
                </div>
                <Badge variant="outline" className={STATUS_COLORS[r.status] || ""}>
                  {STATUS_LABELS[r.status] || r.status}
                </Badge>
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Package2 className="h-3.5 w-3.5" /> {r.stops.length} paradas
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> {delivered} entregadas
                </span>
              </div>
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-teal-600 rounded-full"
                  style={{ width: `${r.stops.length ? (delivered / r.stops.length) * 100 : 0}%` }} />
              </div>
            </Card>
          );
        })}

        {routes.length === 0 && (
          <Card className="p-10 text-center">
            <RouteIcon className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground mt-3">
              No tiene rutas asignadas todavía. El despachador le asignará una ruta pronto.
            </p>
          </Card>
        )}
      </main>
    </div>
  );
}
