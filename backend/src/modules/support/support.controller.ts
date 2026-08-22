import type { Request, Response } from "express";
import type { SupportEnquiryInput } from "./support.schemas.js";
import { supportService } from "./support.service.js";

export const supportController = {
  async create(request: Request, response: Response) {
    const result = await supportService.create(
      request.body as SupportEnquiryInput,
      request.auth?.id,
      request.file,
    );
    response.status(201).json(result);
  },
  async list(_request: Request, response: Response) {
    response.json({ items: await supportService.list() });
  },
  async listMine(request: Request, response: Response) {
    if (!request.auth) {
      response.status(401).json({ message: "Authentication required" });
      return;
    }
    const role = typeof request.query.role === "string" ? request.query.role : undefined;
    const items = await supportService.listByUser(request.auth.id, request.auth.email, role);
    response.json({ items });
  },
  async updateStatus(request: Request, response: Response) {
    const id = Number(request.params.id);
    const { status } = request.body as { status: string };
    const result = await supportService.updateStatus(id, status);
    response.json(result);
  },
  async downloadAttachment(request: Request, response: Response) {
    const attachment = await supportService.getAttachment(Number(request.params.id));
    response.setHeader("Content-Type", attachment.mime);
    const fallbackName = attachment.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "attachment";
    response.setHeader("Content-Disposition", `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(attachment.name)}`);
    response.sendFile(attachment.path);
  },
};
