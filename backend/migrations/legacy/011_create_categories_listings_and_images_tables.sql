-- Migration 011: Create categories, subcategories, listings, and listing_images tables
-- Non-destructive migration creating new marketplace listing structures and populating them from legacy auctions & categories.

-- 1. Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT NULL,
  image_url VARCHAR(500) NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_slug (slug),
  KEY idx_categories_order_active (display_order, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Create subcategories table
CREATE TABLE IF NOT EXISTS subcategories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_subcategories_slug (slug),
  KEY idx_subcategories_category_order (category_id, display_order, is_active),
  CONSTRAINT fk_subcategories_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Seed default categories from hardcoded lists
INSERT INTO categories (name, slug, description, display_order, is_active) VALUES
('Electronics & Tech', 'electronics', 'Cameras, audio, computing and devices', 1, TRUE),
('Automotive & Vehicles', 'vehicles', 'Inspected cars, motorcycles and commercial vehicles', 2, TRUE),
('Antiques & Collectibles', 'collectibles', 'Art, coins, memorabilia and rare finds', 3, TRUE),
('Fashion & Luxury', 'fashion-luxury', 'Luxury apparel, bags and designer items', 4, TRUE),
('Jewelry & Watches', 'jewelry-watches', 'Fine jewelry, watches and precious gems', 5, TRUE),
('Industrial & Equipment', 'industrial-equipment', 'Machinery, tools and business assets', 6, TRUE),
('Home & Lifestyle', 'home-lifestyle', 'Furniture, décor and home appliances', 7, TRUE),
('Art & Paintings', 'art-paintings', 'Original paintings, sculptures and fine art', 8, TRUE),
('Real Estate', 'real-estate', 'Residential, commercial land and property', 9, TRUE),
('Other', 'other', 'Distinctive lots worth exploring', 10, TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description);

-- 4. Seed default subcategories
INSERT INTO subcategories (category_id, name, slug, description, display_order, is_active) VALUES
-- Electronics
((SELECT id FROM categories WHERE slug = 'electronics'), 'Audio & Sound', 'audio-sound', 'Headphones, speakers and sound systems', 1, TRUE),
((SELECT id FROM categories WHERE slug = 'electronics'), 'Cameras & Optics', 'cameras-optics', 'DSLR, lenses and photography gear', 2, TRUE),
((SELECT id FROM categories WHERE slug = 'electronics'), 'Computers & Laptops', 'computers-laptops', 'Desktops, laptops and components', 3, TRUE),
((SELECT id FROM categories WHERE slug = 'electronics'), 'Mobile & Devices', 'mobile-devices', 'Smartphones, tablets and wearables', 4, TRUE),

-- Vehicles
((SELECT id FROM categories WHERE slug = 'vehicles'), 'Cars & Sedans', 'cars-sedans', 'Passenger cars, SUVs and luxury vehicles', 1, TRUE),
((SELECT id FROM categories WHERE slug = 'vehicles'), 'Motorcycles & Two-Wheelers', 'motorcycles', 'Bikes, scooters and cruisers', 2, TRUE),
((SELECT id FROM categories WHERE slug = 'vehicles'), 'Commercial & Trucks', 'commercial-trucks', 'Trucks, vans and fleet vehicles', 3, TRUE),

-- Collectibles
((SELECT id FROM categories WHERE slug = 'collectibles'), 'Coins & Stamps', 'coins-stamps', 'Rare coins, currency and postal stamps', 1, TRUE),
((SELECT id FROM categories WHERE slug = 'collectibles'), 'Vintage & Antiquities', 'vintage-antiquities', 'Historical items and antique decor', 2, TRUE),

-- Fashion
((SELECT id FROM categories WHERE slug = 'fashion-luxury'), 'Designer Apparel', 'designer-apparel', 'Luxury coats, dresses and formalwear', 1, TRUE),
((SELECT id FROM categories WHERE slug = 'fashion-luxury'), 'Bags & Accessories', 'bags-accessories', 'Handbags, wallets and leather goods', 2, TRUE),

-- Jewelry & Watches
((SELECT id FROM categories WHERE slug = 'jewelry-watches'), 'Fine Jewelry', 'fine-jewelry', 'Rings, necklaces and precious ornaments', 1, TRUE),
((SELECT id FROM categories WHERE slug = 'jewelry-watches'), 'Luxury Watches', 'luxury-watches', 'Chronographs, automatic and vintage timepieces', 2, TRUE),

-- Industrial
((SELECT id FROM categories WHERE slug = 'industrial-equipment'), 'Machinery & Tools', 'machinery-tools', 'Heavy machinery, CNC and industrial tools', 1, TRUE),
((SELECT id FROM categories WHERE slug = 'industrial-equipment'), 'Commercial Assets', 'commercial-assets', 'Restaurant, office and retail inventory', 2, TRUE),

-- Home
((SELECT id FROM categories WHERE slug = 'home-lifestyle'), 'Furniture & Decor', 'furniture-decor', 'Sofas, tables, lighting and home decor', 1, TRUE),
((SELECT id FROM categories WHERE slug = 'home-lifestyle'), 'Home Appliances', 'home-appliances', 'Kitchen and household appliances', 2, TRUE),

-- Art
((SELECT id FROM categories WHERE slug = 'art-paintings'), 'Original Paintings', 'original-paintings', 'Oil, acrylic and watercolor paintings', 1, TRUE),
((SELECT id FROM categories WHERE slug = 'art-paintings'), 'Sculptures & Prints', 'sculptures-prints', 'Bronze, stone sculptures and fine prints', 2, TRUE),

-- Real Estate
((SELECT id FROM categories WHERE slug = 'real-estate'), 'Residential Property', 'residential-property', 'Plots, apartments and villas', 1, TRUE),
((SELECT id FROM categories WHERE slug = 'real-estate'), 'Commercial Property', 'commercial-property', 'Offices, shops and industrial plots', 2, TRUE),

-- Other
((SELECT id FROM categories WHERE slug = 'other'), 'General & Miscellaneous', 'general-misc', 'All other unique listings', 1, TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 5. Create listings table
CREATE TABLE IF NOT EXISTS listings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  seller_id BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  subcategory_id BIGINT UNSIGNED NULL,
  sale_mode ENUM('negotiated_offer', 'multi_unit_offer') NOT NULL DEFAULT 'negotiated_offer',
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  `condition` ENUM('new', 'like-new', 'used', 'refurbished') NOT NULL,
  location VARCHAR(120) NOT NULL,
  asking_price DECIMAL(15,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  offer_selection_deadline DATETIME NULL,
  public_slug VARCHAR(180) NOT NULL,
  listing_reference VARCHAR(30) NOT NULL,
  review_status ENUM(
    'draft',
    'submitted',
    'under_review',
    'approved',
    'scheduled',
    'open',
    'offer_selection',
    'sold',
    'partially_sold',
    'unsold',
    'completed',
    'changes_requested',
    'rejected',
    'cancelled',
    'suspended',
    'expired'
  ) NOT NULL DEFAULT 'draft',
  review_notes TEXT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,

  -- Multi-unit offer specific fields
  total_quantity INT UNSIGNED NULL,
  unit_name VARCHAR(50) NULL,
  asking_price_per_unit DECIMAL(15,2) NULL,
  min_order_quantity INT UNSIGNED NULL,
  max_order_quantity INT UNSIGNED NULL,
  quantity_increment INT UNSIGNED NULL DEFAULT 1,
  allow_partial_allocation BOOLEAN NOT NULL DEFAULT TRUE,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_listings_public_slug (public_slug),
  UNIQUE KEY uq_listings_reference (listing_reference),
  KEY idx_listings_public (review_status, start_time, end_time, deleted_at),
  KEY idx_listings_seller (seller_id, review_status, created_at),
  KEY idx_listings_category_sub (category_id, subcategory_id, review_status),
  CONSTRAINT fk_listings_seller FOREIGN KEY (seller_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CONSTRAINT fk_listings_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  CONSTRAINT fk_listings_subcategory FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE SET NULL,
  CONSTRAINT chk_listing_schedule CHECK (end_time > start_time),
  CONSTRAINT chk_asking_price CHECK (asking_price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Create listing_images table
CREATE TABLE IF NOT EXISTS listing_images (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  listing_id BIGINT UNSIGNED NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  display_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_listing_images_listing_order (listing_id, display_order),
  CONSTRAINT fk_listing_images_listing FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Migrate existing auction records into listings safely (preserving Primary Key IDs & data)
INSERT INTO listings (
  id,
  seller_id,
  category_id,
  subcategory_id,
  sale_mode,
  title,
  description,
  `condition`,
  location,
  asking_price,
  currency,
  start_time,
  end_time,
  public_slug,
  listing_reference,
  review_status,
  review_notes,
  version,
  created_at,
  updated_at,
  deleted_at
)
SELECT
  a.id,
  a.seller_id,
  COALESCE(
    (SELECT id FROM categories WHERE LOWER(name) = LOWER(a.category) OR slug = LOWER(REPLACE(a.category, ' ', '-')) LIMIT 1),
    (SELECT id FROM categories WHERE slug = 'other' LIMIT 1)
  ) AS category_id,
  (
    SELECT id FROM subcategories
    WHERE category_id = COALESCE(
      (SELECT id FROM categories WHERE LOWER(name) = LOWER(a.category) OR slug = LOWER(REPLACE(a.category, ' ', '-')) LIMIT 1),
      (SELECT id FROM categories WHERE slug = 'other' LIMIT 1)
    )
    ORDER BY display_order ASC LIMIT 1
  ) AS subcategory_id,
  'negotiated_offer' AS sale_mode,
  a.title,
  a.description,
  a.item_condition AS `condition`,
  a.location,
  a.starting_price AS asking_price,
  'INR' AS currency,
  a.starts_at AS start_time,
  a.ends_at AS end_time,
  a.slug AS public_slug,
  a.lot_number AS listing_reference,
  CASE
    WHEN a.status = 'draft' THEN 'draft'
    WHEN a.status = 'pending' THEN 'submitted'
    WHEN a.status = 'approved' THEN 'approved'
    WHEN a.status = 'rejected' THEN 'rejected'
    WHEN a.status = 'changes_requested' THEN 'changes_requested'
    WHEN a.status = 'closed' THEN 'completed'
    ELSE 'draft'
  END AS review_status,
  a.review_notes,
  a.version,
  a.created_at,
  a.updated_at,
  a.deleted_at
FROM auctions a
ON DUPLICATE KEY UPDATE
  seller_id = VALUES(seller_id),
  category_id = VALUES(category_id),
  title = VALUES(title),
  description = VALUES(description),
  `condition` = VALUES(`condition`),
  location = VALUES(location),
  asking_price = VALUES(asking_price),
  start_time = VALUES(start_time),
  end_time = VALUES(end_time),
  review_status = VALUES(review_status),
  review_notes = VALUES(review_notes),
  updated_at = VALUES(updated_at);
