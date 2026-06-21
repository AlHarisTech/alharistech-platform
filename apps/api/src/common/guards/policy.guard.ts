import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { FastifyRequest } from "fastify";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PolicyUser {
  id: string;
  role: string;
  customerId?: string;
  permissions?: string[];
}

interface PolicyCondition {
  field: string;
  operator: "equals" | "in" | "owns" | "has_role" | "contains" | "regex" | "greater_than" | "less_than";
  value: unknown;
}

interface CompiledPolicy {
  effect: "allow" | "deny";
  roles: Set<string>;
  resources: Set<string>;
  actions: Set<string>;
  conditions: PolicyCondition[];
  priority: number;
}

interface PolicyContext {
  caller: {
    id: string;
    role: string;
    customerId?: string;
    ip: string;
  };
  resource: {
    type: string;
    id?: string;
    params: Record<string, string>;
  };
  action: string;
  now: string;
}

// ---------------------------------------------------------------------------
// Route → Resource Mapping (derived from service-catalog.yaml)
// ---------------------------------------------------------------------------

interface RouteResourceMapping {
  resource: string;
  action: string;
  ownerIdParam?: string;
}

const ROUTE_RESOURCE_MAP = new Map<string, RouteResourceMapping>();

function registerRoute(method: string, path: string, resource: string, action: string, ownerIdParam?: string): void {
  ROUTE_RESOURCE_MAP.set(`${method.toUpperCase()}:${path}`, { resource, action, ownerIdParam });
}

// -- Identity Domain --
registerRoute("POST",   "/auth/register",            "identity:auth",       "create");
registerRoute("POST",   "/auth/verify-email",        "identity:auth",       "verify");
registerRoute("POST",   "/auth/login",               "identity:auth",       "login");
registerRoute("POST",   "/auth/refresh",             "identity:auth",       "refresh");
registerRoute("POST",   "/auth/logout",              "identity:auth",       "revoke");
registerRoute("POST",   "/auth/forgot-password",     "identity:auth",       "forgot_password");
registerRoute("POST",   "/auth/reset-password",      "identity:auth",       "reset_password");
registerRoute("GET",    "/users/me",                 "identity:users",      "read");
registerRoute("PATCH",  "/users/me",                 "identity:users",      "update");
registerRoute("GET",    "/users",                    "identity:users",      "read");
registerRoute("POST",   "/users",                    "identity:users",      "create");
registerRoute("GET",    "/users/:id",                "identity:users",      "read",    "id");
registerRoute("PATCH",  "/users/:id",                "identity:users",      "update",  "id");
registerRoute("DELETE", "/users/:id",                "identity:users",      "delete",  "id");
registerRoute("PATCH",  "/users/:id/role",           "identity:roles",      "update");
registerRoute("POST",   "/users/:id/disable",        "identity:users",      "update",  "id");
registerRoute("POST",   "/users/:id/enable",         "identity:users",      "update",  "id");

// -- Customer Domain --
registerRoute("POST",   "/customers",                "customer:customers",  "create");
registerRoute("GET",    "/customers",                "customer:customers",  "read");
registerRoute("GET",    "/customers/:id",            "customer:customers",  "read",    "id");
registerRoute("PATCH",  "/customers/:id",            "customer:customers",  "update",  "id");
registerRoute("DELETE", "/customers/:id",            "customer:customers",  "delete",  "id");
registerRoute("PATCH",  "/customers/:id/tags",       "customer:customer_tags", "update");
registerRoute("GET",    "/customers/tags",           "customer:customer_tags", "read");
registerRoute("GET",    "/customers/:id/orders",     "customer:customers",  "read",    "id");
registerRoute("GET",    "/customers/:id/communications", "customer:communication_logs", "read");
registerRoute("POST",   "/customers/:id/communications", "customer:communication_logs", "create");
registerRoute("POST",   "/customers/import",         "customer:customer_import", "create");
registerRoute("POST",   "/customers/export",         "customer:customer_export", "create");
registerRoute("POST",   "/customers/merge",          "customer:customer_merge",  "create");

// -- Service Domain --
registerRoute("GET",    "/services",                 "service:services",    "read");
registerRoute("POST",   "/services",                 "service:services",    "create");
registerRoute("GET",    "/services/:id",             "service:services",    "read",    "id");
registerRoute("PATCH",  "/services/:id",             "service:services",    "update",  "id");
registerRoute("DELETE", "/services/:id",             "service:services",    "delete",  "id");
registerRoute("GET",    "/services/slug/:slug",      "service:services",    "read");
registerRoute("GET",    "/services/categories",      "service:service_categories", "read");
registerRoute("POST",   "/orders",                   "service:service_orders", "create");
registerRoute("GET",    "/orders",                   "service:service_orders", "read");
registerRoute("GET",    "/orders/:id",               "service:service_orders", "read",   "id");
registerRoute("PATCH",  "/orders/:id/status",        "service:service_orders", "update", "id");
registerRoute("POST",   "/orders/:id/documents",     "service:order_documents", "create", "id");
registerRoute("POST",   "/orders/:id/assign",        "service:order_assignment", "create");
registerRoute("POST",   "/orders/:id/rate",          "service:order_ratings", "create", "id");
registerRoute("GET",    "/orders/:id/timeline",      "service:service_orders", "read",   "id");

