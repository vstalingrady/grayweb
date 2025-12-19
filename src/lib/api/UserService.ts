import { apiFetch } from "./request";
import type {
    User,
    UserCreate,
    UserUpdate,
    ApiKey,
    ApiKeyCreate
} from "./types";
import { ApiError } from "./errors";

export class UserService {
    async createUser(userData: UserCreate): Promise<User> {
        return apiFetch<User>('/users/', {
            method: 'POST',
            body: JSON.stringify(userData),
        });
    }

    async getUser(userId: number): Promise<User> {
        return apiFetch<User>(`/users/${userId}`);
    }

    async getUserByEmail(email: string): Promise<User> {
        return apiFetch<User>(`/users/email/${encodeURIComponent(email)}`);
    }

    async updateUser(userId: number, userData: UserUpdate): Promise<User> {
        return apiFetch<User>(`/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(userData),
        });
    }

    async deleteUser(userId: number): Promise<void> {
        await apiFetch<void>(`/users/${userId}`, {
            method: 'DELETE',
        });
    }

    async storeUserApiKey(userId: number, payload: ApiKeyCreate): Promise<ApiKey> {
        return apiFetch<ApiKey>(`/users/${userId}/api-keys`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    }

    async getUserApiKey(userId: number, service: string): Promise<ApiKey | null> {
        try {
            return await apiFetch<ApiKey>(`/users/${userId}/api-keys/${service}`);
        } catch (error) {
            if (error instanceof ApiError && error.status === 404) {
                return null;
            }
            throw error;
        }
    }

}

export const userService = new UserService();
