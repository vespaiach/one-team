CREATE TABLE "activity" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_id" uuid NOT NULL,
	"type" text NOT NULL,
	"issue_id" uuid,
	"project_id" uuid,
	"field" text,
	"from_value" text,
	"to_value" text,
	"comment_id" uuid,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "activity_type_valid" CHECK ("activity"."type" in ('created', 'field_changed', 'member_added', 'member_removed', 'archived', 'reopened', 'comment')),
	CONSTRAINT "activity_from_value_length" CHECK (char_length("activity"."from_value") <= 200),
	CONSTRAINT "activity_to_value_length" CHECK (char_length("activity"."to_value") <= 200),
	CONSTRAINT "activity_target_exactly_one" CHECK (num_nonnulls("activity"."issue_id", "activity"."project_id") = 1),
	CONSTRAINT "activity_comment_id_matches_type" CHECK (("activity"."type" = 'comment') = ("activity"."comment_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "comment" (
	"id" uuid PRIMARY KEY NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"issue_id" uuid,
	"project_id" uuid,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "comment_body_length" CHECK (char_length("comment"."body") <= 10000),
	CONSTRAINT "comment_target_exactly_one" CHECK (num_nonnulls("comment"."issue_id", "comment"."project_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_comment_id_comment_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_issue_id_created_at_idx" ON "activity" USING btree ("issue_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_project_id_created_at_idx" ON "activity" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "comment_issue_id_created_at_idx" ON "comment" USING btree ("issue_id","created_at");--> statement-breakpoint
CREATE INDEX "comment_project_id_created_at_idx" ON "comment" USING btree ("project_id","created_at");