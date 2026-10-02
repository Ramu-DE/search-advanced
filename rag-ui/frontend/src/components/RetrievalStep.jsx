import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE } from "../utils/api.js";
import VectorGeometry from "./VectorGeometry.jsx";
import SemanticSearchApproaches from "./SemanticSearchApproaches.jsx";
import ContentVectorSimilarity from "./ContentVectorSimilarity.jsx";

function ScoreBar({ score, max = 1 }) {
  const pct = (score / max) * 100;
  const color =
    score > 0.7 ? "from-emerald-500 to-emerald-400" :
    score > 0.4 ? "from-amber-500 to-amber-400" :
    "from-slate-600 to-slate-500";

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-dark-700 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={`h-full bg-gradient-to-r ${color} rounded-full`}
        />
      </div>
      <span className="text-xs font-mono text-slate-400 w-12 text-right">
        {score.toFixed(3)}
      </span>
    </div>
  );
}

export default function RetrievalStep({ ragState, onComplete, onBack }) {
  const { sessionId, chunks } = ragState;
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [topK, setTopK] = useState(3);

  const suggestions = [
    "What is the main topic of this document?",
    "Summarize the key points",
    "What are the conclusions?",
    "What methods are described?",
  ];

  const handleRetrieve = async (q = query) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/retrieve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, query: q, topK }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const maxScore = result?.allScores?.[0]?.score ?? 1;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 text-amber-400 text-sm">
          <span>Step 4</span><span className="text-amber-600">·</span><span>Semantic Retrieval</span>
        </div>
        <h2 className="text-3xl font-bold text-white">Find Relevant Chunks</h2>
        <p className="text-slate-400">
          Your query is embedded and compared to all chunk vectors using{" "}
          <strong className="text-amber-400">cosine similarity</strong>
        </p>
      </div>

      {/* Query input */}
      <div className="glass rounded-2xl p-6 border border-amber-500/10 space-y-4">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Ask a Question
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRetrieve()}
            placeholder="Type your question about the document..."
            className="flex-1 bg-dark-700 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors text-sm"
          />
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-xs text-slate-500">Top-K:</div>
            <select
              value={topK}
              onChange={(e) => setTopK(+e.target.value)}
              className="bg-dark-700 border border-white/10 rounded-lg px-2 py-2 text-sm text-white focus:outline-none"
            >
              {[1,2,3,4,5].map(k => <option key={k}>{k}</option>)}
            </select>
          </div>
          <button
            onClick={() => handleRetrieve()}
            disabled={loading || !query.trim()}
            className="px-5 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-all hover:scale-105 flex items-center gap-2"
          >
            {loading ? "🔄" : "🔍"} Search
          </button>
        </div>

        {/* Suggestions */}
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => { setQuery(s); handleRetrieve(s); }}
              className="text-xs px-3 py-1.5 bg-dark-700 hover:bg-amber-500/10 border border-white/10 hover:border-amber-500/30 rounded-full text-slate-400 hover:text-amber-400 transition-all"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="grid md:grid-cols-4 gap-3 text-center text-sm">
        {[
          { icon: "❓", label: "Query", desc: "Your question", color: "amber" },
          { icon: "🔢", label: "Embed Query", desc: "Convert to 256-dim vector", color: "indigo" },
          { icon: "📐", label: "Cosine Sim", desc: "Measure angle to all chunks", color: "cyan" },
          { icon: "🏆", label: "Top-K", desc: "Return closest matches", color: "emerald" },
        ].map((step, i) => (
          <div key={step.label} className="glass rounded-xl p-4 relative">
            {i < 3 && (
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 text-slate-600 text-xs">→</div>
            )}
            <div className="text-2xl mb-2">{step.icon}</div>
            <p className={`font-medium text-${step.color}-400`}>{step.label}</p>
            <p className="text-slate-500 text-xs mt-1">{step.desc}</p>
          </div>
        ))}
      </div>

      {/* Sparse vs Dense semantic search explainer (with angles) */}
      <SemanticSearchApproaches query={result?.query} result={result} />

      {/* Content (Vector) Similarity — driven by the uploaded doc + query */}
      <ContentVectorSimilarity sessionId={sessionId} query={result?.query} />

      {/* Loading */}
      {loading && (
        <div className="text-center space-y-3">
          <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-slate-400 text-sm">Embedding query and computing similarity scores...</p>
        </div>
      )}

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-rose-400 text-sm">⚠️ {error}</div>
      )}

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Best Match", value: result.retrievalStats.topScore, color: "text-emerald-400" },
                { label: "Best Angle", value: `${result.retrievalStats.topAngleDeg ?? "—"}°`, color: "text-cyan-400" },
                { label: "Avg Score", value: result.retrievalStats.avgScore, color: "text-amber-400" },
                { label: "Worst Selected", value: result.retrievalStats.lowestSelected, color: "text-slate-400" },
              ].map((s) => (
                <div key={s.label} className="glass rounded-xl p-4 text-center">
                  <div className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-slate-500 mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {/* All scores visualization */}
            <div className="glass rounded-2xl p-6 border border-amber-500/10">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                Similarity Scores — All {result.allScores.length} Chunks
              </h3>
              <div className="space-y-2">
                {result.allScores.map((s) => (
                  <div key={s.chunkId} className={`rounded-lg p-3 transition-all
                    ${s.isSelected ? "bg-amber-500/10 border border-amber-500/20" : "bg-dark-700/30"}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-mono text-slate-400">
                        Chunk #{s.chunkId + 1}
                        {s.isSelected && (
                          <span className="ml-2 px-1.5 py-0.5 bg-amber-500 text-dark-950 rounded text-xs font-bold">
                            #{s.rank} SELECTED
                          </span>
                        )}
                      </span>
                      {typeof s.angleDeg === "number" && (
                        <span className="text-xs font-mono text-cyan-400" title="Angle between query and chunk vectors">
                          📐 {s.angleDeg.toFixed(1)}°
                        </span>
                      )}
                    </div>
                    <ScoreBar score={s.score} max={maxScore} />
                    {s.isSelected && (
                      <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                        {chunks[s.chunkId]?.text}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Vector geometry: angles, formula, 2D arrow plot */}
            <VectorGeometry sessionId={sessionId} query={result.query} />

            {/* Top results */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                🏆 Selected Chunks (Top-{topK})
              </h3>
              {result.topResults.map((r, i) => (
                <motion.div
                  key={r.chunkId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="glass rounded-2xl p-5 border border-amber-500/20"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-sm font-bold text-amber-400">
                        {i + 1}
                      </span>
                      <span className="text-sm text-slate-400 font-mono">
                        Chunk #{r.chunkId + 1}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-xs text-slate-500">Similarity</div>
                        <div className="text-lg font-bold font-mono text-emerald-400">
                          {r.score.toFixed(3)}
                        </div>
                      </div>
                      {typeof r.angleDeg === "number" && (
                        <div className="text-right pl-3 border-l border-white/10">
                          <div className="text-xs text-slate-500">Angle</div>
                          <div className="text-lg font-bold font-mono text-cyan-400">
                            {r.angleDeg.toFixed(1)}°
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">{r.text}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex justify-between">
        <button onClick={onBack} className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm">
          ← Back
        </button>
        {result && (
          <button
            onClick={() => onComplete({ retrievalResults: result, query: result.query })}
            className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 rounded-xl text-sm font-medium transition-colors"
          >
            Continue to Generation →
          </button>
        )}
      </div>
    </div>
  );
}
