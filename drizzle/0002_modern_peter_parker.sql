CREATE TABLE "invite" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"invited_by" uuid NOT NULL,
	"token_digest" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "invite_token_digest_unique" UNIQUE("token_digest"),
	CONSTRAINT "invite_email_length" CHECK (char_length("invite"."email") <= 200),
	CONSTRAINT "invite_token_digest_length" CHECK (char_length("invite"."token_digest") = 64)
);
--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invite_email_lower_unspent_idx" ON "invite" USING btree (lower("email")) WHERE "invite"."accepted_at" is null;