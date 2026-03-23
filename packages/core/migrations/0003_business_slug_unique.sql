CREATE UNIQUE INDEX "business_slug_unique" ON "business" USING btree ("slug") WHERE "slug" IS NOT NULL;--> statement-breakpoint
