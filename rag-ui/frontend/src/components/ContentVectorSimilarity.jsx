import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";

/*
 * Content (Vector) Similarity — recreation of the AWS slide, interactive.
 *
 * LEFT:  a textbook 2D plane with two vectors from the origin, the angle arc
 *        between them, their coordinates, and the cosine-distance formula.
 *        All numbers are computed live from the coordinates (honest geometry).
 *
 * RIGHT: a genre-clustered "song" scatter cloud. A highlighted "favorite" point
 *        has an arrow to it and a dashed connector to its nearest neighbor
 *        ("similar songs you might like"), with the angle between them shown.
 */

// ── small vector helpers ────────────────────────────────────────────────────
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const norm = (a) => Math.hypot(a[0], a[1]);
const cosine = (a, b) => dot(a, b) / (norm(a) * norm(b) || 1);
const angleDeg = (a, b) =>
  (Math.acos(Math.max(-1, Math.min(1, cosine(a, b)))) * 180) / Math.PI;
const angleBetween = (a, b) => {
  // angle of each vector from +x axis, then absolute difference
  const t = (Math.atan2(b[1], b[0]) - Math.atan2(a[1], a[0])) * 180 / Math.PI;
  return Math.abs(((t + 180) % 360) - 180);
};

// ── LEFT: textbook two-vector diagram ───────────────────────────────────────
function TextbookPlane({ A, B }) {
  const size = 320;
  const cx = size * 0.28;      // origin x
  const cy = size * 0.68;      // origin y
  const scale = 220;           // units -> px

  const toPx = (v) => ({ x: cx + v[0] * scale, y: cy - v[1] * scale });
  const pa = toPx(A);
  const pb = toPx(B);

  // angle arc between the two vectors near the origin
  const r = 42;
  const angA = Math.atan2(A[1], A[0]);
  const angB = Math.atan2(B[1], B[0]);
  const arcA = { x: cx + r * Math.cos(angA), y: cy - r * Math.sin(angA) };
  const arcB = { x: cx + r * Math.cos(angB), y: cy - r * Math.sin(angB) };
  const sweep = angA > angB ? 0 : 1;

  const theta = angleBetween(A, B);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-sm mx-auto">
      <defs>
        <marker id="cvA" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill="#f59e0b" />
        </marker>
        <marker id="cvB" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill="#ec4899" />
        </marker>
      </defs>

      {/* axes */}
      <line x1={cx} y1={size * 0.08} x2={cx} y2={size * 0.92} stroke="#334155" strokeWidth="1.5" />
      <line x1={size * 0.04} y1={cy} x2={size * 0.96} y2={cy} stroke="#334155" strokeWidth="1.5" />

      {/* angle arc */}
      <path
        d={`M ${arcA.x} ${arcA.y} A ${r} ${r} 0 0 ${sweep} ${arcB.x} ${arcB.y}`}
        fill="none" stroke="#a78bfa" strokeWidth="2"
      />
      <text x={cx + 34} y={cy - 14} fill="#c4b5fd" fontSize="12" fontWeight="bold" fontFamily="monospace">
        {theta.toFixed(1)}°
      </text>

      {/* vector A (orange) */}
      <line x1={cx} y1={cy} x2={pa.x} y2={pa.y} stroke="#f59e0b" strokeWidth="3" markerEnd="url(#cvA)" />
      <circle cx={pa.x} cy={pa.y} r="6" fill="#f59e0b" />
      <g>
        <rect x={pa.x - 26} y={pa.y - 34} width="54" height="20" rx="4" fill="#1e293b" stroke="#f59e0b55" />
        <text x={pa.x + 1} y={pa.y - 20} fill="#fbbf24" fontSize="11" textAnchor="middle" fontFamily="monospace">
          {A[0]}, {A[1]}
        </text>
      </g>

      {/* vector B (magenta) */}
      <line x1={cx} y1={cy} x2={pb.x} y2={pb.y} stroke="#ec4899" strokeWidth="3" markerEnd="url(#cvB)" />
      <circle cx={pb.x} cy={pb.y} r="6" fill="#ec4899" />
      <g>
        <rect x={pb.x + 8} y={pb.y - 10} width="54" height="20" rx="4" fill="#1e293b" stroke="#ec489955" />
        <text x={pb.x + 35} y={pb.y + 4} fill="#f472b6" fontSize="11" textAnchor="middle" fontFamily="monospace">
          {B[0]}, {B[1]}
        </text>
      </g>
    </svg>
  );
}

// ── RIGHT: genre-clustered song cloud ───────────────────────────────────────
const GENRES = [
  { name: "Classical", color: "#60a5fa", cx: 0.72, cy: 0.30 },
  { name: "Dance & Electronic", color: "#f59e0b", cx: 0.62, cy: 0.22 },
  { name: "Rock", color: "#34d399", cx: 0.30, cy: 0.30 },
  { name: "Pop", color: "#f87171", cx: 0.52, cy: 0.62 },
  { name: "Jazz", color: "#a78bfa", cx: 0.44, cy: 0.42 },
  { name: "Country", color: "#b45309", cx: 0.58, cy: 0.78 },
  { name: "Rap & Hip-Hop", color: "#f472b6", cx: 0.42, cy: 0.46 },
];

