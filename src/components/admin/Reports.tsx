"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart3, FileDown, FileSpreadsheet, DollarSign, ShoppingCart, Droplets, Receipt,
  Loader2, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, money, getCurrencySymbol, fmtDay, STATUS_LABELS, STATUS_COLORS } from "@/components/shared/api";
import { useSystemConfig } from "@/components/shared/system-config";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface ReportData {
  period: { from: string; to: string };
  summary: { orders: number; revenue: number; units: number; avgTicket: number };
  statusCounts: Record<string, number>;
  byDay: { date: string; revenue: number; orders: number }[];
  byProduct: { name: string; qty: number; revenue: number }[];
  byCustomer: { name: string; zone: string; orders: number; revenue: number }[];
  byDriver: { name: string; deliveries: number; revenue: number }[];
  orders: {
    id: number; date: string; customer: string; zone: string; items: string;
    units: number; total: number; status: string; driver: string | null;
  }[];
}

const PRESETS = [
  { id: "hoy", label: "Hoy" },
  { id: "7d", label: "Últimos 7 días" },
  { id: "mes", label: "Este mes" },
  { id: "custom", label: "Personalizado" },
] as const;

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function Reports({ canView }: { canView: boolean }) {
  const { systemName, config } = useSystemConfig();
  const [preset, setPreset] = useState<string>("7d");
  const [from, setFrom] = useState(isoDay(new Date(Date.now() - 6 * 24 * 3600 * 1000)));
  const [to, setTo] = useState(isoDay(new Date()));
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (f: string, t: string) => {
    setLoading(true);
    try {
      const r = await api<ReportData>(`/api/reports/sales?from=${f}&to=${t}`);
      setData(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error cargando reporte");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(from, to); }, []);  

  function changePreset(p: string) {
    setPreset(p);
    if (p === "hoy") {
      const today = isoDay(new Date());
      setFrom(today); setTo(today);
      load(today, today);
    } else if (p === "7d") {
      const f = isoDay(new Date(Date.now() - 6 * 24 * 3600 * 1000));
      const t = isoDay(new Date());
      setFrom(f); setTo(t);
      load(f, t);
    } else if (p === "mes") {
      const now = new Date();
      const f = isoDay(new Date(now.getFullYear(), now.getMonth(), 1));
      const t = isoDay(now);
      setFrom(f); setTo(t);
      load(f, t);
    }
  }

  function downloadPDF() {
    if (!data) return;
    const doc = new jsPDF();
    const width = doc.internal.pageSize.getWidth();
    const companyLine = [
      config.companyName, config.companyRif, config.companyPhone,
    ].filter(Boolean).join(" · ");

    // Encabezado
    doc.setFillColor(15, 118, 110);
    doc.rect(0, 0, width, 30, "F");
    doc.setTextColor(255);
    doc.setFontSize(18);
    doc.text(`${systemName} — Reporte de Ventas`, 14, 13);
    doc.setFontSize(10);
    doc.text(`Período: ${fmtDay(data.period.from)} — ${fmtDay(data.period.to)}`, 14, 20);
    doc.text(`Generado: ${new Date().toLocaleString("es-VE")}`, 14, 26);

    // Resumen
    doc.setTextColor(30);
    doc.setFontSize(12);
    doc.text("Resumen general", 14, 40);
    autoTable(doc, {
      startY: 44,
      head: [["Pedidos", "Ingresos", "Unidades vendidas", "Ticket promedio"]],
      body: [[
        String(data.summary.orders),
        `$${data.summary.revenue.toFixed(2)}`,
        String(data.summary.units),
        `$${data.summary.avgTicket.toFixed(2)}`,
      ]],
      theme: "grid",
      headStyles: { fillColor: [15, 118, 110] },
    });

    // Ventas por producto
    doc.setFontSize(12);
    doc.text("Ventas por producto", 14, (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10);
    autoTable(doc, {
      startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14,
      head: [["Producto", "Unidades", "Ingresos"]],
      body: data.byProduct.map((p) => [p.name, String(p.qty), `$${p.revenue.toFixed(2)}`]),
      theme: "striped",
      headStyles: { fillColor: [15, 118, 110] },
    });

    // Ventas por cliente (top 15)
    doc.setFontSize(12);
    doc.text("Ventas por cliente (top 15)", 14, (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10);
    autoTable(doc, {
      startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14,
      head: [["Cliente", "Zona", "Pedidos", "Ingresos"]],
      body: data.byCustomer.slice(0, 15).map((c) => [c.name, c.zone, String(c.orders), `$${c.revenue.toFixed(2)}`]),
      theme: "striped",
      headStyles: { fillColor: [15, 118, 110] },
    });

    // Ventas por chofer
    if (data.byDriver.length > 0) {
      doc.addPage();
      doc.setFontSize(12);
      doc.text("Ventas por chofer / ruta", 14, 20);
      autoTable(doc, {
        startY: 24,
        head: [["Chofer", "Entregas", "Ingresos"]],
        body: data.byDriver.map((d) => [d.name, String(d.deliveries), `$${d.revenue.toFixed(2)}`]),
        theme: "striped",
        headStyles: { fillColor: [15, 118, 110] },
      });
    }

    // Detalle de pedidos (primeros 40)
    doc.setFontSize(12);
    doc.text("Detalle de pedidos", 14, (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10);
    autoTable(doc, {
      startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14,
      head: [["#", "Fecha", "Cliente", "Productos", "Total", "Estado"]],
      body: data.orders.slice(0, 40).map((o) => [
        String(o.id), fmtDay(o.date), o.customer, o.items,
        getCurrencySymbol() + o.total.toFixed(2), STATUS_LABELS[o.status] || o.status,
      ]),
      theme: "grid",
      headStyles: { fillColor: [15, 118, 110] },
      styles: { fontSize: 8 },
      didDrawPage: () => {
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(
          companyLine || `${systemName} · Sistema de control y despacho de agua embotellada`,
          14, doc.internal.pageSize.getHeight() - 8
        );
      },
    });
    if (data.orders.length > 40) {
      const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`(+${data.orders.length - 40} pedidos adicionales no mostrados en el PDF)`, 14, y);
    }

    doc.save(`reporte-ventas-${from}_${to}.pdf`);
    toast.success("Reporte PDF descargado");
  }

  function downloadCSV() {
    if (!data) return;
    const rows = [
      ["#", "Fecha", "Cliente", "Zona", "Productos", "Unidades", "Total", "Estado", "Chofer"],
      ...data.orders.map((o) => [
        o.id, new Date(o.date).toLocaleString("es-VE"), o.customer, o.zone,
        `"${o.items}"`, o.units, o.total.toFixed(2), o.status, o.driver || "",
      ]),
    ];
    const csv = rows.map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ventas-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  }

  if (!canView) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        No tiene permisos para ver reportes
      </CardContent></Card>
    );
  }

  const kpis = [
    { label: "Ingresos del período", value: data ? money(data.summary.revenue) : "—", icon: DollarSign, color: "text-emerald-600 bg-emerald-50" },
    { label: "Pedidos facturados", value: data ? String(data.summary.orders) : "—", icon: ShoppingCart, color: "text-teal-600 bg-teal-50" },
    { label: "Unidades vendidas", value: data ? String(data.summary.units) : "—", icon: Droplets, color: "text-cyan-600 bg-cyan-50" },
    { label: "Ticket promedio", value: data ? money(data.summary.avgTicket) : "—", icon: Receipt, color: "text-amber-600 bg-amber-50" },
  ];

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Período</Label>
            <Select value={preset} onValueChange={changePreset}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Desde</Label>
            <Input type="date" value={from} className="w-40"
              onChange={(e) => { setFrom(e.target.value); setPreset("custom"); }} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Hasta</Label>
            <Input type="date" value={to} className="w-40"
              onChange={(e) => { setTo(e.target.value); setPreset("custom"); }} />
          </div>
          <Button variant="outline" className="gap-1.5" onClick={() => load(from, to)} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Actualizar
          </Button>
          <div className="flex-1" />
          <Button className="gap-1.5 bg-teal-600 hover:bg-teal-700" onClick={downloadPDF} disabled={!data || loading}>
            <FileDown className="h-4 w-4" /> Descargar PDF
          </Button>
          <Button variant="outline" className="gap-1.5" onClick={downloadCSV} disabled={!data || loading}>
            <FileSpreadsheet className="h-4 w-4" /> CSV
          </Button>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="pt-4 flex items-center gap-3">
              <span className={`h-10 w-10 rounded-lg flex items-center justify-center ${k.color}`}>
                <k.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{k.label}</p>
                <p className="text-lg font-bold tabular-nums">{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Estados */}
      {data && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(data.statusCounts).map(([st, count]) => (
            <Badge key={st} variant="outline" className={STATUS_COLORS[st] || ""}>
              {STATUS_LABELS[st] || st}: {count}
            </Badge>
          ))}
        </div>
      )}

      {/* Tablas agregadas */}
      {data && (
        <Tabs defaultValue="productos">
          <TabsList>
            <TabsTrigger value="productos">Por producto</TabsTrigger>
            <TabsTrigger value="clientes">Por cliente</TabsTrigger>
            <TabsTrigger value="choferes">Por chofer</TabsTrigger>
            <TabsTrigger value="detalle">Detalle de pedidos</TabsTrigger>
          </TabsList>

          <TabsContent value="productos">
            <Card><CardContent className="pt-4">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Producto</TableHead><TableHead className="text-right">Unidades</TableHead>
                  <TableHead className="text-right">Ingresos</TableHead><TableHead className="text-right">%</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {data.byProduct.map((p) => (
                    <TableRow key={p.name}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.qty}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(p.revenue)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {data.summary.revenue ? ((p.revenue / data.summary.revenue) * 100).toFixed(1) : "0"}%
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.byProduct.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Sin ventas en el período</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="clientes">
            <Card><CardContent className="pt-4 max-h-96 overflow-y-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Cliente</TableHead><TableHead>Zona</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead><TableHead className="text-right">Ingresos</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {data.byCustomer.map((c) => (
                    <TableRow key={c.name}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-muted-foreground">{c.zone}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.orders}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(c.revenue)}</TableCell>
                    </TableRow>
                  ))}
                  {data.byCustomer.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Sin ventas en el período</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="choferes">
            <Card><CardContent className="pt-4">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Chofer</TableHead>
                  <TableHead className="text-right">Pedidos despachados</TableHead>
                  <TableHead className="text-right">Ingresos</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {data.byDriver.map((d) => (
                    <TableRow key={d.name}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.deliveries}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(d.revenue)}</TableCell>
                    </TableRow>
                  ))}
                  {data.byDriver.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Sin despachos en el período</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="detalle">
            <Card><CardContent className="pt-4 max-h-96 overflow-y-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>#</TableHead><TableHead>Fecha</TableHead><TableHead>Cliente</TableHead>
                  <TableHead>Productos</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Estado</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {data.orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="tabular-nums">{o.id}</TableCell>
                      <TableCell className="whitespace-nowrap">{fmtDay(o.date)}</TableCell>
                      <TableCell className="font-medium">{o.customer}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-56 truncate">{o.items}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(o.total)}</TableCell>
                      <TableCell><Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[o.status] || ""}`}>{STATUS_LABELS[o.status] || o.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {data.orders.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin pedidos en el período</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      )}

      {!data && !loading && (
        <Card><CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
          <BarChart3 className="h-10 w-10" /> Seleccione un período y actualice para ver el reporte
        </CardContent></Card>
      )}
    </div>
  );
}
