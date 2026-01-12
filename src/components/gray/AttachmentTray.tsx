"use client";

import { LoaderCircle, X } from "lucide-react";
import styles from "@/components/gray/chat/ChatComposerStyles.module.css";
import { resolveUploadUrl, type MediaUpload } from "@/lib/api";
import { useI18n } from "@/contexts/I18nContext";

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
  const { t } = useI18n();
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
                src={attachment.previewUrl || resolveUploadUrl(attachment)}
                alt={attachment.filename}
                onError={(event) => {
                  const fallback = resolveUploadUrl({ id: attachment.id });
                  if (!fallback) {
                    return;
                  }
                  if (event.currentTarget.getAttribute("src") === fallback) {
                    return;
                  }
                  event.currentTarget.src = fallback;
                }}
              />
            ) : (
              <div className={styles.chatAttachmentThumbFile}>
                <span>{attachment.mime_type?.split("/").pop()?.toUpperCase() || t("FILE")}</span>
              </div>
            )}
            <button
              type="button"
              className={styles.chatAttachmentRemoveBtn}
              onClick={() => onRemoveAttachment(attachment.id)}
              aria-label={t("Remove attachment")}
              title={t("Remove attachment")}
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
