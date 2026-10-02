import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { API_BASE } from "../utils/api.js";

/*
 * Content (Vector) Similarity — now driven by the uploaded document.
 *
 * It fetches /api/vector-geometry for the current session + query, which
 * returns the real 2D PCA projection of the query and every chunk, plus the
 * per-chunk cosine/angle.
 *
 *   LEFT  : textbook 2D plane — the QUERY vector vs its BEST-matching chunk
 *           vector (using their real projected coordinates), with the true
 *           cosine/angle/distance.
 *   RIGHT : a scatter of the document's chunks ("content cloud"). The query is
 *           the highlighted point; a dashed line connects it to the nearest
 *           chunk by TRUE cosine angle (the recommendation / retrieval idea).
 *
 * Falls back to a small static illustration before any search is run.
 */

const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const norm = (a) => Math.hypot(a[0], a[1]);
const cosine = (a, b) => dot(a, b) / (norm(a) * norm(b) || 1);
const angleDeg = (a, b) =>
  (Math.acos(Math.max(-1, Math.min(1, cosine(a, b)))) * 180) / Math.PI;

// ── LEFT: textbook two-vector diagram ───────────────────────────────────────
function TextbookPlane({ A, B, labelA, labelB }) {
  const size = 320;
  const cx = size * 0.5;
  const cy = size * 0.5;
  // scale so the larger of the two vectors fills the plane nicely
  const maxMag = Math.max(norm(A), norm(B), 1e-6);
  const scale = (size * 0.38) / maxMag;

  const toPx = (v) => ({ x: cx + v[0] * scale, y: cy - v[1] * scale });
  const pa = toPx(A);
  const pb = toPx(B);

  const r = 42;
  const angA = Math.atan2(A[1], A[0]);
  const angB = Math.atan2(B[1], B[0]);
  const arcA = { x: cx + r * Math.cos(angA), y: cy - r * Math.sin(angA) };
  const arcB = { x: cx + r * Math.cos(angB), y: cy - r * Math.sin(angB) };
  const sweep = angA > angB ? 0 : 1;
  const theta = angleDeg(A, B);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-sm mx-auto">
      <defs>
        <marker id="cvA" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill="#6366f1" />
        </marker>
        <marker id="cvB" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill="#ec4899" />
        </marker>
      </defs>
      <line x1={cx} y1={size * 0.08} x2={cx} y2={size * 0.92} stroke="#334155" strokeWidth="1.5" />
      <line x1={size * 0.04} y1={cy} x2={size * 0.96} y2={cy} stroke="#334155" strokeWidth="1.5" />
      <path d={`M ${arcA.x} ${arcA.y} A ${r} ${r} 0 0 ${sweep} ${arcB.x} ${arcB.y}`}
        fill="none" stroke="#a78bfa" strokeWidth="2" />
      <text x={cx + 10} y={cy - 12} fill="#c4b5fd" fontSize="12" fontWeight="bold" fontFamily="monospace">
        {theta.toFixed(1)}°
      </text>

      <line x1={cx} y1={cy} x2={pa.x} y2={pa.y} stroke="#6366f1" strokeWidth="3" markerEnd="url(#cvA)" />
      <circle cx={pa.x} cy={pa.y} r="5" fill="#6366f1" />
      <text x={pa.x + 6} y={pa.y - 6} fill="#a5b4fc" fontSize="11" fontFamily="monospace">{labelA}</text>

      <line x1={cx} y1={cy} x2={pb.x} y2={pb.y} stroke="#ec4899" strokeWidth="3" markerEnd="url(#cvB)" />
      <circle cx={pb.x} cy={pb.y} r="5" fill="#ec4899" />
      <text x={pb.x + 6} y={pb.y + 12} fill="#f472b6" fontSize="11" fontFamily="monospace">{labelB}</text>
    </svg>
  );
}

