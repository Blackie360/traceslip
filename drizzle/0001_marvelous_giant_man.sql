ALTER TABLE "attachments" ADD COLUMN "content" "bytea";--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "upload_token_hash" text;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "upload_token_expires_at" timestamp with time zone;