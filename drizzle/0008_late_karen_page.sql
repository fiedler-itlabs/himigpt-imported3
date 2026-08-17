ALTER TABLE `contracts` ADD `parentContractId` int;--> statement-breakpoint
ALTER TABLE `contracts` ADD `contractType` enum('main','extension','pricelist','productgroup','regional') DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE `contracts` ADD `displayOrder` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `contracts` ADD `productGroups` varchar(128);