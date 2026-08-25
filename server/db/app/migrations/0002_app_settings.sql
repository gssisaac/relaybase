CREATE TABLE `app_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`inbound_retain_per_domain` integer,
	`updated_at` text NOT NULL
);
