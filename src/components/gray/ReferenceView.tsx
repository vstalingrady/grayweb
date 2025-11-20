"use client";

import React, { useState } from "react";
import { Search, Upload, FileText } from "lucide-react";

export function ReferenceView() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="flex flex-col h-full w-full">
      <header className="mb-10">
        <h1 className="text-3xl font-medium tracking-tight text-white mb-2">Reference</h1>
        <p className="text-zinc-400">
          Upload documents and manage your knowledge base for RAG.
        </p>
      </header>

      <div className="flex flex-col items-center justify-center flex-1 min-h-[400px]">
        <div className="flex items-center gap-4 w-full max-w-2xl mb-12">
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

        <div className="w-full max-w-2xl p-12 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-zinc-900/50 flex items-center justify-center mb-4">
            <FileText className="text-zinc-600" size={24} />
          </div>
          <h3 className="text-zinc-300 font-medium text-lg">0 Documents</h3>
          <p className="text-zinc-500 text-sm mt-1 max-w-xs">
            No files indexed yet. Upload documents to get started.
          </p>
        </div>
      </div>
    </div>
  );
}
