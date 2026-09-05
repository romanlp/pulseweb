CREATE TABLE `run_activity` (
	`user_id` text NOT NULL,
	`source_run_id` text NOT NULL,
	`schema_version` integer NOT NULL,
	`content_sha256` text NOT NULL,
	`payload_byte_count` integer NOT NULL,
	`chunk_count` integer NOT NULL,
	`received_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`user_id`, `source_run_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `run_activity_payload_chunk` (
	`user_id` text NOT NULL,
	`source_run_id` text NOT NULL,
	`ordinal` integer NOT NULL,
	`payload` blob NOT NULL,
	PRIMARY KEY(`user_id`, `source_run_id`, `ordinal`),
	FOREIGN KEY (`user_id`,`source_run_id`) REFERENCES `run_activity`(`user_id`,`source_run_id`) ON UPDATE no action ON DELETE cascade
);
