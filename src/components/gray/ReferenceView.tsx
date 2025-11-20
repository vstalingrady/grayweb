"use client";

import React, { useState } from "react";
import { Search, Upload, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MARKDOWN_CONTENT } from "./ReferenceContent";

export function ReferenceView() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <header className="mb-6 px-8 pt-8 shrink-0">
        <h1 className="text-3xl font-medium tracking-tight text-white mb-2">Reference</h1>
        <p className="text-zinc-400">
          Upload documents and manage your knowledge base for RAG.
        </p>
      </header>

      <div className="flex flex-col flex-1 overflow-y-auto px-8 pb-8">
        <div className="flex items-center gap-4 w-full max-w-2xl mb-8 mx-auto shrink-0">
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

          <button
            className="w-12 h-12 rounded-full bg-[#0A0A0A] border border-white/10 flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:border-white/20 hover:bg-white/5 transition-all"
            title="Upload Files"
          >
            <Upload size={20} />
          </button>
        </div>

        <div className="w-full max-w-4xl mx-auto">
            <div className="prose prose-invert prose-zinc max-w-none pb-20">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {MARKDOWN_CONTENT}
                </ReactMarkdown>
            </div>
        </div>
      </div>
    </div>
  );
}
