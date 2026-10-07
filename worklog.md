# Worklog

---
Task ID: 1
Agent: Super Z (main agent)
Task: Sistema web y app para control y despacho de agua embotellada (5L-20L) con backend separado, seguimiento GPS, sesiones y roles/permisos

Work Log:
- Inicializado entorno fullstack (Next.js 16 + TypeScript + Tailwind 4 + shadcn/ui + Prisma/SQLite)
- Instaladas librerías leaflet, react-leaflet, @types/leaflet para mapas
- Definido esquema Prisma completo: Role, User, Product, InventoryMovement, Customer, Order, OrderItem, Vehicle, DeliveryRoute, RouteStop, Dispatch, TrackingPoint
- Creada lib de autenticación propia (src/lib/auth.ts): hash scrypt, tokens HMAC firmados (12h), sesión por cookie HttpOnly + Bearer token para app, helpers requireAuth/requirePermission
- Creado catálogo de permisos RBAC (src/lib/permissions.ts): 16 permisos, presets ADMIN/SUPERVISOR/BODEGA/CHOFER
- Endpoints API REST (backend único consumido por web y app):
  - /api/auth/login|logout|me
  - /api/users, /api/users/[id], /api/roles (RBAC)
  - /api/products, /api/products/[id], /api/inventory (movimientos ENTRADA/SALIDA/AJUSTE)
  - /api/customers, /api/customers/[id]
  - /api/orders, /api/orders/[id]
  - /api/routes, /api/routes/[id] (START descarga inventario en transacción, COMPLETE, STOP_STATUS)
  - /api/tracking (POST posición GPS chofer, GET posiciones en vivo), /api/dashboard, /api/vehicles
- Seed con datos demo de Caracas: 5 usuarios, 4 roles, 4 productos (5L/10L/12L/20L), 2 vehículos, 8 clientes geolocalizados, pedidos, 2 rutas (1 EN_CURSO con trail GPS, 1 PLANIFICADA)
- Frontend Web Admin (SPA en /): LoginScreen con acceso rápido demo; AdminPanel con sidebar por permisos; secciones Dashboard (KPIs + recharts), Productos/Inventario, Clientes (mapa con ubicaciones + picker), Pedidos (carrito multi-producto), Rutas de Despacho, Seguimiento GPS (mapa en vivo, auto-refresh 8s), Usuarios y Roles (editor de permisos granular con switches)
- App Chofer (vista móvil, componente separado): lista de rutas, detalle con mapa, GPS real (watchPosition) + modo simulación para demo, envío de posición al backend cada 8-10s, botones En camino/Entregado/No entregado, link a navegación Google Maps
- Verificación end-to-end con Agent Browser: login, dashboard, mapa GPS en vivo, app chofer con simulación, entregas, editor de permisos — todo funcional, sin errores en consola ni dev.log
- Verificación de permisos por API: chofer recibe 403 al intentar crear producto
- Verificación de transacción de inicio de ruta: descuento de stock exacto (20L: -18, 10L: -4, 5L: -6) y reversión posterior

Stage Summary:
- Sistema completo funcionando en puerto 3000 (ruta /)
- Cuentas demo: admin@aqua.com/admin123, supervisor@aqua.com/super123, bodega@aqua.com/bodega123, chofer@aqua.com/chofer123, chofer2@aqua.com/chofer123
- Arquitectura: backend API REST único + 2 frontends (Web Admin escritorio, App Chofer móvil) que consumen los mismos endpoints con Bearer token

---
Task ID: 2
Agent: Super Z (main agent)
Task: Fase 2-4 — Notificaciones push de nuevas rutas, comprobantes fotográficos de entrega, reportes PDF de ventas y portal de clientes con autopedido