// -- Commerce Domain --
registerRoute("GET",    "/products",                 "commerce:products",   "read");
registerRoute("POST",   "/products",                 "commerce:products",   "create");
registerRoute("GET",    "/products/:id",             "commerce:products",   "read",    "id");
registerRoute("PATCH",  "/products/:id",             "commerce:products",   "update",  "id");
registerRoute("DELETE", "/products/:id",             "commerce:products",   "delete",  "id");
registerRoute("GET",    "/products/slug/:slug",      "commerce:products",   "read");
registerRoute("GET",    "/categories",               "commerce:product_categories", "read");
registerRoute("POST",   "/categories",               "commerce:product_categories", "create");
registerRoute("PATCH",  "/categories/:id",           "commerce:product_categories", "update", "id");
registerRoute("DELETE", "/categories/:id",           "commerce:product_categories", "delete", "id");
registerRoute("GET",    "/cart",                     "commerce:carts",      "read");
registerRoute("POST",   "/cart/items",               "commerce:carts",      "create");
registerRoute("PATCH",  "/cart/items/:cartItemId",   "commerce:carts",      "update");
registerRoute("DELETE", "/cart/items/:cartItemId",   "commerce:carts",      "delete");
registerRoute("POST",   "/commerce/orders",          "commerce:commerce_orders", "create");
registerRoute("GET",    "/commerce/orders",          "commerce:commerce_orders", "read");
registerRoute("GET",    "/commerce/orders/:id",      "commerce:commerce_orders", "read",   "id");
registerRoute("PATCH",  "/commerce/orders/:id/status", "commerce:commerce_orders", "update", "id");
registerRoute("POST",   "/commerce/orders/:id/cancel", "commerce:commerce_orders", "update", "id");
registerRoute("GET",    "/commerce/orders/:id/status-history", "commerce:commerce_orders", "read", "id");
registerRoute("GET",    "/inventory",                "commerce:inventory",  "read");
registerRoute("GET",    "/inventory/:productId",     "commerce:inventory",  "read");
registerRoute("PATCH",  "/inventory/:productId",     "commerce:inventory",  "update");
registerRoute("GET",    "/products/:id/reviews",     "commerce:product_reviews", "read");
registerRoute("POST",   "/products/:id/reviews",     "commerce:product_reviews", "create");
registerRoute("PATCH",  "/products/:id/reviews/:reviewId", "commerce:product_reviews", "update");
registerRoute("GET",    "/coupons",                  "commerce:coupons",    "read");
registerRoute("POST",   "/coupons",                  "commerce:coupons",    "create");
registerRoute("PATCH",  "/coupons/:id",              "commerce:coupons",    "update",  "id");
registerRoute("DELETE", "/coupons/:id",              "commerce:coupons",    "delete",  "id");
registerRoute("POST",   "/coupons/validate",         "commerce:coupons",    "read");

// -- Support Domain --
registerRoute("POST",   "/tickets",                  "support:tickets",     "create");
registerRoute("GET",    "/tickets",                  "support:tickets",     "read");
registerRoute("GET",    "/tickets/:id",              "support:tickets",     "read",    "id");
registerRoute("PATCH",  "/tickets/:id/status",       "support:ticket_status", "update");
registerRoute("PATCH",  "/tickets/:id/assign",       "support:ticket_assignment", "update");
registerRoute("PATCH",  "/tickets/:id/priority",     "support:ticket_status", "update");
registerRoute("DELETE", "/tickets/:id",              "support:tickets",     "delete",  "id");
registerRoute("POST",   "/tickets/:id/messages",     "support:ticket_messages", "create");
registerRoute("GET",    "/tickets/:id/messages",     "support:ticket_messages", "read");
registerRoute("PATCH",  "/tickets/:id/messages/:messageId", "support:ticket_messages", "update");
registerRoute("DELETE", "/tickets/:id/messages/:messageId", "support:ticket_messages", "delete");
registerRoute("POST",   "/tickets/:id/rate",         "support:tickets",     "create",  "id");
registerRoute("POST",   "/tickets/:id/link-article", "support:tickets",     "update",  "id");
registerRoute("GET",    "/knowledge/articles",       "support:knowledge_articles", "read");
registerRoute("POST",   "/knowledge/articles",       "support:knowledge_articles", "create");
registerRoute("GET",    "/knowledge/articles/:id",   "support:knowledge_articles", "read", "id");
registerRoute("PATCH",  "/knowledge/articles/:id",   "support:knowledge_articles", "update", "id");
registerRoute("DELETE", "/knowledge/articles/:id",   "support:knowledge_articles", "delete", "id");
registerRoute("POST",   "/knowledge/articles/:id/publish",   "support:knowledge_article_publish", "update");
registerRoute("POST",   "/knowledge/articles/:id/unpublish", "support:knowledge_article_publish", "update");
registerRoute("POST",   "/knowledge/articles/:id/feedback",  "support:knowledge_articles", "read");
registerRoute("GET",    "/support/reports",          "support:ticket_reports", "read");

// -- Content Domain --
registerRoute("POST",   "/pages",                    "content:pages",       "create");
registerRoute("GET",    "/pages",                    "content:pages",       "read");
registerRoute("GET",    "/pages/:id",                "content:pages",       "read",    "id");
registerRoute("PATCH",  "/pages/:id",                "content:pages",       "update",  "id");
registerRoute("DELETE", "/pages/:id",                "content:pages",       "delete",  "id");
registerRoute("POST",   "/pages/:id/publish",        "content:page_publish", "create");
registerRoute("POST",   "/pages/:id/unpublish",      "content:page_publish", "update");
registerRoute("POST",   "/pages/:id/schedule",       "content:page_schedule", "create");
registerRoute("GET",    "/pages/:id/versions",       "content:page_versions", "read");
registerRoute("GET",    "/pages/:id/versions/:version", "content:page_versions", "read");
registerRoute("POST",   "/pages/:id/versions/:version/restore", "content:page_versions", "restore");
registerRoute("POST",   "/media",                    "content:media",       "create");
registerRoute("GET",    "/media",                    "content:media",       "read");
registerRoute("GET",    "/media/:id",                "content:media",       "read",    "id");
registerRoute("DELETE", "/media/:id",                "content:media",       "delete",  "id");
registerRoute("POST",   "/blog",                     "content:blog_posts",  "create");
registerRoute("GET",    "/blog",                     "content:blog_posts",  "read");
registerRoute("GET",    "/blog/:id",                 "content:blog_posts",  "read",    "id");
registerRoute("PATCH",  "/blog/:id",                 "content:blog_posts",  "update",  "id");
registerRoute("DELETE", "/blog/:id",                 "content:blog_posts",  "delete",  "id");
registerRoute("POST",   "/blog/:id/publish",         "content:blog_publish", "create");
registerRoute("POST",   "/blog/categories",          "content:blog_categories", "create");
registerRoute("GET",    "/blog/categories",          "content:blog_categories", "read");