// deterministic pseudo-random so the cloud is stable across renders
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function SongCloud() {
  const { points, favorite, neighbor, theta, cos } = useMemo(() => {
    const rnd = mulberry32(42);
    const pts = [];
    GENRES.forEach((g, gi) => {
      const n = 90;
      for (let i = 0; i < n; i++) {
        // gaussian-ish spread around the genre center
        const r = Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * 0.055;
        const a = rnd() * Math.PI * 2;
        pts.push({
          x: Math.min(0.97, Math.max(0.03, g.cx + r * Math.cos(a))),
          y: Math.min(0.97, Math.max(0.03, g.cy + r * Math.sin(a))),
          color: g.color,
          genre: gi,
        });
      }
    });
    // favorite = a point in the Rap/Hip-Hop cluster (index 6)
    const fav = pts.find((p) => p.genre === 6) || pts[0];
    // nearest neighbor by euclidean distance (excluding itself)
    let best = null, bestD = Infinity;
    for (const p of pts) {
      if (p === fav) continue;
      const d = (p.x - fav.x) ** 2 + (p.y - fav.y) ** 2;
      if (d < bestD) { bestD = d; best = p; }
    }
    // STRICT geometry: treat each point as a 2D vector in embedding space and
    // take the TRUE cosine angle between them (arccos(dot/(|a||b|))), the same
    // measure used for retrieval — not a visual from-bottom-origin angle.
    const vFav = [fav.x, fav.y];
    const vNbr = [best.x, best.y];
    const cos = cosine(vFav, vNbr);
    return {
      points: pts,
      favorite: fav,
      neighbor: best,
      theta: angleDeg(vFav, vNbr),
      cos,
    };
  }, []);

  const W = 420, H = 320;
  const px = (p) => ({ x: p.x * W, y: p.y * H });
  const fav = px(favorite);
  const nbr = px(neighbor);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl bg-white/95">
        <defs>
          <marker id="favArrow" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6 Z" fill="#db2777" />
          </marker>
        </defs>

        {/* dots */}
        {points.map((p, i) => {
          const q = px(p);
          return <circle key={i} cx={q.x} cy={q.y} r="2.1" fill={p.color} opacity="0.8" />;
        })}

        {/* arrow in to the favorite */}
        <line x1={W * 0.18} y1={H * 0.08} x2={fav.x} y2={fav.y}
          stroke="#db2777" strokeWidth="2.5" markerEnd="url(#favArrow)" />
        {/* dashed connector to nearest neighbour */}
        <line x1={fav.x} y1={fav.y} x2={nbr.x} y2={nbr.y}
          stroke="#111827" strokeWidth="1.5" strokeDasharray="4 3" />

        <circle cx={fav.x} cy={fav.y} r="7" fill="none" stroke="#111827" strokeWidth="2.5" />
        <circle cx={nbr.x} cy={nbr.y} r="5" fill="none" stroke="#111827" strokeWidth="2" />

        {/* true cosine angle label near the favorite */}
        <rect x={fav.x + 8} y={fav.y - 10} width="52" height="16" rx="3" fill="#111827" />
        <text x={fav.x + 34} y={fav.y + 2} fill="#fff" fontSize="10" textAnchor="middle" fontFamily="monospace">
          {theta.toFixed(1)}°
        </text>
        <rect x={fav.x + 8} y={fav.y + 8} width="52" height="14" rx="3" fill="#111827" />
        <text x={fav.x + 34} y={fav.y + 18} fill="#86efac" fontSize="9" textAnchor="middle" fontFamily="monospace">
          cos {cos.toFixed(2)}
        </text>
      </svg>

      {/* overlay labels */}
      <div className="absolute left-[14%] top-[2%] bg-pink-600 text-white text-[11px] px-2 py-0.5 rounded">
        Your Favorite Song
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 bottom-[2%] bg-pink-600 text-white text-[11px] px-2 py-0.5 rounded text-center">
        Similar songs (you might like)
      </div>

      {/* legend */}
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
        {GENRES.map((g) => (
          <span key={g.name} className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: g.color }} />
            {g.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ContentVectorSimilarity() {
  const [open, setOpen] = useState(false);
  const A = [0, 0.5];
  const B = [0.8, 0.2];
  const cos = cosine(A, B);
  const theta = angleDeg(A, B);

  return (
    <div className="glass rounded-2xl p-6 border border-pink-500/10">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between text-left">
        <div>
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            🎵 Content (Vector) Similarity
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            The angle between vectors = how similar two items are (songs, docs, anything)
          </p>
        </div>
        <span className="text-slate-500 text-lg">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-6 grid lg:grid-cols-2 gap-6 overflow-hidden"
        >
          {/* LEFT */}
          <div className="bg-dark-800/60 rounded-xl p-5 border border-white/5">
            <TextbookPlane A={A} B={B} />
            <div className="mt-3 bg-dark-900/60 rounded-lg p-3 font-mono text-xs text-slate-300 space-y-1">
              <div className="text-slate-500">// cosine distance = 1 − cosine similarity</div>
              <div>
                cos θ = (A · B) / (‖A‖ · ‖B‖) ={" "}
                <span className="text-emerald-400">{cos.toFixed(3)}</span>
              </div>
              <div>
                θ = arccos({cos.toFixed(3)}) ={" "}
                <span className="text-violet-400 font-bold">{theta.toFixed(1)}°</span>
              </div>
              <div className="text-slate-400">
                cosine distance = 1 − {cos.toFixed(3)} ={" "}
                <span className="text-amber-400">{(1 - cos).toFixed(3)}</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
              A small angle ⇒ high similarity ⇒ small distance. Here the two vectors
              sit <strong className="text-violet-400">{theta.toFixed(0)}°</strong> apart, so they're only
              loosely related.
            </p>
          </div>

          {/* RIGHT */}
          <div className="bg-dark-800/60 rounded-xl p-5 border border-white/5">
            <SongCloud />
            <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
              Every song is a point (a vector) in embedding space. The favorite and its
              nearest neighbor are compared with the <strong className="text-pink-400">true
              cosine angle</strong> between their vectors —
              <span className="font-mono text-slate-400"> θ = arccos(cos θ)</span> — the exact
              same measure retrieval uses to find the closest chunks to a query.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