Work Log:
- Esquema Prisma ampliado: Notification (RUTA_ASIGNADA/PEDIDO_*), DeliveryProof (foto dataURL + lat/lng + nota, 1:1 con RouteStop), User.customerId para vincular usuario CLIENTE ↔ Customer
- Nueva permission "orders.create" + rol CLIENTE (products.view, orders.view, orders.create); presets y seed actualizados
- src/lib/notify.ts: helpers createNotification / notifyCustomerUsers / notifyStaffAboutNewOrder (punto único de envío; en producción sería FCM)
- Endpoints nuevos: POST /api/auth/register (alta pública de clientes con customer + usuario), GET/PUT /api/notifications (bandeja + marcar leídas), POST/GET /api/stops/[id]/proof (subida de comprobante con validación foto+GPS obligatoria, marca ENTREGADO; consulta por chofer/admin/cliente del pedido), GET /api/reports/sales (agregados por día/producto/cliente/chofer + detalle)
- Endpoints modificados: /api/orders (GET scoped para CLIENTE, POST permite autopedido del cliente y notifica al staff), /api/orders/[id] (notifica al cliente en cada cambio de estado), /api/routes (POST notifica al chofer RUTA_ASIGNADA + aviso a clientes; GET incluye proof), /api/routes/[id] (GET incluye proof)
- Frontend compartido: NotificationBell con polling cada 6s + toasts sonner (simula push FCM), integrado en Admin, App Chofer y Portal Cliente; deep-link: tocar RUTA_ASIGNADA abre la ruta
- DriverApp: modal "Comprobante de entrega" con cámara (input capture), compresión canvas 1024px JPEG 0.62, GPS obligatorio (real o simulación), nota opcional; botón Entregado reemplazado por Entregar
- AdminPanel: sección Reportes de Ventas (presets de período, KPIs, tabs por producto/cliente/chofer/detalle, PDF con jsPDF+autoTable, export CSV) + botón Comprobante en paradas entregadas (foto + GPS + Google Maps)
- ClientPortal nuevo (mobile-first): catálogo con stepper, carrito flotante, nota para el chofer, mis pedidos con estados, ver comprobante fotográfico de entregas
- LoginScreen: tab "Soy cliente nuevo" con registro (nombre, correo, teléfono, dirección, zona con geolocalización aproximada) + acceso rápido cliente@aqua.com
- page.tsx enruta roleName CLIENTE → ClientPortal
- Corregido: seed usaba userId:1 fijo que rompía FK con SQLite autoincrement; ahora usa adminUser.id; reordenadas eliminaciones por FK; ruta COMPLETADA demo con comprobante para el portal del cliente
- Reinicio del dev server requerido para recargar Prisma Client generado
- Verificación: smoke test API 8/8 OK (notificaciones, reportes, scoping de pedidos, comprobante, alta de pedido por cliente, RBAC 403 intacto); Agent Browser: flujo cliente completo (carrito $17.50 + nota → pedido), comprobante con foto+GPS en portal y admin, notificación push al chofer con deep-link a ruta, entrega con foto+GPS simulado confirmada (2/3), PDF y CSV generados sin errores, cero errores de consola, responsive móvil verificado

Stage Summary:
- Sistema completo con las 4 nuevas funcionalidades operativas en puerto 3000
- Cuentas: admin@aqua.com/admin123 · supervisor@aqua.com/super123 · bodega@aqua.com/bodega123 · chofer@aqua.com/chofer123 · chofer2@aqua.com/chofer123 · cliente@aqua.com/cliente123
- Flujo end-to-end demostrado: cliente pide en el portal → staff recibe push → confirma → arma ruta → chofer recibe push → entrega con foto+GPS → cliente ve comprobante

---
Task ID: 3
Agent: Super Z (main agent)
Task: Acceso rápido dinámico por frecuencia de uso + vista de Configuración con tarjetas (Usuarios y Roles separados, nombre/logo del sistema editable)

