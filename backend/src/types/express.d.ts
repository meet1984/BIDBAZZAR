import type { AccessTokenUser } from "../shared/tokens.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AccessTokenUser;
    }
  }
}

export {};
