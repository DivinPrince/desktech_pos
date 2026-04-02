ALTER TABLE IF EXISTS "stock_movement" DROP CONSTRAINT IF EXISTS "stock_movement_product_variant_id_product_variant_id_fk";
--> statement-breakpoint
ALTER TABLE IF EXISTS "sale_line" DROP CONSTRAINT IF EXISTS "sale_line_product_variant_id_product_variant_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "stock_movement_variant_idx";--> statement-breakpoint
ALTER TABLE IF EXISTS "stock_movement" DROP COLUMN IF EXISTS "product_variant_id";--> statement-breakpoint
ALTER TABLE IF EXISTS "sale_line" DROP COLUMN IF EXISTS "product_variant_id";--> statement-breakpoint
ALTER TABLE IF EXISTS "product_variant_stock" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "product_variant" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE IF EXISTS "product_variant_stock" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "product_variant" CASCADE;