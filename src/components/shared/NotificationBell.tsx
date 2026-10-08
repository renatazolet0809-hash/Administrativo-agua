"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Bell, BellRing, Truck, ShoppingBag, CheckCheck, PackageCheck, PackageX, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { api, fmtDate } from "@/components/shared/api";
import { toast } from "sonner";

interface Notif {
  id: number;
  type: string;
  title: string;
  body: string;
  data: string;
  read: boolean;
  createdAt: string;
}

const TYPE_ICON: Record<string, typeof Bell> = {
  RUTA_ASIGNADA: Truck,
  PEDIDO_NUEVO: ShoppingBag,
  PEDIDO_CONFIRMADO: BadgeCheck,
  PEDIDO_EN_RUTA: Truck,
  PEDIDO_ENTREGADO: PackageCheck,
  PEDIDO_CANCELADO: PackageX,
};

/**
 * Campana de notificaciones push in-app.
 * En producción con la app React Native, el backend enviaría el push vía FCM;
 * aquí simulamos el push con polling cada 6s + toast emergente.
 */
export function NotificationBell({
  onOpenRoute,
  onOpenOrder,
  dark = false,
}: {
  onOpenRoute?: (routeId: number) => void;
  onOpenOrder?: (orderId: number) => void;
  dark?: boolean;
}) {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const lastSeenId = useRef<number | null>(null);
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    try {
      const r = await api<{ notifications: Notif[]; unread: number }>("/api/notifications");
      setNotifs(r.notifications);
      setUnread(r.unread);

      // Toast emergente para notificaciones nuevas (simula el push del móvil)
      const newest = r.notifications[0];
      if (newest) {
        if (firstLoad.current) {
          lastSeenId.current = newest.id;
        } else if (lastSeenId.current !== null && newest.id > lastSeenId.current) {
          const fresh = r.notifications.filter((n) => n.id > (lastSeenId.current ?? 0));
          for (const n of fresh.slice(0, 3)) {
            toast(n.title, { description: n.body, duration: 6000 });
          }
          lastSeenId.current = newest.id;
        }
      }
      firstLoad.current = false;
    } catch { /* silencioso: reintenta en el próximo ciclo */ }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [load]);

  async function markAll() {
    await api("/api/notifications", { method: "PUT", body: { all: true } }).catch(() => null);
    load();
  }

  async function handleClick(n: Notif) {
    if (!n.read) {
      await api("/api/notifications", { method: "PUT", body: { id: n.id } }).catch(() => null);
      load();
    }
    try {
      const data = JSON.parse(n.data || "{}");
      if (n.type === "RUTA_ASIGNADA" && data.routeId && onOpenRoute) {
        setOpen(false);
        onOpenRoute(data.routeId);
      } else if (onOpenOrder && data.orderId) {
        setOpen(false);
        onOpenOrder(data.orderId);
      }
    } catch { /* data sin JSON válido */ }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className={`relative ${dark ? "text-white hover:bg-white/15" : ""}`}
          title="Notificaciones"
        >
          {unread > 0 ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2.5 border-b">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            Notificaciones
            {unread > 0 && <Badge className="h-5 px-1.5 text-[10px] bg-teal-600">{unread} nuevas</Badge>}
          </p>
          {unread > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={markAll}>
              <CheckCheck className="h-3.5 w-3.5" /> Marcar leídas
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          <div className="p-2 space-y-1">
            {notifs.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-10">
                No hay notificaciones todavía
              </p>
            )}
            {notifs.map((n) => {
              const Icon = TYPE_ICON[n.type] || Bell;
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left flex gap-2.5 rounded-lg p-2.5 transition hover:bg-muted ${!n.read ? "bg-teal-50/70 border border-teal-100" : ""}`}
                >
                  <span className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center ${!n.read ? "bg-teal-600 text-white" : "bg-muted text-muted-foreground"}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">{n.title}</span>
                      {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-teal-600 shrink-0" />}
                    </span>
                    <span className="text-xs text-muted-foreground line-clamp-2 block">{n.body}</span>
                    <span className="text-[10px] text-muted-foreground/70 mt-0.5 block">{fmtDate(n.createdAt)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
