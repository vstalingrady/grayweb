"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  Search,
  Upload,
  FileText,
  LoaderCircle,
  X,
  CheckCircle2,
  AlertCircle,
  File,
  FileSpreadsheet,
  FileJson,
} from "lucide-react";
import { apiService } from "@/lib/api";
import { useUser } from "@/contexts/UserContext";
import { useI18n } from "@/contexts/I18nContext";

interface UploadedDocument {
  id: number;
  filename: string;
  mime_type: string;
  size: number;
  created_at: Date;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  error?: string;
}

export function ReferenceView() {
  const { t } = useI18n();
  const { user } = useUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "docs" | "data">("all");
  const [sortMode, setSortMode] = useState<"newest" | "oldest" | "name">("newest");
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !user) return;

    const file = files[0];

    // Create a temporary document entry
    const tempDoc: UploadedDocument = {
      id: Date.now(),
      filename: file.name,
      mime_type: file.type,
      size: file.size,
      created_at: new Date(),
      status: 'uploading',
    };

    setDocuments(prev => [tempDoc, ...prev]);
    setIsUploading(true);

    try {
      // Upload the file
      const result = await apiService.uploadMediaFile(file);

      // Update the document status
      setDocuments(prev => prev.map(doc =>
        doc.id === tempDoc.id
          ? {
            ...doc,
            id: result.id,
            status: 'processing',
          }
          : doc
      ));

      // Simulate processing time (in reality, the backend handles this)
      setTimeout(() => {
        setDocuments(prev => prev.map(doc =>
          doc.id === result.id
            ? { ...doc, status: 'ready' }
            : doc
        ));
      }, 2000);

    } catch (error) {
      console.error('Upload failed:', error);
      setDocuments(prev => prev.map(doc =>
        doc.id === tempDoc.id
          ? {
            ...doc,
            status: 'error',
            error: error instanceof Error ? error.message : t("Upload failed")
          }
          : doc
      ));
    } finally {
      setIsUploading(false);
      // Reset the input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [user, t]);

  const handleRemoveDocument = useCallback((docId: number) => {
    setDocuments(prev => prev.filter(doc => doc.id !== docId));
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const normalizeFileExtension = (filename: string) => {
    const lastDotIndex = filename.lastIndexOf(".");
    if (lastDotIndex <= 0) return "";
    return filename.slice(lastDotIndex + 1).trim().toLowerCase();
  };

  const getDocumentKind = (doc: UploadedDocument): "docs" | "data" => {
    const extension = normalizeFileExtension(doc.filename);
    if (["csv", "json"].includes(extension)) return "data";
    return "docs";
  };

  const getDocumentIcon = (doc: UploadedDocument) => {
    const extension = normalizeFileExtension(doc.filename);
    if (extension === "csv") return FileSpreadsheet;
    if (extension === "json") return FileJson;
    if (extension === "pdf" || extension === "doc" || extension === "docx" || extension === "md" || extension === "txt") {
      return FileText;
    }
    return File;
  };

  const getStatusLabel = (status: UploadedDocument["status"]) => {
    if (status === "uploading") return t("Uploading...");
    if (status === "processing") return t("Processing...");
    if (status === "ready") return t("Ready");
    return t("Failed");
  };

  const getStatusToneClasses = (status: UploadedDocument["status"]) => {
    if (status === "uploading") return "bg-blue-500/10 text-blue-300 border-blue-500/20";
    if (status === "processing") return "bg-yellow-500/10 text-yellow-200 border-yellow-500/20";
    if (status === "ready") return "bg-emerald-500/10 text-emerald-200 border-emerald-500/20";
    return "bg-red-500/10 text-red-200 border-red-500/20";
  };

  const filteredDocuments = documents
    .filter((doc) => doc.filename.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((doc) => (typeFilter === "all" ? true : getDocumentKind(doc) === typeFilter))
    .sort((left, right) => {
      if (sortMode === "name") {
        return left.filename.localeCompare(right.filename);
      }
      if (sortMode === "oldest") {
        return left.created_at.getTime() - right.created_at.getTime();
      }
      return right.created_at.getTime() - left.created_at.getTime();
    });

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <header className="mb-6 px-8 pt-8 shrink-0">
        <h1 className="text-3xl font-medium tracking-tight text-white">{t("Attachments")}</h1>
        <p className="text-sm text-zinc-500 mt-2">
          {t(
            "Manage your uploaded files and attachments. Deleting files here removes them from relevant threads, but does not delete the threads."
          )}
        </p>
      </header>

      <div className="flex flex-col flex-1 overflow-y-auto px-8 pb-8">
        {/* Controls */}
        <div className="flex flex-col gap-4 w-full max-w-5xl mb-6 mx-auto shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-full bg-[#0A0A0A] border border-white/10 focus-within:border-white/20 transition-colors">
            <Search size={18} className="text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("Search files...")}
              className="flex-1 bg-transparent border-none outline-none text-zinc-200 placeholder:text-zinc-600 text-sm"
            />
          </div>

          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.txt,.md,.doc,.docx,.json,.csv"
          />

          <button
            onClick={handleUploadClick}
            disabled={isUploading}
            className="w-12 h-12 rounded-full bg-[#0A0A0A] border border-white/10 flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:border-white/20 hover:bg-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title={t("Upload Files")}
          >
            {isUploading ? (
              <LoaderCircle size={20} className="animate-spin" />
            ) : (
              <Upload size={20} />
            )}
          </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}
                className="px-4 py-2 rounded-full bg-[#0A0A0A] border border-white/10 text-zinc-200 text-sm outline-none hover:border-white/20 focus:border-white/25 transition-colors"
                aria-label={t("Filter files")}
              >
                <option value="all">{t("All files")}</option>
                <option value="docs">{t("Documents")}</option>
                <option value="data">{t("Data")}</option>
              </select>

              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as typeof sortMode)}
                className="px-4 py-2 rounded-full bg-[#0A0A0A] border border-white/10 text-zinc-200 text-sm outline-none hover:border-white/20 focus:border-white/25 transition-colors"
                aria-label={t("Sort files")}
              >
                <option value="newest">{t("Newest")}</option>
                <option value="oldest">{t("Oldest")}</option>
                <option value="name">{t("Name")}</option>
              </select>
            </div>

            <div className="text-xs text-zinc-500">
              {filteredDocuments.length === 1
                ? t("1 file")
                : t("{count} files", { count: filteredDocuments.length })}
            </div>
          </div>
        </div>

        {/* Gallery */}
        <div className="w-full max-w-5xl mx-auto">
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-4">
                <FileText size={32} className="text-zinc-600" />
              </div>
              <p className="text-zinc-400 text-sm">
                {searchQuery ? t("No files match your search") : t("No attachments found.")}
              </p>
              <p className="text-zinc-600 text-xs mt-2">
                {t("Attachments will appear here when your chats include them.")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="group relative overflow-hidden rounded-2xl bg-[#0A0A0A] border border-white/10 hover:border-white/20 transition-colors"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-zinc-100 truncate font-medium">
                          {doc.filename}
                        </p>
                        <p className="text-xs text-zinc-500 mt-1">
                          {doc.created_at.toLocaleDateString()} • {formatFileSize(doc.size)}
                        </p>
                      </div>

                      <button
                        onClick={() => handleRemoveDocument(doc.id)}
                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-2 -m-2 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-zinc-200"
                        title={t("Remove document")}
                        aria-label={t("Remove document")}
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {(() => {
                          const Icon = getDocumentIcon(doc);
                          return <Icon size={18} className="text-zinc-400 flex-shrink-0" />;
                        })()}
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] ${getStatusToneClasses(
                            doc.status
                          )}`}
                        >
                          {doc.status === "uploading" || doc.status === "processing" ? (
                            <LoaderCircle size={12} className="animate-spin" />
                          ) : null}
                          {doc.status === "ready" ? <CheckCircle2 size={12} /> : null}
                          {doc.status === "error" ? <AlertCircle size={12} /> : null}
                          <span className="truncate">{doc.status === "error" ? doc.error || getStatusLabel(doc.status) : getStatusLabel(doc.status)}</span>
                        </span>
                      </div>

                      <span className="text-[11px] text-zinc-500 uppercase tracking-wider">
                        {normalizeFileExtension(doc.filename) || t("File")}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
