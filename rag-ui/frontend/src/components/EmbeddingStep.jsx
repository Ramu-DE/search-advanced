import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE } from "../utils/api.js";

function VectorBar({ value, index }) {
  const color = value > 0
    ? `rgba(99, 102, 241, ${Math.abs(value) * 0.9 + 0.1})`
    : `rgba(251, 113, 133, ${Math.abs(value) * 0.9 + 0.1})`;

  return (
    <motion.div
      initial={{ scaleY: 0 }}
      animate={{ scaleY: 1 }}
      transition={{ delay: index * 0.01, duration: 0.3 }}
      style={{
        height: `${Math.abs(value) * 100}%`,
        backgroundColor: color,
        minHeight: "2px",
      }}
      className="flex-1 rounded-sm"
      title={`dim[${index}]: ${value.toFixed(4)}`}
    />
  );
}

function SimilarityHeatmap({ matrix, chunkCount }) {
  if (!matrix || matrix.length === 0) return null;
  const n = Math.min(matrix.length, 15); // show max 15x15

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
        Chunk Similarity Matrix
      </h4>
      <div className="overflow-x-auto">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
            gap: "2px",
          }}
          className="max-w-full"
        >
          {matrix.slice(0, n).map((row, i) =>
            row.slice(0, n).map((val, j) => {
              const intensity = Math.floor(val * 255);
              const bg = i === j
                ? "rgb(99,102,241)"
                : val > 0.7
                ? `rgba(52,211,153,${val})`
                : val > 0.4
                ? `rgba(251,191,36,${val})`
                : `rgba(100,116,139,${val + 0.1})`;

              return (
                <motion.div
                  key={`${i}-${j}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: (i * n + j) * 0.002 }}
                  style={{ backgroundColor: bg, aspectRatio: "1" }}
                  className="rounded-sm cursor-pointer"
                  title={`Chunk ${i + 1} ↔ Chunk ${j + 1}: ${val.toFixed(3)}`}
                />
              );
            })
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block" /> Self (1.0)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-emerald-400 inline-block" /> High similarity
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-amber-400/60 inline-block" /> Medium
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-slate-600 inline-block" /> Low
        </span>
      </div>
    </div>
  );
}

export default function EmbeddingStep({ ragState, onComplete, onBack }) {
  const { sessionId, chunks } = ragState;
  const [phase, setPhase] = useState("idle"); // idle | running | done
  const [progress, setProgress] = useState(0);
  const [embeddings, setEmbeddings] = useState([]);
  const [similarityMatrix, setSimilarityMatrix] = useState(null);
  const [activeEmbed, setActiveEmbed] = useState(null);
  const [log, setLog] = useState([]);

  const startEmbedding = () => {
    setPhase("running");
    setProgress(0);
    setEmbeddings([]);
    setLog([]);

    const source = new EventSource(`${API_BASE}/api/embed/${sessionId}`);

    source.onmessage = (e) => {
      const data = JSON.parse(e.data);

      if (data.type === "progress") {
        setProgress(Math.round((data.chunkId / data.total) * 100));
        setLog((prev) => [`⚡ Embedding chunk ${data.chunkId + 1}/${data.total}...`, ...prev.slice(0, 9)]);
      } else if (data.type === "embedding") {
        setEmbeddings((prev) => [...prev, data]);
        setActiveEmbed(data);
      } else if (data.type === "done") {
        setSimilarityMatrix(data.similarityMatrix);
        setPhase("done");
        source.close();
      } else if (data.type === "error") {
        setLog((prev) => [`❌ Error: ${data.message}`, ...prev]);
        setPhase("idle");
        source.close();
      }
    };

    source.onerror = () => {
      setLog((prev) => ["❌ Connection error", ...prev]);
      setPhase("idle");
      source.close();
    };
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 text-emerald-400 text-sm">
          <span>Step 3</span><span className="text-emerald-600">·</span><span>Vector Embedding</span>
        </div>
        <h2 className="text-3xl font-bold text-white">Convert Text → Vectors</h2>
        <p className="text-slate-400">
          Amazon Titan Embed V2 converts each chunk into a{" "}
          <strong className="text-emerald-400">256-dimensional vector</strong>
        </p>
      </div>

      {/* Explainer */}
      <div className="glass rounded-2xl p-6 border border-emerald-500/10">
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="flex gap-3">
            <span className="text-2xl">📝</span>
            <div>
              <p className="text-emerald-400 font-medium mb-1">Input: Text</p>
              <p className="text-slate-400">Each chunk of text (up to 8K tokens) is sent to the embedding model</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-2xl">🧮</span>
            <div>
              <p className="text-emerald-400 font-medium mb-1">Process: Neural Encoding</p>
              <p className="text-slate-400">The transformer encoder maps semantic meaning to a point in vector space</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-2xl">📊</span>
            <div>
              <p className="text-emerald-400 font-medium mb-1">Output: 256-dim Vector</p>
              <p className="text-slate-400">A normalized float array. Similar text → geometrically close vectors</p>
            </div>
          </div>
        </div>
      </div>

      {/* Start button or progress */}
      {phase === "idle" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center space-y-4"
        >
          <p className="text-slate-400 text-sm">
            Ready to embed <strong className="text-white">{chunks.length} chunks</strong> using{" "}
            <strong className="text-emerald-400">amazon.titan-embed-text-v2:0</strong>
          </p>
          <button
            onClick={startEmbedding}
            className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-medium transition-all hover:scale-105 flex items-center gap-2 mx-auto"
          >
            <span>🚀</span> Start Embedding
          </button>
        </motion.div>
      )}

      {(phase === "running" || phase === "done") && (
        <div className="space-y-6">
          {/* Progress bar */}
          <div className="glass rounded-xl p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-400">
                {phase === "running" ? "Embedding chunks via Bedrock..." : "✅ All embeddings complete"}
              </span>
              <span className="text-emerald-400 font-mono">{phase === "done" ? "100" : progress}%</span>
            </div>
            <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
              <motion.div
                animate={{ width: `${phase === "done" ? 100 : progress}%` }}
                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full"
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="mt-2 text-xs text-slate-500 font-mono">
              {embeddings.length}/{chunks.length} chunks embedded
            </div>
          </div>

          {/* Live vector display */}
          {activeEmbed && (
            <motion.div
              key={activeEmbed.chunkId}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass rounded-2xl p-5 border border-emerald-500/20"
            >
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-semibold text-emerald-400">
                  🔢 Vector Preview — Chunk #{activeEmbed.chunkId + 1}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  dim={activeEmbed.dimension} · norm≈{activeEmbed.vectorNorm?.toFixed(3)}
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-3 line-clamp-1">
                "{activeEmbed.text}"
              </p>
              {/* Vector bar chart - first 32 dims */}
              <div className="flex items-end gap-px h-16 bg-dark-800 rounded-lg p-2">
                {activeEmbed.vectorPreview?.map((val, i) => (
                  <VectorBar key={i} value={val} index={i} />
                ))}
              </div>
              <div className="flex justify-between text-xs text-slate-600 mt-1 font-mono">
                <span>dim[0]</span>
                <span>Showing first 32 of {activeEmbed.dimension} dimensions</span>
                <span>dim[31]</span>
              </div>
            </motion.div>
          )}

          {/* Log */}
          <div className="glass rounded-xl p-4 font-mono text-xs text-slate-500 space-y-0.5 max-h-32 overflow-hidden">
            <AnimatePresence>
              {log.map((line, i) => (
                <motion.div
                  key={`${line}-${i}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-emerald-400/70"
                >
                  {line}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Similarity matrix */}
      {phase === "done" && similarityMatrix && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 border border-emerald-500/10"
        >
          <SimilarityHeatmap matrix={similarityMatrix} chunkCount={chunks.length} />
          <div className="mt-4 text-xs text-slate-500">
            💡 The diagonal is always 1.0 (a chunk is identical to itself).
            Off-diagonal high values mean chunks share similar topics.
          </div>
        </motion.div>
      )}

      {/* Embedding gallery */}
      {embeddings.length > 0 && (
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Embedded Chunks ({embeddings.length}/{chunks.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-2">
            {embeddings.map((emb) => (
              <div
                key={emb.chunkId}
                onClick={() => setActiveEmbed(emb)}
                className="flex gap-3 items-center p-3 rounded-lg bg-dark-700/50 border border-emerald-500/10 cursor-pointer hover:border-emerald-500/30 transition-all"
              >
                <div className="flex items-end gap-px h-8 w-16 flex-shrink-0">
                  {emb.vectorPreview?.slice(0, 16).map((v, i) => (
                    <div
                      key={i}
                      style={{ height: `${Math.abs(v) * 100}%`, minHeight: "2px" }}
                      className={`flex-1 rounded-sm ${v > 0 ? "bg-emerald-400/60" : "bg-rose-400/60"}`}
                    />
                  ))}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-emerald-400 font-mono">Chunk #{emb.chunkId + 1}</p>
                  <p className="text-xs text-slate-500 truncate">{emb.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <button onClick={onBack} className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm">
          ← Back
        </button>
        {phase === "done" && (
          <button
            onClick={() => onComplete({ embeddings, similarityMatrix })}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
          >
            Continue to Retrieval →
          </button>
        )}
      </div>
    </div>
  );
}
