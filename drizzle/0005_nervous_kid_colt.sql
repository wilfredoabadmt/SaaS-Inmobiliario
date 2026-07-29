CREATE TYPE "public"."ig_connection_status" AS ENUM('connected', 'disconnected', 'expired', 'reconnect_required');--> statement-breakpoint
CREATE TABLE "instagram_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"ig_user_id" text NOT NULL,
	"username" text NOT NULL,
	"encrypted_token" text NOT NULL,
	"token_iv" text NOT NULL,
	"auth_tag" text NOT NULL,
	"token_expires_at" timestamp NOT NULL,
	"status" "ig_connection_status" DEFAULT 'connected' NOT NULL,
	"connected_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instagram_dm" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"counterparty_igsid" text NOT NULL,
	"direction" "message_direction" NOT NULL,
	"text" text,
	"ig_message_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instagram_post" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"ig_media_id" text NOT NULL,
	"property_id" text,
	"caption" text,
	"media_type" text DEFAULT 'IMAGE' NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "instagram_credentials" ADD CONSTRAINT "instagram_credentials_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instagram_dm" ADD CONSTRAINT "instagram_dm_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instagram_post" ADD CONSTRAINT "instagram_post_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instagram_post" ADD CONSTRAINT "instagram_post_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instagram_post" ADD CONSTRAINT "instagram_post_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "instagram_credentials_org_uq" ON "instagram_credentials" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "instagram_credentials_ig_user_uq" ON "instagram_credentials" USING btree ("ig_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "instagram_dm_message_uq" ON "instagram_dm" USING btree ("ig_message_id");--> statement-breakpoint
CREATE INDEX "instagram_dm_org_counterparty_idx" ON "instagram_dm" USING btree ("organization_id","counterparty_igsid");--> statement-breakpoint
CREATE UNIQUE INDEX "instagram_post_media_uq" ON "instagram_post" USING btree ("ig_media_id");--> statement-breakpoint
CREATE INDEX "instagram_post_org_idx" ON "instagram_post" USING btree ("organization_id");