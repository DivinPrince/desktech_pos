CREATE TABLE "product_variant" (
	"id" varchar(30) PRIMARY KEY NOT NULL,
	"business_id" varchar(30) NOT NULL,
	"product_id" varchar(30) NOT NULL,
	"name" varchar(255) NOT NULL,
	"sku" varchar(120),
	"price_cents" bigint NOT NULL,
	"cost_cents" bigint,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variant_stock" (
	"business_id" varchar(30) NOT NULL,
	"product_variant_id" varchar(30) NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_variant_stock_business_id_product_variant_id_pk" PRIMARY KEY("business_id","product_variant_id")
);
--> statement-breakpoint
ALTER TABLE "stock_movement" ADD COLUMN "product_variant_id" varchar(30);--> statement-breakpoint
ALTER TABLE "sale_line" ADD COLUMN "product_variant_id" varchar(30);--> statement-breakpoint
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_stock" ADD CONSTRAINT "product_variant_stock_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_stock" ADD CONSTRAINT "product_variant_stock_product_variant_id_product_variant_id_fk" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_product_variant_id_product_variant_id_fk" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_line" ADD CONSTRAINT "sale_line_product_variant_id_product_variant_id_fk" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_variant_product_idx" ON "product_variant" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_variant_business_idx" ON "product_variant" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "product_variant_business_sku_idx" ON "product_variant" USING btree ("business_id","sku");--> statement-breakpoint
CREATE INDEX "stock_movement_variant_idx" ON "stock_movement" USING btree ("product_variant_id");--> statement-breakpoint
CREATE INDEX "sale_line_product_variant_idx" ON "sale_line" USING btree ("product_variant_id");
