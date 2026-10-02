import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { API_BASE } from "../utils/api.js";

// Palette for chunk arrows (cycles if there are more chunks)
const CHUNK_COLORS = [
  "#34d399", "#f59e0b", "#60a5fa", "#f472b6", "#a78bfa",
  "#2dd4bf", "#fb7185", "#facc15", "#4ade80", "#38bdf8",
];

const QUERY_COLOR = "#6366f1";

function angleToDescriptor(deg) {
  if (deg < 15) return { label: "nearly identical", tone: "text-emerald-400" };
  if (deg < 35) return { label: "very similar", tone: "text-emerald-400" };
  if (deg < 55) return { label: "related", tone: "text-amber-400" };
  if (deg < 80) return { label: "loosely related", tone: "text-amber-400" };
  if (deg < 100) return { label: "unrelated (orthogonal)", tone: "text-slate-400" };
  return { label: "opposing", tone: "text-rose-400" };
}

/**
 * 2D plot of query + chunk vectors as arrows from the origin.
 * Coordinates come from a PCA projection computed on the backend, so the
 * angles between arrows approximate the real high-dimensional angles.
 */
function ArrowPlot({ projection, highlightId }) {
  const size = 420;
  const cx = size / 2;
  const cy = size / 2;

  const points = useMemo(() => {
    const all = [projection.query, ...projection.chunks];
    const maxMag = Math.max(
      ...all.map((p) => Math.sqrt(p.x * p.x + p.y * p.y)),
      1e-6
    );
    const scale = (size / 2 - 40) / maxMag;
    return {
      scale,
      query: { x: cx + projection.query.x * scale, y: cy - projection.query.y * scale },
      chunks: projection.chunks.map((p) => ({
        chunkId: p.chunkId,
        x: cx + p.x * scale,
        y: cy - p.y * scale,
      })),
    };
  }, [projection]);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-md mx-auto">
      <defs>
        <marker id="arrowQuery" markerWidth="10" markerHeight="10" refX="8" refY="3"
          orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L8,3 L0,6 Z" fill={QUERY_COLOR} />
        </marker>
        {CHUNK_COLORS.map((c, i) => (
          <marker key={i} id={`arrowChunk${i}`} markerWidth="10" markerHeight="10"
            refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L8,3 L0,6 Z" fill={c} />
          </marker>
        ))}
      </defs>

      {/* Grid axes */}
      <line x1="0" y1={cy} x2={size} y2={cy} stroke="#1e293b" strokeWidth="1" />
      <line x1={cx} y1="0" x2={cx} y2={size} stroke="#1e293b" strokeWidth="1" />
      <circle cx={cx} cy={cy} r="4" fill="#475569" />
      <text x={cx + 8} y={cy + 16} fill="#64748b" fontSize="11" fontFamily="monospace">
        origin
      </text>

      {/* Chunk arrows */}
      {points.chunks.map((p, i) => {
        const color = CHUNK_COLORS[i % CHUNK_COLORS.length];
        const isHi = highlightId === p.chunkId;
        return (
          <g key={p.chunkId} opacity={highlightId == null || isHi ? 1 : 0.25}>
            <line
              x1={cx} y1={cy} x2={p.x} y2={p.y}
              stroke={color} strokeWidth={isHi ? 3 : 1.75}
              markerEnd={`url(#arrowChunk${i % CHUNK_COLORS.length})`}
            />
            <text x={p.x + 4} y={p.y - 4} fill={color} fontSize="11" fontFamily="monospace">
              C{p.chunkId + 1}
            </text>
          </g>
        );
      })}

      {/* Query arrow (drawn last, on top) */}
      <line
        x1={cx} y1={cy} x2={points.query.x} y2={points.query.y}
        stroke={QUERY_COLOR} strokeWidth="3.5" markerEnd="url(#arrowQuery)"
      />
      <text x={points.query.x + 4} y={points.query.y - 4} fill={QUERY_COLOR}
        fontSize="12" fontWeight="bold" fontFamily="monospace">
        Query
      </text>
    </svg>
  );
}

/** A small protractor-style gauge showing a single angle in degrees. */
function AngleGauge({ deg, color }) {
  const r = 34;
  const cx = 44;
  const cy = 44;
  // Query arm points straight right (0°). Chunk arm is rotated by `deg`.
  const rad = (deg * Math.PI) / 180;
  const qx = cx + r;
  const qy = cy;
  const chx = cx + r * Math.cos(rad);
  const chy = cy - r * Math.sin(rad);

  // Arc path for the angle sweep
  const arcR = 16;
  const ax = cx + arcR;
  const ay = cy;
  const bx = cx + arcR * Math.cos(rad);
  const by = cy - arcR * Math.sin(rad);
  const largeArc = deg > 180 ? 1 : 0;

  return (
    <svg viewBox="0 0 88 88" className="w-20 h-20 flex-shrink-0">
      <line x1={cx} y1={cy} x2={qx} y2={qy} stroke={QUERY_COLOR} strokeWidth="2.5" />
      <line x1={cx} y1={cy} x2={chx} y2={chy} stroke={color} strokeWidth="2.5" />
      <path
        d={`M ${ax} ${ay} A ${arcR} ${arcR} 0 ${largeArc} 0 ${bx} ${by}`}
        fill="none" stroke="#94a3b8" strokeWidth="1.5"
      />
      <text x={cx + 2} y={cy - 20} fill="#e2e8f0" fontSize="13" fontWeight="bold"
        textAnchor="middle" fontFamily="monospace">
        {deg.toFixed(0)}°
      </text>
    </svg>
  );
}

