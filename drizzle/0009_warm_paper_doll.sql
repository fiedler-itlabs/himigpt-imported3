ALTER TABLE `contracts` ADD `isArchived` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `contracts` ADD `archivedAt` timestamp;--> statement-breakpoint
ALTER TABLE `contracts` ADD `replacedByContractId` int;--> statement-breakpoint
ALTER TABLE `contracts` ADD `versionNumber` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `contracts` ADD `versionLabel` varchar(64);