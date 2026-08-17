CREATE TABLE `contractCustomData` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contractId` int NOT NULL,
	`columnId` int NOT NULL,
	`value` text,
	`extractedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contractCustomData_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customColumns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`description` text NOT NULL,
	`dataType` enum('text','number','date') NOT NULL DEFAULT 'text',
	`displayOrder` int NOT NULL DEFAULT 0,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customColumns_id` PRIMARY KEY(`id`)
);
