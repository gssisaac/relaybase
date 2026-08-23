CREATE TABLE `beta_invites` (
	`uuid` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `beta_invites_email_unique` ON `beta_invites` (`email`);--> statement-breakpoint
CREATE INDEX `beta_invites_email_idx` ON `beta_invites` (`email`);