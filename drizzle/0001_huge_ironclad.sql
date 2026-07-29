CREATE TABLE "client_requirements" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"client_id" text NOT NULL,
	"operation" "operation_type",
	"budget_min" numeric(14, 2),
	"budget_max" numeric(14, 2),
	"zone" text,
	"property_type" "property_type",
	"bedrooms" integer,
	"bathrooms" numeric(3, 1),
	"notes" text,
	"source" text DEFAULT 'ai' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "ai_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "needs_human" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "message" ADD COLUMN "ai_generated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "client_requirements" ADD CONSTRAINT "client_requirements_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_requirements" ADD CONSTRAINT "client_requirements_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "client_requirements_org_client_uq" ON "client_requirements" USING btree ("organization_id","client_id");--> statement-breakpoint
CREATE INDEX "client_requirements_org_idx" ON "client_requirements" USING btree ("organization_id");