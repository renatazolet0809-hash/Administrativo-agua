// Catálogo de permisos del sistema y roles por defecto

export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard.view",
  PRODUCTS_VIEW: "products.view",
  PRODUCTS_MANAGE: "products.manage",
  INVENTORY_MANAGE: "inventory.manage",
  CUSTOMERS_VIEW: "customers.view",
  CUSTOMERS_MANAGE: "customers.manage",
  ORDERS_VIEW: "orders.view",
  ORDERS_MANAGE: "orders.manage",
  ORDERS_CREATE: "orders.create",
  ROUTES_VIEW: "routes.view",
  ROUTES_MANAGE: "routes.manage",
  TRACKING_VIEW: "tracking.view",
  TRACKING_SEND: "tracking.send",
  DELIVERY_EXECUTE: "delivery.execute",
  USERS_MANAGE: "users.manage",
  ROLES_MANAGE: "roles.manage",
  REPORTS_VIEW: "reports.view",
  SETTINGS_MANAGE: "settings.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

export const PERMISSION_LABELS: Record<Permission, string> = {
  "dashboard.view": "Ver dashboard",
  "products.view": "Ver catálogo de productos",
  "products.manage": "Gestionar productos",
  "inventory.manage": "Gestionar inventario",
  "customers.view": "Ver clientes",
  "customers.manage": "Gestionar clientes",
  "orders.view": "Ver pedidos",
  "orders.manage": "Gestionar pedidos",
  "orders.create": "Crear pedidos (portal cliente)",
  "routes.view": "Ver rutas de despacho",
  "routes.manage": "Gestionar rutas de despacho",
  "tracking.view": "Ver seguimiento GPS",
  "tracking.send": "Enviar posición GPS",
  "delivery.execute": "Ejecutar entregas",
  "users.manage": "Gestionar usuarios",
  "roles.manage": "Gestionar roles y permisos",
  "reports.view": "Ver reportes",
  "settings.manage": "Gestionar configuración del sistema",
};

export const ROLE_PRESETS: Record<string, Permission[]> = {
  ADMIN: ALL_PERMISSIONS,
  SUPERVISOR: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.PRODUCTS_MANAGE,
    PERMISSIONS.INVENTORY_MANAGE,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_MANAGE,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_MANAGE,
    PERMISSIONS.ROUTES_VIEW,
    PERMISSIONS.ROUTES_MANAGE,
    PERMISSIONS.TRACKING_VIEW,
    PERMISSIONS.REPORTS_VIEW,
  ],
  BODEGA: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.INVENTORY_MANAGE,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ROUTES_VIEW,
  ],
  CHOFER: [
    PERMISSIONS.ROUTES_VIEW,
    PERMISSIONS.TRACKING_SEND,
    PERMISSIONS.DELIVERY_EXECUTE,
  ],
  CLIENTE: [
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_CREATE,
  ],
};

export function parsePermissions(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
