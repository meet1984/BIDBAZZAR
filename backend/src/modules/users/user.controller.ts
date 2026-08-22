import type { Request, Response } from "express";
import type { AdminCreateUserInput, UpdateUserRoleInput, UserListQuery, UserStatusInput } from "./user.schemas.js";
import { userService } from "./user.service.js";

export const userController = {
  async createUser(request: Request, response: Response) {
    const user = await userService.createUser(request.body as AdminCreateUserInput);
    response.status(201).json({ user, message: "User created successfully." });
  },
  async list(request: Request, response: Response) {
    response.json(await userService.list(request.query as unknown as UserListQuery));
  },
  async updateStatus(request: Request, response: Response) {
    const user = await userService.updateStatus(
      request.auth!.id,
      Number(request.params.id),
      request.body as UserStatusInput,
    );
    response.json({ user });
  },
  async updateRole(request: Request, response: Response) {
    const user = await userService.updateRole(
      request.auth!.id,
      Number(request.params.id),
      request.body as UpdateUserRoleInput,
    );
    response.json({ user, message: "User account type updated successfully." });
  },
};
