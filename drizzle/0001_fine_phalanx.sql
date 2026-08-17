CREATE TABLE `chatMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chatId` int NOT NULL,
	`role` enum('user','assistant','system') NOT NULL,
	`content` text NOT NULL,
	`sources` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chatMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(256) NOT NULL DEFAULT 'Neuer Chat',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contractChunks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contractId` int NOT NULL,
	`content` text NOT NULL,
	`pageNumber` int NOT NULL,
	`chunkIndex` int NOT NULL,
	`metadata` json,
	`embedding` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contractChunks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(512) NOT NULL,
	`insuranceCompany` varchar(256),
	`contractNumber` varchar(128),
	`productArea` varchar(512),
	`validFrom` timestamp,
	`validUntil` timestamp,
	`pdfUrl` text NOT NULL,
	`pdfKey` varchar(512) NOT NULL,
	`totalPages` int DEFAULT 0,
	`status` enum('pending','processing','ready','error') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`uploadedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contracts_id` PRIMARY KEY(`id`)
);
