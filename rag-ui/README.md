# RAG Pipeline Visualizer

An interactive educational UI that shows every step of a Retrieval-Augmented Generation pipeline in real-time with live AWS Bedrock calls.

## What it Shows

| Step | What Happens | Visualization |
|------|--------------|---------------|
| **1. Upload** | Text/PDF extraction, chunk settings | Drag-and-drop UI with parameter sliders |
| **2. Chunking** | Sliding-window text splitting | Animated bar chart + chunk inspector |
| **3. Embedding** | Titan Embed V2 → 256-dim vectors | Live vector bar chart + similarity heatmap |
| **4. Retrieval** | Cosine similarity search | Scored bar chart of all chunks |
| **5. Generation** | Claude Haiku streaming answer | Token-by-token streaming display |

## Stack

- **Frontend:** React 18 + Vite + Tailwind CSS + Framer Motion
- **Backend:** Node.js + Express + AWS SDK v3
- **AI Models:** Amazon Titan Embed Text V2 (embeddings) + Claude Haiku 4.5 (generation)
- **Region:** us-east-1

## Start

```bash
# Terminal 1 — Backend
cd backend && node src/index.js

# Terminal 2 — Frontend
cd frontend && npx vite --port 3000
```

Then open **http://localhost:3000**

## Requirements

- Node.js 20+
- AWS credentials with Bedrock access in us-east-1
- Models enabled: `amazon.titan-embed-text-v2:0` and `anthropic.claude-haiku-4-5-20251001-v1:0`
