"use client";

import { LoaderCircle, X } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import type { MediaUpload } from "@/lib/api";

type AttachmentTrayProps = {
  attachments: MediaUpload[];
  isUploading: boolean;
  error: string | null;
  onRemoveAttachment: (id: number) => void;
};

const AttachmentTray = ({
  attachments,
  isUploading,
  error,
  onRemoveAttachment,
}: AttachmentTrayProps) => {
  const hasAttachments = attachments.length > 0;

  if (!hasAttachments && !error && !isUploading) {
    return null;
  }

  return (
    <div className={styles.chatAttachmentTrayInline}>
      {attachments.map((attachment) => (
        <div key={attachment.id} className={styles.chatAttachmentThumb}>
          <div className={styles.chatAttachmentThumbImage}>
            {attachment.mime_type?.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={attachment.previewUrl || attachment.public_url}
                alt={attachment.filename}
              />
            ) : (
              <div className={styles.chatAttachmentThumbFile}>
                <span>{attachment.mime_type?.split("/").pop()?.toUpperCase() || "FILE"}</span>
              </div>
            )}
            <button
              type="button"
              className={styles.chatAttachmentRemoveBtn}
              onClick={() => onRemoveAttachment(attachment.id)}
            >
              <X size={12} />
            </button>
          </div>
        </div>
      ))}
      {isUploading && (
        <div className={styles.chatAttachmentThumb}>
          <div className={styles.chatAttachmentLoading}>
            <LoaderCircle size={16} className={styles.chatAttachmentSpinner} />
          </div>
        </div>
      )}
      {error && <div className={styles.chatAttachmentErrorInline}>{error}</div>}
    </div>
  );
};

export default AttachmentTray;
