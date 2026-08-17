CREATE TABLE `contractSummaries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contractId` int NOT NULL,
	`templateId` int NOT NULL,
	`content` text NOT NULL,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`generatedBy` int NOT NULL,
	CONSTRAINT `contractSummaries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `summaryTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('backOffice','sales','management','all','custom') NOT NULL,
	`title` varchar(256) NOT NULL,
	`prompt` text NOT NULL,
	`displayOrder` int NOT NULL DEFAULT 0,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `summaryTemplates_id` PRIMARY KEY(`id`)
);
