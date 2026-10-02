# search-advanced

A hands-on toolkit for **advanced semantic / Retrieval-Augmented Generation (RAG) search**, built on **Amazon Bedrock** (Titan embeddings + Claude) and **Qdrant Cloud**.

It contains two complementary parts:

| Part | What it is | Tech |
|------|-----------|------|
| **`rag-ui/`** | An interactive web app that visualizes every stage of a RAG pipeline in real time — including a **vector-geometry view** that shows the actual **angle** between query and document vectors, and a **Sparse vs Dense** semantic-search explainer. | React + Vite + Tailwind (frontend) · Node + Express + AWS SDK v3 (backend) |
| **`RAG/`** | A set of Jupyter notebooks covering search generations, dense vs sparse encoding, hybrid search, HNSW tuning, quantization, production monitoring, plus a `tier1_RAG` chunking/indexing series. | Python 3.11 · boto3 · qdrant-client |

---

## Table of contents
1. [Architecture at a glance](#architecture-at-a-glance)
2. [Repository layout](#repository-layout)
3. [Prerequisites](#prerequisites)
4. [One-time setup on a new machine](#one-time-setup-on-a-new-machine)
   - [A. Clone + environment file](#a-clone--environment-file)
   - [B. AWS Bedrock configuration](#b-aws-bedrock-configuration)
   - [C. Qdrant Cloud configuration](#c-qdrant-cloud-configuration)
5. [Running the rag-ui web app](#running-the-rag-ui-web-app)
6. [Running the RAG notebooks](#running-the-rag-notebooks)
7. [How semantic similarity works (the angle idea)](#how-semantic-similarity-works-the-angle-idea)
8. [Troubleshooting](#troubleshooting)

---

## Architecture at a glance

```
                 ┌──────────────────────────────────────────────┐
                 │                 Amazon Bedrock                │
                 │  Titan Embed v2 (vectors)  ·  Claude (LLM)    │
                 └───────────────▲───────────────▲──────────────┘
                                 │               │
        embeddings / similarity  │               │  generation
                                 │               │
   ┌─────────────────────────────┴───┐   ┌───────┴───────────────────────┐
   │        rag-ui/backend            │   │        RAG/ notebooks         │
   │  Express API on :3001            │   │  Jupyter + boto3              │
   │  /api/embed  /api/retrieve       │   │  dense/sparse/hybrid/HNSW…    │
   │  /api/vector-geometry  /generate │   │        │                      │
   └─────────────────▲────────────────┘   │        ▼                      │
                     │                     │   ┌─────────────┐             │
   ┌─────────────────┴────────────────┐    │   │ Qdrant Cloud│ vector DB   │
   │        rag-ui/frontend           │    │   └─────────────┘             │
   │  React + Vite dev server :3000   │    └───────────────────────────────┘
   │  Vector-geometry & angle views   │
   └──────────────────────────────────┘
```

- The **web app** calls Bedrock directly for embeddings/generation and keeps vectors **in memory** (no external DB needed to try it).
- The **notebooks** use Bedrock for embeddings/LLM and **Qdrant Cloud** as the persistent vector store.

---

## Repository layout

```
search-advanced/
├── .env.example                 # copy to .env, fill AWS + Qdrant values
├── .gitignore
├── README.md                    # this file
│
├── rag-ui/
│   ├── backend/                 # Express API (Node 20+)
│   │   └── src/index.js         # /api/embed, /api/retrieve, /api/vector-geometry, /api/generate
│   ├── frontend/                # React + Vite app
│   │   └── src/components/
│   │       ├── RetrievalStep.jsx
│   │       ├── VectorGeometry.jsx            # angle plot, formula, 2D PCA projection
│   │       └── SemanticSearchApproaches.jsx  # sparse vs dense explainer with angles
│   └── README.md
│
└── RAG/
    └── search/
        ├── 01_Four_Generations_of_Search.ipynb
        ├── 02_Dense_vs_Sparse_Encoding.ipynb
        ├── 03_Hybrid_Search.ipynb
        ├── 04_HNSW_Parameter_Tuning.ipynb
        ├── 05_Quantization_Cost_Optimization.ipynb
        ├── 06_Production_Monitoring.ipynb
        ├── 07_Live_Demo_Dense_vs_Sparse.ipynb
        └── tier1_RAG/rag-factory-tier1/      # chunking & indexing notebooks + sample data
```

---

## Prerequisites

Install these on the new machine first:

| Tool | Version | Check |
|------|---------|-------|
| **Node.js** | 20+ (22+ recommended) | `node -v` |
| **Python** | 3.11+ | `python3 --version` |
| **AWS CLI** | v2 | `aws --version` |
| **Git** | any recent | `git --version` |

You also need:
- An **AWS account** with **Amazon Bedrock model access** granted (see step B).
- A free **Qdrant Cloud** account (see step C) — only required for the notebooks.

---

## One-time setup on a new machine

### A. Clone + environment file

```bash
git clone https://github.com/Ramu-DE/search-advanced.git
cd search-advanced

# Create your private env file from the template
cp .env.example .env
#   → open .env and fill in real AWS + Qdrant values (details below)
```

> `.env` is git-ignored and will never be committed.

### B. AWS Bedrock configuration

**1. Provide credentials.** Pick ONE of these:

- **Recommended — AWS CLI profile** (keys stay out of the repo):
  ```bash
  aws configure
  #   AWS Access Key ID:     <your key>
  #   AWS Secret Access Key: <your secret>
  #   Default region name:   us-east-1
  ```
  Both the Node backend and boto3 automatically pick up this profile. With this, you can leave the `AWS_*` keys in `.env` blank.

- **Or — put keys in `.env`** (handy for temporary workshop/SSO credentials):
  ```
  AWS_DEFAULT_REGION="us-east-1"
  AWS_ACCESS_KEY_ID="..."
  AWS_SECRET_ACCESS_KEY="..."
  AWS_SESSION_TOKEN="..."   # only for temporary STS creds
  ```

**2. Enable the models in Bedrock** (one time per account/region):

1. Open the AWS Console → **Amazon Bedrock** → **Model access** (region **us-east-1**).
2. Click **Manage model access** / **Enable specific models**.
3. Enable:
   - **Amazon Titan Text Embeddings V2** → `amazon.titan-embed-text-v2:0`
   - **Anthropic Claude** (Haiku for the app; Sonnet for notebooks)
4. Save and wait until status shows **Access granted**.

**3. Verify access from the CLI:**
```bash
aws bedrock list-foundation-models --region us-east-1 \
  --query "modelSummaries[?contains(modelId,'titan-embed-text-v2')].modelId"
```
You should see `amazon.titan-embed-text-v2:0` in the output.

### C. Qdrant Cloud configuration

Only needed for the **notebooks** (the web app uses in-memory vectors).

1. Sign up at **https://cloud.qdrant.io** (free tier is fine).
2. **Create a cluster** → copy its **Cluster URL** (looks like `https://xxxx.us-east-1-0.aws.cloud.qdrant.io`).
3. **Create an API key** → copy it.
4. Put both in `.env`:
   ```
   QDRANT_URL="https://YOUR_CLUSTER_ID.YOUR_REGION.aws.cloud.qdrant.io"
   QDRANT_API_KEY="YOUR_QDRANT_API_KEY"
   ```

---

## Running the rag-ui web app

Two processes: backend (API, port 3001) and frontend (Vite, port 3000).

```bash
# ── Terminal 1: backend ──
cd rag-ui/backend
npm install
node src/index.js
#   → "RAG Backend running on http://localhost:3001"

# ── Terminal 2: frontend ──
cd rag-ui/frontend
npm install
npx vite --port 3000
#   → open http://localhost:3000
```

Then in the browser, walk the pipeline:
**Upload → Chunking → Embedding → Retrieval → Generation.**

In the **Retrieval** step you get:
- cosine-similarity scores for every chunk,
- the **Vector Geometry** panel — the **angle (in degrees)** between your query and each chunk, a live cosine→angle formula, and a 2D PCA plot of the vectors as arrows from the origin,
- the **Semantic Search — Two Approaches** panel comparing **Sparse vs Dense** encoding, with angle diagrams for each.

> **Local vs proxied access.** `frontend/src/utils/api.js` auto-detects whether it is served under a `/proxy/<port>/` prefix (e.g. VS Code / code-server) and points the API base accordingly. For plain local use (`http://localhost:3000`) it talks to the backend through Vite's dev proxy — no extra config needed.

### Quick start helper
From `rag-ui/` you can also use the npm scripts:
```bash
cd rag-ui
npm --prefix backend install && npm --prefix frontend install
# then, in two terminals:
npm run backend
npm run frontend
```

---

## Running the RAG notebooks

```bash
cd RAG/search

# (recommended) create a virtual environment
python3 -m venv .venv && source .venv/bin/activate

pip install boto3 qdrant-client opensearch-py requests-aws4auth \
            strands-agents pypdf python-dotenv rank-bm25 numpy \
            matplotlib scikit-learn ipykernel jupyter

# register a kernel so the notebooks can find this environment
python -m ipykernel install --user --name search-advanced \
       --display-name "Python 3.11 (search-advanced)"

jupyter lab      # or: jupyter notebook
```

The notebooks load credentials automatically from the repo-root `.env` via `python-dotenv`. Open them in order (01 → 07); `tier1_RAG/rag-factory-tier1/` has its own README and sample `data/`.

Suggested reading order:
1. `01_Four_Generations_of_Search` — the big picture
2. `02_Dense_vs_Sparse_Encoding` — the two encodings (mirrors the UI panel)
3. `03_Hybrid_Search` — combining them
4. `04_HNSW_Parameter_Tuning` — ANN index tuning
5. `05_Quantization_Cost_Optimization`
6. `06_Production_Monitoring`
7. `07_Live_Demo_Dense_vs_Sparse`

---

## How semantic similarity works (the angle idea)

Both the app and the notebooks measure relevance as the **angle between vectors**:

```
cos θ = (query · doc) / (‖query‖ · ‖doc‖)      θ = arccos(cos θ)
```

| cosine | angle | meaning |
|-------:|------:|---------|
| 1.00 | 0°  | identical direction (same meaning) |
| 0.71 | ~45° | related |
| 0.00 | 90° | orthogonal — unrelated |
| −1.0 | 180° | opposite |

Titan embeddings are **normalized** (length 1), so `‖query‖ = ‖doc‖ = 1` and the dot product **equals** the cosine. Direction (meaning) is all that matters; magnitude does not.

- **Dense** encoding places synonyms at a *small* angle even with **zero shared words** (`car` ↔ `automobile` ≈ 31°).
- **Sparse** encoding lives in a ~30k-dim term space; two texts with **no shared vocabulary are orthogonal (90°)** unless term expansion adds the synonym.

The `VectorGeometry.jsx` and `SemanticSearchApproaches.jsx` components in the app visualize exactly this.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---------|--------------------|
| `AccessDeniedException` / `could not load credentials` | AWS creds missing or wrong region. Run `aws configure` or fill `.env`; confirm region is `us-east-1`. |
| `You don't have access to the model` | Model not enabled in Bedrock. Do step **B.2** (Model access). |
| Backend starts but embeddings fail | Titan model not enabled, or region mismatch between `.env` and the backend (`us-east-1`). |
| Frontend loads but API calls fail | Make sure the backend (port 3001) is running; for proxied setups see the note in [Running the rag-ui web app](#running-the-rag-ui-web-app). |
| Node SDK v3 warns about Node version | Harmless; upgrade to Node 22+ to silence it. |
| Notebook can't reach Qdrant | Check `QDRANT_URL`/`QDRANT_API_KEY` in `.env` and that the cluster is running. |
| `ModuleNotFoundError` in a notebook | Re-run the `pip install …` line; ensure the `search-advanced` kernel is selected. |

---

### Security note
Never commit real credentials. `.env`, `*.pem`, and `*.key` are git-ignored. Share secrets out-of-band, not in the repo.
