ALTER TABLE support_enquiries
  MODIFY COLUMN status ENUM('open', 'in_progress', 'resolved', 'closed') NOT NULL DEFAULT 'open';
