"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  RefreshCw,
  Copy,
  Image as ImageIcon,
  FileText,
  X,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import styles from "@/app/gray/GrayPageClient.module.css";
import { GrayChatBar } from "./ChatBar";
import {
  SYSTEM_PROMPT,
  useChatStore,
  buildAssistantReply,
  shouldIncludeWorkspaceContext,
  normalizeAssistantContent,
  type ChatMessage as ChatSessionMessage,
  type ChatRole,
} from "./ChatProvider";
import { useUser } from "@/contexts/UserContext";
import { apiService, type ChatAttachment, type GeminiFileMetadata } from "@/lib/api";

type GrayChatViewProps = {
  sessionId: string | null;
};

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024;
const FALLBACK_ASSISTANT_DELAY_MS = 150;

type ComposerAttachmentStatus = "uploading" | "uploaded" | "error";

type ComposerAttachment = {
  id: string;
  file: File;
  status: ComposerAttachmentStatus;
  previewUrl?: string;
  uploaded?: ChatAttachment;
  error?: string;
};

const formatFileSize = (bytes?: number) => {
  if (!bytes || Number.isNaN(bytes)) {
    return "";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const mapGeminiFileToAttachment = (file: GeminiFileMetadata): ChatAttachment => {
  return {
    name: file.name,
    uri: file.uri ?? file.download_uri ?? "",
    mime_type: file.mime_type ?? "application/octet-stream",
    display_name: file.display_name ?? file.name,
    size_bytes: file.size_bytes,
  };
};

type AssistantSections = {
  user: string | null;
  thinking: string | null;
  ai: string;
  isStructured: boolean;
};

const parseStructuredAssistantMessage = (content?: string | null): AssistantSections => {
  const raw = (content ?? "").replace(/\r\n/g, "\n");
  const templateMatch = raw.match(
    /user:\s*([\s\S]*?)\n\s*thinking \(not visible\):\s*<thinking>([\s\S]*?)<\/thinking>\s*\n\s*ai:\s*([\s\S]*)/i
  );

  if (!templateMatch) {
    const fallback = raw.trim();
    return {
      user: null,
      thinking: null,
      ai: fallback,
      isStructured: false,
    };
  }

  const [, userSection, thinkingSection, aiSection] = templateMatch;
  const sanitize = (value: string) => value.replace(/^\s+|\s+$/g, "");

  return {
    user: sanitize(userSection) || null,
    thinking: sanitize(thinkingSection) || null,
    ai: sanitize(aiSection),
    isStructured: true,
  };
};

const getAssistantDisplayText = (content?: string | null) =>
  parseStructuredAssistantMessage(content).ai;

export function GrayChatView({ sessionId }: GrayChatViewProps) {
  const { getSession, appendMessage, updateMessage, deleteMessage, updateSession, workspaceContext } =
    useChatStore();
  const session = sessionId ? getSession(sessionId) : undefined;
  const { user } = useUser();
  const [draft, setDraft] = useState("");
  const [hasHydrated, setHasHydrated] = useState(false);
  const replyTimeout = useRef<number | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const isLoadingHistoryRef = useRef<string | null>(null);
  const attachmentsRef = useRef<ComposerAttachment[]>([]);
  const [displayedAssistantContent, setDisplayedAssistantContent] = useState<Record<string, string>>({});
  const processedAssistantMessagesRef = useRef<Set<string>>(new Set());
  const simulatedMessagesRef = useRef<Set<string>>(new Set());
  const hydrationCompleteRef = useRef(false);
  const animationTimersRef = useRef<Map<string, number>>(new Map());
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const copyResetTimeoutRef = useRef<number | null>(null);
  const [regeneratingMessageId, setRegeneratingMessageId] = useState<string | null>(null);
  const [activeStreamingMessageId, setActiveStreamingMessageId] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [composerAttachments, setComposerAttachments] = useState<ComposerAttachment[]>([]);
  const revokePreviewUrl = useCallback((url?: string) => {
    if (url) {
      URL.revokeObjectURL(url);
    }
  }, []);
  const activeSessionId = session?.id ?? null;
  const activeConversationId = session?.conversationId ?? null;

  const messages = useMemo(
    () => session?.messages ?? [],
    [session?.messages]
  );
  const clearComposerAttachments = useCallback(() => {
    setComposerAttachments((prev) => {
      if (!prev.length) {
        return prev;
      }
      prev.forEach((attachment) => revokePreviewUrl(attachment.previewUrl));
      return [];
    });
  }, [revokePreviewUrl]);
  const uploadComposerAttachment = useCallback((attachmentId: string, file: File) => {
    setComposerAttachments((prev) =>
      prev.map((attachment) =>
        attachment.id === attachmentId
          ? { ...attachment, status: "uploading", error: undefined }
          : attachment
      )
    );

    apiService
      .uploadGeminiFile(file, file.name)
      .then((uploadedFile: GeminiFileMetadata) => {
        const normalized = mapGeminiFileToAttachment(uploadedFile);
        if (!normalized.uri) {
          throw new Error("Gemini did not return a reusable file URI.");
        }
        setComposerAttachments((prev) =>
          prev.map((attachment) =>
            attachment.id === attachmentId
              ? { ...attachment, status: "uploaded", uploaded: normalized, error: undefined }
              : attachment
          )
        );
      })
      .catch((error: unknown) => {
        console.error("Failed to upload attachment:", error);
        const message =
          error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "File upload failed.";
        setComposerAttachments((prev) =>
          prev.map((attachment) =>
            attachment.id === attachmentId
              ? { ...attachment, status: "error", error: message }
              : attachment
          )
        );
      });
  }, []);

  const handleFilesSelected = useCallback(
    (files: File[]) => {
      if (!files.length) {
        return;
      }

      const availableSlots = MAX_ATTACHMENTS - composerAttachments.length;
      if (availableSlots <= 0) {
        return;
      }

      const selection = files.slice(0, availableSlots);
      const limitLabel = `${Math.round(MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024))} MB`;

      selection.forEach((file) => {
        const id =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${file.name}`;

        if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
          setComposerAttachments((prev) => [
            ...prev,
            {
              id,
              file,
              status: "error",
              error: `File exceeds ${limitLabel}.`,
            },
          ]);
          return;
        }

        const previewUrl = file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : undefined;
        setComposerAttachments((prev) => [
          ...prev,
          {
            id,
            file,
            status: "uploading",
            previewUrl,
          },
        ]);
        uploadComposerAttachment(id, file);
      });
    },
    [composerAttachments.length, uploadComposerAttachment]
  );

  const handleRemoveAttachment = useCallback(
    (attachmentId: string) => {
      setComposerAttachments((prev) => {
        const target = prev.find((attachment) => attachment.id === attachmentId);
        if (target) {
          revokePreviewUrl(target.previewUrl);
        }
        return prev.filter((attachment) => attachment.id !== attachmentId);
      });
    },
    [revokePreviewUrl]
  );

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const handleRetryAttachment = useCallback(
    (attachmentId: string) => {
      const target = composerAttachments.find((attachment) => attachment.id === attachmentId);
      if (!target) {
        return;
      }
      uploadComposerAttachment(attachmentId, target.file);
    },
    [composerAttachments, uploadComposerAttachment]
  );

  useEffect(() => {
    if (!scrollAnchorRef.current) {
      return;
    }
    scrollAnchorRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, session?.isResponding]);

  useEffect(() => {
    attachmentsRef.current = composerAttachments;
  }, [composerAttachments]);

  useEffect(() => {
    animationTimersRef.current.forEach((timer) => window.clearInterval(timer));
    animationTimersRef.current.clear();
    processedAssistantMessagesRef.current.clear();
    hydrationCompleteRef.current = false;
    setDisplayedAssistantContent({});
    setActiveStreamingMessageId(null);
  }, [session?.id]);

  useEffect(() => {
    if (isHistoryLoading) {
      animationTimersRef.current.forEach((timer) => window.clearInterval(timer));
      animationTimersRef.current.clear();
      processedAssistantMessagesRef.current.clear();
      hydrationCompleteRef.current = false;
      setDisplayedAssistantContent({});
      setActiveStreamingMessageId(null);
      return;
    }

    if (!session || hydrationCompleteRef.current) {
      return;
    }

    processedAssistantMessagesRef.current.clear();
    const initialAssistantContent: Record<string, string> = {};
    session.messages.forEach((message) => {
      if (message.role !== "assistant") {
        return;
      }
      processedAssistantMessagesRef.current.add(message.id);
      initialAssistantContent[message.id] = getAssistantDisplayText(message.content);
    });

    setDisplayedAssistantContent(initialAssistantContent);
    hydrationCompleteRef.current = true;
  }, [isHistoryLoading, session]);

  useEffect(
    () => () => {
      animationTimersRef.current.forEach((timer) => window.clearInterval(timer));
      animationTimersRef.current.clear();
    },
    []
  );

  useEffect(
    () => () => {
      attachmentsRef.current.forEach((attachment) => revokePreviewUrl(attachment.previewUrl));
    },
    [revokePreviewUrl]
  );

  useEffect(
    () => () => {
      if (replyTimeout.current !== null) {
        window.clearTimeout(replyTimeout.current);
        replyTimeout.current = null;
      }
    },
    []
  );

  useEffect(() => {
    if (replyTimeout.current !== null) {
      window.clearTimeout(replyTimeout.current);
      replyTimeout.current = null;
    }
  }, [session?.id]);

  useEffect(() => {
    clearComposerAttachments();
  }, [clearComposerAttachments, session?.id]);

  const simulateMessageStream = useCallback(async (messageId: string | null, finalText: string) => {
    if (!messageId) {
      return;
    }
    simulatedMessagesRef.current.add(messageId);
    try {
      setDisplayedAssistantContent((prev) => ({
        ...prev,
        [messageId]: finalText,
      }));
    } finally {
      simulatedMessagesRef.current.delete(messageId);
    }
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    if (!hydrationCompleteRef.current) {
      const initial: Record<string, string> = {};
      messages.forEach((message) => {
        if (message.role === "assistant") {
          processedAssistantMessagesRef.current.add(message.id);
          initial[message.id] = getAssistantDisplayText(message.content);
        }
      });
      if (Object.keys(initial).length > 0) {
        setDisplayedAssistantContent((prev) => ({
          ...prev,
          ...initial,
        }));
      }
      hydrationCompleteRef.current = true;
      return;
    }

    messages.forEach((message) => {
      if (message.role !== "assistant") {
        return;
      }

      if (simulatedMessagesRef.current.has(message.id)) {
        return;
      }

      if (processedAssistantMessagesRef.current.has(message.id)) {
        setDisplayedAssistantContent((prev) => {
          const existing = prev[message.id];
          const displayText = getAssistantDisplayText(message.content);
          if (existing === undefined || existing !== displayText) {
            return {
              ...prev,
              [message.id]: displayText,
            };
          }
          return prev;
        });
        return;
      }

      processedAssistantMessagesRef.current.add(message.id);
      const full = getAssistantDisplayText(message.content);
      setDisplayedAssistantContent((prev) => ({
        ...prev,
        [message.id]: full,
      }));
    });
  }, [messages, session]);

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
        copyResetTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!activeSessionId || !activeConversationId) {
      setIsHistoryLoading(false);
      isLoadingHistoryRef.current = null;
      return;
    }

    if (isLoadingHistoryRef.current === activeConversationId) {
      return;
    }

    let cancelled = false;
    setIsHistoryLoading(true);
    isLoadingHistoryRef.current = activeConversationId;

    (async () => {
      try {
        const history = await apiService.getConversation(activeConversationId);
        if (cancelled) {
          return;
        }
        if (!history.length) {
          return;
        }

        const mappedHistory: ChatSessionMessage[] = history.map((message, index) => {
          const role: ChatRole = message.role === "model" ? "assistant" : "user";
          return {
            id:
              typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `${activeConversationId}-${index}-${Date.now()}`,
            role,
            content: message.text,
            createdAt: Date.now(),
            attachments: Array.isArray(message.attachments) ? message.attachments : undefined,
          };
        });

        updateSession(activeSessionId, {
          messages: mappedHistory,
          updatedAt: Date.now(),
          isResponding: false,
        });
      } catch (error) {
        console.error("Failed to load conversation history:", error);
      } finally {
        if (!cancelled) {
          setIsHistoryLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeConversationId, activeSessionId, updateSession]);

  const streamAssistantReply = useCallback(
    async (
      targetSessionId: string,
      prompt: string,
      conversationId: string | null,
      attachments?: ChatAttachment[]
    ) => {
      if (!user) {
        const fallback = buildAssistantReply(prompt);
        const assistantMessage = appendMessage(targetSessionId, "assistant", fallback);
        updateSession(targetSessionId, { isResponding: false });
        if (assistantMessage?.id) {
          setDisplayedAssistantContent((prev) => ({
            ...prev,
            [assistantMessage.id]: getAssistantDisplayText(fallback),
          }));
        }
        return fallback;
      }

      updateSession(targetSessionId, { isResponding: true });
      const useWorkspaceContext = shouldIncludeWorkspaceContext(prompt, workspaceContext);
      const contextPayload = useWorkspaceContext ? workspaceContext ?? undefined : undefined;
      let assistantMessageId: string | null = null;
      let streamingMessageId: string | null = null;
      let accumulated = "";
      let streamedConversationId: string | null = conversationId;
      let didReceiveToken = false;
      try {
        for await (const event of apiService.sendMessageStream({
          message: prompt,
          conversation_id: conversationId ?? undefined,
          system_prompt: SYSTEM_PROMPT,
          user_id: user.id,
          context: contextPayload,
          attachments: attachments && attachments.length ? attachments : undefined,
        })) {
          if (event.type === "token") {
            didReceiveToken = true;
            accumulated += event.delta;
              if (!assistantMessageId) {
              const assistantMessage = appendMessage(targetSessionId, "assistant", accumulated);
              assistantMessageId = (assistantMessage as { id: string } | null)?.id ?? null;
              streamingMessageId = assistantMessageId;
              if (streamingMessageId) {
                setActiveStreamingMessageId(streamingMessageId);
              }
            } else if (assistantMessageId) {
              updateMessage(targetSessionId, assistantMessageId, { content: accumulated });
            }
            if (assistantMessageId) {
              setDisplayedAssistantContent((prev) => ({
                ...prev,
                [assistantMessageId as string]: accumulated,
              }));
              updateSession(targetSessionId, { isResponding: true });
            }
            continue;
          }

          if (event.type === "end") {
            streamedConversationId = event.conversationId ?? streamedConversationId;
            const finalResponse = normalizeAssistantContent(event.response ?? accumulated, prompt);
            accumulated = finalResponse;
            if (!assistantMessageId) {
              const assistantMessage = appendMessage(targetSessionId, "assistant", finalResponse);
              assistantMessageId = (assistantMessage as { id: string } | null)?.id ?? null;
              streamingMessageId = assistantMessageId;
              if (streamingMessageId) {
                setActiveStreamingMessageId(streamingMessageId);
              }
            } else if (assistantMessageId) {
              updateMessage(targetSessionId, assistantMessageId, { content: finalResponse });
            }
            if (assistantMessageId) {
              const finalDisplay = getAssistantDisplayText(finalResponse);
              if (!didReceiveToken && finalDisplay) {
                await simulateMessageStream(assistantMessageId, finalDisplay);
              } else {
                setDisplayedAssistantContent((prev) => ({
                  ...prev,
                  [assistantMessageId as string]: finalDisplay,
                }));
              }
            }
            updateSession(targetSessionId, {
              conversationId: streamedConversationId ?? undefined,
              isResponding: false,
            });
            return finalResponse;
          }

          if (event.type === "error") {
            throw new Error(event.message);
          }
        }

        if (!assistantMessageId) {
          const normalized = normalizeAssistantContent(accumulated, prompt);
          const assistantMessage = appendMessage(targetSessionId, "assistant", normalized);
          assistantMessageId = (assistantMessage as { id: string } | null)?.id ?? null;
          accumulated = normalized;
          if (!didReceiveToken && assistantMessageId && !streamingMessageId) {
            streamingMessageId = assistantMessageId;
            setActiveStreamingMessageId(assistantMessageId);
          }
        }
        if (assistantMessageId) {
          const displayText = getAssistantDisplayText(accumulated);
          if (!didReceiveToken && displayText) {
            await simulateMessageStream(assistantMessageId, displayText);
          } else {
            setDisplayedAssistantContent((prev) => ({
              ...prev,
              [assistantMessageId as string]: displayText,
            }));
          }
        }

        updateSession(targetSessionId, {
          conversationId: streamedConversationId ?? undefined,
          isResponding: false,
        });
        return accumulated;
      } catch (error) {
        console.error("Failed to stream assistant reply:", error);
        try {
          const fallbackResponse = await apiService.sendMessage({
            message: prompt,
            conversation_id: conversationId ?? undefined,
            system_prompt: SYSTEM_PROMPT,
            user_id: user.id,
            context: contextPayload,
            attachments: attachments && attachments.length ? attachments : undefined,
          });
          streamedConversationId = fallbackResponse.conversation_id ?? streamedConversationId;
          const finalResponse = normalizeAssistantContent(fallbackResponse.response, prompt);
          if (assistantMessageId) {
            updateMessage(targetSessionId, assistantMessageId, { content: finalResponse });
          } else {
            const assistantMessage = appendMessage(targetSessionId, "assistant", finalResponse);
            assistantMessageId = assistantMessage?.id ?? null;
            if (!didReceiveToken && assistantMessageId && !streamingMessageId) {
              streamingMessageId = assistantMessageId;
              setActiveStreamingMessageId(assistantMessageId);
            }
          }
          if (assistantMessageId) {
            const displayText = getAssistantDisplayText(finalResponse);
            if (!didReceiveToken && displayText) {
              await simulateMessageStream(assistantMessageId, displayText);
            } else {
                setDisplayedAssistantContent((prev) => ({
                  ...prev,
                  [assistantMessageId as string]: displayText,
                }));
            }
          }
          updateSession(targetSessionId, {
            conversationId: streamedConversationId ?? undefined,
            isResponding: false,
          });
          return finalResponse;
        } catch (fallbackError) {
          console.error("Fallback chat request failed:", fallbackError);
          const fallback = buildAssistantReply(prompt);
          if (assistantMessageId) {
            updateMessage(targetSessionId, assistantMessageId, { content: fallback });
          } else {
            const assistantMessage = appendMessage(targetSessionId, "assistant", fallback);
            assistantMessageId = assistantMessage?.id ?? null;
            if (!didReceiveToken && assistantMessageId && !streamingMessageId) {
              streamingMessageId = assistantMessageId;
              setActiveStreamingMessageId(assistantMessageId);
            }
          }
          if (assistantMessageId) {
            const displayText = getAssistantDisplayText(fallback);
            if (!didReceiveToken && displayText) {
              await simulateMessageStream(assistantMessageId, displayText);
            } else {
              setDisplayedAssistantContent((prev) => ({
                ...prev,
                [assistantMessageId as string]: displayText,
              }));
            }
          }
          updateSession(targetSessionId, { isResponding: false });
          return fallback;
        }
      } finally {
        if (streamingMessageId) {
          setActiveStreamingMessageId((previous) =>
            previous === streamingMessageId ? null : previous
          );
        }
      }
    },
    [
      appendMessage,
      shouldIncludeWorkspaceContext,
      simulateMessageStream,
      updateMessage,
      updateSession,
      user,
      workspaceContext,
    ]
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session) {
      return;
    }
    const content = draft.trim();
    const readyAttachments = composerAttachments.filter(
      (attachment) => attachment.status === "uploaded" && attachment.uploaded
    );
    const attachmentPayload = readyAttachments.map((attachment) => attachment.uploaded!) as ChatAttachment[];
    const hasMessageBody = Boolean(content) || attachmentPayload.length > 0;
    const hasPendingAttachments = composerAttachments.some(
      (attachment) => attachment.status !== "uploaded"
    );

    if (!hasMessageBody || hasPendingAttachments) {
      return;
    }

    appendMessage(session.id, "user", content, attachmentPayload.length ? attachmentPayload : undefined);
    setDraft("");
    clearComposerAttachments();
    if (replyTimeout.current !== null) {
      window.clearTimeout(replyTimeout.current);
    }

    if (user) {
      void streamAssistantReply(
        session.id,
        content,
        session.conversationId ?? null,
        attachmentPayload.length ? attachmentPayload : undefined
      );
      return;
    }

    replyTimeout.current = window.setTimeout(() => {
      appendMessage(session.id, "assistant", buildAssistantReply(content));
      replyTimeout.current = null;
    }, FALLBACK_ASSISTANT_DELAY_MS);
  };

  const latestAssistantMessageId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === "assistant") {
        return message.id;
      }
    }
    return null;
  }, [messages]);

  const getResponseDurationLabel = useCallback(
    (messageIndex: number) => {
      const message = messages[messageIndex];
      if (!message || message.role !== "assistant") {
        return null;
      }
      for (let index = messageIndex - 1; index >= 0; index -= 1) {
        const candidate = messages[index];
        if (candidate.role === "assistant") {
          continue;
        }
        if (candidate.role === "user") {
          const diffMs = Math.max(0, message.createdAt - candidate.createdAt);
          if (!Number.isFinite(diffMs)) {
            return null;
          }
          const diffSeconds = diffMs / 1000;
          if (diffSeconds < 0.1) {
            return "<0.1s";
          }
          if (diffSeconds >= 10) {
            return `${Math.round(diffSeconds)}s`;
          }
          return `${diffSeconds.toFixed(1)}s`;
        }
      }
      return null;
    },
    [messages]
  );

  const handleCopyMessage = useCallback(
    async (messageId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        console.warn("Clipboard API is not available in this environment.");
        return;
      }
      try {
        await navigator.clipboard.writeText(trimmed);
        setCopiedMessageId(messageId);
        if (copyResetTimeoutRef.current !== null) {
          window.clearTimeout(copyResetTimeoutRef.current);
        }
        copyResetTimeoutRef.current = window.setTimeout(() => {
          setCopiedMessageId(null);
          copyResetTimeoutRef.current = null;
        }, 2000);
      } catch (error) {
        console.error("Failed to copy response:", error);
      }
    },
    []
  );

  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      if (!session) {
        return;
      }
      const timer = animationTimersRef.current.get(messageId);
      if (timer) {
        window.clearInterval(timer);
        animationTimersRef.current.delete(messageId);
      }
      processedAssistantMessagesRef.current.delete(messageId);
      simulatedMessagesRef.current.delete(messageId);
      if (activeStreamingMessageId === messageId) {
        setActiveStreamingMessageId(null);
      }
      setDisplayedAssistantContent((prev) => {
        if (!(messageId in prev)) {
          return prev;
        }
        const next = { ...prev };
        delete next[messageId];
        return next;
      });
      if (copiedMessageId === messageId) {
        setCopiedMessageId(null);
      }
      deleteMessage(session.id, messageId);
    },
    [activeStreamingMessageId, copiedMessageId, deleteMessage, session]
  );

  const handleRegenerate = useCallback(
    (messageId: string) => {
      if (!session) {
        return;
      }

      const assistantIndex = messages.findIndex((message) => message.id === messageId);
      if (assistantIndex === -1) {
        return;
      }

      const assistantMessage = messages[assistantIndex];
      if (assistantMessage.role !== "assistant") {
        return;
      }

      if (assistantMessage.id !== latestAssistantMessageId) {
        console.warn("Regeneration is only supported for the latest assistant response.");
        return;
      }

      let userIndex = assistantIndex - 1;
      while (userIndex >= 0 && messages[userIndex].role !== "user") {
        userIndex -= 1;
      }
      if (userIndex < 0) {
        console.warn("Unable to locate the originating user message for regeneration.");
        return;
      }

      const userMessage = messages[userIndex];
      const preservedMessages = messages.slice(0, userIndex);

      const animationsTimer = animationTimersRef.current.get(assistantMessage.id);
      if (animationsTimer) {
        window.clearInterval(animationsTimer);
        animationTimersRef.current.delete(assistantMessage.id);
      }

      setDisplayedAssistantContent((prev) => {
        if (!(assistantMessage.id in prev)) {
          return prev;
        }
        const next = { ...prev };
        delete next[assistantMessage.id];
        return next;
      });
      processedAssistantMessagesRef.current.delete(assistantMessage.id);

      setRegeneratingMessageId(assistantMessage.id);

      updateSession(session.id, {
        messages: preservedMessages,
        isResponding: true,
      });

      const attachments = userMessage.attachments ?? [];
      appendMessage(
        session.id,
        "user",
        userMessage.content,
        attachments.length ? attachments : undefined
      );

      if (user) {
        void (async () => {
          try {
            await streamAssistantReply(
              session.id,
              userMessage.content,
              session.conversationId ?? null,
              attachments.length ? attachments : undefined
            );
          } finally {
            setRegeneratingMessageId(null);
          }
        })();
        return;
      }

      window.setTimeout(() => {
        appendMessage(session.id, "assistant", buildAssistantReply(userMessage.content));
        setRegeneratingMessageId(null);
      }, FALLBACK_ASSISTANT_DELAY_MS);
    },
    [
      appendMessage,
      latestAssistantMessageId,
      messages,
      session,
      updateSession,
      streamAssistantReply,
      user,
      workspaceContext,
    ]
  );

  if (!hasHydrated) {
    return (
      <div className={styles.chatView} aria-live="polite">
        <div className={styles.chatViewport}>
          <div className={styles.chatFade} aria-hidden="true" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className={styles.chatViewEmpty}>
        <div>
          <h2>We could not find that chat.</h2>
          <p>Select another conversation from the sidebar or start a new one.</p>
        </div>
      </div>
    );
  }

  const isResponding = session.isResponding;
  const trimmedDraft = draft.trim();
  const hasUploadedAttachments = composerAttachments.some((attachment) => attachment.status === "uploaded");
  const hasPendingAttachments = composerAttachments.some((attachment) => attachment.status !== "uploaded");
  const composerHasContent = Boolean(trimmedDraft) || hasUploadedAttachments;
  const isSendDisabled = isResponding || !composerHasContent || hasPendingAttachments;

  return (
    <div className={styles.chatView} aria-live="polite">
      <div className={styles.chatViewport}>
        <div className={styles.chatFade} aria-hidden="true" />
        <div className={styles.chatMessages}>
          {messages.map((message, messageIndex) => {
            const isUser = message.role === "user";
            const isAssistant = !isUser;
            const quickReplies: string[] = [];
            const rawContent = message.content ?? "";
            const assistantSections = isAssistant ? parseStructuredAssistantMessage(rawContent) : null;
            const fullText = isAssistant ? assistantSections?.ai ?? rawContent : rawContent;
            const assistantDisplayEntry = isAssistant ? displayedAssistantContent[message.id] : undefined;
            const animatedText = isAssistant ? assistantDisplayEntry ?? "" : fullText;
            const isStreamingMessage = isAssistant && message.id === activeStreamingMessageId;
            const isAnimating =
              isAssistant &&
              assistantDisplayEntry !== undefined &&
              (isStreamingMessage || (fullText.length > 0 && animatedText.length < fullText.length));
            const hasTextContent = isAssistant
              ? isStreamingMessage
                ? true
                : fullText.trim().length > 0
              : Boolean(animatedText.trim());
            const messageAttachments = message.attachments ?? [];
            const hasMessageAttachments = messageAttachments.length > 0;
            const responseDurationLabel = isAssistant
              ? getResponseDurationLabel(messageIndex)
              : null;
            const isLatestAssistantMessage = isAssistant && message.id === latestAssistantMessageId;
            const isRegenerating = regeneratingMessageId === message.id;
            const bubbleClassName = isUser ? styles.chatBubbleUser : styles.chatBubbleAssistant;
            return (
              <div
                key={message.id}
                className={styles.chatMessage}
                data-role={isUser ? "user" : "assistant"}
                data-streaming={isStreamingMessage ? "true" : undefined}
              >
                <div className={`${styles.chatBubble} ${bubbleClassName}`}>
                  {hasTextContent && (
                    <div
                      className={
                        isAnimating ? styles.chatMarkdownGenerating : styles.chatMarkdown
                      }
                      data-animating={isAnimating ? "true" : "false"}
                    >
                      {isAssistant && isAnimating ? (
                        <span>{animatedText || "\u00a0"}</span>
                      ) : (
                        <ReactMarkdown
                          remarkPlugins={[remarkMath, remarkGfm]}
                          rehypePlugins={[[rehypeKatex, { strict: false }]]}
                        >
                          {isAssistant ? fullText : animatedText}
                        </ReactMarkdown>
                      )}
                    </div>
                  )}
                  {hasMessageAttachments && (
                    <div className={styles.chatMessageAttachments}>
                      {messageAttachments.map((attachment) => {
                        const isImage = attachment.mime_type?.startsWith("image/");
                        const sizeLabel = formatFileSize(attachment.size_bytes);
                        return (
                          <div
                            key={`${message.id}-${attachment.name}`}
                            className={styles.chatMessageAttachment}
                          >
                            <div className={styles.chatMessageAttachmentIcon}>
                              {isImage ? <ImageIcon size={16} /> : <FileText size={16} />}
                            </div>
                            <div className={styles.chatMessageAttachmentMeta}>
                              <span>{attachment.display_name ?? attachment.name}</span>
                              <div>
                                {sizeLabel && <span>{sizeLabel}</span>}
                                <span className={styles.chatMessageAttachmentHint}>
                                  Stored in Gemini
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {isAssistant && (
                  <div className={styles.chatMessageFooter}>
                    <div className={styles.chatActionRow}>
                      <button
                        type="button"
                        aria-label="Regenerate response"
                        onClick={() => handleRegenerate(message.id)}
                        disabled={!isLatestAssistantMessage || isRegenerating}
                        data-state={isRegenerating ? "loading" : "idle"}
                      >
                        {isRegenerating ? <Loader2 size={15} /> : <RefreshCw size={15} />}
                      </button>
                      <button
                        type="button"
                        aria-label="Copy response"
                        onClick={() => handleCopyMessage(message.id, fullText)}
                        disabled={!fullText.trim()}
                      >
                        {copiedMessageId === message.id ? <CheckCircle2 size={15} /> : <Copy size={15} />}
                      </button>
                      <button
                        type="button"
                        aria-label="Delete message"
                        onClick={() => handleDeleteMessage(message.id)}
                        data-variant="danger"
                      >
                        <Trash2 size={15} />
                      </button>
                      <span aria-hidden="true">
                        {responseDurationLabel ?? "—"}
                      </span>
                    </div>
                    {quickReplies.length > 0 && (
                      <div className={styles.chatQuickReplies}>
                        {quickReplies.map((reply) => (
                          <button key={reply} type="button">
                            {reply}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={scrollAnchorRef} />
        </div>
      </div>

      <div className={styles.chatComposerDock}>
        {composerAttachments.length > 0 && (
          <div className={styles.chatAttachmentList}>
            {composerAttachments.map((attachment) => {
              const isImage = attachment.file.type.startsWith("image/");
              const sizeLabel = formatFileSize(attachment.file.size);
              return (
                <div
                  key={attachment.id}
                  className={styles.chatAttachmentItem}
                  data-status={attachment.status}
                >
                  <div className={styles.chatAttachmentPreview}>
                    {isImage && attachment.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={attachment.previewUrl} alt={attachment.file.name} />
                    ) : (
                      <FileText size={16} />
                    )}
                  </div>
                  <div className={styles.chatAttachmentMeta}>
                    <span className={styles.chatAttachmentName}>{attachment.file.name}</span>
                    <span className={styles.chatAttachmentDetails}>
                      {sizeLabel}
                      {sizeLabel && attachment.status !== "uploaded" ? " • " : ""}
                      {attachment.status === "uploading" && "Uploading"}
                      {attachment.status === "uploaded" && "Ready"}
                      {attachment.status === "error" && "Failed"}
                    </span>
                    {attachment.error && (
                      <span className={styles.chatAttachmentError}>{attachment.error}</span>
                    )}
                  </div>
                  <div className={styles.chatAttachmentActions}>
                    {attachment.status === "uploading" && (
                      <Loader2 size={16} className={styles.chatAttachmentSpinner} />
                    )}
                    {attachment.status === "uploaded" && <CheckCircle2 size={16} />}
                    {attachment.status === "error" && (
                      <button
                        type="button"
                        className={styles.chatAttachmentRetry}
                        onClick={() => handleRetryAttachment(attachment.id)}
                      >
                        Retry
                      </button>
                    )}
                    <button
                      type="button"
                      className={styles.chatAttachmentRemove}
                      aria-label="Remove attachment"
                      onClick={() => handleRemoveAttachment(attachment.id)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className={styles.chatBarRow}>
          <GrayChatBar
            value={draft}
            onChange={setDraft}
            onSubmit={handleSubmit}
            onSelectFiles={handleFilesSelected}
            isSubmitDisabled={isSendDisabled}
            isSubmitting={isResponding}
            fileAccept="image/*,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.csv,.md,.json"
          />
        </div>
        <p className={styles.chatDisclaimer}>Gray can make mistakes. Check important info.</p>
      </div>
    </div>
  );
}
