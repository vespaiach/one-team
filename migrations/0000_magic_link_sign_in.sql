CREATE TABLE "magic_links" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "magic_links_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"member_id" bigint NOT NULL,
	"token_hash" text NOT NULL,
	"destination" text,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "magic_links_token_hash_key" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "members_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"username" text NOT NULL,
	"role" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_role_check" CHECK ("members"."role" in ('admin', 'member'))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"member_id" bigint NOT NULL,
	"token_hash" text NOT NULL,
	"magic_link_id" bigint,
	"request_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "sessions_token_hash_key" UNIQUE("token_hash"),
	CONSTRAINT "sessions_request_id_key" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE TABLE "sign_in_attempts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sign_in_attempts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"email_key" text NOT NULL,
	"ip" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sign_in_requests" (
	"request_id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "magic_links" ADD CONSTRAINT "magic_links_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_magic_link_id_magic_links_id_fk" FOREIGN KEY ("magic_link_id") REFERENCES "public"."magic_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "members_email_key" ON "members" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "members_username_key" ON "members" USING btree (lower("username"));--> statement-breakpoint
CREATE INDEX "sessions_member_id_idx" ON "sessions" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "sign_in_attempts_email_key_created_at_idx" ON "sign_in_attempts" USING btree ("email_key","created_at");--> statement-breakpoint
CREATE INDEX "sign_in_attempts_ip_created_at_idx" ON "sign_in_attempts" USING btree ("ip","created_at");