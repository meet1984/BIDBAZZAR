import bcrypt from "bcryptjs";
import { isDuplicateEntry } from "../../database/pool.js";
import { AppError } from "../../shared/AppError.js";
import type { AccountType } from "../../shared/tokens.js";
import { authRepository } from "../auth/auth.repository.js";
import { publicUser } from "../auth/auth.service.js";
import type { AdminCreateUserInput, UpdateUserRoleInput, UserListQuery, UserStatusInput } from "./user.schemas.js";
import type { UserRepository } from "./user.repository.js";
import { userRepository } from "./user.repository.js";

export class UserService {
  constructor(private readonly repository: UserRepository) {}

  list(query: UserListQuery) {
    return this.repository.list(query);
  }

  async createUser(input: AdminCreateUserInput) {
    const existingUser = await authRepository.findAccountByEmail(input.email);
    if (existingUser) {
      throw new AppError(409, "EMAIL_IN_USE", "An account with this email address already exists.");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    let userId: number;
    try {
      userId = await this.repository.createUser(input, passwordHash);
    } catch (error) {
      if (isDuplicateEntry(error)) {
        throw new AppError(409, "EMAIL_IN_USE", "An account with this email address already exists.");
      }
      throw error;
    }

    const account = await authRepository.findAccountById(userId);
    if (!account) {
      throw new AppError(500, "USER_CREATION_FAILED", "Failed to retrieve the newly created user account.");
    }
    return publicUser(account);
  }

  async updateStatus(currentAdminId: number, id: number, input: UserStatusInput) {
    const user = await this.repository.find(id);
    if (!user) throw new AppError(404, "USER_NOT_FOUND", "The user was not found.");
    if (id === currentAdminId || user.accountType === "admin") {
      throw new AppError(403, "ADMIN_ACCOUNT_PROTECTED", "Admin status cannot be changed here.");
    }
    await this.repository.setStatus(id, input.status);
    if (input.status === "suspended") {
      await authRepository.revokeAllUserTokens(id);
    }
    return { ...user, status: input.status };
  }

  async updateRole(currentAdminId: number, id: number, input: UpdateUserRoleInput) {
    const user = await this.repository.find(id);
    if (!user) throw new AppError(404, "USER_NOT_FOUND", "The user was not found.");
    if (id === currentAdminId || user.accountType === "admin") {
      throw new AppError(403, "ADMIN_ACCOUNT_PROTECTED", "Full administrator roles cannot be changed through this endpoint.");
    }
    const targetType: AccountType = input.accountType || input.role || "buyer";
    if (targetType !== user.accountType && await this.repository.hasMarketplaceHistory(id)) {
      throw new AppError(409, "ROLE_CHANGE_BLOCKED", "Accounts with marketplace history cannot change account type. Create a separate account instead.");
    }
    await this.repository.updateRole(id, targetType);
    await authRepository.revokeAllUserTokens(id);
    const updated = await this.repository.find(id);
    return updated!;
  }
}

export const userService = new UserService(userRepository);
