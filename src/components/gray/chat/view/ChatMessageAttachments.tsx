"use client";

import styles from "@/app/gray/GrayPageClient.module.css";
import type { MediaUpload } from "@/lib/api";

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
	              src={
	                attachment.previewUrl ||
	                (typeof attachment.id === "number" ? `/api/uploads/${attachment.id}/file` : attachment.public_url)
	              }
              alt={t("Attachment")}
              onError={(event) => {
                if (typeof attachment.id !== "number") {
                  return;
                }
                const fallback = `/api/uploads/${attachment.id}/file`;
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
