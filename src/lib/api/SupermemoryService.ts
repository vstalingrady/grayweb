import { apiFetch } from "./request";
import type {
  SupermemoryStoreResponse,
  SupermemorySearchResponse,
  SupermemoryProfileResponse,
  SupermemoryForgetResponse,
  SupermemoryWipeResponse,
} from "./types";

export class SupermemoryService {
  async store(text: string, category?: string): Promise<SupermemoryStoreResponse> {
    return apiFetch<SupermemoryStoreResponse>("/api/supermemory/store", {
      method: "POST",
      body: JSON.stringify({ text, category }),
    });
  }

  async search(query: string, limit = 5): Promise<SupermemorySearchResponse> {
    return apiFetch<SupermemorySearchResponse>("/api/supermemory/search", {
      method: "POST",
      body: JSON.stringify({ query, limit }),
    });
  }

  async profile(query?: string): Promise<SupermemoryProfileResponse> {
    return apiFetch<SupermemoryProfileResponse>("/api/supermemory/profile", {
      method: "POST",
      body: JSON.stringify({ query }),
    });
  }

  async forget(query?: string, memoryId?: string): Promise<SupermemoryForgetResponse> {
    return apiFetch<SupermemoryForgetResponse>("/api/supermemory/forget", {
      method: "POST",
      body: JSON.stringify({ query, memory_id: memoryId }),
    });
  }

  async wipe(confirm = false): Promise<SupermemoryWipeResponse> {
    return apiFetch<SupermemoryWipeResponse>("/api/supermemory/wipe", {
      method: "POST",
      body: JSON.stringify({ confirm }),
    });
  }
}

export const supermemoryService = new SupermemoryService();
