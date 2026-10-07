"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, ShieldCheck, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, fmtDate } from "@/components/shared/api";
import { toast } from "sonner";

interface Role { id: number; name: string; description: string | null; permissions: string; _count?: { users: number } }
interface User {
  id: number; name: string; email: string; phone: string | null; active: boolean;
  lastLoginAt: string | null; roleId: number; role: { id: number; name: string };
}

export function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", roleId: "" });

  const load = useCallback(async () => {
    try {
      const [u, r] = await Promise.all([api<User[]>("/api/users"), api<Role[]>("/api/roles")]);
      setUsers(u);
      setRoles(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error cargando usuarios");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", email: "", phone: "", password: "", roleId: "" });
    setDialogOpen(true);
  }

  function openEdit(u: User) {
    setEditing(u);
    setForm({ name: u.name, email: u.email, phone: u.phone || "", password: "", roleId: String(u.roleId) });
    setDialogOpen(true);
  }

  async function save() {
    try {
      const body: Record<string, unknown> = {
        name: form.name, phone: form.phone, roleId: Number(form.roleId),
      };
      if (editing) {
        if (form.password) body.password = form.password;
        await api(`/api/users/${editing.id}`, { method: "PUT", body });
        toast.success("Usuario actualizado");
      } else {
        body.email = form.email;
        body.password = form.password;
        await api("/api/users", { method: "POST", body });
        toast.success("Usuario creado");
      }
      setDialogOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error guardando usuario");
    }
  }

  async function toggleActive(u: User) {
    try {
      await api(`/api/users/${u.id}`, { method: "PUT", body: { active: !u.active } });
      toast.success(`${u.name} ${u.active ? "desactivado" : "activado"}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error actualizando usuario");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-teal-600" /> Usuarios
        </h2>
        <p className="text-sm text-muted-foreground">
          Cuentas de acceso al sistema: alta, edición, rol asignado y estado.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Usuarios del sistema</CardTitle>
            <CardDescription>Control de acceso con roles y permisología por usuario</CardDescription>
          </div>
          <Button onClick={openCreate} className="gap-1.5"><Plus className="h-4 w-4" /> Nuevo usuario</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Último acceso</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                    {u.phone && <div className="text-xs text-muted-foreground">{u.phone}</div>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-teal-50 text-teal-800 border-teal-200">
                      <ShieldCheck className="h-3 w-3 mr-1" /> {u.role.name}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {u.lastLoginAt ? fmtDate(u.lastLoginAt) : "Nunca"}
                  </TableCell>
                  <TableCell>
                    <Switch checked={u.active} onCheckedChange={() => toggleActive(u)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => openEdit(u)}>Editar</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Diálogo usuario */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
            <DialogDescription>
              {editing ? "Modifique los datos del usuario" : "Cree una cuenta con su rol correspondiente"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-1">
            <div className="space-y-2">
              <Label>Nombre completo</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            {!editing && (
              <div className="space-y-2">
                <Label>Correo electrónico</Label>
                <Input type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select value={form.roleId} onValueChange={(v) => setForm({ ...form, roleId: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{editing ? "Nueva contraseña (opcional)" : "Contraseña"}</Label>
              <Input type="password" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!form.name || !form.roleId || (!editing && (!form.email || form.password.length < 6))}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
