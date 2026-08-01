ALTER TABLE "bookmark_items" ADD COLUMN "favorite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "learned_items" ADD COLUMN "favorite" boolean DEFAULT false NOT NULL;