import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";

/*
 * Semantic Search — Two Approaches (Sparse vs Dense), with angle visualization.
 *
 * Driven by the user's REAL query and the chunks retrieved from the uploaded
 * document:
 *   - DENSE angle  = the actual angle the backend computed between the query
 *     embedding and the chunk embedding (true semantic geometry from Bedrock).
 *   - SPARSE angle = the bag-of-words cosine between the query and the SAME
 *     chunk text, computed in the browser (true lexical overlap).
 *
 * This contrast on the user's own data shows why dense retrieval finds a chunk
 * that is "about" the query even when it shares few/no exact words, while
 * sparse/lexical scoring depends on shared vocabulary.
 *
 * Before any search is run, it falls back to a small car/automobile teaching
 * example so the panel is still meaningful.
 */

const QUERY_COLOR = "#6366f1";

// ── tokenization + sparse bag-of-words cosine ───────────────────────────────
const STOP = new Set([
  "a","an","the","is","are","of","to","in","on","and","or","for","with",
  "that","this","it","as","by","at","from","be","was","were","what","which",
  "how","do","does","did","can","you","your","i","we","they","he","she",
]);
function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
}
function tf(tokens) {
  const m = {};
  for (const t of tokens) m[t] = (m[t] || 0) + 1;
  return m;
}
function sparseCosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) dot += (a[k] || 0) * (b[k] || 0);
  for (const k of Object.keys(a)) na += a[k] * a[k];
  for (const k of Object.keys(b)) nb += b[k] * b[k];
  return dot / ((Math.sqrt(na) * Math.sqrt(nb)) || 1);
}
function sharedTerms(aTokens, bTokens) {
  const bset = new Set(bTokens);
  return [...new Set(aTokens.filter((t) => bset.has(t)))];
}
const cosToDeg = (c) => (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;

// ── reusable angle diagram ──────────────────────────────────────────────────
function AnglePair({ deg, docColor, caption }) {
  const size = 150;
  const cx = size / 2;
  const cy = size - 24;
  const r = size - 60;
  const rad = (deg * Math.PI) / 180;
  const dx = cx + r * Math.sin(rad);
  const dy = cy - r * Math.cos(rad);
  const arcR = 28;
  const bx = cx + arcR * Math.sin(rad);
  const by = cy - arcR * Math.cos(rad);
  const largeArc = deg > 180 ? 1 : 0;
  const uid = React.useId();

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-36 h-36">
        <defs>
          <marker id={`apQ${uid}`} markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
            <path d="M0,0 L7,3 L0,6 Z" fill={QUERY_COLOR} />
          </marker>
          <marker id={`apD${uid}`} markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
            <path d="M0,0 L7,3 L0,6 Z" fill={docColor} />
          </marker>
        </defs>
        <circle cx={cx} cy={cy} r="3" fill="#475569" />
        <line x1={cx} y1={cy} x2={cx} y2={cy - r} stroke={QUERY_COLOR} strokeWidth="3" markerEnd={`url(#apQ${uid})`} />
        <line x1={cx} y1={cy} x2={dx} y2={dy} stroke={docColor} strokeWidth="3" markerEnd={`url(#apD${uid})`} />
        <path d={`M ${cx} ${cy - arcR} A ${arcR} ${arcR} 0 ${largeArc} 1 ${bx} ${by}`}
          fill="none" stroke="#94a3b8" strokeWidth="1.5" />
        <text x={cx + 6} y={cy - arcR - 4} fill="#e2e8f0" fontSize="13" fontWeight="bold" fontFamily="monospace">
          {deg.toFixed(0)}°
        </text>
      </svg>
      <div className="text-[11px] text-slate-500 text-center -mt-1 leading-tight">{caption}</div>
    </div>
  );
}

const DENSE_FACTS = [
  "Fixed-length continuous vectors (384–768 dim)",
  "Stored in a vector index (HNSW, IVF, etc.)",
  "Captures deep semantic relationships in vector space",
  "k-NN search at query time",
  "Models: BERT, Cohere, OpenAI, Amazon Titan / Bedrock",
];
const SPARSE_FACTS = [
  "Expands documents with weighted synonyms",
  "Uses the existing inverted index (Lucene-native)",
  "30,522 dims (BERT vocab) — only ~1% non-zero per doc",
  "105,879 dims for the multilingual variant",
  "As efficient as BM25 at query time",
  "Pre-trained: opensearch-neural-sparse-v2",
];

