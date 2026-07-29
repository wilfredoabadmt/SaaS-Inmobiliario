ALTER TABLE "client" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
CREATE INDEX "client_org_archived_idx" ON "client" USING btree ("organization_id","archived_at");