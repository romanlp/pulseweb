CREATE TABLE `run_activity_projection` (
	`user_id` text NOT NULL,
	`source_run_id` text NOT NULL,
	`started_at_epoch_millis` integer NOT NULL,
	`ended_at_epoch_millis` integer NOT NULL,
	`status` text NOT NULL,
	`outcome` text NOT NULL,
	`workout_label` text,
	`location_count` integer NOT NULL,
	`heart_rate_count` integer NOT NULL,
	`cue_count` integer NOT NULL,
	`pause_count` integer NOT NULL,
	`execution_count` integer NOT NULL,
	PRIMARY KEY(`user_id`, `source_run_id`),
	FOREIGN KEY (`user_id`,`source_run_id`) REFERENCES `run_activity`(`user_id`,`source_run_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `run_activity_projection_owner_started_idx` ON `run_activity_projection` (`user_id`,`started_at_epoch_millis`,`source_run_id`);