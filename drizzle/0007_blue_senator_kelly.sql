CREATE TABLE `comparisonHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(256) NOT NULL,
	`query` text NOT NULL,
	`contractIds` json NOT NULL,
	`result` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `comparisonHistory_id` PRIMARY KEY(`id`)
);
