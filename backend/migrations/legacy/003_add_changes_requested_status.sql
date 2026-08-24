ALTER TABLE auctions MODIFY COLUMN status ENUM('draft', 'pending', 'approved', 'rejected', 'closed', 'changes_requested') NOT NULL DEFAULT 'draft';
