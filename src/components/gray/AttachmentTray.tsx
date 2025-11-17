"use client";

import { Loader2 } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import type { MediaUpload } from "@/lib/api";

type AttachmentTrayProps = {
  attachments: MediaUpload[];
  isUploading: boolean;
  error: string | null;
  onAddAttachment: () => void;
  onRemoveAttachment: (id: number) => void;
};

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[exponent]}`;
};

const getMimeLabel = (mimeType: string | null | undefined) => {
  if (!mimeType) {
    return "FILE";
  }
  const normalized = mimeType.toUpperCase();
  if (normalized.includes("/")) {
    const [type, subtype] = normalized.split("/");
    if (type === "IMAGE") {
      return subtype;
    }
  }
  return normalized;
};

const AttachmentTray = ({
  attachments,
  isUploading,
  error,
  onAddAttachment,
  onRemoveAttachment,
}: AttachmentTrayProps) => {
  const hasAttachments = attachments.length > 0;

  const renderPreview = (attachment: MediaUpload) => {
    const mimeType = attachment.mime_type?.toLowerCase() ?? "";
    const isImage = Boolean(attachment.previewUrl && mimeType.startsWith("image/"));
    if (isImage) {
      return (
        <img
          src={attachment.previewUrl}
          alt={attachment.filename}
          className={styles.chatAttachmentPreviewImage}
        />
      );
    }
    if (mimeType === "application/pdf") {
      return <span className={styles.chatAttachmentPreviewLabel}>PDF</span>;
    }
    return (
      <span className={styles.chatAttachmentPreviewLabel}>
        {attachment.mime_type?.split("/").pop()?.toUpperCase() || "FILE"}
      </span>
    );
  };

  if (!hasAttachments && !error && !isUploading) {
    return null;
  }
  return (
    <div className={styles.chatAttachmentTray}>
      {error ? <p className={styles.chatAttachmentError}>{error}</p> : null}
      {isUploading ? (
        <div className={styles.chatAttachmentUploadStatus}>
          <Loader2 size={16} className={styles.chatAttachmentSpinner} aria-hidden="true" />
          <span>Uploading attachments…</span>
        </div>
      ) : null}
      {hasAttachments ? (
        <div className={styles.chatAttachmentList} role="list">
          {attachments.map((attachment) => (
            <figure
              key={attachment.id}
              className={styles.chatAttachmentItem}
              role="listitem"
              data-has-preview={
                attachment.previewUrl && attachment.mime_type?.toLowerCase().startsWith("image/")
                  ? "true"
                  : "false"
              }
            >
              <button
                type="button"
                className={styles.chatAttachmentRemove}
                onClick={() => onRemoveAttachment(attachment.id)}
                aria-label={`Remove attachment ${attachment.filename}`}
              >
                &times;
              </button>
              <div className={styles.chatAttachmentPreview} aria-hidden="true">
                {renderPreview(attachment)}
              </div>
              <figcaption className={styles.chatAttachmentMeta}>
                <span className={styles.chatAttachmentName} title={attachment.filename}>
                  {attachment.filename}
                </span>
                <span className={styles.chatAttachmentDetails}>
                  {getMimeLabel(attachment.mime_type)} · {formatBytes(attachment.size)}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default AttachmentTray;
