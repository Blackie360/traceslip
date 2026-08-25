import { relations, sql } from "drizzle-orm"
import {
  bigint,
  boolean,
  check,
  customType,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

const bytea = customType<{ data: Uint8Array }>({ dataType: () => "bytea" })

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}

export const users = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  role: text("role"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", { withTimezone: true }),
  ...timestamps,
})

export const sessions = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    activeOrganizationId: text("active_organization_id"),
    impersonatedBy: text("impersonated_by"),
    ...timestamps,
  },
  (table) => [index("session_user_idx").on(table.userId)]
)

export const accounts = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    issuer: text("issuer").notNull(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("account_issuer_account_id_uidx").on(table.issuer, table.accountId),
    index("account_user_idx").on(table.userId),
  ]
)

export const verifications = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
)

export const organizations = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  suspensionReason: text("suspension_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

export const members = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    role: text("role").default("member").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("member_org_user_uidx").on(table.organizationId, table.userId),
    index("member_user_idx").on(table.userId),
  ]
)

export const invitations = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    inviterId: text("inviter_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("invitation_org_email_idx").on(table.organizationId, table.email)]
)

export const workspaceSettings = pgTable("workspace_settings", {
  organizationId: text("organization_id").primaryKey().references(() => organizations.id, { onDelete: "cascade" }),
  locale: text("locale").default("en-KE").notNull(),
  timezone: text("timezone").default("Africa/Nairobi").notNull(),
  defaultCurrency: text("default_currency").default("KES").notNull(),
  ...timestamps,
})

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("projects_org_slug_uidx").on(table.organizationId, table.slug),
    uniqueIndex("projects_id_org_uidx").on(table.id, table.organizationId),
    index("projects_org_idx").on(table.organizationId),
  ]
)

export const projectMembers = pgTable(
  "project_members",
  {
    projectId: uuid("project_id").notNull(),
    organizationId: text("organization_id").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    role: text("role").default("viewer").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.userId] }),
    foreignKey({
      columns: [table.projectId, table.organizationId],
      foreignColumns: [projects.id, projects.organizationId],
      name: "project_members_project_org_fk",
    }).onDelete("cascade"),
    index("project_members_user_idx").on(table.userId),
  ]
)

export const merchantProfiles = pgTable(
  "merchant_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
    displayName: text("display_name").notNull(),
    address: text("address"),
    contacts: text("contacts"),
    taxIdentifier: text("tax_identifier"),
    logoPath: text("logo_path"),
    preferredTemplateId: text("preferred_template_id").default("classic-80mm").notNull(),
    brandColor: text("brand_color"),
    footer: text("footer"),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
    ...timestamps,
  },
  (table) => [index("merchant_profiles_org_idx").on(table.organizationId)]
)

export const receiptCounters = pgTable(
  "receipt_counters",
  {
    organizationId: text("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
    year: integer("year").notNull(),
    value: integer("value").default(0).notNull(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.year] })]
)