// -- Notification Domain --
registerRoute("GET",    "/notifications/templates",  "notification:notification_templates", "read");
registerRoute("POST",   "/notifications/templates",  "notification:notification_templates", "create");
registerRoute("PATCH",  "/notifications/templates/:id", "notification:notification_templates", "update");
registerRoute("DELETE", "/notifications/templates/:id", "notification:notification_templates", "delete");
registerRoute("GET",    "/notifications/log",        "notification:notification_logs", "read");
registerRoute("POST",   "/notifications/send",       "notification:notification_bulk", "create");
registerRoute("GET",    "/users/me/notifications/preferences", "notification:notification_preferences", "read");
registerRoute("PATCH",  "/users/me/notifications/preferences", "notification:notification_preferences", "update");

// -- Analytics Domain --
registerRoute("GET",    "/analytics/dashboards",     "analytics:analytics_dashboards", "read");
registerRoute("POST",   "/analytics/dashboards",     "analytics:analytics_dashboards", "create");
registerRoute("PATCH",  "/analytics/dashboards/:id", "analytics:analytics_dashboards", "update");
registerRoute("DELETE", "/analytics/dashboards/:id", "analytics:analytics_dashboards", "delete");
registerRoute("GET",    "/analytics/reports",        "analytics:analytics_reports", "read");
registerRoute("POST",   "/analytics/reports",        "analytics:analytics_reports", "create");
registerRoute("GET",    "/analytics/reports/:id/download", "analytics:analytics_report_export", "read");
registerRoute("GET",    "/analytics/kpis",           "analytics:analytics_kpis", "read");
registerRoute("POST",   "/analytics/kpis",           "analytics:analytics_kpis", "create");
registerRoute("GET",    "/analytics/metrics",        "analytics:analytics_metrics", "read");

// -- AI Domain --
registerRoute("GET",    "/ai/agents",                "ai:ai_agents",        "read");
registerRoute("POST",   "/ai/agents",                "ai:ai_agents",        "create");
registerRoute("PATCH",  "/ai/agents/:id",            "ai:ai_agents",        "update",  "id");
registerRoute("DELETE", "/ai/agents/:id",            "ai:ai_agents",        "delete",  "id");
registerRoute("POST",   "/ai/agents/:id/invoke",     "ai:ai_agent_invoke",  "execute");
registerRoute("POST",   "/ai/chat",                  "ai:ai_chat",          "send");
registerRoute("GET",    "/ai/knowledge",             "ai:ai_knowledge",     "read");
registerRoute("POST",   "/ai/knowledge",             "ai:ai_knowledge",     "create");
registerRoute("GET",    "/ai/prompts",               "ai:ai_prompts",       "read");
registerRoute("POST",   "/ai/prompts",               "ai:ai_prompts",       "create");
registerRoute("PATCH",  "/ai/prompts/:id",           "ai:ai_prompts",       "update",  "id");
registerRoute("DELETE", "/ai/prompts/:id",           "ai:ai_prompts",       "delete",  "id");
registerRoute("POST",   "/ai/prompts/:id/activate",  "ai:ai_prompt_activate", "update");
registerRoute("GET",    "/ai/interactions",          "ai:ai_interactions",  "read");
registerRoute("GET",    "/ai/interactions/stats",    "ai:ai_interaction_stats", "read");

// ---------------------------------------------------------------------------
// Compiled Policy Rules (derived from access-control.yaml)
// ---------------------------------------------------------------------------

