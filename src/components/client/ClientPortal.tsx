"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Droplets, LogOut, ShoppingBasket, ClipboardList, Plus, Minus, ShoppingCart,
  Camera, MapPin, PackageCheck, Loader2, RefreshCw, Package2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { api, clearToken, money, fmtDay, STATUS_LABELS, STATUS_COLORS } from "@/components/shared/api";
import { NotificationBell } from "@/components/shared/NotificationBell";
import { toast } from "sonner";

interface Product {
  id: number; name: string; code: string; sizeLiters: number; price: number; stock: number;
}
interface Order {
  id: number; status: string; total: number; notes: string | null; createdAt: string;
  items: { quantity: number; unitPrice: number; product: { name: string } }[];
  routeStops: { id: number; status: string }[];
}
interface Proof {
  photoData: string; lat: number; lng: number; note: string | null; createdAt: string;
}

export function ClientPortal({
  user,
  onLogout,
}: {
  user: { id: number; name: string };
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<"catalogo" | "pedidos">("catalogo");
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [notes, setNotes] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [proof, setProof] = useState<Proof | null>(null);
  const [proofLoading, setProofLoading] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      const p = await api<Product[]>("/api/products");
      setProducts(p.filter((x) => x.active));
    } catch {
      toast.error("Error cargando el catálogo");
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const o = await api<Order[]>("/api/orders");
      setOrders(o);
    } catch {
      toast.error("Error cargando sus pedidos");
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { if (tab === "pedidos") loadOrders(); }, [tab, loadOrders]);

  const cartItems = Object.entries(cart)
    .map(([id, qty]) => ({ product: products.find((p) => p.id === Number(id))!, qty }))
    .filter((x) => x.product && x.qty > 0);
  const cartTotal = cartItems.reduce((s, i) => s + i.product.price * i.qty, 0);
  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0);

  function setQty(productId: number, qty: number) {
    setCart((prev) => {
      const next = { ...prev };
      const p = products.find((x) => x.id === productId);
      if (qty <= 0) delete next[productId];
      else next[productId] = Math.min(qty, p?.stock || 99);
      return next;
    });
  }

  async function placeOrder() {
    if (cartItems.length === 0) return;
    setPlacing(true);
    try {
      await api("/api/orders", {
        method: "POST",
        body: {
          items: cartItems.map((i) => ({ productId: i.product.id, quantity: i.qty })),
          notes: notes || undefined,
        },
      });
      toast.success("¡Pedido enviado! Nuestro personal lo confirmará en breve.");
      setCart({});
      setNotes("");
      setCartOpen(false);
      setTab("pedidos");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error enviando el pedido");
    } finally {
      setPlacing(false);
    }
  }

  async function viewProof(stopId: number) {
    setProofLoading(true);
    setProof(null);
    try {
      const p = await api<Proof>(`/api/stops/${stopId}/proof`);
      setProof(p);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Comprobante no disponible");
    } finally {
      setProofLoading(false);
    }
  }

  async function logout() {
    try { await api("/api/auth/logout", { method: "POST" }); } catch { /* noop */ }
    clearToken();
    onLogout();
  }

  const activeOrders = orders.filter((o) => !["ENTREGADO", "CANCELADO"].includes(o.status)).length;

  return (
    <div className="min-h-screen bg-teal-50/50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-teal-700 to-cyan-800 text-white shadow-lg">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <div className="p-2 bg-white/15 rounded-xl backdrop-blur">
            <Droplets className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold">AquaGestión · Clientes</h1>
            <p className="text-xs text-teal-100 truncate">Hola, {user.name} 👋</p>
          </div>
          <NotificationBell dark />
          <Button size="icon" variant="ghost" className="text-white hover:bg-teal-600" onClick={logout} title="Salir">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 pb-24 max-w-md w-full mx-auto p-4 space-y-3">
        {/* ---------- CATÁLOGO ---------- */}
        {tab === "catalogo" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <ShoppingBasket className="h-4.5 w-4.5 text-teal-700" /> Catálogo de agua
              </h2>
              <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={loadProducts}>
                <RefreshCw className="h-3.5 w-3.5" /> Actualizar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              Elija los botellones y cantidades. Su pedido llega directo al despachador.
            </p>

            {products.map((p) => {
              const qty = cart[p.id] || 0;
              return (
                <Card key={p.id} className="overflow-hidden">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="h-14 w-14 shrink-0 rounded-xl bg-gradient-to-br from-cyan-100 to-teal-100 flex items-center justify-center">
                      <span className="text-lg font-bold text-teal-700">{p.sizeLiters}<span className="text-[10px]">L</span></span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-sm text-teal-700 font-bold">{money(p.price)}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {p.stock > 0 ? `Disponible: ${p.stock} uds.` : "Agotado temporalmente"}
                      </div>
                    </div>
                    {qty === 0 ? (
                      <Button size="sm" variant="outline" className="gap-1 h-9 shrink-0" disabled={p.stock === 0}
                        onClick={() => setQty(p.id, 1)}>
                        <Plus className="h-3.5 w-3.5" /> Agregar
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQty(p.id, qty - 1)}>
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <span className="w-7 text-center font-bold tabular-nums">{qty}</span>
                        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQty(p.id, qty + 1)}>
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </>
        )}

        {/* ---------- MIS PEDIDOS ---------- */}
        {tab === "pedidos" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <ClipboardList className="h-4.5 w-4.5 text-teal-700" /> Mis pedidos
              </h2>
              <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={loadOrders}>
                <RefreshCw className="h-3.5 w-3.5" /> Actualizar
              </Button>
            </div>

            {ordersLoading && (
              <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-teal-600" /></div>
            )}

            {!ordersLoading && orders.map((o) => {
              const deliveredStop = o.routeStops.find((s) => s.status === "ENTREGADO");
              return (
                <Card key={o.id}>
                  <CardContent className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold">Pedido #{o.id}</div>
                        <div className="text-xs text-muted-foreground">{fmtDay(o.createdAt)}</div>
                      </div>
                      <Badge variant="outline" className={STATUS_COLORS[o.status] || ""}>
                        {STATUS_LABELS[o.status] || o.status}
                      </Badge>
                    </div>

                    <div className="space-y-1">
                      {o.items.map((it, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <Package2 className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                          <span className="flex-1">{it.quantity}× {it.product.name}</span>
                          <span className="tabular-nums text-muted-foreground">{money(it.quantity * it.unitPrice)}</span>
                        </div>
                      ))}
                    </div>

                    {o.notes && (
                      <p className="text-xs bg-teal-50 border border-teal-100 text-teal-900 rounded-lg p-2">
                        Nota: {o.notes}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <span className="font-bold text-teal-700">Total: {money(o.total)}</span>
                      {deliveredStop && (
                        <Button size="sm" variant="outline" className="gap-1 h-8 text-teal-700"
                          onClick={() => viewProof(deliveredStop.id)}>
                          <Camera className="h-3.5 w-3.5" /> Ver comprobante
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {!ordersLoading && orders.length === 0 && (
              <Card className="p-10 text-center">
                <ClipboardList className="h-10 w-10 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground mt-3">
                  Aún no ha realizado pedidos. ¡Visite el catálogo!
                </p>
              </Card>
            )}
          </>
        )}
      </main>

      {/* Barra de carrito flotante */}
      {tab === "catalogo" && cartCount > 0 && (
        <div className="fixed bottom-16 inset-x-0 z-30 px-4">
          <div className="max-w-md mx-auto">
            <Button className="w-full h-12 justify-between shadow-xl bg-teal-700 hover:bg-teal-800" onClick={() => setCartOpen(true)}>
              <span className="flex items-center gap-2">
                <span className="relative">
                  <ShoppingCart className="h-5 w-5" />
                  <span className="absolute -top-2 -right-2 h-4 min-w-4 px-0.5 rounded-full bg-amber-400 text-teal-900 text-[10px] font-bold flex items-center justify-center">
                    {cartCount}
                  </span>
                </span>
                Ver mi pedido
              </span>
              <span className="font-bold tabular-nums">{money(cartTotal)}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Navegación inferior estilo app */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t">
        <div className="max-w-md mx-auto grid grid-cols-2">
          <button
            onClick={() => setTab("catalogo")}
            className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition ${tab === "catalogo" ? "text-teal-700" : "text-muted-foreground"}`}
          >
            <ShoppingBasket className="h-5 w-5" /> Catálogo
          </button>
          <button
            onClick={() => setTab("pedidos")}
            className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium relative transition ${tab === "pedidos" ? "text-teal-700" : "text-muted-foreground"}`}
          >
            <ClipboardList className="h-5 w-5" /> Mis pedidos
            {activeOrders > 0 && (
              <span className="absolute top-1.5 right-1/2 translate-x-6 h-4 min-w-4 px-0.5 rounded-full bg-amber-400 text-teal-900 text-[10px] font-bold flex items-center justify-center">
                {activeOrders}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Diálogo: confirmar pedido */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar mi pedido</DialogTitle>
            <DialogDescription>Revise los productos antes de enviarlo al despachador</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {cartItems.map((i) => (
              <div key={i.product.id} className="flex items-center gap-2 text-sm border rounded-lg p-2.5">
                <PackageCheck className="h-4 w-4 text-teal-600 shrink-0" />
                <span className="flex-1">{i.qty}× {i.product.name}</span>
                <span className="tabular-nums font-medium">{money(i.product.price * i.qty)}</span>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground" onClick={() => setQty(i.product.id, 0)}>
                  <Minus className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <div className="flex justify-between font-bold text-teal-700 px-1 pt-1">
              <span>Total</span><span className="tabular-nums">{money(cartTotal)}</span>
            </div>
            <div className="space-y-1.5 pt-2">
              <Label htmlFor="order-notes" className="text-xs">Nota para el chofer (opcional)</Label>
              <Textarea id="order-notes" rows={2} placeholder="Ej: dejar en recepción, llamar al llegar…"
                value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCartOpen(false)} disabled={placing}>Seguir comprando</Button>
            <Button className="bg-teal-700 hover:bg-teal-800 gap-1.5" onClick={placeOrder} disabled={placing || cartItems.length === 0}>
              {placing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
              {placing ? "Enviando…" : "Enviar pedido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: comprobante de entrega */}
      <Dialog open={!!proof || proofLoading} onOpenChange={(o) => !o && setProof(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-teal-600" /> Comprobante de su entrega
            </DialogTitle>
            <DialogDescription>Fotografía registrada por el chofer al entregar su pedido</DialogDescription>
          </DialogHeader>
          {proof ? (
            <div className="space-y-3">
              { }
              <img src={proof.photoData} alt="Comprobante de entrega" className="w-full rounded-xl border" />
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-muted p-2.5">
                  <p className="text-muted-foreground">Fecha</p>
                  <p className="font-medium">{fmtDay(proof.createdAt)}</p>
                </div>
                <div className="rounded-lg bg-muted p-2.5 flex items-start gap-1.5">
                  <MapPin className="h-3.5 w-3.5 mt-0.5 text-teal-600" />
                  <div>
                    <p className="text-muted-foreground">GPS de entrega</p>
                    <p className="font-medium tabular-nums">{proof.lat.toFixed(4)}, {proof.lng.toFixed(4)}</p>
                  </div>
                </div>
              </div>
              {proof.note && <p className="text-xs bg-teal-50 border border-teal-100 text-teal-900 rounded-lg p-2.5">Nota: {proof.note}</p>}
            </div>
          ) : (
            <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-teal-600" /></div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
