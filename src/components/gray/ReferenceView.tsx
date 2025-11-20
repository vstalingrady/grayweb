"use client";

import React from "react";
import { FileText, Upload, Search } from "lucide-react";

export function ReferenceView() {
  return (
    <div className="flex flex-col h-full p-8 max-w-6xl mx-auto w-full">
      <header className="mb-10">
        <h1 className="text-3xl font-medium tracking-tight text-white mb-2">Reference</h1>
        <p className="text-zinc-400">
          Upload documents and manage your knowledge base for RAG.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="p-6 rounded-3xl bg-[#0A0A0A] border border-white/5 flex flex-col items-center justify-center text-center gap-4 min-h-[200px] cursor-pointer hover:bg-[#111] hover:border-white/10 transition-all duration-200 group">
          <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform duration-200">
            <Upload size={20} />
          </div>
          <div>
            <h3 className="font-medium text-zinc-100 text-lg">Upload Files</h3>
            <p className="text-sm text-zinc-500 mt-1">
              PDF, TXT, MD supported
            </p>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-[#0A0A0A] border border-white/5 flex flex-col items-center justify-center text-center gap-4 min-h-[200px] cursor-pointer hover:bg-[#111] hover:border-white/10 transition-all duration-200 group">
          <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform duration-200">
            <Search size={20} />
          </div>
          <div>
            <h3 className="font-medium text-zinc-100 text-lg">Search Context</h3>
            <p className="text-sm text-zinc-500 mt-1">
              Find snippets across all docs
            </p>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-[#0A0A0A] border border-white/5 flex flex-col items-center justify-center text-center gap-4 min-h-[200px] group">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <FileText size={20} />
          </div>
          <div>
            <h3 className="font-medium text-zinc-100 text-lg">0 Documents</h3>
            <p className="text-sm text-zinc-500 mt-1">
              No files indexed yet
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 rounded-3xl bg-[#0A0A0A] border border-white/5 p-6">
        <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
          Select an action above to get started
        </div>
      </div>
    </div>
  );
}