Work Log:
- Prisma: nuevo modelo Setting (key/value); db push sin pérdida de datos; script no destructivo scripts/apply-settings-update.ts (10 configuraciones por defecto + permiso settings.manage al rol ADMIN; seed.ts actualizado para futuros reseeds)
- Nuevo permiso settings.manage en permissions.ts (ADMIN lo recibe automáticamente)
- API /api/settings: GET público devuelve solo claves públicas (systemName, logo, currency, quickAccessThreshold); GET autenticado devuelve todo; PUT requiere settings.manage con validaciones (sessionHours 1-72, threshold 0-20, logo dataURL ≤400KB, trim de textos)
- Sesión configurable: signToken(userId, ttl) + login lee sessionHours de la BD (token + cookie Max-Age sincronizados); verificado token de 12.0h exactas
- src/lib/settings.ts: definiciones, defaults, validación y helpers server-side
- Frontend compartido: SystemConfigProvider (contexto React, aplica moneda a money() global y document.title) + módulo quick-access.ts (localStorage por navegador: contador de ingresos, contraseña ofuscada base64 opcional, eliminar cuenta)
- LoginScreen reescrito: sin lista demo fija; acceso rápido dinámico (cuentas con count > N, N configurable, orden por último uso), tarjetas con avatar/rol/indicador "directo" o "pide clave", botón X para eliminar, checkbox "Recordar la cuenta en este dispositivo" (default activado), click sin clave → rellena correo y enfoca contraseña
- AdminPanel: menú con grupos Operación/Configuración; vista Configuración = 5 tarjetas (Personalización, Datos de la empresa, Seguridad y sesión, Usuarios, Roles y Permisos) filtradas por permisos; sub-vistas con botón volver
- Users.tsx y Roles.tsx separados en vistas independientes (antes pestañas dentro de una sola)
- Settings.tsx: formularios con guardado inmediato + refresh del contexto (header cambia en vivo); logo con redimensionado canvas 192px y vista previa
- Marca dinámica en: header/footer Admin, LoginScreen (branding), App Chofer, Portal Cliente, PDF de Reportes (título + pie con razón social/RIF/teléfono) y moneda configurable en todos los precios vía money()
- Reinicio de dev server (Prisma client regenerado); servidor lanzado con setsid para persistencia
- Verificación end-to-end: API (GET público/privado, PUT admin OK, 403 supervisor, 400 validaciones), navegador: login→logout×2 → tarjeta aparece; umbral N=3 → tarjeta desaparece; restaurar N=1 → reaparece; X elimina (localStorage []); logo subido por canvas → header/footer/login actualizados; Usuarios y Roles independientes; cero errores de consola

Stage Summary:
- El acceso rápido ya no muestra cuentas demo: aprende por frecuencia de uso en cada navegador (N configurable en Configuración → Seguridad) y cada tarjeta se puede eliminar
- Nueva sección Configuración con tarjetas; Usuarios y Roles son vistas separadas; nombre/logo/moneda/datos de empresa/duración de sesión configurables y aplicados en toda la app (web, app chofer, portal cliente, PDF)
- Valores restaurados a defaults tras las pruebas (AquaGestión, $, N=1, sesión 12h, sin logo)

---
Task ID: 4
Agent: Super Z (main agent)
Task: Diagnóstico de "no puedo iniciar sesión con admin"

Work Log:
- Diagnóstico: servidor activo (HTTP 200), API de login OK vía curl, BD con usuarios activos y settings sanos; reproducción en navegador limpio ingresó sin problemas
- Causa hallada en dev.log: 4 intentos POST /api/auth/login con respuesta 401 → credenciales incorrectas del usuario (probablemente escribía solo "admin" o una clave distinta; el campo type=email bloqueaba el envío si no era un correo válido)
- Solución: login acepta ahora correo completo O nombre de usuario (fallback input@aqua.com para inputs sin "@"); mensaje de error más claro "Usuario o contraseña incorrectos"
- LoginScreen: campo "Correo o usuario" (type=text + inputMode=email + autocomplete=username) con placeholder "admin o admin@aqua.com"
- Verificado: login con "admin"+admin123 OK (API y navegador), correo completo OK, clave incorrecta → 401; cero errores de consola
- Se preserva la personalización del usuario (systemName "Agua Fresquita" que él mismo configuró)

Stage Summary:
- El login admite "admin" o "admin@aqua.com" con clave admin123; las credenciales de todas las cuentas siguen intactas

