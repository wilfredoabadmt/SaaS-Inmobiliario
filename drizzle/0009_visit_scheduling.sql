-- Feature 011 (visit-scheduling): calendario real por asesor. Migración ADITIVA (no destructiva):
-- 2 tablas nuevas + 1 enum + 3 columnas en showing. Escrita a mano (drizzle-kit migrate la aplica
-- vía el journal sin necesitar el snapshot). Ver specs/011-visit-scheduling/data-model.md.

-- 1) Enum de estado de conexión de Google Calendar -----------------------------------------
CREATE TYPE "public"."google_calendar_status" AS ENUM('connected', 'reconnect_required', 'disconnected');--> statement-breakpoint

-- 2) calendar_settings (1:1 por organización+usuario) --------------------------------------
CREATE TABLE "calendar_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"weekly_hours" jsonb NOT NULL,
	"slot_minutes" integer DEFAULT 60 NOT NULL,
	"buffer_minutes" integer DEFAULT 0 NOT NULL,
	"timezone" text DEFAULT 'America/Mexico_City' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_settings" ADD CONSTRAINT "calendar_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_settings" ADD CONSTRAINT "calendar_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_settings_org_user_uq" ON "calendar_settings" USING btree ("organization_id","user_id");--> statement-breakpoint

-- 3) google_calendar_credentials (1:1 por organización+usuario) -----------------------------
CREATE TABLE "google_calendar_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"google_sub" text NOT NULL,
	"email" text,
	"calendar_id" text DEFAULT 'primary' NOT NULL,
	"encrypted_access_token" text NOT NULL,
	"access_iv" text NOT NULL,
	"access_auth_tag" text NOT NULL,
	"access_token_expires_at" timestamp NOT NULL,
	"encrypted_refresh_token" text,
	"refresh_iv" text,
	"refresh_auth_tag" text,
	"scope" text,
	"status" "google_calendar_status" DEFAULT 'connected' NOT NULL,
	"connected_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "google_calendar_credentials" ADD CONSTRAINT "google_calendar_credentials_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_calendar_credentials" ADD CONSTRAINT "google_calendar_credentials_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "google_calendar_credentials_org_user_uq" ON "google_calendar_credentials" USING btree ("organization_id","user_id");--> statement-breakpoint

-- 4) Columnas aditivas en showing ----------------------------------------------------------
ALTER TABLE "showing" ADD COLUMN "duration_minutes" integer;--> statement-breakpoint
ALTER TABLE "showing" ADD COLUMN "google_event_id" text;--> statement-breakpoint
ALTER TABLE "showing" ADD COLUMN "reminder_email_sent_at" timestamp;
