-- Feature 012 (whatsapp-templates): gestión real de plantillas contra Meta. ADITIVA.
-- Extiende `template` (estatus/componentes/sincronización) y añade caché de analítica.
-- Ver specs/012-whatsapp-templates/data-model.md.
ALTER TABLE "template" ADD COLUMN "wa_template_id" text;--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "status" text;--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "rejected_reason" text;--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "quality_rating" text;--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "components" jsonb;--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "last_synced_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "template_org_name_lang_uq" ON "template" ("organization_id","wa_template_name","language");--> statement-breakpoint
CREATE TABLE "template_analytics" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"template_id" text NOT NULL,
	"day" date NOT NULL,
	"sent" integer DEFAULT 0 NOT NULL,
	"delivered" integer DEFAULT 0 NOT NULL,
	"read" integer DEFAULT 0 NOT NULL,
	"clicked" integer DEFAULT 0 NOT NULL,
	"cost" numeric,
	"currency" text,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "template_analytics" ADD CONSTRAINT "template_analytics_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_analytics" ADD CONSTRAINT "template_analytics_template_id_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "template_analytics_tpl_day_uq" ON "template_analytics" ("template_id","day");--> statement-breakpoint
CREATE INDEX "template_analytics_org_idx" ON "template_analytics" ("organization_id");