export default function VectorGeometry({ sessionId, query }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [highlightId, setHighlightId] = useState(null);

  useEffect(() => {
    if (!sessionId || !query) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/api/vector-geometry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, query }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [sessionId, query]);

  if (loading) {
    return (
      <div className="glass rounded-2xl p-6 border border-cyan-500/10 text-center text-slate-400 text-sm">
        <div className="animate-spin w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-2" />
        Computing vector geometry (angles, dot products, 2D projection)...
      </div>
    );
  }
  if (error) {
    return (
      <div className="glass rounded-2xl p-4 border border-rose-500/20 text-rose-400 text-sm">
        ⚠️ Geometry: {error}
      </div>
    );
  }
  if (!data) return null;

  // Chunks sorted by angle (smallest = most similar) and limited for the gauges
  const sortedChunks = [...data.chunks].sort((a, b) => a.angleDeg - b.angleDeg);
  const topChunks = sortedChunks.slice(0, Math.min(6, sortedChunks.length));
  const f = data.formula;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="glass rounded-2xl p-6 border border-cyan-500/10 space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            📐 Vector Geometry — The Angle Between Meaning
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Each chunk and your query is a {data.dimension}-dimensional unit vector.
            Semantic similarity is the <em>angle</em> between them:
            <span className="text-emerald-400"> 0° = identical</span>,
            <span className="text-amber-400"> ~45° = related</span>,
            <span className="text-slate-400"> 90° = unrelated</span>,
            <span className="text-rose-400"> 180° = opposite</span>.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* 2D arrow plot */}
          <div>
            <div className="text-xs text-slate-500 mb-2 font-mono">
              2D projection (PCA) — arrows from origin
            </div>
            <ArrowPlot projection={data.projection} highlightId={highlightId} />
            <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
              The {data.dimension}-D vectors are projected to 2D so you can see them.
              Angles are approximate in 2D but reflect the real directional
              relationships. Hover a gauge to highlight its arrow.
            </p>
          </div>

          {/* Formula breakdown */}
          <div className="space-y-4">
            <div className="text-xs text-slate-500 font-mono">
              How cosine similarity → angle is computed
            </div>
            <div className="bg-dark-800 rounded-xl p-4 font-mono text-xs space-y-2 text-slate-300">
              <div className="text-slate-500">// unit vectors ⇒ ‖query‖ = ‖chunk‖ = 1</div>
              <div>
                cos θ = <span className="text-cyan-400">(query · chunk)</span> / (‖query‖ · ‖chunk‖)
              </div>
              {f && (
                <>
                  <div className="pl-6 text-slate-400">
                    = {f.dot.toFixed(4)} / ({f.queryNorm.toFixed(3)} × {f.chunkNorm.toFixed(3)})
                  </div>
                  <div className="pl-6">
                    = <span className="text-emerald-400">{f.cosine.toFixed(4)}</span>
                    <span className="text-slate-600"> (cosine similarity)</span>
                  </div>
                  <div className="pt-1">
                    θ = arccos({f.cosine.toFixed(4)}) ={" "}
                    <span className="text-amber-400 font-bold">{f.angleDeg.toFixed(1)}°</span>
                  </div>
                  <div className="text-slate-600 text-[11px] pt-1">
                    best match: Chunk #{f.chunkId + 1}
                  </div>
                </>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-dark-700/50 rounded-lg p-2">
                <div className="text-[10px] text-slate-500 uppercase">Query ‖v‖</div>
                <div className="text-sm font-mono text-indigo-400">{data.queryNorm.toFixed(3)}</div>
              </div>
              <div className="bg-dark-700/50 rounded-lg p-2">
                <div className="text-[10px] text-slate-500 uppercase">Dims</div>
                <div className="text-sm font-mono text-cyan-400">{data.dimension}</div>
              </div>
              <div className="bg-dark-700/50 rounded-lg p-2">
                <div className="text-[10px] text-slate-500 uppercase">Normalized</div>
                <div className="text-sm font-mono text-emerald-400">{data.normalized ? "yes" : "no"}</div>
              </div>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Because the vectors are normalized (length 1), the magnitude carries
              no meaning — only <strong className="text-slate-400">direction</strong> does.
              That's why the dot product alone equals the cosine, and the angle is the
              pure measure of semantic closeness.
            </p>
          </div>
        </div>
      </div>

      {/* Per-chunk angle gauges */}
      <div className="glass rounded-2xl p-6 border border-cyan-500/10">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
          Angle to Query — Per Chunk
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {topChunks.map((c) => {
            const color = CHUNK_COLORS[c.chunkId % CHUNK_COLORS.length];
            const desc = angleToDescriptor(c.angleDeg);
            return (
              <div
                key={c.chunkId}
                onMouseEnter={() => setHighlightId(c.chunkId)}
                onMouseLeave={() => setHighlightId(null)}
                className="flex items-center gap-3 bg-dark-700/40 rounded-xl p-3 border border-white/5 hover:border-cyan-500/30 transition-colors cursor-default"
              >
                <AngleGauge deg={c.angleDeg} color={color} />
                <div className="min-w-0">
                  <div className="text-xs font-mono" style={{ color }}>
                    Chunk #{c.chunkId + 1}
                  </div>
                  <div className={`text-xs ${desc.tone}`}>{desc.label}</div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                    cos={c.cosine.toFixed(3)} · {c.angleDeg.toFixed(1)}°
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
