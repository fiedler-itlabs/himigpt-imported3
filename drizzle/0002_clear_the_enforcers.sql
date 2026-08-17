ALTER TABLE `chatMessages` ADD `feedback` enum('positive','negative');--> statement-breakpoint
ALTER TABLE `contracts` ADD `contactPerson` varchar(256);--> statement-breakpoint
ALTER TABLE `contracts` ADD `contactEmail` varchar(320);--> statement-breakpoint
ALTER TABLE `contracts` ADD `contactPhone` varchar(64);--> statement-breakpoint
ALTER TABLE `contracts` ADD `notes` text;