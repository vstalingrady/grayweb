import { apiFetch } from "./request";
import type {
    MediaUpload,
    ContextCache,
    ContextCacheBase,
    FileSearchUploadResponse,
    WorkspaceBackground,
    WorkspaceBackgroundCreate,
    WorkspaceBackgroundAssetUploadResponse
} from "./types";

export class UtilityService {
    async uploadMediaFile(file: File): Promise<MediaUpload> {
        const form = new FormData();
        form.append('file', file);
        return apiFetch<MediaUpload>('/api/uploads', {
            method: 'POST',
            body: form,
        });
    }

    async listUploads(options?: { limit?: number; offset?: number }): Promise<MediaUpload[]> {
        const params = new URLSearchParams();
        if (options?.limit) {
            params.set('limit', String(options.limit));
        }
        if (options?.offset) {
            params.set('offset', String(options.offset));
        }
        const suffix = params.toString();
        const endpoint = suffix ? `/api/uploads?${suffix}` : '/api/uploads';
        return apiFetch<MediaUpload[]>(endpoint);
    }

    async createContextCache(userId: number, payload: ContextCacheBase): Promise<ContextCache> {
        const params = new URLSearchParams({ user_id: String(userId) });
        return apiFetch<ContextCache>(`/context-cache?${params.toString()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async getContextCache(cacheId: number): Promise<ContextCache> {
        return apiFetch<ContextCache>(`/context-cache/${cacheId}`);
    }

    async createFileSearchStore(displayName?: string): Promise<{ name: string; display_name?: string }> {
        return apiFetch<{ name: string; display_name?: string }>('/api/file-search/stores', {
            method: 'POST',
            body: JSON.stringify({ display_name: displayName }),
        });
    }

    async uploadToFileSearchStore(options: {
        storeName: string;
        file: File;
        displayName?: string;
        chunkingConfig?: Record<string, unknown>;
    }): Promise<FileSearchUploadResponse> {
        const form = new FormData();
        form.append('store_name', options.storeName);
        form.append('file', options.file);
        if (options.displayName) {
            form.append('display_name', options.displayName);
        }
        if (options.chunkingConfig) {
            form.append('chunking_config', JSON.stringify(options.chunkingConfig));
        }
        return apiFetch<FileSearchUploadResponse>('/api/file-search/upload', {
            method: 'POST',
            body: form,
        });
    }

    async importFileSearch(payload: {
        storeName: string;
        fileName: string;
        chunkingConfig?: Record<string, unknown>;
    }): Promise<FileSearchUploadResponse> {
        return apiFetch<FileSearchUploadResponse>('/api/file-search/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                file_search_store_name: payload.storeName,
                file_name: payload.fileName,
                chunking_config: payload.chunkingConfig ?? undefined,
            }),
        });
    }

    async listWorkspaceBackgrounds(): Promise<WorkspaceBackground[]> {
        return apiFetch<WorkspaceBackground[]>('/api/workspace-backgrounds');
    }

    async createWorkspaceBackground(payload: WorkspaceBackgroundCreate): Promise<WorkspaceBackground> {
        return apiFetch<WorkspaceBackground>('/api/workspace-backgrounds', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    }

    async uploadWorkspaceBackgroundAsset(file: File): Promise<WorkspaceBackgroundAssetUploadResponse> {
        const formData = new FormData();
        formData.append('file', file);
        return apiFetch<WorkspaceBackgroundAssetUploadResponse>('/api/workspace-backgrounds/assets', {
            method: 'POST',
            body: formData,
        });
    }
}

export const utilityService = new UtilityService();
