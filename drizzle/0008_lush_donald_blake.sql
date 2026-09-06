CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"type" text NOT NULL,
	"issue_id" uuid,
	"project_id" uuid,
	"comment_id" uuid,
	"read_at" timestamp with time zone,
	"emailed_at" timestamp with time zone,
	"send_attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "notification_type_valid" CHECK ("notification"."type" in ('mention', 'assignment', 'comment')),
	CONSTRAINT "notification_target_exactly_one" CHECK (num_nonnulls("notification"."issue_id", "notification"."project_id") = 1),
	CONSTRAINT "notification_actor_not_recipient" CHECK ("notification"."user_id" <> "notification"."actor_id"),
	CONSTRAINT "notification_comment_id_matches_type" CHECK (("notification"."type" = 'assignment') = ("notification"."comment_id" is null)),
	CONSTRAINT "notification_send_attempts_range" CHECK ("notification"."send_attempts" between 0 and 4)
);
--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_comment_id_comment_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_user_id_created_at_idx" ON "notification" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_user_id_unread_idx" ON "notification" USING btree ("user_id") WHERE "notification"."read_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_user_id_comment_id_idx" ON "notification" USING btree ("user_id","comment_id") WHERE "notification"."comment_id" is not null;