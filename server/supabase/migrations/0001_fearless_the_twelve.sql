CREATE TYPE "public"."provider" AS ENUM('google', 'github');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"pwd" text,
	"provider" "provider" NOT NULL,
	"p_id" text NOT NULL,
	"email" text,
	"pfp" text
);
--> statement-breakpoint
DROP TABLE "posts_table" CASCADE;--> statement-breakpoint
DROP TABLE "users_table" CASCADE;