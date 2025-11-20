"use client";

import React from "react";
import { FileText, Upload, Search } from "lucide-react";

export function ReferenceView() {
  return (
    <div className="flex flex-col h-full p-8 max-w-5xl mx-auto w-full">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Reference Library</h1>
        <p className="text-gray-400">
          Upload documents and manage your knowledge base for RAG.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800/50 flex flex-col items-center justify-center text-center gap-4 min-h-[200px] cursor-pointer hover:bg-gray-900/80 transition-colors">
          <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
            <Upload size={24} />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Upload Files</h3>
            <p className="text-sm text-gray-500 mt-1">
              PDF, TXT, MD supported
            </p>
          </div>
        </div>
        
        <div className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800/50 flex flex-col items-center justify-center text-center gap-4 min-h-[200px] cursor-pointer hover:bg-gray-900/80 transition-colors">
           <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400">
            <Search size={24} />
          </div>
          <div>
             <h3 className="font-semibold text-lg">Search Context</h3>
             <p className="text-sm text-gray-500 mt-1">
               Find snippets across all docs
             </p>
           </div>
        </div>

        <div className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800/50 flex flex-col items-center justify-center text-center gap-4 min-h-[200px]">
           <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-400">
            <FileText size={24} />
          </div>
          <div>
             <h3 className="font-semibold text-lg">0 Documents</h3>
             <p className="text-sm text-gray-500 mt-1">
               No files indexed yet
             </p>
           </div>
        </div>
      </div>

      <div className="flex-1 rounded-2xl bg-gray-900/30 border border-gray-800/30 p-6">
        <div className="flex items-center justify-center h-full text-gray-500">
          Select an action above to get started
        </div>
      </div>
    </div>
  );
}
