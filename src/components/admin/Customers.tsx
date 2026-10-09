"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, MapPin, Search, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api, fmtDay } from "@/components/shared/api";
import { AddressAutocomplete } from "@/components/shared/AddressAutocomplete";
import dynamic from "next/dynamic";
import { toast } from "sonner";

const MapView = dynamic(() => import("@/components/shared/MapView"), {
  ssr: false,
  loading: () => <div className="h-96 w-full rounded-xl bg-muted animate-pulse" />,
});

interface Customer {
  id: number; name: string; phone: string; email: string | null; address: string;
  zone: string; lat: number; lng: number; notes: string | null; active: boolean;
  createdAt: string;
}

export function Customers({ canManage }: { canManage: boolean }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", phone: "", email: "", address: "", zone: "", lat: "10.4806", lng: "-66.9036", notes: "",
  });

  const load = useCallback(async () => {
    try {
      const q = search ? `?q=${encodeURIComponent(search)}` : "";
      setCustomers(await api<Customer[]>(`/api/customers${q}`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error cargando clientes");
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setSelected(null);
    setForm({ name: "", phone: "", email: "", address: "", zone: "", lat: "10.4806", lng: "-66.9036", notes: "" });
    setDialogOpen(true);
  }

  function openEdit(c: Customer) {
    setSelected(c);
    setForm({
      name: c.name, phone: c.phone, email: c.email || "", address: c.address,
      zone: c.zone, lat: String(c.lat), lng: String(c.lng), notes: c.notes || "",
    });
    setDialogOpen(true);
  }

  async function save() {
    try {
      const body = { ...form, lat: Number(form.lat), lng: Number(form.lng) };
      if (selected) {
        await api(`/api/customers/${selected.id}`, { method: "PUT", body });
        toast.success("Cliente actualizado");
      } else {
        await api("/api/customers", { method: "POST", body });
        toast.success("Cliente registrado");
      }
      setDialogOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error guardando cliente");
    }
  }

  const markers = customers.map((c) => ({
    id: String(c.id),
    position: [c.lat, c.lng] as [number, number],
    label: c.name,
    sublabel: `${c.zone} · ${c.address}`,
    color: "#0e9aa7",
    emoji: "🏢",
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar cliente, teléfono, zona..." className="pl-9"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {canManage && <Button onClick={openCreate} className="gap-1.5 shrink-0"><Plus className="h-4 w-4" /> Nuevo</Button>}
        </div>

        <ScrollArea className="h-[calc(100vh-240px)] lg:h-[calc(100vh-220px)]">
          <div className="space-y-2.5 pr-3">
            {customers.map((c) => (
              <Card key={c.id} className={`p-4 cursor-pointer transition hover:border-teal-300 ${selected?.id === c.id ? "border-teal-500 ring-1 ring-teal-500" : ""}`}
                onClick={() => setSelected(c)}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {c.zone}
                    </div>
                    <div className="text-xs text-muted-foreground">{c.address}</div>
                    <div className="text-xs mt-1">{c.phone}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {canManage && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                        onClick={(e) => { e.stopPropagation(); openEdit(c); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {!c.active && <Badge variant="secondary">Inactivo</Badge>}
                    <span className="text-[10px] text-muted-foreground">{fmtDay(c.createdAt)}</span>
                  </div>
                </div>
              </Card>
            ))}
            {customers.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-10">Sin clientes encontrados</p>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="lg:col-span-3">
        <Card className="overflow-hidden">
          <CardContent className="p-3">
            <MapView
              markers={markers}
              center={[10.4806, -66.9036]}
              fitAll={false}
              className="h-[calc(100vh-220px)] min-h-[400px] w-full"
            />
          </CardContent>
        </Card>
      </div>

      {/* Diálogo cliente */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
            <DialogDescription>
              Escriba la dirección del cliente para autocompletar la ubicación o haga clic en el mapa
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre / Razón social</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Email (opcional)</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Dirección</Label>
                <AddressAutocomplete
                  value={form.address}
                  onChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      address: v.address,
                      ...(v.lat !== undefined && v.lng !== undefined
                        ? { lat: v.lat.toFixed(6), lng: v.lng.toFixed(6) }
                        : {}),
                      ...(v.zone && !f.zone ? { zone: v.zone } : {}),
                    }))
                  }
                  placeholder="Ej: Av. Libertador, Chacao…"
                />
                <p className="text-[11px] text-muted-foreground">
                  Escriba y seleccione una sugerencia para completar las coordenadas automáticamente.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Zona / Sector</Label>
                  <Input value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Latitud</Label>
                  <Input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Longitud</Label>
                  <Input value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="min-h-[260px]">
              <MapView
                markers={[{
                  id: "pick", position: [Number(form.lat) || 10.4806, Number(form.lng) || -66.9036],
                  label: form.name || "Ubicación del cliente", color: "#0e9aa7", emoji: "🏢",
                }]}
                fitAll={false}
                onMapClick={(lat, lng) => setForm({ ...form, lat: lat.toFixed(6), lng: lng.toFixed(6) })}
                className="h-full min-h-[260px] w-full"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!form.name || !form.phone || !form.address}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
