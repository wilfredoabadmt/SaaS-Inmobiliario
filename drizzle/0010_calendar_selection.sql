-- Feature 011 (visit-scheduling) US4: selección de calendarios. Aditiva.
-- `conflict_calendar_ids` (jsonb array) = calendarios que cuentan para conflictos en freeBusy.
-- Null → se usa solo el calendario destino (`calendar_id`). Ver data-model.md.
ALTER TABLE "google_calendar_credentials" ADD COLUMN "conflict_calendar_ids" jsonb;
