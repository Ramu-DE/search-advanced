import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";

/*
 * Semantic Search — Two Approaches (Sparse vs Dense), with angle visualization.
 *
 * This is a self-contained educational widget. It demonstrates the key idea:
 *   - Both sparse and dense encoding score relevance with the SAME math
 *     (dot product → cosine → angle).
 *   - SPARSE vectors live in a huge, mostly-zero term space. Two texts that
 *     share no vocabulary are ORTHOGONAL (90°). Angle is driven by lexical
 *     overlap (and learned term expansion).
 *   - DENSE vectors live in a small continuous space where learned semantics
 *     place related meanings at a SMALL angle even with zero shared words.
 *
 * The sparse angles below are computed from the actual bag-of-words of the
 * sample texts (a real sparse TF representation), so the geometry is honest.
 * The dense angles are illustrative values representing what a trained encoder
 * would produce (synonyms land close even with no shared tokens).
 */

const QUERY_COLOR = "#6366f1";
const DOC_COLOR = "#34d399";

// ── sample data ───────────────────────────────────────────────────────────
const QUERY_TEXT = "car";
// Doc A shares the token with the query → lexical match.
// Doc B is a synonym with NO shared token → semantic match only.
const DOC_A = { label: 'Doc A: "a fast car"', tokens: ["a", "fast", "car"] };
const DOC_B = { label: 'Doc B: "a quick automobile"', tokens: ["a", "quick", "automobile"] };

// ── sparse: real bag-of-words cosine ────────────────────────────────────────
function tf(tokens) {
  const m = {};
  for (const t of tokens) m[t] = (m[t] || 0) + 1;
  return m;
}
function sparseCosine(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0, na = 0, nb = 0;
  for (const k of keys) {
    const va = a[k] || 0;
    const vb = b[k] || 0;
    dot += va * vb;
  }
  for (const k of Object.keys(a)) na += a[k] * a[k];
  for (const k of Object.keys(b)) nb += b[k] * b[k];
  const denom = Math.sqrt(na) * Math.sqrt(nb) || 1;
  return dot / denom;
}
const cosToDeg = (c) => (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;

// ── a reusable "angle between query and doc" diagram ───────────────────────
function AnglePair({ deg, docColor = DOC_COLOR, caption }) {
  const size = 150;
  const cx = size / 2;
  const cy = size - 24;
  const r = size - 60;
  const rad = (deg * Math.PI) / 180;
  // query points straight up; doc rotated clockwise by `deg`
  const qx = cx;
  const qy = cy - r;
  const dx = cx + r * Math.sin(rad);
  const dy = cy - r * Math.cos(rad);
  const arcR = 28;
  const ax = cx;
  const ay = cy - arcR;
  const bx = cx + arcR * Math.sin(rad);
  const by = cy - arcR * Math.cos(rad);
  const largeArc = deg > 180 ? 1 : 0;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-40 h-40">
        <defs>
          <marker id="apQ" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
            <path d="M0,0 L7,3 L0,6 Z" fill={QUERY_COLOR} />
          </marker>
          <marker id="apD" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
            <path d="M0,0 L7,3 L0,6 Z" fill={docColor} />
          </marker>
        </defs>
        <circle cx={cx} cy={cy} r="3" fill="#475569" />
        <line x1={cx} y1={cy} x2={qx} y2={qy} stroke={QUERY_COLOR} strokeWidth="3" markerEnd="url(#apQ)" />
        <line x1={cx} y1={cy} x2={dx} y2={dy} stroke={docColor} strokeWidth="3" markerEnd="url(#apD)" />
        <path d={`M ${ax} ${ay} A ${arcR} ${arcR} 0 ${largeArc} 1 ${bx} ${by}`}
          fill="none" stroke="#94a3b8" strokeWidth="1.5" />
        <text x={cx + 6} y={cy - arcR - 4} fill="#e2e8f0" fontSize="13" fontWeight="bold" fontFamily="monospace">
          {deg.toFixed(0)}°
        </text>
      </svg>
      <div className="text-[11px] text-slate-500 text-center -mt-2">{caption}</div>
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

export default function SemanticSearchApproaches() {
  const [open, setOpen] = useState(false);

  // SPARSE angles: computed from real bag-of-words of the sample texts.
  const sparse = useMemo(() => {
    const q = tf([QUERY_TEXT]);
    const a = tf(DOC_A.tokens);
    const b = tf(DOC_B.tokens);
    return {
      a: cosToDeg(sparseCosine(q, a)), // shares "car" → < 90°
      b: cosToDeg(sparseCosine(q, b)), // no shared token → exactly 90°
    };
  }, []);

  // DENSE angles: illustrative values a trained encoder would produce.
  // "car" ↔ "fast car": very close. "car" ↔ "quick automobile": still close
  // (synonym) even though they share NO tokens — the whole point of dense.
  const dense = { a: 22, b: 31 };

  return (
    <div className="glass rounded-2xl p-6 border border-indigo-500/10">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-left"
      >
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
                  <li key={f} className="flex gap-2">
                    <span className="text-amber-500/60 mt-0.5">▸</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-around pt-2 border-t border-white/5">
                <AnglePair deg={sparse.a} docColor="#f59e0b"
                  caption={<>query "car" ↔ Doc A<br />shares the word "car"</>} />
                <AnglePair deg={sparse.b} docColor="#f59e0b"
                  caption={<>query "car" ↔ Doc B<br />no shared word → 90°</>} />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Angle is driven by <strong className="text-amber-400">shared vocabulary</strong>.
                A synonym with no overlapping token is <strong>orthogonal (90°)</strong> — pure
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
                  <li key={f} className="flex gap-2">
                    <span className="text-emerald-500/60 mt-0.5">▸</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-around pt-2 border-t border-white/5">
                <AnglePair deg={dense.a} docColor="#34d399"
                  caption={<>query "car" ↔ Doc A<br />semantically close</>} />
                <AnglePair deg={dense.b} docColor="#34d399"
                  caption={<>query "car" ↔ Doc B<br />synonym still close</>} />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Angle is driven by <strong className="text-emerald-400">learned meaning</strong>.
                "car" and "automobile" land at a <strong>small angle</strong> despite sharing
                no tokens — the encoder places synonyms near each other in space.
              </p>
            </div>
          </div>

          {/* takeaway */}
          <div className="bg-indigo-500/5 border border-indigo-500/15 rounded-xl p-4 text-xs text-slate-400 leading-relaxed">
            <span className="text-indigo-400 font-semibold">Same math, different space.</span>{" "}
            Both compute <span className="font-mono text-slate-300">cos θ = (q · d) / (‖q‖‖d‖)</span>{" "}
            and the angle <span className="font-mono text-slate-300">θ = arccos(cos θ)</span>.
            Sparse lives in a ~30k-dim term space (mostly zeros) where the angle reflects
            <strong className="text-amber-400"> word overlap</strong>; dense lives in a ~384–768-dim
            space where the angle reflects <strong className="text-emerald-400"> meaning</strong>.
            Hybrid search combines both.
          </div>
        </motion.div>
      )}
    </div>
  );
}
