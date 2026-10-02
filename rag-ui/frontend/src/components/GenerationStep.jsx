import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE } from "../utils/api.js";

function TokenStream({ text }) {
  // Split into visible token "bubbles" for the animation
  const tokens = text.split(/(\s+)/);
  return (
    <span>
      {tokens.map((t, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.1 }}
        >
          {t}
        </motion.span>
      ))}
    </span>
  );
}

export default function GenerationStep({ ragState, onUpdate, onBack }) {
  const { query, retrievalResults } = ragState;
  const [phase, setPhase] = useState("idle"); // idle | generating | done
  const [streamedText, setStreamedText] = useState("");
  const [tokenCount, setTokenCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [log, setLog] = useState([]);
  const [customQuery, setCustomQuery] = useState(query || "");
  const [error, setError] = useState(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const outputRef = useRef(null);

  const topResults = retrievalResults?.topResults || [];

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [streamedText]);

  const startGeneration = async () => {
    if (!customQuery.trim() || topResults.length === 0) return;
    setPhase("generating");
    setStreamedText("");
    setTokenCount(0);
    setError(null);
    setLog([]);
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      setElapsed(((Date.now() - startTimeRef.current) / 1000).toFixed(1));
    }, 100);

    try {
      const res = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: customQuery,
          context: topResults,
        }),
      });

      if (!res.ok) throw new Error("Generation request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));

          if (data.type === "start") {
            setLog((prev) => [
              `🚀 Generating with ${data.model}`,
              `📎 Using ${data.contextChunks} context chunks`,
              ...prev,
            ]);
          } else if (data.type === "token") {
            setStreamedText((prev) => prev + data.text);
            setTokenCount((c) => c + 1);
          } else if (data.type === "done") {
            clearInterval(timerRef.current);
            setPhase("done");
            setLog((prev) => [
              `✅ Done — ${data.totalTokens} output tokens`,
              ...prev,
            ]);
            onUpdate({ generatedText: data.fullText });
          } else if (data.type === "error") {
            throw new Error(data.message);
          }
        }
      }
    } catch (err) {
      clearInterval(timerRef.current);
      setError(err.message);
      setPhase("idle");
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 rounded-full px-4 py-1.5 text-rose-400 text-sm">
          <span>Step 5</span><span className="text-rose-600">·</span><span>LLM Generation</span>
        </div>
        <h2 className="text-3xl font-bold text-white">Generate the Answer</h2>
        <p className="text-slate-400">
          Claude Haiku uses the retrieved chunks as context to generate a grounded answer
        </p>
      </div>

      {/* RAG prompt anatomy */}
      <div className="glass rounded-2xl p-6 border border-rose-500/10 space-y-4">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          📋 Prompt Anatomy
        </h3>
        <div className="grid md:grid-cols-3 gap-3">
          <div className="bg-dark-700/60 rounded-xl p-4 border border-indigo-500/20">
            <p className="text-xs text-indigo-400 font-medium mb-2 uppercase tracking-wide">System Prompt</p>
            <p className="text-xs text-slate-400">
              "Answer based ONLY on the provided context. If not in context, say so."
            </p>
          </div>
          <div className="bg-dark-700/60 rounded-xl p-4 border border-amber-500/20">
            <p className="text-xs text-amber-400 font-medium mb-2 uppercase tracking-wide">
              Context ({topResults.length} chunks)
            </p>
            <div className="space-y-1">
              {topResults.map((r, i) => (
                <div key={i} className="text-xs text-slate-500 truncate">
                  [{i+1}] {r.text?.slice(0, 60)}...
                </div>
              ))}
            </div>
          </div>
          <div className="bg-dark-700/60 rounded-xl p-4 border border-rose-500/20">
            <p className="text-xs text-rose-400 font-medium mb-2 uppercase tracking-wide">User Question</p>
            <p className="text-xs text-slate-400">"{customQuery || query}"</p>
          </div>
        </div>
      </div>

      {/* Query editor */}
      <div className="glass rounded-2xl p-5 border border-rose-500/10 space-y-3">
        <label className="text-sm font-semibold text-slate-400">Question</label>
        <div className="flex gap-3">
          <input
            type="text"
            value={customQuery}
            onChange={(e) => setCustomQuery(e.target.value)}
            disabled={phase === "generating"}
            className="flex-1 bg-dark-700 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-rose-500/50 text-sm disabled:opacity-50"
            placeholder="Ask a question about the document..."
          />
          <button
            onClick={startGeneration}
            disabled={phase === "generating" || !customQuery.trim() || topResults.length === 0}
            className="px-6 py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-all hover:scale-105 flex items-center gap-2"
          >
            {phase === "generating" ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <><span>✨</span> Generate</>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-rose-400 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Generation output */}
      {(phase === "generating" || phase === "done" || streamedText) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl overflow-hidden border border-rose-500/20"
        >
          {/* Header bar */}
          <div className="px-5 py-3 bg-dark-700/50 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              </div>
              <span className="text-xs text-slate-500 ml-2 font-mono">
                claude-haiku-4-5 · us-east-1
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500 font-mono">
              {phase === "generating" && (
                <span className="text-rose-400 animate-pulse">● STREAMING</span>
              )}
              {elapsed > 0 && <span>{elapsed}s</span>}
              {tokenCount > 0 && <span>~{tokenCount} tokens</span>}
            </div>
          </div>

          {/* Output text */}
          <div
            ref={outputRef}
            className="p-6 font-mono text-sm text-slate-200 leading-relaxed min-h-32 max-h-96 overflow-y-auto whitespace-pre-wrap"
          >
            {streamedText}
            {phase === "generating" && (
              <span className="inline-block w-2 h-4 bg-rose-400 ml-0.5 animate-pulse" />
            )}
          </div>
        </motion.div>
      )}

      {/* Log */}
      {log.length > 0 && (
        <div className="glass rounded-xl p-4 font-mono text-xs space-y-1">
          {log.map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-slate-500"
            >
              {line}
            </motion.div>
          ))}
        </div>
      )}

      {/* Full pipeline summary - shown when done */}
      {phase === "done" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 border border-emerald-500/20"
        >
          <h3 className="font-semibold text-emerald-400 mb-4">🎉 RAG Pipeline Complete!</h3>
          <div className="grid md:grid-cols-5 gap-3 text-center text-xs">
            {[
              { icon: "📄", label: "Document", sub: "Uploaded & parsed", color: "indigo" },
              { icon: "✂️", label: "Chunked", sub: `${ragState.chunks?.length} chunks`, color: "cyan" },
              { icon: "🔢", label: "Embedded", sub: "256-dim vectors", color: "emerald" },
              { icon: "🔍", label: "Retrieved", sub: `Top-${topResults.length} chunks`, color: "amber" },
              { icon: "✨", label: "Generated", sub: "Grounded answer", color: "rose" },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl p-3 bg-${s.color}-500/10 border border-${s.color}-500/20`}>
                <div className="text-2xl mb-1">{s.icon}</div>
                <p className={`font-medium text-${s.color}-400`}>{s.label}</p>
                <p className="text-slate-500 mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs text-slate-500 text-center">
            💡 This is RAG in action — the model never makes up facts,
            it grounds its answer entirely in the chunks you uploaded.
          </div>
        </motion.div>
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <button onClick={onBack} className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm">
          ← Back to Retrieval
        </button>
        {phase === "done" && (
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-medium transition-colors"
          >
            🔄 Try Another Document
          </button>
        )}
      </div>
    </div>
  );
}