export const receipts = pgTable(
  "receipts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").references(() => organizations.id, { onDelete: "restrict" }).notNull(),
    projectId: uuid("project_id").notNull(),
    archiveId: text("archive_id").notNull(),
    sourceNumber: text("source_number"),
    sourceFingerprint: text("source_fingerprint"),
    status: text("status").default("draft").notNull(),
    documentKind: text("document_kind").default("receipt").notNull(),
    expenseCategory: text("expense_category"),
    templateId: text("template_id").default("classic-80mm").notNull(),
    merchantProfileId: uuid("merchant_profile_id").references(() => merchantProfiles.id, { onDelete: "set null" }),
    merchantName: text("merchant_name").default("").notNull(),
    merchantAddress: text("merchant_address"),
    merchantContacts: text("merchant_contacts"),
    merchantTaxIdentifier: text("merchant_tax_identifier"),
    buyerName: text("buyer_name"),
    buyerTaxIdentifier: text("buyer_tax_identifier"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    currency: text("currency").default("KES").notNull(),
    locale: text("locale").default("en-KE").notNull(),
    timezone: text("timezone").default("Africa/Nairobi").notNull(),
    subtotalMinor: bigint("subtotal_minor", { mode: "number" }).default(0).notNull(),
    discountMinor: bigint("discount_minor", { mode: "number" }).default(0).notNull(),
    taxMinor: bigint("tax_minor", { mode: "number" }).default(0).notNull(),
    feesMinor: bigint("fees_minor", { mode: "number" }).default(0).notNull(),
    totalMinor: bigint("total_minor", { mode: "number" }).default(0).notNull(),
    paymentMethod: text("payment_method"),
    paymentReference: text("payment_reference"),
    fiscalMetadata: jsonb("fiscal_metadata").$type<Record<string, unknown>>().default({}).notNull(),
    calculationWarnings: jsonb("calculation_warnings").$type<string[]>().default([]).notNull(),
    notes: text("notes"),
    footer: text("footer"),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
    updatedById: text("updated_by_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
    finalizedById: text("finalized_by_id").references(() => users.id, { onDelete: "restrict" }),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    voidedById: text("voided_by_id").references(() => users.id, { onDelete: "restrict" }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidReason: text("void_reason"),
    lockVersion: integer("lock_version").default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("receipts_archive_uidx").on(table.archiveId),
    index("receipts_org_status_idx").on(table.organizationId, table.status),
    index("receipts_project_issued_idx").on(table.projectId, table.issuedAt),
    index("receipts_org_fingerprint_idx").on(table.organizationId, table.sourceFingerprint),
    foreignKey({
      columns: [table.projectId, table.organizationId],
      foreignColumns: [projects.id, projects.organizationId],
      name: "receipts_project_org_fk",
    }).onDelete("restrict"),
    check("receipts_currency_length", sql`char_length(${table.currency}) = 3`),
    check("receipts_status_check", sql`${table.status} in ('draft', 'final', 'void')`),
  ]
)

export const receiptItems = pgTable(
  "receipt_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    receiptId: uuid("receipt_id").references(() => receipts.id, { onDelete: "cascade" }).notNull(),
    position: integer("position").notNull(),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 18, scale: 6 }).default("1").notNull(),
    unitPriceMinor: bigint("unit_price_minor", { mode: "number" }).default(0).notNull(),
    discountMinor: bigint("discount_minor", { mode: "number" }).default(0).notNull(),
    taxRateBps: integer("tax_rate_bps"),
    taxMinor: bigint("tax_minor", { mode: "number" }).default(0).notNull(),
    totalMinor: bigint("total_minor", { mode: "number" }).default(0).notNull(),
    sourceEvidence: jsonb("source_evidence").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("receipt_items_receipt_position_uidx").on(table.receiptId, table.position),
    index("receipt_items_receipt_idx").on(table.receiptId),
  ]
)

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    receiptId: uuid("receipt_id").references(() => receipts.id, { onDelete: "restrict" }).notNull(),
    organizationId: text("organization_id").references(() => organizations.id, { onDelete: "restrict" }).notNull(),
    storagePath: text("storage_path").notNull().unique(),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    content: bytea("content"),
    uploadTokenHash: text("upload_token_hash"),
    uploadTokenExpiresAt: timestamp("upload_token_expires_at", { withTimezone: true }),
    sha256: text("sha256"),
    status: text("status").default("pending").notNull(),
    isOriginalSource: boolean("is_original_source").default(true).notNull(),
    uploadedById: text("uploaded_by_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("attachments_receipt_idx").on(table.receiptId), index("attachments_org_idx").on(table.organizationId)]
)

export const aiExtractionAttempts = pgTable(
  "ai_extraction_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    receiptId: uuid("receipt_id").references(() => receipts.id, { onDelete: "cascade" }).notNull(),
    attachmentId: uuid("attachment_id").references(() => attachments.id, { onDelete: "restrict" }).notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    model: text("model").notNull(),
    schemaVersion: text("schema_version").notNull(),
    status: text("status").default("pending").notNull(),
    latencyMs: integer("latency_ms"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    result: jsonb("result").$type<Record<string, unknown>>(),
    safeErrorCode: text("safe_error_code"),
    safeErrorMessage: text("safe_error_message"),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("ai_attempt_idempotency_uidx").on(table.idempotencyKey),
    index("ai_attempt_receipt_idx").on(table.receiptId),
  ]
)

export const receiptVersions = pgTable(
  "receipt_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    receiptId: uuid("receipt_id").references(() => receipts.id, { onDelete: "restrict" }).notNull(),
    version: integer("version").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    reason: text("reason").notNull(),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("receipt_versions_receipt_version_uidx").on(table.receiptId, table.version),
    index("receipt_versions_receipt_idx").on(table.receiptId),
  ]
)

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").references(() => organizations.id, { onDelete: "restrict" }),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "restrict" }),
    effectiveUserId: text("effective_user_id").references(() => users.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    reason: text("reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("audit_org_created_idx").on(table.organizationId, table.createdAt), index("audit_actor_idx").on(table.actorUserId)]
)

export const supportImpersonations = pgTable(
  "support_impersonations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    adminUserId: text("admin_user_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
    targetUserId: text("target_user_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
    reason: text("reason").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (table) => [index("support_impersonations_admin_idx").on(table.adminUserId, table.startedAt)]
)

export const userRelations = relations(users, ({ many }) => ({ sessions: many(sessions), members: many(members) }))
export const organizationRelations = relations(organizations, ({ many, one }) => ({
  members: many(members),
  projects: many(projects),
  settings: one(workspaceSettings),
}))
export const projectRelations = relations(projects, ({ many }) => ({ members: many(projectMembers), receipts: many(receipts) }))
export const receiptRelations = relations(receipts, ({ many }) => ({
  items: many(receiptItems),
  attachments: many(attachments),
  versions: many(receiptVersions),
  attempts: many(aiExtractionAttempts),
}))

export type ReceiptRow = typeof receipts.$inferSelect
export type ReceiptItemRow = typeof receiptItems.$inferSelect
