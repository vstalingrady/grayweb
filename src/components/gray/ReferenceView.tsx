"use client";

import React, { useState, useRef, useCallback } from "react";
import { Search, Upload, FileText, LoaderCircle, X, CheckCircle2, AlertCircle } from "lucide-react";
import { apiService } from "@/lib/api";
import { useUser } from "@/contexts/UserContext";

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
  const { user } = useUser();
  const [searchQuery, setSearchQuery] = useState("");
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
            error: error instanceof Error ? error.message : 'Upload failed'
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
  }, [user]);

  const handleRemoveDocument = useCallback((docId: number) => {
    setDocuments(prev => prev.filter(doc => doc.id !== docId));
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredDocuments = documents.filter(doc =>
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <header className="mb-6 px-8 pt-8 shrink-0 text-center">
        <h1 className="text-3xl font-medium tracking-tight text-white">Reference</h1>
        <p className="text-sm text-zinc-500 mt-2">
          Upload documents to build your knowledge base
        </p>
      </header>

      <div className="flex flex-col flex-1 overflow-y-auto px-8 pb-8">
        {/* Search and Upload Bar */}
        <div className="flex items-center gap-4 w-full max-w-lg mb-8 mx-auto shrink-0">
          <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-full bg-[#0A0A0A] border border-white/10 focus-within:border-white/20 transition-colors">
            <Search size={18} className="text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your knowledge base..."
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
            title="Upload Files"
          >
            {isUploading ? (
              <LoaderCircle size={20} className="animate-spin" />
            ) : (
              <Upload size={20} />
            )}
          </button>
        </div>

        {/* Documents List */}
        <div className="w-full max-w-2xl mx-auto">
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-4">
                <FileText size={32} className="text-zinc-600" />
              </div>
              <p className="text-zinc-400 text-sm">
                {searchQuery ? 'No documents match your search' : 'No documents uploaded yet'}
              </p>
              <p className="text-zinc-600 text-xs mt-2">
                Upload PDFs, text files, and more to get started
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-4 p-4 rounded-xl bg-[#0A0A0A] border border-white/10 hover:border-white/20 transition-colors"
                >
                  {/* Status Icon */}
                  <div className="flex-shrink-0">
                    {doc.status === 'uploading' && (
                      <LoaderCircle size={20} className="text-blue-400 animate-spin" />
                    )}
                    {doc.status === 'processing' && (
                      <LoaderCircle size={20} className="text-yellow-400 animate-spin" />
                    )}
                    {doc.status === 'ready' && (
                      <CheckCircle2 size={20} className="text-green-400" />
                    )}
                    {doc.status === 'error' && (
                      <AlertCircle size={20} className="text-red-400" />
                    )}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-zinc-500 flex-shrink-0" />
                      <p className="text-sm text-zinc-200 truncate font-medium">
                        {doc.filename}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-zinc-600">
                        {formatFileSize(doc.size)}
                      </span>
                      <span className="text-xs text-zinc-600">
                        {doc.created_at.toLocaleDateString()}
                      </span>
                      {doc.status === 'uploading' && (
                        <span className="text-xs text-blue-400">Uploading...</span>
                      )}
                      {doc.status === 'processing' && (
                        <span className="text-xs text-yellow-400">Processing...</span>
                      )}
                      {doc.status === 'ready' && (
                        <span className="text-xs text-green-400">Ready</span>
                      )}
                      {doc.status === 'error' && (
                        <span className="text-xs text-red-400">{doc.error || 'Failed'}</span>
                      )}
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => handleRemoveDocument(doc.id)}
                    className="flex-shrink-0 p-2 rounded-lg hover:bg-white/10 transition-colors text-zinc-500 hover:text-zinc-200"
                    title="Remove document"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Section */}
        {documents.length > 0 && (
          <div className="w-full max-w-2xl mx-auto mt-8 p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-xs text-zinc-500 leading-relaxed">
              <strong className="text-zinc-400">💡 Tip:</strong> Your uploaded documents are automatically indexed and can be referenced by Gray in conversations. Ask questions about your documents to get AI-powered insights!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
