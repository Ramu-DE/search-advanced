import express from "express";
import cors from "cors";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

app.use(cors({
  origin: true, // reflect request origin - works for all environments
  credentials: true,
}));
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const bedrock = new BedrockRuntimeClient({ region: "us-east-1" });

// In-memory document store (sessionId -> {chunks, embeddings})
const sessions = new Map();

// ─── HELPERS ────────────────────────────────────────────────────────────────

/**
 * Extract text from uploaded file (txt / pdf / plain text)
 */
async function extractText(buffer, mimetype, originalname) {
  const ext = originalname.split(".").pop().toLowerCase();

  if (ext === "pdf") {
    try {
      const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
      const data = await pdfParse(buffer);
      return data.text;
    } catch (e) {
      // Fallback: return raw buffer as string for demo
      return buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ");
    }
  }
  return buffer.toString("utf-8");
}

/**
 * Chunk text using sliding-window approach
 */
function chunkText(text, chunkSize = 300, overlap = 50) {
  const sentences = text
    .replace(/\r\n/g, "\n")
    .split(/(?<=[.!?])\s+|\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  const chunks = [];
  let current = [];
  let currentLen = 0;

  for (const sentence of sentences) {
    const words = sentence.split(/\s+/);
    if (currentLen + words.length > chunkSize && current.length > 0) {
      const chunkText = current.join(" ");
      chunks.push({
        id: chunks.length,
        text: chunkText,
        wordCount: currentLen,
        charCount: chunkText.length,
        sentences: current.length,
      });
      // Keep overlap
      const overlapWords = current
        .join(" ")
        .split(/\s+/)
        .slice(-overlap)
        .join(" ");
      current = [overlapWords];
      currentLen = overlap;
    }
    current.push(sentence);
    currentLen += words.length;
  }

  if (current.length > 0) {
    const chunkText = current.join(" ");
    chunks.push({
      id: chunks.length,
      text: chunkText,
      wordCount: currentLen,
      charCount: chunkText.length,
      sentences: current.length,
    });
  }

  // Ensure at least one chunk
  if (chunks.length === 0 && text.trim().length > 0) {
    chunks.push({
      id: 0,
      text: text.trim().slice(0, 2000),
      wordCount: text.trim().split(/\s+/).length,
      charCount: text.trim().length,
      sentences: 1,
    });
  }

  return chunks;
}

/**
 * Get embedding from Bedrock Titan Embed Text V2
 */
async function getEmbedding(text) {
  const payload = {
    inputText: text.slice(0, 8000),
    dimensions: 256,
    normalize: true,
  };

  const cmd = new InvokeModelCommand({
    modelId: "amazon.titan-embed-text-v2:0",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(payload),
  });

  const response = await bedrock.send(cmd);
  const result = JSON.parse(new TextDecoder().decode(response.body));
  return result.embedding;
}

/**
 * Cosine similarity between two vectors
 */
function cosineSim(a, b) {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Convert a cosine similarity value into the angle (in degrees)
 * between the two vectors. 0° = identical direction, 90° = unrelated
 * (orthogonal), 180° = opposite direction.
 */
function cosineToAngleDeg(cos) {
  const clamped = Math.max(-1, Math.min(1, cos));
  return (Math.acos(clamped) * 180) / Math.PI;
}

/**
 * Full geometric breakdown of the similarity between two vectors:
 * dot product, each magnitude (L2 norm), cosine similarity, and angle.
 */
function vectorMath(a, b) {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  const cos = dot / (normA * normB);
  return {
    dot,
    normA,
    normB,
    cosine: cos,
    angleDeg: cosineToAngleDeg(cos),
  };
}

// ─── ROUTES ─────────────────────────────────────────────────────────────────

/**
 * POST /api/upload
 * Upload document → extract text → chunk → return chunks
 */
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const sessionId = uuidv4();
    const text = await extractText(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname
    );

    const chunkSize = parseInt(req.body.chunkSize) || 300;
    const overlap = parseInt(req.body.overlap) || 50;
    const chunks = chunkText(text, chunkSize, overlap);

    sessions.set(sessionId, {
      filename: req.file.originalname,
      fullText: text,
      chunks,
      embeddings: null,
      createdAt: Date.now(),
    });

    res.json({
      sessionId,
      filename: req.file.originalname,
      totalChars: text.length,
      totalWords: text.split(/\s+/).length,
      chunks: chunks.map((c) => ({
        id: c.id,
        text: c.text,
        wordCount: c.wordCount,
        charCount: c.charCount,
      })),
      chunkingStats: {
        totalChunks: chunks.length,
        avgChunkSize: Math.round(
          chunks.reduce((s, c) => s + c.wordCount, 0) / chunks.length
        ),
        maxChunkSize: Math.max(...chunks.map((c) => c.wordCount)),
        minChunkSize: Math.min(...chunks.map((c) => c.wordCount)),
      },
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/embed
 * Embed all chunks → return embeddings (with progress via SSE)
 */
app.get("/api/embed/:sessionId", async (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: "Session not found" });

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const embeddings = [];
    for (let i = 0; i < session.chunks.length; i++) {
      const chunk = session.chunks[i];
      send({ type: "progress", chunkId: i, total: session.chunks.length });

      const embedding = await getEmbedding(chunk.text);
      embeddings.push({ chunkId: i, vector: embedding });

      // Send snippet of the vector for visualization
      send({
        type: "embedding",
        chunkId: i,
        text: chunk.text.slice(0, 80) + "...",
        vectorPreview: embedding.slice(0, 32),
        vectorNorm: Math.sqrt(embedding.reduce((s, v) => s + v * v, 0)),
        dimension: embedding.length,
      });

      // Small delay to make the animation visible
      await new Promise((r) => setTimeout(r, 200));
    }

    session.embeddings = embeddings;

    // Compute similarity matrix for visualization
    const n = embeddings.length;
    const similarityMatrix = [];
    for (let i = 0; i < n; i++) {
      similarityMatrix.push([]);
      for (let j = 0; j < n; j++) {
        similarityMatrix[i].push(
          Math.round(cosineSim(embeddings[i].vector, embeddings[j].vector) * 100) / 100
        );
      }
    }

    send({ type: "done", similarityMatrix, totalEmbeddings: n });
    res.end();
  } catch (err) {
    send({ type: "error", message: err.message });
    res.end();
  }
});

/**
 * POST /api/retrieve
 * Embed query → find top-K similar chunks → return with scores
 */
app.post("/api/retrieve", async (req, res) => {
  try {
    const { sessionId, query, topK = 3 } = req.body;
    const session = sessions.get(sessionId);

    if (!session) return res.status(404).json({ error: "Session not found" });
    if (!session.embeddings)
      return res.status(400).json({ error: "Embeddings not computed yet" });

    // Embed the query
    const queryEmbedding = await getEmbedding(query);
    // Remember the most recent query embedding for the geometry endpoint
    session.lastQuery = { query, vector: queryEmbedding };

    // Score all chunks
    const scores = session.embeddings.map((emb, idx) => {
      const score = cosineSim(queryEmbedding, emb.vector);
      return {
        chunkId: emb.chunkId,
        text: session.chunks[emb.chunkId].text,
        score,
        angleDeg: cosineToAngleDeg(score),
        rank: 0,
      };
    });

    scores.sort((a, b) => b.score - a.score);
    scores.forEach((s, i) => (s.rank = i + 1));

    const topResults = scores.slice(0, topK);
    const allScores = scores.map((s) => ({
      chunkId: s.chunkId,
      score: Math.round(s.score * 1000) / 1000,
      angleDeg: Math.round(s.angleDeg * 10) / 10,
      rank: s.rank,
      isSelected: s.rank <= topK,
    }));

    res.json({
      query,
      queryVectorPreview: queryEmbedding.slice(0, 32),
      topResults,
      allScores,
      retrievalStats: {
        topScore: Math.round(topResults[0]?.score * 1000) / 1000,
        topAngleDeg: Math.round((topResults[0]?.angleDeg ?? 90) * 10) / 10,
        lowestSelected: Math.round(topResults[topResults.length - 1]?.score * 1000) / 1000,
        avgScore: Math.round(
          (scores.reduce((s, c) => s + c.score, 0) / scores.length) * 1000
        ) / 1000,
      },
    });
  } catch (err) {
    console.error("Retrieve error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Project a set of D-dimensional vectors down to 2D using PCA
 * (power iteration to find the top-2 principal components).
 * Returns an array of {x, y} points, one per input vector.
 *
 * PCA is used so the 2D plot preserves the dominant directions of
 * variation — the angles you see between arrows approximate the real
 * high-dimensional angles as closely as a 2D view allows.
 */
function pca2d(vectors) {
  const n = vectors.length;
  const dim = vectors[0].length;

  // Mean-center
  const mean = new Array(dim).fill(0);
  for (const v of vectors) for (let d = 0; d < dim; d++) mean[d] += v[d] / n;
  const centered = vectors.map((v) => v.map((val, d) => val - mean[d]));

  // Power iteration for the leading eigenvector of the covariance matrix.
  // We never materialize the DxD covariance; we apply C = (1/n) Xᵀ X implicitly.
  const applyCov = (vec) => {
    // t = X · vec   (n-dim),  then  Xᵀ · t   (dim-dim)
    const t = centered.map((row) => {
      let s = 0;
      for (let d = 0; d < dim; d++) s += row[d] * vec[d];
      return s;
    });
    const out = new Array(dim).fill(0);
    for (let i = 0; i < n; i++) {
      const row = centered[i];
      const ti = t[i];
      for (let d = 0; d < dim; d++) out[d] += row[d] * ti;
    }
    for (let d = 0; d < dim; d++) out[d] /= n;
    return out;
  };

  const normalize = (vec) => {
    let norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
    return vec.map((x) => x / norm);
  };

  const powerIteration = (deflate) => {
    let v = normalize(vectors[0].map(() => Math.random() - 0.5));
    for (let iter = 0; iter < 100; iter++) {
      let w = applyCov(v);
      if (deflate) {
        // Remove the component along the already-found axis (orthogonalize)
        const dot = w.reduce((s, x, d) => s + x * deflate[d], 0);
        for (let d = 0; d < dim; d++) w[d] -= dot * deflate[d];
      }
      v = normalize(w);
    }
    return v;
  };

  const pc1 = powerIteration(null);
  const pc2 = powerIteration(pc1);

  return centered.map((row) => ({
    x: row.reduce((s, val, d) => s + val * pc1[d], 0),
    y: row.reduce((s, val, d) => s + val * pc2[d], 0),
  }));
}

/**
 * POST /api/vector-geometry
 * Returns the geometric breakdown (dot, magnitudes, cosine, angle) between
 * the query vector and every chunk vector, plus a 2D projection of all
 * vectors so the UI can draw them as arrows from the origin.
 *
 * Uses the query from the request if provided, otherwise falls back to the
 * last query embedded during /api/retrieve.
 */
app.post("/api/vector-geometry", async (req, res) => {
  try {
    const { sessionId, query } = req.body;
    const session = sessions.get(sessionId);

    if (!session) return res.status(404).json({ error: "Session not found" });
    if (!session.embeddings)
      return res.status(400).json({ error: "Embeddings not computed yet" });

    // Determine the query vector
    let queryVector;
    let usedQuery;
    if (query && query.trim()) {
      queryVector = await getEmbedding(query);
      usedQuery = query;
      session.lastQuery = { query, vector: queryVector };
    } else if (session.lastQuery) {
      queryVector = session.lastQuery.vector;
      usedQuery = session.lastQuery.query;
    } else {
      return res
        .status(400)
        .json({ error: "No query provided and no previous query found" });
    }

    // Per-chunk geometric breakdown
    const chunks = session.embeddings.map((emb) => {
      const m = vectorMath(queryVector, emb.vector);
      return {
        chunkId: emb.chunkId,
        text: session.chunks[emb.chunkId].text.slice(0, 120),
        dot: Math.round(m.dot * 10000) / 10000,
        chunkNorm: Math.round(m.normB * 10000) / 10000,
        cosine: Math.round(m.cosine * 10000) / 10000,
        angleDeg: Math.round(m.angleDeg * 10) / 10,
      };
    });

    const queryNorm = Math.sqrt(queryVector.reduce((s, v) => s + v * v, 0));

    // 2D projection of [query, ...chunks] so the frontend can draw arrows.
    const allVectors = [queryVector, ...session.embeddings.map((e) => e.vector)];
    const projected = pca2d(allVectors);
    const projection = {
      query: projected[0],
      chunks: projected.slice(1).map((p, i) => ({
        chunkId: session.embeddings[i].chunkId,
        x: Math.round(p.x * 10000) / 10000,
        y: Math.round(p.y * 10000) / 10000,
      })),
    };
    projection.query = {
      x: Math.round(projection.query.x * 10000) / 10000,
      y: Math.round(projection.query.y * 10000) / 10000,
    };

    res.json({
      query: usedQuery,
      dimension: queryVector.length,
      queryNorm: Math.round(queryNorm * 10000) / 10000,
      normalized: Math.abs(queryNorm - 1) < 0.05, // Titan returns unit vectors
      chunks,
      projection,
      // A worked example using the top chunk, so the UI can show live numbers.
      formula: (() => {
        const best = [...chunks].sort((a, b) => b.cosine - a.cosine)[0];
        return best
          ? {
              chunkId: best.chunkId,
              dot: best.dot,
              queryNorm: Math.round(queryNorm * 10000) / 10000,
              chunkNorm: best.chunkNorm,
              cosine: best.cosine,
              angleDeg: best.angleDeg,
            }
          : null;
      })(),
    });
  } catch (err) {
    console.error("Vector-geometry error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/generate
 * Stream LLM answer using retrieved context
 */
app.post("/api/generate", async (req, res) => {
  try {
    const { query, context } = req.body;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    const systemPrompt = `You are a helpful assistant. Answer the user's question based ONLY on the provided context.
If the answer is not in the context, say "I don't have enough information to answer this."
Be concise and educational.`;

    const contextText = context
      .map((c, i) => `[Chunk ${i + 1} | Score: ${c.score.toFixed(3)}]\n${c.text}`)
      .join("\n\n---\n\n");

    const userMessage = `Context:\n${contextText}\n\nQuestion: ${query}`;

    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    };

    const cmd = new InvokeModelWithResponseStreamCommand({
      modelId: "anthropic.claude-haiku-4-5-20251001-v1:0",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });

    const response = await bedrock.send(cmd);
    let totalTokens = 0;
    let fullText = "";

    send({ type: "start", model: "claude-haiku-4-5", contextChunks: context.length });

    for await (const chunk of response.body) {
      if (chunk.chunk?.bytes) {
        const decoded = JSON.parse(new TextDecoder().decode(chunk.chunk.bytes));
        if (decoded.type === "content_block_delta" && decoded.delta?.text) {
          fullText += decoded.delta.text;
          send({ type: "token", text: decoded.delta.text });
        } else if (decoded.type === "message_delta" && decoded.usage) {
          totalTokens = decoded.usage.output_tokens;
        }
      }
    }

    send({ type: "done", fullText, totalTokens });
    res.end();
  } catch (err) {
    console.error("Generate error:", err);
    res.write(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`);
    res.end();
  }
});

/**
 * GET /api/health
 */
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", sessions: sessions.size });
});

app.listen(PORT, () => {
  console.log(`RAG Backend running on http://localhost:${PORT}`);
});
