CREATE TABLE "demo_item" (
	"id" varchar(30) PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"body" text,
	"created_by_user_id" varchar(30),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "demo_item" ADD CONSTRAINT "demo_item_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
