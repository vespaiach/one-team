CREATE TABLE "issue" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"column_id" uuid NOT NULL,
	"priority" text DEFAULT 'none' NOT NULL,
	"assignee_id" uuid,
	"due_date" date,
	"created_by" uuid NOT NULL,
	"sort_order" text collate "C" NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "issue_project_id_number_unique" UNIQUE("project_id","number"),
	CONSTRAINT "issue_title_length" CHECK (char_length("issue"."title") <= 200),
	CONSTRAINT "issue_description_length" CHECK (char_length("issue"."description") <= 10000),
	CONSTRAINT "issue_priority_valid" CHECK ("issue"."priority" in ('none', 'low', 'medium', 'high', 'urgent'))
);
--> statement-breakpoint
ALTER TABLE "board_column" ADD CONSTRAINT "board_column_project_id_id_unique" UNIQUE("project_id","id");--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_assignee_id_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_project_id_column_id_fk" FOREIGN KEY ("project_id","column_id") REFERENCES "public"."board_column"("project_id","id") ON DELETE no action ON UPDATE no action;