const POLICIES: CompiledPolicy[] = [
  // === IDENTITY DOMAIN ===
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["identity:users"]), actions: new Set(["create","read","update","delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin"]), resources: new Set(["identity:roles"]), actions: new Set(["create","read","update","delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["manager"]), resources: new Set(["identity:roles"]), actions: new Set(["read"]), conditions: [], priority: 80 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["identity:sessions"]), actions: new Set(["read","revoke"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager","employee","customer","partner"]), resources: new Set(["identity:auth_tokens"]), actions: new Set(["issue","refresh","revoke"]), conditions: [], priority: 60 },
  { effect: "allow",  roles: new Set(["employee","customer","partner"]), resources: new Set(["identity:users"]), actions: new Set(["read"]), conditions: [{ field: "id", operator: "equals", value: "$caller.id" }], priority: 50 },
  { effect: "allow",  roles: new Set(["employee","customer","partner"]), resources: new Set(["identity:sessions"]), actions: new Set(["read"]), conditions: [{ field: "userId", operator: "equals", value: "$caller.id" }], priority: 50 },
  // === CUSTOMER DOMAIN ===
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["customer:customers"]), actions: new Set(["create","read","update","delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["customer:customer_profiles"]), actions: new Set(["create","read","update","delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["customer:communication_logs"]), actions: new Set(["create","read","update","delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["customer:customer_tags"]), actions: new Set(["create","read","update","delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin"]), resources: new Set(["customer:customer_import"]), actions: new Set(["create"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["customer:customer_export"]), actions: new Set(["create"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin"]), resources: new Set(["customer:customer_merge"]), actions: new Set(["create"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["employee"]), resources: new Set(["customer:customers"]), actions: new Set(["read"]), conditions: [], priority: 70 },
  { effect: "allow",  roles: new Set(["employee"]), resources: new Set(["customer:customer_profiles"]), actions: new Set(["read"]), conditions: [], priority: 70 },
  { effect: "allow",  roles: new Set(["employee"]), resources: new Set(["customer:communication_logs"]), actions: new Set(["create","read"]), conditions: [], priority: 70 },
  { effect: "allow",  roles: new Set(["customer"]), resources: new Set(["customer:customers"]), actions: new Set(["read"]), conditions: [{ field: "id", operator: "equals", value: "$caller.customerId" }], priority: 50 },
  { effect: "allow",  roles: new Set(["customer"]), resources: new Set(["customer:customer_profiles"]), actions: new Set(["read"]), conditions: [{ field: "customerId", operator: "equals", value: "$caller.customerId" }], priority: 50 },
  { effect: "allow",  roles: new Set(["partner"]), resources: new Set(["customer:customers"]), actions: new Set(["read"]), conditions: [{ field: "assignedPartnerId", operator: "equals", value: "$caller.id" }], priority: 40 },
  // === SERVICE DOMAIN ===
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["service:services"]), actions: new Set(["create","read","update","delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["service:service_categories"]), actions: new Set(["create","read","update","delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["service:service_orders"]), actions: new Set(["create","read","update","delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["service:order_assignment"]), actions: new Set(["create","read","update"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager","employee"]), resources: new Set(["service:order_documents"]), actions: new Set(["create","read","verify"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin"]), resources: new Set(["service:order_documents"]), actions: new Set(["delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["service:order_ratings"]), actions: new Set(["read","delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["employee"]), resources: new Set(["service:services"]), actions: new Set(["read"]), conditions: [], priority: 70 },
  { effect: "allow",  roles: new Set(["employee"]), resources: new Set(["service:service_categories"]), actions: new Set(["read"]), conditions: [], priority: 70 },
  { effect: "allow",  roles: new Set(["employee"]), resources: new Set(["service:service_orders"]), actions: new Set(["read","update"]), conditions: [{ field: "assignedTo", operator: "equals", value: "$caller.id" }], priority: 60 },
  { effect: "allow",  roles: new Set(["employee"]), resources: new Set(["service:order_documents"]), actions: new Set(["create","read","verify"]), conditions: [{ field: "order.assignedTo", operator: "equals", value: "$caller.id" }], priority: 60 },
  { effect: "allow",  roles: new Set(["customer"]), resources: new Set(["service:services"]), actions: new Set(["read"]), conditions: [], priority: 50 },
  { effect: "allow",  roles: new Set(["customer"]), resources: new Set(["service:service_categories"]), actions: new Set(["read"]), conditions: [], priority: 50 },
  { effect: "allow",  roles: new Set(["customer"]), resources: new Set(["service:service_orders"]), actions: new Set(["create","read"]), conditions: [{ field: "customerId", operator: "equals", value: "$caller.customerId" }], priority: 50 },
  { effect: "allow",  roles: new Set(["customer"]), resources: new Set(["service:order_documents"]), actions: new Set(["create","read"]), conditions: [{ field: "order.customerId", operator: "equals", value: "$caller.customerId" }], priority: 50 },
  { effect: "allow",  roles: new Set(["customer"]), resources: new Set(["service:order_ratings"]), actions: new Set(["create"]), conditions: [{ field: "order.customerId", operator: "equals", value: "$caller.customerId" },{ field: "order.status", operator: "equals", value: "completed" }], priority: 50 },
  { effect: "allow",  roles: new Set(["partner"]), resources: new Set(["service:services"]), actions: new Set(["read"]), conditions: [], priority: 40 },
  { effect: "allow",  roles: new Set(["partner"]), resources: new Set(["service:service_categories"]), actions: new Set(["read"]), conditions: [], priority: 40 },
  // === COMMERCE DOMAIN ===
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["commerce:products"]), actions: new Set(["create","read","update","delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["commerce:product_categories"]), actions: new Set(["create","read","update","delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["commerce:carts"]), actions: new Set(["create","read","update","delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["commerce:commerce_orders"]), actions: new Set(["create","read","update","delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["commerce:inventory"]), actions: new Set(["create","read","update","delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["commerce:coupons"]), actions: new Set(["create","read","update","delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["commerce:product_reviews"]), actions: new Set(["create","read","update","delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["commerce:price_history"]), actions: new Set(["read"]), conditions: [], priority: 80 },
  { effect: "allow",  roles: new Set(["admin"]), resources: new Set(["commerce:products"]), actions: new Set(["delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin"]), resources: new Set(["commerce:coupons"]), actions: new Set(["delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["employee"]), resources: new Set(["commerce:products"]), actions: new Set(["read"]), conditions: [], priority: 70 },
  { effect: "allow",  roles: new Set(["employee"]), resources: new Set(["commerce:product_categories"]), actions: new Set(["read"]), conditions: [], priority: 70 },
  { effect: "allow",  roles: new Set(["employee"]), resources: new Set(["commerce:carts"]), actions: new Set(["create","read","update","delete"]), conditions: [], priority: 70 },
  { effect: "allow",  roles: new Set(["employee"]), resources: new Set(["commerce:commerce_orders"]), actions: new Set(["read"]), conditions: [], priority: 70 },
  { effect: "allow",  roles: new Set(["employee"]), resources: new Set(["commerce:inventory"]), actions: new Set(["read"]), conditions: [], priority: 70 },
  { effect: "allow",  roles: new Set(["employee"]), resources: new Set(["commerce:coupons"]), actions: new Set(["read"]), conditions: [], priority: 70 },
  { effect: "allow",  roles: new Set(["manager"]), resources: new Set(["commerce:commerce_orders"]), actions: new Set(["read","update"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["manager"]), resources: new Set(["commerce:inventory"]), actions: new Set(["read","update"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["manager"]), resources: new Set(["commerce:coupons"]), actions: new Set(["create","read","update"]), conditions: [], priority: 90 },
  { effect: "allow",  roles: new Set(["manager"]), resources: new Set(["commerce:product_reviews"]), actions: new Set(["read","update"]), conditions: [], priority: 90 },
  { effect: "allow",  roles: new Set(["customer"]), resources: new Set(["commerce:products"]), actions: new Set(["read"]), conditions: [], priority: 50 },
  { effect: "allow",  roles: new Set(["customer"]), resources: new Set(["commerce:product_categories"]), actions: new Set(["read"]), conditions: [], priority: 50 },
  { effect: "allow",  roles: new Set(["customer"]), resources: new Set(["commerce:carts"]), actions: new Set(["create","read","update","delete"]), conditions: [{ field: "customerId", operator: "equals", value: "$caller.customerId" }], priority: 50 },
  { effect: "allow",  roles: new Set(["customer"]), resources: new Set(["commerce:commerce_orders"]), actions: new Set(["create","read"]), conditions: [{ field: "customerId", operator: "equals", value: "$caller.customerId" }], priority: 50 },
  { effect: "allow",  roles: new Set(["customer"]), resources: new Set(["commerce:coupons"]), actions: new Set(["read"]), conditions: [{ field: "isActive", operator: "equals", value: true }], priority: 50 },
  { effect: "allow",  roles: new Set(["customer"]), resources: new Set(["commerce:product_reviews"]), actions: new Set(["create","read"]), conditions: [{ field: "reviewerId", operator: "equals", value: "$caller.customerId" }], priority: 50 },
  { effect: "allow",  roles: new Set(["partner"]), resources: new Set(["commerce:products"]), actions: new Set(["read"]), conditions: [], priority: 40 },
  { effect: "allow",  roles: new Set(["partner"]), resources: new Set(["commerce:product_categories"]), actions: new Set(["read"]), conditions: [], priority: 40 },
  { effect: "allow",  roles: new Set(["partner"]), resources: new Set(["commerce:carts"]), actions: new Set(["create","read","update","delete"]), conditions: [{ field: "customerId", operator: "equals", value: "$caller.customerId" }], priority: 40 },
  { effect: "allow",  roles: new Set(["partner"]), resources: new Set(["commerce:commerce_orders"]), actions: new Set(["read"]), conditions: [{ field: "assignedPartnerId", operator: "equals", value: "$caller.id" }], priority: 40 },
  // === SUPPORT DOMAIN ===
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["support:tickets"]), actions: new Set(["create","read","update","delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["support:ticket_status"]), actions: new Set(["read","update"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["support:ticket_assignment"]), actions: new Set(["create","read","update"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["support:ticket_messages"]), actions: new Set(["create","read","update","delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["support:knowledge_articles"]), actions: new Set(["create","read","update","delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["support:knowledge_article_publish"]), actions: new Set(["create","update"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["support:ticket_reports"]), actions: new Set(["read"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin"]), resources: new Set(["support:sla_configuration"]), actions: new Set(["create","read","update","delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["manager"]), resources: new Set(["support:sla_configuration"]), actions: new Set(["read"]), conditions: [], priority: 80 },
  { effect: "allow",  roles: new Set(["manager"]), resources: new Set(["support:tickets"]), actions: new Set(["create","read","update"]), conditions: [], priority: 90 },
  { effect: "allow",  roles: new Set(["manager"]), resources: new Set(["support:ticket_messages"]), actions: new Set(["create","read","update"]), conditions: [], priority: 90 },
  { effect: "allow",  roles: new Set(["manager"]), resources: new Set(["support:knowledge_articles"]), actions: new Set(["create","read","update"]), conditions: [], priority: 90 },
  { effect: "allow",  roles: new Set(["employee"]), resources: new Set(["support:tickets"]), actions: new Set(["create","read"]), conditions: [], priority: 70 },
  { effect: "allow",  roles: new Set(["employee"]), resources: new Set(["support:ticket_status"]), actions: new Set(["update"]), conditions: [{ field: "assignedTo", operator: "equals", value: "$caller.id" }], priority: 70 },
  { effect: "allow",  roles: new Set(["employee"]), resources: new Set(["support:ticket_messages"]), actions: new Set(["create","read","update"]), conditions: [{ field: "senderId", operator: "equals", value: "$caller.id" }], priority: 70 },
  { effect: "allow",  roles: new Set(["employee"]), resources: new Set(["support:knowledge_articles"]), actions: new Set(["read"]), conditions: [], priority: 70 },
  { effect: "allow",  roles: new Set(["employee"]), resources: new Set(["support:ticket_reports"]), actions: new Set(["read"]), conditions: [{ field: "employeeId", operator: "equals", value: "$caller.id" }], priority: 70 },
  { effect: "allow",  roles: new Set(["customer"]), resources: new Set(["support:tickets"]), actions: new Set(["create","read"]), conditions: [{ field: "customerId", operator: "equals", value: "$caller.customerId" }], priority: 50 },
  { effect: "allow",  roles: new Set(["customer"]), resources: new Set(["support:ticket_messages"]), actions: new Set(["create","read"]), conditions: [{ field: "ticket.customerId", operator: "equals", value: "$caller.customerId" },{ field: "message.isInternal", operator: "equals", value: false }], priority: 50 },
  { effect: "allow",  roles: new Set(["customer"]), resources: new Set(["support:knowledge_articles"]), actions: new Set(["read"]), conditions: [{ field: "isPublished", operator: "equals", value: true }], priority: 50 },
  { effect: "allow",  roles: new Set(["admin"]), resources: new Set(["support:tickets"]), actions: new Set(["delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin"]), resources: new Set(["support:knowledge_articles"]), actions: new Set(["delete"]), conditions: [], priority: 100 },
  // === CONTENT DOMAIN ===
  { effect: "allow",  roles: new Set(["admin","manager","employee"]), resources: new Set(["content:pages"]), actions: new Set(["create","read","update"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["content:pages"]), actions: new Set(["delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager","employee"]), resources: new Set(["content:page_publish"]), actions: new Set(["create","update"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["content:page_schedule"]), actions: new Set(["create","read","update","delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["content:page_versions"]), actions: new Set(["read","restore"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["employee"]), resources: new Set(["content:page_versions"]), actions: new Set(["read"]), conditions: [], priority: 70 },
  { effect: "allow",  roles: new Set(["admin","manager","employee"]), resources: new Set(["content:media"]), actions: new Set(["create","read"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["content:media"]), actions: new Set(["update","delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager","employee"]), resources: new Set(["content:blog_posts"]), actions: new Set(["create","read","update"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["content:blog_posts"]), actions: new Set(["delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager","employee"]), resources: new Set(["content:blog_publish"]), actions: new Set(["create","update"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["content:blog_categories"]), actions: new Set(["create","read","update","delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["employee"]), resources: new Set(["content:blog_categories"]), actions: new Set(["read"]), conditions: [], priority: 70 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["content:menus"]), actions: new Set(["create","read","update","delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["employee"]), resources: new Set(["content:menus"]), actions: new Set(["read"]), conditions: [], priority: 70 },
  { effect: "allow",  roles: new Set(["admin","manager","employee"]), resources: new Set(["content:sitemap"]), actions: new Set(["read"]), conditions: [], priority: 80 },
  { effect: "allow",  roles: new Set(["customer","partner"]), resources: new Set(["content:pages"]), actions: new Set(["read"]), conditions: [{ field: "isPublished", operator: "equals", value: true }], priority: 50 },
  { effect: "allow",  roles: new Set(["customer","partner"]), resources: new Set(["content:blog_posts"]), actions: new Set(["read"]), conditions: [{ field: "isPublished", operator: "equals", value: true }], priority: 50 },
  { effect: "allow",  roles: new Set(["customer","partner"]), resources: new Set(["content:blog_categories"]), actions: new Set(["read"]), conditions: [], priority: 50 },
  { effect: "allow",  roles: new Set(["customer","partner"]), resources: new Set(["content:sitemap"]), actions: new Set(["read"]), conditions: [], priority: 50 },
  // === NOTIFICATION DOMAIN ===
  { effect: "allow",  roles: new Set(["admin"]), resources: new Set(["notification:notification_templates"]), actions: new Set(["create","read","update","delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["manager"]), resources: new Set(["notification:notification_templates"]), actions: new Set(["read"]), conditions: [], priority: 80 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["notification:notification_logs"]), actions: new Set(["read"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["notification:notification_preferences"]), actions: new Set(["read","update"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin"]), resources: new Set(["notification:notification_bulk"]), actions: new Set(["create","read","update","delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["manager"]), resources: new Set(["notification:notification_bulk"]), actions: new Set(["execute"]), conditions: [], priority: 80 },
  { effect: "allow",  roles: new Set(["employee","customer","partner"]), resources: new Set(["notification:notification_preferences"]), actions: new Set(["read","update"]), conditions: [{ field: "userId", operator: "equals", value: "$caller.id" }], priority: 50 },
  { effect: "allow",  roles: new Set(["customer","partner"]), resources: new Set(["notification:notification_logs"]), actions: new Set(["read"]), conditions: [{ field: "userId", operator: "equals", value: "$caller.id" }], priority: 50 },
  // === ANALYTICS DOMAIN ===
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["analytics:analytics_dashboards"]), actions: new Set(["create","read","update","delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["analytics:analytics_reports"]), actions: new Set(["create","read"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin"]), resources: new Set(["analytics:analytics_reports"]), actions: new Set(["update"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["analytics:analytics_report_export"]), actions: new Set(["create","read"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["analytics:analytics_kpis"]), actions: new Set(["create","read","update"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin"]), resources: new Set(["analytics:analytics_kpis"]), actions: new Set(["delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["analytics:analytics_metrics"]), actions: new Set(["read"]), conditions: [], priority: 80 },
  { effect: "allow",  roles: new Set(["employee"]), resources: new Set(["analytics:analytics_dashboards"]), actions: new Set(["read"]), conditions: [{ field: "visibility", operator: "in", value: ["overview","team"] }], priority: 70 },
  { effect: "allow",  roles: new Set(["partner"]), resources: new Set(["analytics:analytics_dashboards"]), actions: new Set(["read"]), conditions: [{ field: "ownerId", operator: "equals", value: "$caller.id" }], priority: 40 },
  { effect: "allow",  roles: new Set(["partner"]), resources: new Set(["analytics:analytics_reports"]), actions: new Set(["create","read"]), conditions: [{ field: "ownerId", operator: "equals", value: "$caller.id" }], priority: 40 },
  { effect: "allow",  roles: new Set(["partner"]), resources: new Set(["analytics:analytics_report_export"]), actions: new Set(["read"]), conditions: [{ field: "report.ownerId", operator: "equals", value: "$caller.id" }], priority: 40 },
  // === AI DOMAIN ===
  { effect: "allow",  roles: new Set(["admin"]), resources: new Set(["ai:ai_agents"]), actions: new Set(["create","read","update","delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["manager"]), resources: new Set(["ai:ai_agents"]), actions: new Set(["read"]), conditions: [], priority: 80 },
  { effect: "allow",  roles: new Set(["admin","manager","employee"]), resources: new Set(["ai:ai_agent_invoke"]), actions: new Set(["execute"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["customer"]), resources: new Set(["ai:ai_agent_invoke"]), actions: new Set(["execute"]), conditions: [{ field: "agentType", operator: "equals", value: "support" }], priority: 50 },
  { effect: "allow",  roles: new Set(["admin","manager","employee","customer"]), resources: new Set(["ai:ai_chat"]), actions: new Set(["send"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["partner"]), resources: new Set(["ai:ai_chat"]), actions: new Set(["send"]), conditions: [{ field: "authMethod", operator: "equals", value: "api_key" }], priority: 40 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["ai:ai_knowledge"]), actions: new Set(["create","read","update","delete","ingest"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["employee"]), resources: new Set(["ai:ai_knowledge"]), actions: new Set(["read"]), conditions: [], priority: 70 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["ai:ai_prompts"]), actions: new Set(["create","read","update"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin"]), resources: new Set(["ai:ai_prompts"]), actions: new Set(["delete"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["ai:ai_prompt_activate"]), actions: new Set(["update"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["employee"]), resources: new Set(["ai:ai_prompts"]), actions: new Set(["read"]), conditions: [], priority: 70 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["ai:ai_interactions"]), actions: new Set(["read"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["admin","manager"]), resources: new Set(["ai:ai_interaction_stats"]), actions: new Set(["read"]), conditions: [], priority: 100 },
  { effect: "allow",  roles: new Set(["employee"]), resources: new Set(["ai:ai_agents"]), actions: new Set(["read"]), conditions: [{ field: "isActive", operator: "equals", value: true }], priority: 70 },
  { effect: "allow",  roles: new Set(["employee"]), resources: new Set(["ai:ai_agent_invoke"]), actions: new Set(["execute"]), conditions: [{ field: "agentType", operator: "in", value: ["support","analytics"] }], priority: 70 },
  { effect: "allow",  roles: new Set(["employee","customer"]), resources: new Set(["ai:ai_interactions"]), actions: new Set(["read"]), conditions: [{ field: "userId", operator: "equals", value: "$caller.id" }], priority: 50 },
  { effect: "allow",  roles: new Set(["partner"]), resources: new Set(["ai:ai_interactions"]), actions: new Set(["read"]), conditions: [{ field: "userId", operator: "equals", value: "$caller.id" }], priority: 40 },
  // === PUBLIC RESOURCES (wildcard roles) ===
  { effect: "allow",  roles: new Set(["*"]), resources: new Set(["service:services"]), actions: new Set(["read"]), conditions: [{ field: "isActive", operator: "equals", value: true }], priority: 10 },
  { effect: "allow",  roles: new Set(["*"]), resources: new Set(["service:service_categories"]), actions: new Set(["read"]), conditions: [], priority: 10 },
  { effect: "allow",  roles: new Set(["*"]), resources: new Set(["commerce:products"]), actions: new Set(["read"]), conditions: [{ field: "isActive", operator: "equals", value: true }], priority: 10 },
  { effect: "allow",  roles: new Set(["*"]), resources: new Set(["commerce:product_categories"]), actions: new Set(["read"]), conditions: [], priority: 10 },
  { effect: "allow",  roles: new Set(["*"]), resources: new Set(["commerce:product_reviews"]), actions: new Set(["read"]), conditions: [{ field: "isApproved", operator: "equals", value: true }], priority: 10 },
  { effect: "allow",  roles: new Set(["*"]), resources: new Set(["support:knowledge_articles"]), actions: new Set(["read"]), conditions: [{ field: "isPublished", operator: "equals", value: true }], priority: 10 },
  { effect: "allow",  roles: new Set(["*"]), resources: new Set(["content:pages"]), actions: new Set(["read"]), conditions: [{ field: "isPublished", operator: "equals", value: true }], priority: 10 },
  { effect: "allow",  roles: new Set(["*"]), resources: new Set(["content:blog_posts"]), actions: new Set(["read"]), conditions: [{ field: "isPublished", operator: "equals", value: true }], priority: 10 },
  { effect: "allow",  roles: new Set(["*"]), resources: new Set(["content:blog_categories"]), actions: new Set(["read"]), conditions: [], priority: 10 },
  { effect: "allow",  roles: new Set(["*"]), resources: new Set(["content:sitemap"]), actions: new Set(["read"]), conditions: [], priority: 10 },
  { effect: "allow",  roles: new Set(["*"]), resources: new Set(["content:menus"]), actions: new Set(["read"]), conditions: [], priority: 10 },
  { effect: "allow",  roles: new Set(["*"]), resources: new Set(["identity:auth"]), actions: new Set(["register","login","verify","refresh","forgot_password","reset_password","revoke"]), conditions: [], priority: 5 },
  { effect: "allow",  roles: new Set(["*"]), resources: new Set(["support:knowledge_articles"]), actions: new Set(["read"]), conditions: [], priority: 5 },
  { effect: "allow",  roles: new Set(["*"]), resources: new Set(["commerce:cart"]), actions: new Set(["read","create","update","delete"]), conditions: [], priority: 5 },
  { effect: "allow",  roles: new Set(["*"]), resources: new Set(["commerce:carts"]), actions: new Set(["read","create","update","delete"]), conditions: [], priority: 5 },
  // === DEFAULT DENY ===
  { effect: "deny",   roles: new Set(["*"]), resources: new Set(["*"]), actions: new Set(["*"]), conditions: [], priority: 0 },
];

// Sort by priority descending for evaluation
POLICIES.sort((a, b) => b.priority - a.priority);

// ---------------------------------------------------------------------------
// PolicyGuard
// ---------------------------------------------------------------------------

@Injectable()
export class PolicyGuard implements CanActivate {
  private readonly logger = new Logger(PolicyGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const startTime = performance.now();

    try {
      // 1. Extract user from JWT
      const user = this.extractUser(request);
      if (!user) {
        this.logger.warn(`No user context available — denying access`);
        throw this.forbiddenError("identity:unknown", "unknown", "anonymous");
      }

      // 2. Resolve route → resource + action
      const method = request.method.toUpperCase();
      const routePath = this.resolveRoutePath(context, request);
      const mapping = this.resolveResource(routePath, method);

      if (!mapping) {
        this.logger.warn(
          `No resource mapping for ${method} ${routePath} — denying (unknown resource)`,
        );
        throw this.forbiddenError("identity:unknown", "unknown", user.role);
      }

      // 3. Build policy context
      const ctx: PolicyContext = {
        caller: {
          id: user.id,
          role: user.role,
          customerId: user.customerId,
          ip: (request as any).ip ?? request.headers["x-forwarded-for"]?.toString() ?? "unknown",
        },
        resource: {
          type: mapping.resource,
          id: mapping.ownerIdParam
            ? (request.params as Record<string, string>)?.[mapping.ownerIdParam]
            : undefined,
          params: (request.params ?? {}) as Record<string, string>,
        },
        action: mapping.action,
        now: new Date().toISOString(),
      };

      // 4. Evaluate policies
      const decision = this.evaluatePolicies(ctx);
      const elapsed = performance.now() - startTime;

      if (decision.allowed) {
        this.logger.debug(
          `Access GRANTED: ${user.role} → ${mapping.resource}:${mapping.action} (${elapsed.toFixed(2)}ms)`,
        );
        return true;
      }

      this.logger.warn(
        `Access DENIED: ${user.role} → ${mapping.resource}:${mapping.action} — ${decision.reason} (${elapsed.toFixed(2)}ms)`,
      );
      throw this.forbiddenError(mapping.resource, mapping.action, user.role);

    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;
      const elapsed = performance.now() - startTime;
      this.logger.error(
        `Policy evaluation error (${elapsed.toFixed(2)}ms)`,
        err instanceof Error ? err.stack : String(err),
      );
      throw new HttpException(
        {
          error: {
            code: "POLICY_EVALUATION_ERROR",
            message: "خطاء في تقييم الصلاحيات",
            message_en: "Policy evaluation error",
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (request as any).id,
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // -----------------------------------------------------------------------
  // User extraction (JWT payload decode — verification deferred to AuthGuard)
  // -----------------------------------------------------------------------

  private extractUser(request: FastifyRequest): PolicyUser | null {
    // Priority 1: request.user (set by AuthGuard when implemented)
    const existingUser = (request as any).user;
    if (existingUser?.id && existingUser?.role) {
      return {
        id: existingUser.id ?? existingUser.sub,
        role: existingUser.role,
        customerId: existingUser.customerId,
        permissions: existingUser.permissions,
      };
    }

    // Priority 2: Authorization header JWT extraction (placeholder)
    const authHeader = request.headers.authorization;
    if (!authHeader) return null;

    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
    try {
      const raw = this.decodeJwtPayload(token);
      const payload = raw as Record<string, unknown> | null;
      if (payload?.sub && payload?.role) {
        return {
          id: String(payload.sub),
          role: String(payload.role),
          customerId: payload.customerId ? String(payload.customerId) : (payload.customer_id ? String(payload.customer_id) : undefined),
          permissions: Array.isArray(payload.permissions) ? payload.permissions.map(String) : (Array.isArray(payload.scopes) ? payload.scopes.map(String) : undefined),
        };
      }
    } catch {
      this.logger.warn("Failed to decode JWT payload from Authorization header");
    }

    return null;
  }

  private decodeJwtPayload(token: string): Record<string, unknown> | null {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    try {
      const payload = parts[1];
      const decoded = Buffer.from(payload, "base64url").toString("utf8");
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }

  // -----------------------------------------------------------------------
  // Route resolution
  // -----------------------------------------------------------------------

  private resolveRoutePath(context: ExecutionContext, request: FastifyRequest): string {
    const routeOpts = (request as any).routeOptions;
    if (routeOpts?.url) return routeOpts.url;
    // Fallback to raw URL path
    return new URL(request.url, "http://localhost").pathname;
  }

  private resolveResource(routePath: string, method: string): RouteResourceMapping | null {
    // Direct lookup
    const key = `${method}:${routePath}`;
    const direct = ROUTE_RESOURCE_MAP.get(key);
    if (direct) return direct;

    // Pattern matching for parameterized routes (/:id, /:slug, etc.)
    for (const [patternKey, mapping] of ROUTE_RESOURCE_MAP) {
      const [patternMethod, patternPath] = patternKey.split(":");
      if (patternMethod !== method) continue;
      if (this.matchPath(routePath, patternPath)) return mapping;
    }

    return null;
  }

  private matchPath(actual: string, pattern: string): boolean {
    const actualParts = actual.replace(/\/+$/, "").split("/").filter(Boolean);
    const patternParts = pattern.replace(/\/+$/, "").split("/").filter(Boolean);
    if (actualParts.length !== patternParts.length) return false;
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(":")) continue; // parameter
      if (patternParts[i] !== actualParts[i]) return false;
    }
    return true;
  }

  // -----------------------------------------------------------------------
  // Policy evaluation
  // -----------------------------------------------------------------------

  private evaluatePolicies(ctx: PolicyContext): { allowed: boolean; reason: string } {
    const candidatePolicies = POLICIES.filter((p) => {
      const roleMatch =
        p.roles.has("*") ||
        p.roles.has(ctx.caller.role) ||
        (ctx.caller.role === "admin" && (p.roles.has("manager") ? false : true));
      const resourceMatch =
        p.resources.has("*") || p.resources.has(ctx.resource.type);
      const actionMatch =
        p.actions.has("*") || p.actions.has(ctx.action);
      return roleMatch && resourceMatch && actionMatch;
    });

    if (candidatePolicies.length === 0) {
      return { allowed: false, reason: "no matching policy found" };
    }

    // Evaluate in priority order (already sorted)
    for (const policy of candidatePolicies) {
      if (policy.effect === "deny") {
        return { allowed: false, reason: `explicit deny at priority ${policy.priority}` };
      }

      if (policy.effect === "allow") {
        const conditionsPassed = this.evaluateConditions(policy.conditions, ctx);
        if (conditionsPassed) {
          return { allowed: true, reason: `allow at priority ${policy.priority}` };
        }
        // Conditions failed — continue to next policy
      }
    }

    // Should not reach here (default deny at priority 0 catches everything)
    return { allowed: false, reason: "default deny" };
  }

  private evaluateConditions(conditions: PolicyCondition[], ctx: PolicyContext): boolean {
    if (conditions.length === 0) return true;

    for (const cond of conditions) {
      const resolvedValue = this.resolveValue(cond.value, ctx);
      const fieldValue = this.resolveField(cond.field, ctx);

      switch (cond.operator) {
        case "equals":
          if (fieldValue !== resolvedValue) return false;
          break;
        case "in":
          if (!Array.isArray(resolvedValue) || !resolvedValue.includes(fieldValue)) return false;
          break;
        case "owns":
          // Ownership: caller.{property} === resource.owner_id
          // For owns operator, value points to caller variable
          if (fieldValue !== resolvedValue) return false;
          break;
        case "has_role":
          if (ctx.caller.role !== resolvedValue) return false;
          break;
        case "contains":
          if (!Array.isArray(fieldValue) || !fieldValue.includes(resolvedValue)) return false;
          break;
        case "regex":
          if (typeof fieldValue !== "string" || typeof resolvedValue !== "string") return false;
          try {
            if (!new RegExp(resolvedValue).test(fieldValue)) return false;
          } catch {
            return false;
          }
          break;
        case "greater_than":
          if (typeof fieldValue !== "number" || typeof resolvedValue !== "number") return false;
          if (fieldValue <= resolvedValue) return false;
          break;
        case "less_than":
          if (typeof fieldValue !== "number" || typeof resolvedValue !== "number") return false;
          if (fieldValue >= resolvedValue) return false;
          break;
        default:
          return false;
      }
    }

    return true;
  }

  private resolveValue(value: unknown, ctx: PolicyContext): unknown {
    if (typeof value === "string" && value.startsWith("$")) {
      return this.resolveVariable(value, ctx);
    }
    return value;
  }

  private resolveVariable(variable: string, ctx: PolicyContext): unknown {
    const path = variable.slice(1).split(".");
    let current: unknown = ctx;
    for (const key of path) {
      if (current === null || current === undefined) return undefined;
      current = (current as Record<string, unknown>)[key];
    }
    return current;
  }

  private resolveField(field: string, ctx: PolicyContext): unknown {
    // Field resolution: if field contains a dot, navigate into resource params
    // Otherwise, look in resource.id (the primary resource identifier)
    if (field === "id") return ctx.resource.id;
    if (field === "userId") return ctx.caller.id;
    if (field === "customerId") return ctx.caller.customerId;

    // Try resource params first
    if (ctx.resource.params && field in ctx.resource.params) {
      return ctx.resource.params[field];
    }

    return undefined;
  }

  // -----------------------------------------------------------------------
  // Error formatting
  // -----------------------------------------------------------------------

  private forbiddenError(resource: string, action: string, userRole: string): HttpException {
    return new HttpException(
      {
        error: {
          code: "FORBIDDEN",
          message: "غير مصرح لك بهذا الإجراء",
          message_en: "You do not have permission to perform this action",
          statusCode: HttpStatus.FORBIDDEN,
          details: { resource, action, role: userRole },
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
