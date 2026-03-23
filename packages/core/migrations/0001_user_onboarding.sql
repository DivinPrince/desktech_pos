ALTER TABLE "user" ADD COLUMN "should_onboard" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "completed_steps" text;
