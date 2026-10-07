"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Package, History, ArrowDownCircle, ArrowUpCircle, Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, money, fmtDate } from "@/components/shared/api";
import { toast } from "sonner";

interface Product {
  id: number; code: string; name: string; sizeLiters: number; price: number;
  cost: number; stock: number; minStock: number; active: boolean;
}

interface Movement {
  id: number; type: string; quantity: number; reason: string | null;
  createdAt: string; product: { name: string; sizeLiters: number };
  user: { name: string };
}

export function Products({ canManage, canInventory }: { canManage: boolean; canInventory: boolean }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [movDialogOpen, setMovDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [movProduct, setMovProduct] = useState<Product | null>(null);

  const [form, setForm] = useState({ name: "", sizeLiters: "5", price: "", stock: "0", minStock: "10" });
  const [movForm, setMovForm] = useState({ type: "ENTRADA", quantity: "", reason: "" });

  const load = useCallback(async () => {
    try {
      const [p, m] = await Promise.all([
        api<Product[]>("/api/products"),
        canInventory ? api<Movement[]>("/api/inventory") : Promise.resolve([]),
      ]);
      setProducts(p);
      setMovements(m);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error cargando datos");
    }
  }, [canInventory]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", sizeLiters: "5", price: "", stock: "0", minStock: "10" });
    setDialogOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({ name: p.name, sizeLiters: String(p.sizeLiters), price: String(p.price), stock: String(p.stock), minStock: String(p.minStock) });
    setDialogOpen(true);
  }

  async function save() {
    try {
      const body = {
        name: form.name,
        sizeLiters: Number(form.sizeLiters),
        price: Number(form.price),
        stock: Number(form.stock),
        minStock: Number(form.minStock),
      };
      if (editing) {
        await api(`/api/products/${editing.id}`, { method: "PUT", body });
        toast.success("Producto actualizado");
      } else {
        await api("/api/products", { method: "POST", body });
        toast.success("Producto creado");
      }
      setDialogOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error guardando");
    }
  }

  async function saveMovement() {
    if (!movProduct) return;
    try {
      await api("/api/inventory", {
        method: "POST",
        body: {
          productId: movProduct.id,
          type: movForm.type,
          quantity: Number(movForm.quantity),
          reason: movForm.reason,
        },
      });
      toast.success("Movimiento registrado");
      setMovDialogOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error registrando movimiento");
    }
  }

  return (
    <Tabs defaultValue="catalogo">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <TabsList>
          <TabsTrigger value="catalogo" className="gap-1.5"><Package className="h-4 w-4" /> Catálogo</TabsTrigger>
          {canInventory && <TabsTrigger value="movimientos" className="gap-1.5"><History className="h-4 w-4" /> Movimientos</TabsTrigger>}
        </TabsList>
        {canManage && <Button onClick={openCreate} className="gap-1.5"><Plus className="h-4 w-4" /> Nuevo producto</Button>}
      </div>

      <TabsContent value="catalogo" className="mt-4">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Formato</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Mínimo</TableHead>
                  <TableHead>Estado</TableHead>
                  {canManage && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}<div className="text-xs text-muted-foreground">{p.code}</div></TableCell>
                    <TableCell>{p.sizeLiters} L</TableCell>
                    <TableCell className="tabular-nums">{money(p.price)}</TableCell>
                    <TableCell className="tabular-nums">
                      {p.stock <= p.minStock ? (
                        <Badge variant="destructive">{p.stock} und</Badge>
                      ) : (
                        `${p.stock} und`
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{p.minStock}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={p.active ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-gray-100 text-gray-600"}>
                        {p.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right space-x-2">
                        {canInventory && (
                          <>
                            <Button size="sm" variant="outline" className="h-8 gap-1"
                              onClick={() => { setMovProduct(p); setMovForm({ type: "ENTRADA", quantity: "", reason: "" }); setMovDialogOpen(true); }}>
                              <ArrowDownCircle className="h-3.5 w-3.5 text-emerald-600" /> Entrada
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 gap-1"
                              onClick={() => { setMovProduct(p); setMovForm({ type: "SALIDA", quantity: "", reason: "" }); setMovDialogOpen(true); }}>
                              <ArrowUpCircle className="h-3.5 w-3.5 text-amber-600" /> Salida
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => openEdit(p)}>Editar</Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {products.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin productos registrados</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {canInventory && (
        <TabsContent value="movimientos" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" /> Historial de movimientos (últimos 100)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Usuario</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-xs">{fmtDate(m.createdAt)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            m.type === "ENTRADA" ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                            : m.type === "SALIDA" ? "bg-amber-100 text-amber-800 border-amber-200"
                            : "bg-sky-100 text-sky-800 border-sky-200"}>
                            {m.type}
                          </Badge>
                        </TableCell>
                        <TableCell>{m.product.name}</TableCell>
                        <TableCell className="tabular-nums">{m.quantity} und</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{m.reason || "—"}</TableCell>
                        <TableCell className="text-xs">{m.user.name}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      )}

      {/* Diálogo producto */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar producto" : "Nuevo producto"}</DialogTitle>
            <DialogDescription>
              {editing ? "Modifique los datos del botellón" : "Registre un nuevo formato de botellón"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Botellón 20L" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Capacidad (litros)</Label>
                <Input type="number" min="1" value={form.sizeLiters} disabled={!!editing}
                  onChange={(e) => setForm({ ...form, sizeLiters: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Precio de venta ($)</Label>
                <Input type="number" step="0.01" min="0" value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Stock inicial</Label>
                <Input type="number" min="0" value={form.stock} disabled={!!editing}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Stock mínimo</Label>
                <Input type="number" min="0" value={form.minStock}
                  onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!form.name || !form.price}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo movimiento */}
      <Dialog open={movDialogOpen} onOpenChange={setMovDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Scale className="h-5 w-5 text-teal-600" /> Movimiento de inventario</DialogTitle>
            <DialogDescription>{movProduct?.name} — stock actual: {movProduct?.stock} und</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Tipo de movimiento</Label>
              <Select value={movForm.type} onValueChange={(v) => setMovForm({ ...movForm, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENTRADA">Entrada (ingreso al almacén)</SelectItem>
                  <SelectItem value="SALIDA">Salida (merma / consumo interno)</SelectItem>
                  <SelectItem value="AJUSTE">Ajuste (fijar stock exacto)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cantidad</Label>
              <Input type="number" min="1" value={movForm.quantity}
                onChange={(e) => setMovForm({ ...movForm, quantity: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Motivo (opcional)</Label>
              <Input value={movForm.reason} onChange={(e) => setMovForm({ ...movForm, reason: e.target.value })}
                placeholder="Compra proveedor, botellón roto..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveMovement} disabled={!movForm.quantity}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
