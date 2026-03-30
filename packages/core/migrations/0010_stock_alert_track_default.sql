ALTER TABLE "product" RENAME COLUMN "reorder_level" TO "stock_alert";--> statement-breakpoint
ALTER TABLE "product" ALTER COLUMN "track_stock" SET DEFAULT false;
