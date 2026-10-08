"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Minus, Trash2, ClipboardList } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, money, fmtDate, STATUS_LABELS, STATUS_COLORS } from "@/components/shared/api";
import { toast } from "sonner";

interface Product { id: number; name: string; sizeLiters: number; price: number; active: boolean; }
interface Customer { id: number; name: string; zone: string; }
interface OrderItem { id: number; product: Product; quantity: number; unitPrice: number; }
interface Order {
  id: number; status: string; total: number; notes: string | null; createdAt: string;
  customer: { id: number; name: string; phone: string; address: string; zone: string };
  items: OrderItem[];
}

export function Orders({ canManage }: { canManage: boolean }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<{ productId: string; quantity: number }[]>([]);

  const load = useCallback(async () => {
    try {
      const [o, p, c] = await Promise.all([
        api<Order[]>("/api/orders"),
        canManage ? api<Product[]>("/api/products") : Promise.resolve([]),
        canManage ? api<Customer[]>("/api/customers") : Promise.resolve([]),
      ]);
      setOrders(o);
      setProducts(p);
      setCustomers(c);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error cargando pedidos");
    }
  }, [canManage]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setCustomerId("");
    setNotes("");
    setItems([{ productId: "", quantity: 1 }]);
    setDialogOpen(true);
  }

  function setItem(idx: number, patch: Partial<{ productId: string; quantity: number }>) {
    setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  const total = items.reduce((s, it) => {
    const p = products.find((p) => String(p.id) === it.productId);
    return s + (p ? p.price * it.quantity : 0);
  }, 0);

  async function createOrder() {
    try {
      await api("/api/orders", {
        method: "POST",
        body: {
          customerId: Number(customerId),
          notes,
          items: items.filter((i) => i.productId).map((i) => ({ productId: Number(i.productId), quantity: i.quantity })),
        },
      });
      toast.success("Pedido registrado");
      setDialogOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error creando pedido");
    }
  }

  async function changeStatus(order: Order, status: string) {
    try {
      await api(`/api/orders/${order.id}`, { method: "PUT", body: { status } });
      toast.success(`Pedido #${order.id} → ${STATUS_LABELS[status]}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error actualizando pedido");
    }
  }

  const availableStatuses = ["PENDIENTE", "CONFIRMADO", "ENTREGADO", "CANCELADO"];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canManage && (
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" /> Nuevo pedido
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Productos</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Estado</TableHead>
                {canManage && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <div className="font-medium flex items-center gap-1.5">
                      <ClipboardList className="h-3.5 w-3.5 text-teal-600" /> #{o.id}
                    </div>
                    <div className="text-xs text-muted-foreground">{fmtDate(o.createdAt)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{o.customer.name}</div>
                    <div className="text-xs text-muted-foreground">{o.customer.zone}</div>
                  </TableCell>
                  <TableCell className="text-xs max-w-56">
                    {o.items.map((it) => `${it.quantity}× ${it.product.name}`).join(", ")}
                    {o.notes && <div className="text-muted-foreground italic mt-0.5">Nota: {o.notes}</div>}
                  </TableCell>
                  <TableCell className="tabular-nums font-medium">{money(o.total)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_COLORS[o.status] || ""}>
                      {STATUS_LABELS[o.status] || o.status}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      {!["ENTREGADO", "CANCELADO"].includes(o.status) && (
                        <Select onValueChange={(v) => changeStatus(o, v)}>
                          <SelectTrigger className="h-8 w-44 text-xs">
                            <SelectValue placeholder="Cambiar estado" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableStatuses
                              .filter((s) => s !== o.status)
                              .map((s) => (
                                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {orders.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin pedidos registrados</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Diálogo nuevo pedido */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar pedido</DialogTitle>
            <DialogDescription>Seleccione el cliente y los botellones solicitados</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-1">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder="Seleccione un cliente" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name} — {c.zone}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Productos</Label>
                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"
                  onClick={() => setItems([...items, { productId: "", quantity: 1 }])}>
                  <Plus className="h-3.5 w-3.5" /> Añadir línea
                </Button>
              </div>
              <div className="space-y-2">
                {items.map((it, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Select value={it.productId} onValueChange={(v) => setItem(idx, { productId: v })}>
                      <SelectTrigger className="flex-1 h-9"><SelectValue placeholder="Producto" /></SelectTrigger>
                      <SelectContent>
                        {products.filter((p) => p.active).map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>{p.name} — {money(p.price)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" className="h-9 w-8"
                        onClick={() => setItem(idx, { quantity: Math.max(1, it.quantity - 1) })}>
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-8 text-center text-sm tabular-nums">{it.quantity}</span>
                      <Button size="icon" variant="outline" className="h-9 w-8"
                        onClick={() => setItem(idx, { quantity: it.quantity + 1 })}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {items.length > 1 && (
                      <Button size="icon" variant="ghost" className="h-9 w-8 text-red-500"
                        onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Instrucciones de entrega..." />
            </div>

            <div className="text-right text-sm">
              Total estimado: <span className="font-bold text-teal-700">{money(total)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={createOrder} disabled={!customerId || total === 0}>Registrar pedido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
