import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import { API_BASE } from "../utils/api.js";

export default function UploadStep({ onComplete }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [chunkSize, setChunkSize] = useState(300);
  const [overlap, setOverlap] = useState(50);
  const fileRef = useRef();

  const handleFile = async (file) => {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("chunkSize", chunkSize);
      formData.append("overlap", overlap);

      const res = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: formData });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      onComplete(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-3"
      >
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1.5 text-indigo-400 text-sm">
          <span>Step 1</span>
          <span className="text-indigo-600">·</span>
          <span>Document Ingestion</span>
        </div>
        <h2 className="text-3xl font-bold text-white">
          Upload Your Document
        </h2>
        <p className="text-slate-400 max-w-lg mx-auto">
          Upload a text or PDF file to begin. The system will extract text, split it into
          chunks, and prepare it for semantic embedding.
        </p>
      </motion.div>

      {/* Settings */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: 0.1 } }}
        className="glass rounded-2xl p-6 space-y-4"
      >
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Chunking Parameters
        </h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Chunk Size <span className="text-indigo-400 font-mono">{chunkSize} words</span>
            </label>
            <input
              type="range" min={50} max={800} step={50} value={chunkSize}
              onChange={(e) => setChunkSize(+e.target.value)}
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-slate-600 mt-1">
              <span>50 (fine)</span><span>800 (coarse)</span>
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Overlap <span className="text-cyan-400 font-mono">{overlap} words</span>
            </label>
            <input
              type="range" min={0} max={150} step={10} value={overlap}
              onChange={(e) => setOverlap(+e.target.value)}
              className="w-full accent-cyan-500"
            />
            <div className="flex justify-between text-xs text-slate-600 mt-1">
              <span>0 (none)</span><span>150 (max)</span>
            </div>
          </div>
        </div>
        <div className="bg-dark-700/50 rounded-lg p-3 text-xs text-slate-400 border border-white/5">
          💡 <strong className="text-slate-300">Chunk size</strong> controls how much text goes into each vector.
          <strong className="text-slate-300"> Overlap</strong> ensures context isn't lost at chunk boundaries.
        </div>
      </motion.div>

      {/* Drop zone */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1, transition: { delay: 0.2 } }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !loading && fileRef.current?.click()}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-300
          ${dragging
            ? "border-indigo-400 bg-indigo-500/10 scale-[1.01]"
            : "border-white/10 hover:border-indigo-500/40 hover:bg-dark-800"
          }`}
      >
        {loading && (
          <div className="absolute inset-0 rounded-2xl overflow-hidden">
            <div className="shimmer absolute inset-0" />
          </div>
        )}
        <input
          ref={fileRef} type="file" accept=".txt,.pdf,.md"
          className="hidden" onChange={(e) => handleFile(e.target.files[0])}
        />
        <div className="space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-indigo-500/20 flex items-center justify-center text-3xl">
            {loading ? "⏳" : "📄"}
          </div>
          <div>
            <p className="text-lg font-semibold text-white">
              {loading ? "Processing document..." : "Drop a file here"}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              {loading
                ? "Extracting text and preparing chunks"
                : "Supports .txt · .pdf · .md — up to 10MB"
              }
            </p>
          </div>
          {!loading && (
            <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-medium transition-colors">
              Browse Files
            </button>
          )}
        </div>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-rose-400 text-sm"
        >
          ⚠️ {error}
        </motion.div>
      )}

      {/* Example documents notice */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: 0.3 } }}
        className="text-center text-sm text-slate-600"
      >
        Try uploading any text document — a research paper, article, or paste text into a .txt file
      </motion.div>
    </div>
  );
}
