import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";

export const accountRouter = Router();
accountRouter.use(...requireAuth);

// Note: /become-seller and /become-buyer endpoints have been removed as accounts now have strict, single account_type.
