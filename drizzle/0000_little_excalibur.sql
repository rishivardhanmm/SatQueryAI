CREATE TABLE `analyses` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `images` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL
);
