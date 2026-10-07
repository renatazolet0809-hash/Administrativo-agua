"use client";

import { useEffect, useState, useCallback } from "react";
import { KeyRound, ShieldCheck, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { api } from "@/components/shared/api";
import { PERMISSIONS, PERMISSION_LABELS } from "@/lib/permissions";
import { toast } from "sonner";

interface Role { id: number; name: string; description: string | null; permissions: string; _count?: { users: number } }

export function Roles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [rolePerms, setRolePerms] = useState<string[]>([]);
  const [savingRole, setSavingRole] = useState(false);

  const load = useCallback(async () => {
    try {
      setRoles(await api<Role[]>("/api/roles"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error cargando roles");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-teal-600" /> Roles y Permisos
        </h2>
        <p className="text-sm text-muted-foreground">
          Defina qué secciones y acciones puede realizar cada rol del sistema.
        </p>
      </div>

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
    </div>
  );
}
