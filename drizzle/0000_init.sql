CREATE TYPE "public"."attend_status" AS ENUM('yes', 'no');--> statement-breakpoint
CREATE TYPE "public"."audience" AS ENUM('family', 'friends', 'colleagues');--> statement-breakpoint
CREATE TYPE "public"."plus_one_policy" AS ENUM('none', 'allowed');--> statement-breakpoint
CREATE TYPE "public"."reminder_stage" AS ENUM('d30', 'd7');--> statement-breakpoint
CREATE TYPE "public"."reminder_status" AS ENUM('sent', 'skipped', 'failed');--> statement-breakpoint
CREATE TABLE "guest_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"guest_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"party_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"display_name" text NOT NULL,
	"name_key" text NOT NULL,
	"is_plus_one" boolean DEFAULT false NOT NULL,
	"invited_by_guest_id" uuid,
	"telegram_username" text,
	"telegram_chat_id" bigint,
	"bot_token" text NOT NULL,
	"bot_started_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"audience" "audience" NOT NULL,
	"plus_one_policy" "plus_one_policy" DEFAULT 'none' NOT NULL,
	"invited_to_registry" boolean DEFAULT false NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guest_id" uuid NOT NULL,
	"stage" "reminder_stage" NOT NULL,
	"status" "reminder_status" NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rsvps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guest_id" uuid NOT NULL,
	"attending" "attend_status" NOT NULL,
	"attending_registry" boolean DEFAULT false NOT NULL,
	"main_courses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"drinks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"allergies" text,
	"needs_transfer" boolean DEFAULT false NOT NULL,
	"song_request" text,
	"comment" text,
	"source" text NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unknown_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raw_name" text NOT NULL,
	"contact" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guest_sessions" ADD CONSTRAINT "guest_sessions_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests" ADD CONSTRAINT "guests_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guests_name_key_idx" ON "guests" USING btree ("name_key");--> statement-breakpoint
CREATE INDEX "guests_party_idx" ON "guests" USING btree ("party_id");--> statement-breakpoint
CREATE UNIQUE INDEX "guests_bot_token_idx" ON "guests" USING btree ("bot_token");--> statement-breakpoint
CREATE UNIQUE INDEX "guests_chat_id_idx" ON "guests" USING btree ("telegram_chat_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reminders_dedupe_idx" ON "reminders" USING btree ("guest_id","stage");--> statement-breakpoint
CREATE UNIQUE INDEX "rsvps_guest_idx" ON "rsvps" USING btree ("guest_id");