-- Feature 010 (sales-pipeline): etapas configurables por organización + trato sin propiedad.
-- Migración con BACKFILL (seed-then-map) ESCRITA A MANO: drizzle-kit no genera data-migrations.
-- Preserva la etapa de cada candidacy vivo (no destructiva para datos). Ver
-- specs/010-sales-pipeline/data-model.md §3.
--
-- NOTA DE DESPLIEGUE: el snapshot drizzle (meta/0008_snapshot.json) se reconcilia en el deploy
-- (correr `drizzle-kit generate` respondiendo "create column" al prompt de stage→stage_id y
-- conservar ESTE .sql en vez del autogenerado). `drizzle-kit migrate` aplica este archivo vía el
-- journal sin necesitar el snapshot.

-- 1) Tabla nueva pipeline_stage (org-scoped) -------------------------------------------------
CREATE TABLE "pipeline_stage" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer NOT NULL,
	"kind" text DEFAULT 'normal' NOT NULL,
	"color" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pipeline_stage" ADD CONSTRAINT "pipeline_stage_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pipeline_stage_org_order_idx" ON "pipeline_stage" USING btree ("organization_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "pipeline_stage_org_kind_anchor_uq" ON "pipeline_stage" USING btree ("organization_id","kind") WHERE "pipeline_stage"."kind" <> 'normal';--> statement-breakpoint

-- 2) Sembrar las 8 etapas por defecto POR organización (id determinista por org+orden) -------
INSERT INTO "pipeline_stage" ("id","organization_id","label","sort_order","kind","color")
SELECT 'pst_' || md5(o."id" || '-' || s.sort_order::text), o."id", s.label, s.sort_order, s.kind, s.color
FROM "organization" o
CROSS JOIN (VALUES
	('Nuevo', 0, 'normal', '--stage-nuevo'),
	('Contactado', 1, 'normal', '--stage-contactado'),
	('Calificado', 2, 'normal', '--stage-calificado'),
	('Visita agendada', 3, 'visit', '--stage-visita'),
	('Documentación', 4, 'normal', '--stage-documentacion'),
	('En negociación', 5, 'normal', '--stage-negociacion'),
	('Ganado', 6, 'won', '--stage-ganado'),
	('Perdido', 7, 'lost', NULL)
) AS s(label, sort_order, kind, color);--> statement-breakpoint

-- 3) candidacy.stage_id (nullable temporal) --------------------------------------------------
ALTER TABLE "candidacy" ADD COLUMN "stage_id" text;--> statement-breakpoint

-- 4) Backfill: mapear el enum viejo a la etapa sembrada de la MISMA org (por label) ----------
UPDATE "candidacy" c
SET "stage_id" = ps."id"
FROM "pipeline_stage" ps
WHERE ps."organization_id" = c."organization_id"
  AND ps."label" = (CASE c."stage"
	WHEN 'nuevo' THEN 'Nuevo'
	WHEN 'contactado' THEN 'Contactado'
	WHEN 'calificado' THEN 'Calificado'
	WHEN 'visita_agendada' THEN 'Visita agendada'
	WHEN 'documentacion' THEN 'Documentación'
	WHEN 'en_negociacion' THEN 'En negociación'
	WHEN 'ganado' THEN 'Ganado'
	WHEN 'perdido' THEN 'Perdido'
  END);--> statement-breakpoint

-- 5) stage_id NOT NULL + FK (ON DELETE restrict = no borrar etapa con tratos) ---------------
ALTER TABLE "candidacy" ALTER COLUMN "stage_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "candidacy" ADD CONSTRAINT "candidacy_stage_id_pipeline_stage_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."pipeline_stage"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

-- 6) Retirar la columna/enum/índice viejos de etapa -----------------------------------------
DROP INDEX "candidacy_org_stage_idx";--> statement-breakpoint
ALTER TABLE "candidacy" DROP COLUMN "stage";--> statement-breakpoint
DROP TYPE "public"."candidacy_stage";--> statement-breakpoint

-- 7) property_id nullable + ON DELETE set null ----------------------------------------------
ALTER TABLE "candidacy" DROP CONSTRAINT "candidacy_property_id_property_id_fk";--> statement-breakpoint
ALTER TABLE "candidacy" ALTER COLUMN "property_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "candidacy" ADD CONSTRAINT "candidacy_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- 8) Índice nuevo por etapa + unique parcial de trato sin propiedad --------------------------
CREATE INDEX "candidacy_org_stage_idx" ON "candidacy" USING btree ("organization_id","stage_id");--> statement-breakpoint
CREATE UNIQUE INDEX "candidacy_org_client_noprop_uq" ON "candidacy" USING btree ("organization_id","client_id") WHERE "candidacy"."property_id" IS NULL;
