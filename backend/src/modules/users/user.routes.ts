import { Router } from "express";
import { requireRole } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { userController } from "./user.controller.js";
import { adminCreateUserSchema, updateUserRoleSchema, userIdSchema, userListSchema, userStatusSchema } from "./user.schemas.js";

export const userRouter = Router();
userRouter.use(requireRole("admin"));
userRouter.get("/", validate(userListSchema, "query"), asyncHandler(userController.list));
userRouter.post("/", validate(adminCreateUserSchema), asyncHandler(userController.createUser));
userRouter.patch(
  "/:id/status",
  validate(userIdSchema, "params"),
  validate(userStatusSchema),
  asyncHandler(userController.updateStatus),
);
userRouter.patch(
  "/:id/role",
  validate(userIdSchema, "params"),
  validate(updateUserRoleSchema),
  asyncHandler(userController.updateRole),
);
