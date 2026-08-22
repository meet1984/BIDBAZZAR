import type { Request, Response } from "express";
import { dashboardService } from "./dashboard.service.js";

export const dashboardController = {
  async admin(_request: Request, response: Response) {
    response.json(await dashboardService.admin());
  },
};
