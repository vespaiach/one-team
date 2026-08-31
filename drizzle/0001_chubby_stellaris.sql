CREATE TABLE "auth_attempt" (
	"id" uuid PRIMARY KEY NOT NULL,
	"flow" text NOT NULL,
	"kind" text NOT NULL,
	"subject" text NOT NULL,
	"attempted_at" timestamp with time zone NOT NULL,
	CONSTRAINT "auth_attempt_flow_valid" CHECK ("auth_attempt"."flow" in ('signin', 'reset')),
	CONSTRAINT "auth_attempt_kind_valid" CHECK ("auth_attempt"."kind" in ('email', 'ip')),
	CONSTRAINT "auth_attempt_subject_length" CHECK (char_length("auth_attempt"."subject") <= 200)
);
--> statement-breakpoint
CREATE TABLE "credential" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "credential_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "credential_password_hash_length" CHECK (char_length("credential"."password_hash") <= 255)
);
--> statement-breakpoint
CREATE TABLE "reset_token" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token_digest" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "reset_token_token_digest_unique" UNIQUE("token_digest"),
	CONSTRAINT "reset_token_token_digest_length" CHECK (char_length("reset_token"."token_digest") = 64)
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token_digest" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text,
	"ip_address" text NOT NULL,
	CONSTRAINT "session_token_digest_unique" UNIQUE("token_digest"),
	CONSTRAINT "session_token_digest_length" CHECK (char_length("session"."token_digest") = 64),
	CONSTRAINT "session_user_agent_length" CHECK (char_length("session"."user_agent") <= 1000),
	CONSTRAINT "session_ip_address_length" CHECK (char_length("session"."ip_address") <= 45)
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"avatar_url" text,
	"role" text DEFAULT 'member' NOT NULL,
	"job_title" text,
	"slack_handle" text,
	"phone" text,
	"bio" text,
	"deactivated_at" timestamp with time zone,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"feed_filter" text DEFAULT 'all' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_first_name_length" CHECK (char_length("user"."first_name") <= 200),
	CONSTRAINT "user_last_name_length" CHECK (char_length("user"."last_name") <= 200),
	CONSTRAINT "user_email_length" CHECK (char_length("user"."email") <= 200),
	CONSTRAINT "user_avatar_url_length" CHECK (char_length("user"."avatar_url") <= 2000),
	CONSTRAINT "user_role_valid" CHECK ("user"."role" in ('admin', 'member')),
	CONSTRAINT "user_job_title_length" CHECK (char_length("user"."job_title") <= 200),
	CONSTRAINT "user_slack_handle_length" CHECK (char_length("user"."slack_handle") <= 200),
	CONSTRAINT "user_phone_length" CHECK (char_length("user"."phone") <= 200),
	CONSTRAINT "user_bio_length" CHECK (char_length("user"."bio") <= 10000),
	CONSTRAINT "user_feed_filter_valid" CHECK ("user"."feed_filter" in ('comments', 'all'))
);
--> statement-breakpoint
DROP TABLE "setup_check" CASCADE;--> statement-breakpoint
ALTER TABLE "credential" ADD CONSTRAINT "credential_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reset_token" ADD CONSTRAINT "reset_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_attempt_flow_kind_subject_attempted_at_idx" ON "auth_attempt" USING btree ("flow","kind","subject","attempted_at");--> statement-breakpoint
CREATE INDEX "auth_attempt_attempted_at_idx" ON "auth_attempt" USING btree ("attempted_at");--> statement-breakpoint
CREATE INDEX "reset_token_user_id_idx" ON "reset_token" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_expires_at_idx" ON "session" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_lower_idx" ON "user" USING btree (lower("email"));