CREATE TABLE "offline_idempotency" (
	"id" varchar(30) PRIMARY KEY NOT NULL,
	"user_id" varchar(30) NOT NULL,
	"business_id" varchar(30) NOT NULL,
	"scope" varchar(64) NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "offline_idempotency" ADD CONSTRAINT "offline_idempotency_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "offline_idem_user_scope_business_key_idx" ON "offline_idempotency" USING btree ("user_id","scope","business_id","idempotency_key");
