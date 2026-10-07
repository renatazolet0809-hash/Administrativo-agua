"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Droplets, LogOut, ShoppingBasket, ClipboardList, Plus, Minus, ShoppingCart,
  Camera, MapPin, PackageCheck, Loader2, RefreshCw, Package2, Menu, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { api, clearToken, money, fmtDay, STATUS_LABELS, STATUS_COLORS } from "@/components/shared/api";
import { NotificationBell } from "@/components/shared/NotificationBell";
import { useSystemConfig } from "@/components/shared/system-config";
import { toast } from "sonner";

interface Product {
  id: number; name: string; code: string; sizeLiters: number; price: number; stock: number; active: boolean;
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
  user: { id: number; name: string; email?: string };
  onLogout: () => void;
}) {
  const { systemName, logo } = useSystemConfig();
  const [section, setSection] = useState<"catalogo" | "pedidos">("catalogo");
  const [menuOpen, setMenuOpen] = useState(false);
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
  useEffect(() => { if (section === "pedidos") loadOrders(); }, [section, loadOrders]);

  const cartItems = Object.entries(cart)
    .map(([id, qty]) => ({ product: products.find((p) => p.id === Number(id))!, qty }))
    .filter((x) => x.product && x.qty > 0);
  const cartTotal = cartItems.reduce((s, i) => s + i.product.price * i.qty, 0);
  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0);
  const activeOrders = orders.filter((o) => !["ENTREGADO", "CANCELADO"].includes(o.status)).length;

  function openSection(id: "catalogo" | "pedidos") {
    setSection(id);
    setMenuOpen(false);
  }

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
      setSection("pedidos");
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

  const initials = user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const NAV = [
    { id: "catalogo" as const, label: "Catálogo", icon: ShoppingBasket },
    { id: "pedidos" as const, label: "Mis Pedidos", icon: ClipboardList },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header — mismo estilo que el panel administrativo */}
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
              <p className="text-[10px] text-muted-foreground">Portal de Clientes</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium leading-none">{user.name}</p>
              {user.email && <p className="text-xs text-muted-foreground">{user.email}</p>}
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
        {/* Sidebar — mismo estilo que el panel administrativo */}
        <aside className={`${menuOpen ? "block" : "hidden"} lg:block fixed lg:sticky inset-x-0 top-14 bottom-0 lg:top-0 z-30 w-64 shrink-0 border-r bg-white overflow-y-auto`}>
          <nav className="p-3 space-y-1">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => openSection(n.id)}
                className={`w-full flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition
                  ${section === n.id ? "bg-teal-600 text-white shadow-sm" : "text-muted-foreground hover:bg-teal-50 hover:text-teal-800"}`}
              >
                <n.icon className="h-4.5 w-4.5 shrink-0" />
                {n.label}
                {n.id === "pedidos" && activeOrders > 0 && (
                  <span className={`ml-auto h-5 min-w-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center
                    ${section === "pedidos" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"}`}>
                    {activeOrders}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="p-3 border-t mx-0 mt-2">
            <div className="rounded-lg bg-teal-50 p-3 text-xs text-teal-900">
              <p className="font-semibold mb-1 flex items-center gap-1.5">
                <Badge variant="outline" className="bg-white text-[10px] h-5">CLIENTE</Badge>
              </p>
              <p className="text-teal-700 leading-relaxed">
                Haga sus pedidos en línea y consulte el comprobante fotográfico de cada entrega.
              </p>
            </div>
          </div>
        </aside>

        {/* Contenido */}
        <main className="flex-1 p-4 lg:p-6 max-w-[1600px] mx-auto w-full">
          {/* ---------- CATÁLOGO ---------- */}
          {section === "catalogo" && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <ShoppingBasket className="h-5 w-5 text-teal-700" /> Catálogo de agua
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Elija los botellones y cantidades. Su pedido llega directo al despachador.
                  </p>
                </div>
                <Button size="sm" variant="outline" className="gap-1" onClick={loadProducts}>
                  <RefreshCw className="h-3.5 w-3.5" /> Actualizar
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {products.map((p) => {
                  const qty = cart[p.id] || 0;
                  return (
                    <Card key={p.id} className="overflow-hidden">
                      <CardContent className="p-5 flex items-center gap-4">
                        <div className="h-16 w-16 shrink-0 rounded-2xl bg-gradient-to-br from-cyan-100 to-teal-100 flex items-center justify-center">
                          <span className="text-xl font-bold text-teal-700">{p.sizeLiters}<span className="text-xs">L</span></span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold">{p.name}</div>
                          <div className="text-lg text-teal-700 font-bold">{money(p.price)}</div>
                          <div className="text-xs text-muted-foreground">
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
              </div>

              {products.length === 0 && (
                <Card className="p-10 text-center">
                  <ShoppingBasket className="h-10 w-10 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground mt-3">
                    No hay productos disponibles por ahora. Intente actualizar en unos minutos.
                  </p>
                </Card>
              )}
            </div>
          )}

          {/* ---------- MIS PEDIDOS ---------- */}
          {section === "pedidos" && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-teal-700" /> Mis pedidos
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Consulte el estado de cada pedido y el comprobante de sus entregas.
                  </p>
                </div>
                <Button size="sm" variant="outline" className="gap-1" onClick={loadOrders}>
                  <RefreshCw className="h-3.5 w-3.5" /> Actualizar
                </Button>
              </div>

              {ordersLoading && (
                <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-teal-600" /></div>
              )}

              {!ordersLoading && (
                <div className="grid gap-4 lg:grid-cols-2">
                  {orders.map((o) => {
                    const deliveredStop = o.routeStops.find((s) => s.status === "ENTREGADO");
                    return (
                      <Card key={o.id}>
                        <CardContent className="p-5 space-y-3">
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
                </div>
              )}

              {!ordersLoading && orders.length === 0 && (
                <Card className="p-10 text-center">
                  <ClipboardList className="h-10 w-10 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground mt-3">
                    Aún no ha realizado pedidos. ¡Visite el catálogo!
                  </p>
                </Card>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Botón flotante del carrito */}
      {section === "catalogo" && cartCount > 0 && (
        <div className="fixed bottom-6 right-6 z-30">
          <Button className="h-12 px-5 gap-2.5 shadow-xl bg-teal-700 hover:bg-teal-800" onClick={() => setCartOpen(true)}>
            <span className="relative">
              <ShoppingCart className="h-5 w-5" />
              <span className="absolute -top-2 -right-2 h-4 min-w-4 px-0.5 rounded-full bg-amber-400 text-teal-900 text-[10px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            </span>
            Ver mi pedido
            <span className="font-bold tabular-nums border-l border-white/30 pl-2.5">{money(cartTotal)}</span>
          </Button>
        </div>
      )}

      <footer className="border-t py-3 text-center text-xs text-muted-foreground mt-auto">
        {systemName} — Portal de Clientes · Pedidos en línea con seguimiento y comprobante de entrega
      </footer>

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
