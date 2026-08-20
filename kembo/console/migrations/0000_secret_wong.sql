CREATE TABLE `account_recovery` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`purpose` text NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_recovery_account_idx` ON `account_recovery` (`account_id`);--> statement-breakpoint
CREATE TABLE `account_workers` (
	`account_id` text NOT NULL,
	`worker_url` text NOT NULL,
	`registered_at` text NOT NULL,
	PRIMARY KEY(`account_id`, `worker_url`),
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_workers_account_idx` ON `account_workers` (`account_id`);--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`email_verified_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_email_unique` ON `accounts` (`email`);--> statement-breakpoint
CREATE INDEX `accounts_email_idx` ON `accounts` (`email`);--> statement-breakpoint
CREATE TABLE `licenses` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`created_at` text NOT NULL,
	`active` integer NOT NULL,
	`tier` text NOT NULL,
	`status` text NOT NULL,
	`stripe_session_id` text,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`current_period_end` text,
	`note` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `licenses_key_hash_unique` ON `licenses` (`key_hash`);--> statement-breakpoint
CREATE INDEX `licenses_email_idx` ON `licenses` (`email`);--> statement-breakpoint
CREATE INDEX `licenses_customer_idx` ON `licenses` (`stripe_customer_id`);--> statement-breakpoint
CREATE TABLE `product_settings` (
	`service_id` text NOT NULL,
	`filename` text NOT NULL,
	`data` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`service_id`, `filename`)
);
--> statement-breakpoint
CREATE TABLE `waitlist` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`created_at` text NOT NULL,
	`source` text,
	`user_agent` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `waitlist_email_unique` ON `waitlist` (`email`);--> statement-breakpoint
CREATE INDEX `waitlist_created_at_idx` ON `waitlist` (`created_at`);