export default function SemanticSearchApproaches({ query, result }) {
  const [open, setOpen] = useState(false);

  // Build two comparison items from REAL data when available.
  const data = useMemo(() => {
    const top = result?.topResults;
    if (query && top && top.length >= 1) {
      const qTok = tokenize(query);
      const qTf = tf(qTok);
      const items = top.slice(0, 2).map((r, i) => {
        const cTok = tokenize(r.text);
        const sparseDeg = cosToDeg(sparseCosine(qTf, tf(cTok)));
        const denseDeg =
          typeof r.angleDeg === "number" ? r.angleDeg : cosToDeg(r.score ?? 0);
        const shared = sharedTerms(qTok, cTok);
        return {
          label: `Chunk #${r.chunkId + 1}`,
          sparseDeg,
          denseDeg,
          shared,
        };
      });
      return { live: true, query, items };
    }
    // Fallback teaching example (no search yet)
    return {
      live: false,
      query: "car",
      items: [
        { label: '"a fast car"', sparseDeg: cosToDeg(sparseCosine(tf(["car"]), tf(["fast", "car"]))), denseDeg: 22, shared: ["car"] },
        { label: '"a quick automobile"', sparseDeg: cosToDeg(sparseCosine(tf(["car"]), tf(["quick", "automobile"]))), denseDeg: 31, shared: [] },
      ],
    };
  }, [query, result]);

  return (
    <div className="glass rounded-2xl p-6 border border-indigo-500/10">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between text-left">
        <div>
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            🧭 Semantic Search — Two Approaches
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Sparse vs Dense encoding — same angle math, very different geometry
          </p>
        </div>
        <span className="text-slate-500 text-lg">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-6 space-y-6 overflow-hidden"
        >
          {/* context line */}
          <div className="text-xs rounded-lg px-3 py-2 bg-dark-800/60 border border-white/5">
            {data.live ? (
              <span className="text-slate-400">
                Comparing your query{" "}
                <span className="text-indigo-400 font-mono">"{data.query}"</span>{" "}
                against the top retrieved chunks from your document.
              </span>
            ) : (
              <span className="text-slate-500">
                Example shown. Run a search above and this panel updates with your
                real query and retrieved chunks.
              </span>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* SPARSE */}
            <div className="bg-dark-800/60 rounded-xl p-5 border border-amber-500/15 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-amber-400 font-semibold">Sparse Encoding</h4>
                <span className="text-[10px] font-mono text-amber-500/70 bg-amber-500/10 px-2 py-0.5 rounded">
                  lexical · term space
                </span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-400">
                {SPARSE_FACTS.map((f) => (
                  <li key={f} className="flex gap-2"><span className="text-amber-500/60 mt-0.5">▸</span><span>{f}</span></li>
                ))}
              </ul>
              <div className="flex justify-around pt-2 border-t border-white/5">
                {data.items.map((it, i) => (
                  <AnglePair key={i} deg={it.sparseDeg} docColor="#f59e0b"
                    caption={<>q ↔ {it.label}<br />
                      {it.shared.length
                        ? `shares: ${it.shared.slice(0, 3).join(", ")}`
                        : "no shared word → 90°"}</>} />
                ))}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Angle is driven by <strong className="text-amber-400">shared vocabulary</strong>.
                A chunk with no overlapping token sits at <strong>90° (orthogonal)</strong> — pure
                lexical matching misses it unless term expansion adds the synonym.
              </p>
            </div>

            {/* DENSE */}
            <div className="bg-dark-800/60 rounded-xl p-5 border border-emerald-500/15 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-emerald-400 font-semibold">Dense Encoding</h4>
                <span className="text-[10px] font-mono text-emerald-500/70 bg-emerald-500/10 px-2 py-0.5 rounded">
                  semantic · vector space
                </span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-400">
                {DENSE_FACTS.map((f) => (
                  <li key={f} className="flex gap-2"><span className="text-emerald-500/60 mt-0.5">▸</span><span>{f}</span></li>
                ))}
              </ul>
              <div className="flex justify-around pt-2 border-t border-white/5">
                {data.items.map((it, i) => (
                  <AnglePair key={i} deg={it.denseDeg} docColor="#34d399"
                    caption={<>q ↔ {it.label}<br />
                      {data.live ? "real embedding angle" : "semantically close"}</>} />
                ))}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Angle is driven by <strong className="text-emerald-400">learned meaning</strong>.
                {data.live
                  ? " Even a chunk that shares few words can land at a small angle because the encoder understood its meaning."
                  : ' "car" and "automobile" land at a small angle despite sharing no tokens.'}
              </p>
            </div>
          </div>

          {/* takeaway */}
          <div className="bg-indigo-500/5 border border-indigo-500/15 rounded-xl p-4 text-xs text-slate-400 leading-relaxed">
            <span className="text-indigo-400 font-semibold">Same math, different space.</span>{" "}
            Both compute <span className="font-mono text-slate-300">cos θ = (q · d) / (‖q‖‖d‖)</span>,{" "}
            <span className="font-mono text-slate-300">θ = arccos(cos θ)</span>.
            Sparse angle reflects <strong className="text-amber-400">word overlap</strong>; dense
            angle reflects <strong className="text-emerald-400">meaning</strong>. Notice how the dense
            angle is often much smaller than the sparse angle for the same chunk — that gap is exactly
            what semantic search buys you. Hybrid search combines both.
          </div>
        </motion.div>
      )}
    </div>
  );
}