---
Task ID: 4
Agent: main (Super Z)
Task: Fix login silent failure — no error alert shown on wrong credentials ("no vi ninguna alerta de problema en las credenciales")

Work Log:
- Diagnóstico: layout.tsx montaba el <Toaster /> de shadcn/Radix (@/components/ui/toaster), pero TODA la app usa toast de sonner. El Toaster de sonner nunca estaba montado → ni errores ni éxitos se mostraban (toasts invisibles en toda la app).
- Confirmado además que la API de login funciona bien: acepta usuario corto ("admin" → admin@aqua.com) y devuelve mensajes claros ("Usuario o contraseña incorrectos").
- Fix 1: layout.tsx ahora importa { Toaster } from "@/components/ui/sonner" y lo monta con richColors closeButton position="top-center".
- Fix 2: LoginScreen.tsx — alerta inline roja (role=alert, border-red-200 bg-red-50) dentro del formulario entre el checkbox y el botón; se limpia al escribir; mapeo de error genérico a "No se pudo conectar con el servidor…"; hint "Puede usar su correo completo o solo el usuario (ej. admin)".
- Verificación e2e (agent-browser): contraseña incorrecta → toast "Usuario o contraseña incorrectos" + alerta inline visible (screenshot download/login-error-visible.png); admin/admin123 → entra al panel con toast "Bienvenido, Administrador General". Sin errores de consolta nuevos.
- Nota: usuario cambió systemName a "Agua Fresquita" (config de personalización funcionando en su navegador).
- Limpieza: logout + localStorage.clear() al finalizar.

Stage Summary:
- Causa raíz: Toaster equivocado montado (shadcn en vez de sonner) → toasts nunca visibles.
- El login nunca estuvo roto en el backend; el usuario no veía el feedback.
- Archivos: src/app/layout.tsx, src/components/LoginScreen.tsx. 3 errores TS preexistentes en otros archivos (stops/proof, tracking, ClientPortal) no bloquean dev mode.

---
Task ID: 5
Agent: main (Super Z)
Task: Unificar la vista del portal de clientes al mismo layout web del panel administrativo

Work Log:
- Diagnóstico: ClientPortal estaba diseñado estilo app móvil (max-w-md, header teal, bottom-nav) a diferencia de AdminPanel (header blanco + sidebar + contenido amplio + footer).
- Reescrito ClientPortal.tsx: header blanco sticky idéntico (logo+systemName+"Portal de Clientes", nombre+email usuario, NotificationBell, Avatar iniciales, logout), sidebar w-64 con nav (Catálogo / Mis Pedidos + badge de pedidos activos), caja CLIENTE al pie del sidebar, contenido en grillas responsivas (catálogo md:2 xl:3 cols; pedidos lg:2 cols), botón flotante carrito bottom-right, mismo footer que admin, menú hamburguesa móvil igual que admin.
- Conservada toda la funcionalidad: carrito, confirmar pedido, nota para chofer, ver comprobante fotográfico, notificaciones.
- page.tsx: pasa email al portal cliente; AppState ampliado con email?: string.
- Fix TS preexistente: interfaz Product del portal añade active: boolean.
- Verificación e2e (agent-browser, cliente@aqua.com): login OK, layout idéntico al admin (screenshot cliente-nuevo-layout.png), agregar al carrito OK, botón flotante "Ver mi pedido $2.50" (cliente-carrito.png), pedido #51 enviado con toast éxito, auto-navegación a Mis Pedidos con badge 5 y grilla 2 cols (cliente-pedidos.png). Sin errores de consola.
- Nota: agent-browser click por @ref a veces no dispara el onClick de React (peculiaridad del CLI); verificado con click() JS que la app funciona correctamente.
- Limpieza: logout + localStorage.clear().

Stage Summary:
- La vista cliente ahora usa exactamente el mismo layout web que admin/supervisor: header blanco + sidebar + contenido amplio + footer.
- Archivos: src/components/client/ClientPortal.tsx (reescrito), src/app/page.tsx (email). DriverApp (chofer) sigue estilo móvil a propósito (es una app de campo).
