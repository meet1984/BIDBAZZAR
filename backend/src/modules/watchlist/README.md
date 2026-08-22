# Watchlist module

Buyer-only routes list, add, and remove saved listings. The service verifies a listing is public before addition, and the repository uses the composite account/listing key for idempotent persistence. Dashboard, home, list and detail clients consume this data.
