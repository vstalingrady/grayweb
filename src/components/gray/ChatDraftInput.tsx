"use client";

import { useState, useCallback, useMemo, type FormEvent, type ReactNode } from "react";
import { GrayChatBar, type GrayChatBarProps } from "@/components/gray/ChatBar";
import { GrayChatComposer } from "@/components/gray/ChatComposer";

export type ChatDraftControls = {
    clear: () => void;
    restore: (value: string) => void;
};

export type ChatDraftInputProps = Omit<GrayChatBarProps, "value" | "onChange" | "onSubmit"> & {
    variant: "composer" | "bar";
    onSubmitMessage: (draft: string, controls: ChatDraftControls) => void;
    showUnderline?: boolean;
    attachmentTray?: ReactNode;
    isSubmitDisabled?: boolean;
    onPasteFiles?: (files: File[]) => void;
};

export const ChatDraftInput = ({
    variant,
    onSubmitMessage,
    showUnderline = true,
    attachmentTray,
    isSubmitDisabled,
    onPasteFiles,
    ...rest
}: ChatDraftInputProps) => {
    const [value, setValue] = useState("");
    const clear = useCallback(() => setValue(""), []);
    const restore = useCallback((nextValue: string) => setValue(nextValue), []);
    const controls = useMemo(
        () => ({
            clear,
            restore,
        }),
        [clear, restore]
    );

    const handleChange = useCallback((nextValue: string) => {
        setValue(nextValue);
    }, []);

    const handleSubmit = useCallback(
        (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const trimmed = value.trim();
            if (!trimmed) {
                return;
            }
            onSubmitMessage(trimmed, controls);
        },
        [value, controls, onSubmitMessage]
    );

    if (variant === "composer") {
        return (
            <GrayChatComposer
                {...rest}
                value={value}
                onChange={handleChange}
                onSubmit={handleSubmit}
                showUnderline={showUnderline}
                attachmentTray={attachmentTray}
                isSubmitDisabled={isSubmitDisabled}
                onPasteFiles={onPasteFiles}
            />
        );
    }

    return (
        <GrayChatBar
            {...rest}
            value={value}
            onChange={handleChange}
            onSubmit={handleSubmit}
            isSubmitDisabled={isSubmitDisabled}
            onPasteFiles={onPasteFiles}
        />
    );
};
