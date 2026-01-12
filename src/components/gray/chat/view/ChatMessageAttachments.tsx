"use client";

import styles from "@/components/gray/chat/ChatStyles.module.css";
import { resolveUploadUrl, type MediaUpload } from "@/lib/api";

export type ChatMessageAttachmentsProps = {
  attachments: MediaUpload[];
  t: (message: string, vars?: Record<string, string | number>) => string;
};

export function ChatMessageAttachments({ attachments, t }: ChatMessageAttachmentsProps) {
  if (!attachments.length) {
    return null;
  }

  return (
    <div className={styles.chatMessageAttachments}>
	      {attachments.map((attachment, index) => (
	        <div key={attachment.id || index} className={styles.chatMessageAttachment}>
	          {attachment.mime_type?.startsWith("image/") ? (
	            // eslint-disable-next-line @next/next/no-img-element -- Attachments may be user-provided URLs and need runtime fallback handling.
            <img
              src={attachment.previewUrl || resolveUploadUrl(attachment)}
              alt={t("Attachment")}
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
            <div className={styles.chatMessageAttachmentFile}>
              <span>{attachment.filename}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
