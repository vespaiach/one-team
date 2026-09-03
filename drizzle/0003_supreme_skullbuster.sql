CREATE TABLE "board_column" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" text collate "C" NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "board_column_name_length" CHECK (char_length("board_column"."name") <= 200),
	CONSTRAINT "board_column_kind_valid" CHECK ("board_column"."kind" in ('open', 'done', 'canceled'))
);
--> statement-breakpoint
CREATE TABLE "issue_counter" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "issue_counter_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"start_date" date,
	"target_date" date,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "project_key_unique" UNIQUE("key"),
	CONSTRAINT "project_key_pattern" CHECK ("project"."key" ~ '^[A-Z][A-Z0-9]{0,7}$'),
	CONSTRAINT "project_key_length" CHECK (char_length("project"."key") <= 200),
	CONSTRAINT "project_name_length" CHECK (char_length("project"."name") <= 200),
	CONSTRAINT "project_description_length" CHECK (char_length("project"."description") <= 10000),
	CONSTRAINT "project_status_valid" CHECK ("project"."status" in ('active', 'archived')),
	CONSTRAINT "project_dates_ordered" CHECK ("project"."start_date" is null or "project"."target_date" is null or "project"."target_date" >= "project"."start_date")
);
--> statement-breakpoint
CREATE TABLE "project_member" (
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "project_member_project_id_user_id_pk" PRIMARY KEY("project_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "board_column" ADD CONSTRAINT "board_column_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_counter" ADD CONSTRAINT "issue_counter_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "board_column_project_id_name_lower_idx" ON "board_column" USING btree ("project_id",lower("name"));