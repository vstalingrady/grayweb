import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { apiService, type MediaUpload, type User } from "@/lib/api";
import { compressImage } from "@/lib/imageCompression";

type UseAttachmentsOptions = {
  resolveChatUser: () => Promise<User | null>;
};

type UseAttachmentsResult = {
  selectedAttachments: MediaUpload[];
  attachmentsRef: MutableRefObject<MediaUpload[]>;
  isAttachmentUploading: boolean;
  attachmentError: string | null;
  uploadAttachments: (files: FileList | File[]) => Promise<void>;
  removeAttachment: (id: number) => void;
  clearAttachments: () => void;
};

export const useAttachments = ({ resolveChatUser }: UseAttachmentsOptions): UseAttachmentsResult => {
  const [selectedAttachments, setSelectedAttachments] = useState<MediaUpload[]>([]);
  const attachmentsRef = useRef<MediaUpload[]>(selectedAttachments);

  useEffect(() => {
    attachmentsRef.current = selectedAttachments;
  }, [selectedAttachments]);

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((attachment) => {
        if (attachment?.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      });
    };
  }, []);

  const releaseAttachmentPreview = useCallback((attachment: MediaUpload) => {
    if (attachment?.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
  }, []);

  const [isAttachmentUploading, setIsAttachmentUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const uploadAttachments = useCallback(
    async (files: FileList | File[]) => {
      const selectedFiles = Array.from(files ?? []);
      if (selectedFiles.length === 0) {
        return;
      }

      setAttachmentError(null);
      setIsAttachmentUploading(true);

      try {
        const resolvedUser = await resolveChatUser();
        if (!resolvedUser) {
          throw new Error("Unable to upload without an authenticated user.");
        }
        const uploads: MediaUpload[] = [];
        for (const file of selectedFiles) {
          if (!file) {
            continue;
          }
          // Compress image before uploading
          const processedFile = await compressImage(file);
          const upload = await apiService.uploadMediaFile(processedFile);
          const previewUrl = file.type?.toLowerCase().startsWith("image/")
            ? URL.createObjectURL(file)
            : upload.public_url ?? undefined;
          uploads.push({ ...upload, previewUrl });
        }
        if (uploads.length > 0) {
          setSelectedAttachments((prev) => [...prev, ...uploads]);
        }
      } catch (error) {
        console.error("Failed to upload attachments:", error);
        if (error instanceof Error) {
          setAttachmentError(error.message);
        } else {
          setAttachmentError("Failed to upload attachment.");
        }
      } finally {
        setIsAttachmentUploading(false);
      }
    },
    [resolveChatUser]
  );

  const removeAttachment = useCallback(
    (id: number) => {
      setSelectedAttachments((prev) => {
        const next: MediaUpload[] = [];
        prev.forEach((attachment) => {
          if (attachment.id === id) {
            releaseAttachmentPreview(attachment);
            return;
          }
          next.push(attachment);
        });
        return next;
      });
    },
    [releaseAttachmentPreview]
  );

  const clearAttachments = useCallback(() => {
    setSelectedAttachments((prev) => {
      prev.forEach(releaseAttachmentPreview);
      return [];
    });
  }, [releaseAttachmentPreview]);

  return {
    selectedAttachments,
    attachmentsRef,
    isAttachmentUploading,
    attachmentError,
    uploadAttachments,
    removeAttachment,
    clearAttachments,
  };
};
