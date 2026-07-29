CREATE TYPE "public"."needs_human_reason" AS ENUM('requested', 'out_of_window', 'uninterpretable', 'ai_error');--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "needs_human_reason" "needs_human_reason";--> statement-breakpoint
ALTER TABLE "message" ADD COLUMN "wa_type" text;