// ── RIGHT: real chunk cloud ─────────────────────────────────────────────────
function ChunkCloud({ projection, chunks }) {
  const { pts, query, nearest, theta, cos } = useMemo(() => {
    const q = projection.query;
    // vectors from origin (the projected coords ARE the vectors)
    const qv = [q.x, q.y];
    let nearest = null, best = -Infinity;
    const pts = projection.chunks.map((c) => {
      const cv = [c.x, c.y];
      const cs = cosine(qv, cv);
      if (cs > best) { best = cs; nearest = c; }
      return { ...c, cos: cs };
    });
    const nv = nearest ? [nearest.x, nearest.y] : [0, 0];
    return { pts, query: q, nearest, theta: angleDeg(qv, nv), cos: best };
  }, [projection]);

  // scale projected coords into the viewbox
  const W = 420, H = 320, pad = 36;
  const all = [query, ...pts];
  const xs = all.map((p) => p.x), ys = all.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const sx = (W - 2 * pad) / ((maxX - minX) || 1);
  const sy = (H - 2 * pad) / ((maxY - minY) || 1);
  const px = (p) => ({ x: pad + (p.x - minX) * sx, y: H - pad - (p.y - minY) * sy });

  const qp = px(query);
  const np = nearest ? px(nearest) : qp;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl bg-white/95">
        <defs>
          <marker id="qArrow" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6 Z" fill="#db2777" />
          </marker>
        </defs>
        {/* chunk dots */}
        {pts.map((c) => {
          const p = px(c);
          // closer (smaller angle) → greener
          const g = Math.max(0, Math.min(1, c.cos));
          const color = `rgb(${Math.round(248 - g * 180)}, ${Math.round(113 + g * 100)}, ${Math.round(113 - g * 40)})`;
          return (
            <g key={c.chunkId}>
              <circle cx={p.x} cy={p.y} r="5" fill={color} opacity="0.85" />
              <text x={p.x + 6} y={p.y + 3} fill="#334155" fontSize="9" fontFamily="monospace">
                #{c.chunkId + 1}
              </text>
            </g>
          );
        })}
        {/* dashed connector query → nearest chunk */}
        <line x1={qp.x} y1={qp.y} x2={np.x} y2={np.y}
          stroke="#111827" strokeWidth="1.5" strokeDasharray="4 3" />
        {/* arrow into the query */}
        <line x1={W * 0.12} y1={H * 0.08} x2={qp.x} y2={qp.y}
          stroke="#db2777" strokeWidth="2.5" markerEnd="url(#qArrow)" />
        <circle cx={qp.x} cy={qp.y} r="7" fill="none" stroke="#111827" strokeWidth="2.5" />
        <rect x={np.x + 8} y={np.y - 10} width="52" height="16" rx="3" fill="#111827" />
        <text x={np.x + 34} y={np.y + 2} fill="#fff" fontSize="10" textAnchor="middle" fontFamily="monospace">
          {theta.toFixed(1)}°
        </text>
      </svg>
      <div className="absolute left-[8%] top-[2%] bg-pink-600 text-white text-[11px] px-2 py-0.5 rounded">
        Your Query
      </div>
      {nearest && (
        <div className="absolute right-[4%] bottom-[8%] bg-slate-800 text-white text-[11px] px-2 py-0.5 rounded">
          Nearest: Chunk #{nearest.chunkId + 1} · cos {cos.toFixed(2)}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block bg-emerald-400" />close (small angle)</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block bg-red-400" />far (large angle)</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2 border-slate-900 inline-block" />query</span>
      </div>
    </div>
  );
}

function StaticFallback() {
  const A = [0, 0.5], B = [0.8, 0.2];
  const cos = cosine(A, B);
  const theta = angleDeg(A, B);
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="bg-dark-800/60 rounded-xl p-5 border border-white/5">
        <TextbookPlane A={A} B={B} labelA="0, 0.5" labelB="0.8, 0.2" />
        <div className="mt-3 bg-dark-900/60 rounded-lg p-3 font-mono text-xs text-slate-300 space-y-1">
          <div>cos θ = (A · B)/(‖A‖‖B‖) = <span className="text-emerald-400">{cos.toFixed(3)}</span></div>
          <div>θ = arccos({cos.toFixed(3)}) = <span className="text-violet-400 font-bold">{theta.toFixed(1)}°</span></div>
        </div>
      </div>
      <div className="bg-dark-800/60 rounded-xl p-5 border border-white/5 flex items-center justify-center text-slate-500 text-xs text-center">
        Run a search above — your query and the document's chunks will plot here as real vectors.
      </div>
    </div>
  );
}

