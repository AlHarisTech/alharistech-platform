import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  integer,
  jsonb,
  uniqueIndex,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", [
  "admin",
  "manager",
  "employee",
  "customer",
  "partner",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    firstNameAr: varchar("first_name_ar", { length: 100 }).notNull(),
    lastNameAr: varchar("last_name_ar", { length: 100 }).notNull(),
    firstNameEn: varchar("first_name_en", { length: 100 }),
    lastNameEn: varchar("last_name_en", { length: 100 }),
    phone: varchar("phone", { length: 20 }),
    role: roleEnum("role").notNull().default("customer"),
    isActive: boolean("is_active").notNull().default(true),
    isVerified: boolean("is_verified").notNull().default(false),
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    emailIdx: uniqueIndex("idx_users_email").on(table.email),
    roleIdx: index("idx_users_role").on(table.role),
  }),
);

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  tokenHash: varchar("token_hash", { length: 255 }).notNull(),
  deviceInfo: jsonb("device_info"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  replacedBy: uuid("replaced_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resource: varchar("resource", { length: 100 }).notNull(),
    action: varchar("action", { length: 50 }).notNull(),
    description: varchar("description", { length: 255 }),
  },
  (table) => ({
    resourceActionIdx: uniqueIndex("idx_permissions_resource_action").on(
      table.resource,
      table.action,
    ),
  }),
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    role: roleEnum("role").notNull(),
    permissionId: uuid("permission_id")
      .references(() => permissions.id)
      .notNull(),
  },
  (table) => ({
    rolePermIdx: uniqueIndex("idx_role_permissions").on(
      table.role,
      table.permissionId,
    ),
  }),
);

export const drizzleMigrations = pgTable("drizzle_migrations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  hash: varchar("hash", { length: 64 }).notNull(),
  executedAt: timestamp("executed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;
export type Permission = typeof permissions.$inferSelect;
export type NewPermission = typeof permissions.$inferInsert;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type NewRolePermission = typeof rolePermissions.$inferInsert;
export type DrizzleMigration = typeof drizzleMigrations.$inferSelect;
export type NewDrizzleMigration = typeof drizzleMigrations.$inferInsert;
