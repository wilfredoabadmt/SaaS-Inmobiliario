ALTER TABLE "property" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
CREATE INDEX "property_org_archived_idx" ON "property" USING btree ("organization_id","archived_at");