export default function ContentVectorSimilarity({ sessionId, query }) {
  const [open, setOpen] = useState(false);
  const [geo, setGeo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sessionId || !query) { setGeo(null); return; }
    let cancelled = false;
    setLoading(true); setError(null);
    fetch(`${API_BASE}/api/vector-geometry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, query }),
    })
      .then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json(); })
      .then((d) => !cancelled && setGeo(d))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [sessionId, query]);

  // Build left-panel vectors (query vs best chunk) from the real projection
  const left = useMemo(() => {
    if (!geo?.projection) return null;
    const q = geo.projection.query;
    const qv = [q.x, q.y];
    let best = null, bestCos = -Infinity;
    for (const c of geo.projection.chunks) {
      const cs = cosine(qv, [c.x, c.y]);
      if (cs > bestCos) { bestCos = cs; best = c; }
    }
    if (!best) return null;
    return {
      A: qv,
      B: [best.x, best.y],
      cos: bestCos,
      theta: angleDeg(qv, [best.x, best.y]),
      chunkId: best.chunkId,
    };
  }, [geo]);

  return (
    <div className="glass rounded-2xl p-6 border border-pink-500/10">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between text-left">
        <div>
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            🎵 Content (Vector) Similarity
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            The angle between vectors = how similar two items are (your query vs the document's chunks)
          </p>
        </div>
        <span className="text-slate-500 text-lg">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-6 overflow-hidden"
        >
          {loading && (
            <div className="text-center text-slate-400 text-sm py-6">
              <div className="animate-spin w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full mx-auto mb-2" />
              Projecting your query and chunks into 2D…
            </div>
          )}
          {error && <div className="text-rose-400 text-sm">⚠️ {error}</div>}

          {!loading && !error && geo?.projection && left ? (
            <div className="grid lg:grid-cols-2 gap-6">
              {/* LEFT — real query vs best chunk */}
              <div className="bg-dark-800/60 rounded-xl p-5 border border-white/5">
                <div className="text-[11px] text-slate-500 mb-1 font-mono">
                  query ↔ best chunk (#{left.chunkId + 1})
                </div>
                <TextbookPlane A={left.A} B={left.B}
                  labelA="query" labelB={`#${left.chunkId + 1}`} />
                <div className="mt-3 bg-dark-900/60 rounded-lg p-3 font-mono text-xs text-slate-300 space-y-1">
                  <div className="text-slate-500">// in the 2D projection shown</div>
                  <div>cos θ = <span className="text-emerald-400">{left.cos.toFixed(3)}</span></div>
                  <div>θ = arccos({left.cos.toFixed(3)}) = <span className="text-violet-400 font-bold">{left.theta.toFixed(1)}°</span></div>
                  <div className="text-slate-400">cosine distance = <span className="text-amber-400">{(1 - left.cos).toFixed(3)}</span></div>
                </div>
                <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
                  Your query{" "}
                  <span className="text-indigo-400 font-mono">"{query}"</span>{" "}
                  and its closest chunk — a small angle means high similarity.
                </p>
              </div>

              {/* RIGHT — real chunk cloud */}
              <div className="bg-dark-800/60 rounded-xl p-5 border border-white/5">
                <ChunkCloud projection={geo.projection} chunks={geo.chunks} />
                <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                  Each dot is a chunk of <strong>your document</strong>, projected to 2D (PCA).
                  The query is the ringed point; the dashed line goes to its nearest chunk by the
                  <strong className="text-pink-400"> true cosine angle</strong> — exactly how retrieval ranks results.
                </p>
              </div>
            </div>
          ) : (
            !loading && !error && <StaticFallback />
          )}
        </motion.div>
      )}
    </div>
  );
}
