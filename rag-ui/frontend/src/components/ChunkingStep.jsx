import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function ChunkingStep({ ragState, onComplete, onBack }) {
  const { chunks = [], chunkingStats, filename } = ragState;
  const [activeChunk, setActiveChunk] = useState(null);
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    // Animate chunks revealing one by one
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setRevealed(i);
      if (i >= chunks.length) clearInterval(timer);
    }, 80);
    return () => clearInterval(timer);
  }, [chunks.length]);

  const maxWords = Math.max(...chunks.map((c) => c.wordCount), 1);
  const colors = [
    "from-indigo-500/20 to-indigo-600/20 border-indigo-500/30",
    "from-cyan-500/20 to-cyan-600/20 border-cyan-500/30",
    "from-emerald-500/20 to-emerald-600/20 border-emerald-500/30",
    "from-amber-500/20 to-amber-600/20 border-amber-500/30",
    "from-rose-500/20 to-rose-600/20 border-rose-500/30",
    "from-violet-500/20 to-violet-600/20 border-violet-500/30",
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-4 py-1.5 text-cyan-400 text-sm">
          <span>Step 2</span><span className="text-cyan-600">·</span><span>Text Chunking</span>
        </div>
        <h2 className="text-3xl font-bold text-white">Document Chunks</h2>
        <p className="text-slate-400">
          <strong className="text-white">{filename}</strong> was split into{" "}
          <strong className="text-cyan-400">{chunks.length} chunks</strong> using sliding window
        </p>
      </div>

      {/* Stats row */}
      {chunkingStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Chunks", value: chunkingStats.totalChunks, color: "text-cyan-400", icon: "✂️" },
            { label: "Avg Chunk Size", value: `${chunkingStats.avgChunkSize} words`, color: "text-indigo-400", icon: "📏" },
            { label: "Max Chunk", value: `${chunkingStats.maxChunkSize} words`, color: "text-emerald-400", icon: "⬆️" },
            { label: "Min Chunk", value: `${chunkingStats.minChunkSize} words`, color: "text-amber-400", icon: "⬇️" },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-xl p-4 text-center"
            >
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Chunk size bar chart */}
      <div className="glass rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
          Chunk Size Distribution
        </h3>
        <div className="flex items-end gap-1 h-24">
          {chunks.map((chunk, i) => {
            const pct = (chunk.wordCount / maxWords) * 100;
            return (
              <motion.div
                key={chunk.id}
                initial={{ height: 0, opacity: 0 }}
                animate={i < revealed ? { height: `${pct}%`, opacity: 1 } : {}}
                transition={{ duration: 0.3, delay: i * 0.02 }}
                onClick={() => setActiveChunk(activeChunk?.id === chunk.id ? null : chunk)}
                className={`flex-1 min-w-0 rounded-t cursor-pointer transition-all hover:opacity-80
                  ${activeChunk?.id === chunk.id
                    ? "bg-cyan-400"
                    : "bg-gradient-to-t from-cyan-600 to-cyan-400/60"
                  }`}
                title={`Chunk ${i + 1}: ${chunk.wordCount} words`}
              />
            );
          })}
        </div>
        <div className="flex justify-between text-xs text-slate-600 mt-2">
          <span>Chunk 1</span>
          <span className="text-slate-500">← Click a bar to inspect →</span>
          <span>Chunk {chunks.length}</span>
        </div>
      </div>

      {/* Chunk grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {chunks.slice(0, 30).map((chunk, i) => (
          <motion.div
            key={chunk.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={i < revealed ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            onClick={() => setActiveChunk(activeChunk?.id === chunk.id ? null : chunk)}
            className={`cursor-pointer rounded-xl border p-4 bg-gradient-to-br transition-all hover:scale-[1.01]
              ${activeChunk?.id === chunk.id
                ? "border-cyan-400/60 bg-cyan-500/10 shadow-lg shadow-cyan-500/10"
                : colors[i % colors.length]
              }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-slate-500">Chunk #{chunk.id + 1}</span>
              <span className="text-xs text-cyan-400 font-mono">{chunk.wordCount}w</span>
            </div>
            <p className="text-sm text-slate-300 line-clamp-3 leading-relaxed">
              {chunk.text}
            </p>
            <div className="mt-3 flex gap-2">
              <span className="text-xs bg-dark-700 rounded px-2 py-0.5 text-slate-500">
                {chunk.charCount} chars
              </span>
            </div>
          </motion.div>
        ))}
        {chunks.length > 30 && (
          <div className="rounded-xl border border-white/5 p-4 flex items-center justify-center text-slate-500 text-sm">
            +{chunks.length - 30} more chunks
          </div>
        )}
      </div>

      {/* Selected chunk detail */}
      <AnimatePresence>
        {activeChunk && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="glass rounded-2xl p-6 border border-cyan-500/20"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-cyan-400">
                🔍 Chunk #{activeChunk.id + 1} — Full Text
              </h3>
              <button onClick={() => setActiveChunk(null)} className="text-slate-500 hover:text-white">✕</button>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed font-mono whitespace-pre-wrap">
              {activeChunk.text}
            </p>
            <div className="mt-4 flex gap-4 text-xs text-slate-500">
              <span>📝 {activeChunk.wordCount} words</span>
              <span>🔤 {activeChunk.charCount} characters</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Explanation */}
      <div className="glass rounded-2xl p-6 border border-white/5">
        <h3 className="font-semibold text-white mb-3">🎓 Why Chunking?</h3>
        <div className="grid md:grid-cols-3 gap-4 text-sm text-slate-400">
          <div className="space-y-1">
            <p className="text-cyan-400 font-medium">Context Window Limits</p>
            <p>Embedding models have token limits (~8K). Documents must be split to fit.</p>
          </div>
          <div className="space-y-1">
            <p className="text-emerald-400 font-medium">Precision Retrieval</p>
            <p>Smaller chunks = more targeted retrieval. We find exactly what's relevant.</p>
          </div>
          <div className="space-y-1">
            <p className="text-amber-400 font-medium">Overlap Strategy</p>
            <p>Overlapping chunks preserve context that would be lost at chunk boundaries.</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        <button onClick={onBack} className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm">
          ← Back
        </button>
        <button
          onClick={onComplete}
          className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
        >
          Continue to Embedding →
        </button>
      </div>
    </div>
  );
}
