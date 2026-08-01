CREATE TABLE "bookmark_items" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"url" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"note" text,
	"tags" jsonb,
	"preview" jsonb,
	"insight" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"total_days" integer NOT NULL,
	"placeholder_days" integer NOT NULL,
	"total_periods" integer NOT NULL,
	"failed_periods" integer NOT NULL,
	"repair_calls" integer NOT NULL,
	"model_outcomes" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learned_items" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"date_key" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"insight" text,
	"tags" jsonb,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topic_completions" (
	"user_id" uuid NOT NULL,
	"day" text NOT NULL,
	"topic_index" integer NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "topic_completions_user_id_day_topic_index_pk" PRIMARY KEY("user_id","day","topic_index")
);
--> statement-breakpoint
CREATE TABLE "topic_resource_cache" (
	"topic_key" text PRIMARY KEY NOT NULL,
	"url" text,
	"title" text,
	"snippet" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_state" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"snapshot" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"subscription_tier" text DEFAULT 'free' NOT NULL,
	"subscription_status" text DEFAULT 'active' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"plan_generations_used" integer DEFAULT 0 NOT NULL,
	"ai_actions_used" integer DEFAULT 0 NOT NULL,
	"free_plan_generations_used" integer DEFAULT 0 NOT NULL,
	"free_ai_actions_used" integer DEFAULT 0 NOT NULL,
	"usage_period_start" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "bookmark_items" ADD CONSTRAINT "bookmark_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learned_items" ADD CONSTRAINT "learned_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_completions" ADD CONSTRAINT "topic_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_state" ADD CONSTRAINT "user_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;