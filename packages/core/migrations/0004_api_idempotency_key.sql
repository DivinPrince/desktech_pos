CREATE TABLE "api_idempotency_key" (
	"user_id" text NOT NULL,
	"business_id" text NOT NULL,
	"key" text NOT NULL,
	"response_status" integer DEFAULT 0 NOT NULL,
	"response_body" text DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_idempotency_key_pkey" PRIMARY KEY("user_id","business_id","key")
);
