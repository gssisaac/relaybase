-- Owner login (issued passtoken) replaces the static ADMIN_TOKEN.
-- Numbered 0003 because local dogfood already shipped 0002_app_settings.
-- admin_token column is no longer read; it is dropped here.
ALTER TABLE `owner_config` DROP COLUMN `admin_token`;
--> statement-breakpoint
ALTER TABLE `owner_config` ADD `admin_username` text;
--> statement-breakpoint
ALTER TABLE `owner_config` ADD `passtoken_salt` text;
--> statement-breakpoint
ALTER TABLE `owner_config` ADD `passtoken_hash` text;
--> statement-breakpoint
ALTER TABLE `owner_config` ADD `passtoken_prefix` text;
--> statement-breakpoint
ALTER TABLE `owner_config` ADD `passtoken_updated_at` text;
--> statement-breakpoint
ALTER TABLE `owner_config` ADD `failed_attempts` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `owner_config` ADD `locked_until` text;
--> statement-breakpoint
CREATE TABLE `owner_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`family` text NOT NULL,
	`label` text,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `owner_sessions_token_hash_unique` ON `owner_sessions` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `owner_sessions_family_idx` ON `owner_sessions` (`family`);
--> statement-breakpoint
-- Dashboard rb-auth tokens are removed; the desktop owner session replaces them.
DROP TABLE IF EXISTS `auth_tokens`;
