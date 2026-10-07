"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, ShieldCheck, UserPlus, KeyRound, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, fmtDate } from "@/components/shared/api";
import { PERMISSIONS, PERMISSION_LABELS } from "@/lib/permissions";
import { toast } from "sonner";

interface Role { id: number; name: string; description: string | null; permissions: string; _count?: { users: number } }
interface User {
  id: number; name: string; email: string; phone: string | null; active: boolean;
  lastLoginAt: string | null; roleId: number; role: { id: number; name: string };
}

export function Users({ canManageRoles }: { canManageRoles: boolean }) {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", roleId: "" });
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [rolePerms, setRolePerms] = useState<string[]>([]);
  const [savingRole, setSavingRole] = useState(false);

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

  function openRole(r: Role) {
    setEditingRole(r);
    try {
      setRolePerms(JSON.parse(r.permissions));
    } catch {
      setRolePerms([]);
    }
  }

  async function saveRole() {
    if (!editingRole) return;
    setSavingRole(true);
    try {
      await api("/api/roles", {
        method: "PUT",
        body: { id: editingRole.id, permissions: rolePerms, description: editingRole.description },
      });
      toast.success(`Permisos del rol ${editingRole.name} actualizados`);
      setEditingRole(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error guardando permisos");
    } finally {
      setSavingRole(false);
    }
  }

  const groupedPerms = Object.entries(PERMISSIONS).map(([key, value]) => ({
    value,
    label: PERMISSION_LABELS[value],
  }));

  return (
    <Tabs defaultValue="usuarios">
      <TabsList>
        <TabsTrigger value="usuarios" className="gap-1.5"><UserPlus className="h-4 w-4" /> Usuarios</TabsTrigger>
        <TabsTrigger value="roles" className="gap-1.5"><KeyRound className="h-4 w-4" /> Roles y permisos</TabsTrigger>
      </TabsList>

      <TabsContent value="usuarios" className="mt-4">
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
      </TabsContent>

      <TabsContent value="roles" className="mt-4">
        <div className="grid gap-4 md:grid-cols-2">
          {roles.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-teal-600" /> {r.name}
                  </CardTitle>
                  <Badge variant="secondary">{r._count?.users ?? 0} usuarios</Badge>
                </div>
                {r.description && <CardDescription>{r.description}</CardDescription>}
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {JSON.parse(r.permissions || "[]").slice(0, 6).map((p: string) => (
                    <Badge key={p} variant="outline" className="text-[10px] font-normal">
                      {PERMISSION_LABELS[p as keyof typeof PERMISSION_LABELS] || p}
                    </Badge>
                  ))}
                  {JSON.parse(r.permissions || "[]").length > 6 && (
                    <Badge variant="outline" className="text-[10px]">
                      +{JSON.parse(r.permissions).length - 6} más
                    </Badge>
                  )}
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openRole(r)}>
                  <KeyRound className="h-3.5 w-3.5" /> Configurar permisos
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </TabsContent>

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

      {/* Diálogo permisos del rol */}
      <Dialog open={!!editingRole} onOpenChange={(open) => !open && setEditingRole(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-teal-600" />
              Permisos del rol: {editingRole?.name}
            </DialogTitle>
            <DialogDescription>
              Active o desactive cada permiso. Los cambios aplican a todos los usuarios con este rol.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            {groupedPerms.map((p) => (
              <div key={p.value} className="flex items-center justify-between gap-3 border rounded-lg px-3.5 py-2.5">
                <span className="text-sm">{p.label}</span>
                <Switch
                  checked={rolePerms.includes(p.value)}
                  onCheckedChange={(checked) =>
                    setRolePerms(checked ? [...rolePerms, p.value] : rolePerms.filter((x) => x !== p.value))
                  }
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRole(null)}>Cancelar</Button>
            <Button onClick={saveRole} disabled={savingRole} className="gap-1.5">
              <Save className="h-4 w-4" /> {savingRole ? "Guardando..." : "Guardar permisos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
