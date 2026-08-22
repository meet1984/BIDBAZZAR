import type { RowDataPacket } from "mysql2/promise";
import { pool } from "./pool.js";

interface UserRow extends RowDataPacket {
  id: number;
}

async function seedAuctions() {
  // 1. Get a seller user
  const [users] = await pool.query<UserRow[]>("SELECT id FROM accounts WHERE account_type = 'seller' LIMIT 1");
  let sellerId: number;

  if (Array.isArray(users) && users.length > 0 && users[0]) {
    sellerId = users[0].id;
  } else {
    console.log("No seller found in the database. Please create a seller account first.");
    process.exit(1);
  }

  const categories = [
    "Electronics & Tech",
    "Automotive & Vehicles",
    "Antiques & Collectibles",
    "Fashion & Luxury",
    "Jewelry & Watches",
    "Industrial & Equipment",
    "Home & Lifestyle",
    "Art & Paintings",
    "Real Estate",
    "Other",
  ];
  const conditions = ["new", "like-new", "used", "refurbished"];

  const titles = [
    "Vintage Rolex Submariner", "Apple iPhone 15 Pro Max", "Sony A7IV Mirrorless Camera",
    "Antique Wooden Chair", "Gucci Leather Handbag", "Signed Football Jersey",
    "Abstract Modern Painting", "BMW 3 Series 2021", "Samsung 4K Smart TV",
    "PlayStation 5 Console", "MacBook Pro M2 16-inch", "Diamond Platinum Ring",
    "Original 19th Century Vase", "Classic Gibson Les Paul", "Retro Arcade Machine",
    "First Edition Harry Potter", "Hermes Birkin Bag 35", "Nike Air Jordan 1",
    "Rare Roman Coin", "Pioneer DJ XDJ-RX3", "OLED Gaming Monitor",
    "Montblanc Meisterstuck Pen", "Louis Vuitton Keepall 55", "Nintendo Switch OLED",
    "Yamaha Grand Piano", "Persian Silk Rug", "Cartier Tank Francaise",
    "Dyson V15 Detect Vacuum", "Leica Q2 Camera", "Chanel Classic Flap Bag",
  ];
  const locations = [
    "Mumbai, India",
    "Delhi, India",
    "Bangalore, India",
    "New York, USA",
    "London, UK",
    "Dubai, UAE",
    "Singapore",
    "Tokyo, Japan",
    "Sydney, Australia",
    "Toronto, Canada"
  ];


  // High quality Unsplash images
  const images = [
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30",
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e",
    "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f",
    "https://images.unsplash.com/photo-1483985988355-763728e1935b",
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff",
    "https://images.unsplash.com/photo-1504274066651-8d31a536b11a",
    "https://images.unsplash.com/photo-1517336714731-489689fd1ca8",
    "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9",
    "https://images.unsplash.com/photo-1593642632823-8f785ba67e45",
    "https://images.unsplash.com/photo-1550009158-9ebf69173e03",
    "https://images.unsplash.com/photo-1526045612212-70caf35c14df",
    "https://images.unsplash.com/photo-1583394838336-acd977736f90",
  ];

  for (let i = 0; i < 30; i++) {
    const title = titles[i] || `Amazing Auction Item ${i + 1}`;
    const category = categories[i % categories.length] ?? "Other";
    const itemCondition = conditions[i % conditions.length] ?? "new";

    // Select 4 to 6 images to ensure more than 3 images per item
    const numImages = 4 + Math.floor(Math.random() * 3);
    const selectedImages = [];
    for (let j = 0; j < numImages; j++) {
      selectedImages.push(images[(i + j) % images.length] ?? "");
    }
    const imageUrl = JSON.stringify(selectedImages);

    const location = locations[i % locations.length] ?? "Mumbai, India";
    const startingPrice = Math.floor(Math.random() * 50000) + 1000;
    const minimumIncrement = 100;
    const description = `This is a premium ${title}. It is in excellent condition and ready for a new owner. Happy bidding! Please review the images and description carefully before placing a bid.`;
    const lotNumber = `LOT-${Math.floor(Math.random() * 10000000).toString().padStart(7, "0")}-${i}`;
    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${lotNumber.toLowerCase()}`;

    const startsAt = new Date();
    startsAt.setDate(startsAt.getDate() - Math.floor(Math.random() * 5)); // Started up to 5 days ago
    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + Math.floor(Math.random() * 10) + 1); // Ends in 1 to 10 days

    const status = "approved"; // Make them visible instantly

    try {
      await pool.execute(
        `INSERT INTO auctions 
         (seller_id, slug, lot_number, title, category, description, item_condition, location, image_url, starting_price, minimum_increment, starts_at, ends_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [sellerId, slug, lotNumber, title, category, description, itemCondition, location, imageUrl, startingPrice, minimumIncrement, startsAt, endsAt, status],
      );
    } catch (e) {
      console.error(`Failed to insert auction ${i}: `, e);
    }
  }

  console.log("Successfully seeded 30 auctions.");
}

seedAuctions()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
