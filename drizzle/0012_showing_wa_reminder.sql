-- Feature 016 (automated-visit-reminders): recordatorio por WhatsApp al cliente. ADITIVA.
-- Añade columna para idempotencia del envío de plantilla o mensaje al cliente.
ALTER TABLE "showing" ADD COLUMN "reminder_wa_sent_at" timestamp;
