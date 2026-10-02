# RAG Factory — Tier 1: Chunking & Indexing Foundations

Six Jupyter notebooks covering the core chunking and indexing patterns for Retrieval-Augmented Generation using **Amazon Bedrock** (Titan Embeddings + Claude Sonnet) and **Qdrant Cloud**.

## Notebooks

| # | Notebook | Pattern |
|---|----------|---------|
| 01 | `01_Simple_RAG.ipynb` | Baseline RAG — fixed-size chunks, top-K retrieval |
| 02 | `02_Semantic_Chunking.ipynb` | Split at topic boundaries using cosine similarity drops |
| 03 | `03_Hierarchical_RAG.ipynb` | Multi-level summaries (document → section → chunk) |
| 04 | `04_Parent_Child_RAG.ipynb` | Retrieve small child chunks, return larger parent context |
| 05 | `05_Sentence_Window_RAG.ipynb` | Retrieve by sentence, expand to surrounding window |
| 06 | `06_Contextual_Retrieval.ipynb` | Prepend LLM-generated context to each chunk before indexing |

## Setup

1. **Copy credentials template**
   ```bash
   cp .env.example .env
   # Fill in your AWS credentials and Qdrant API key
   ```

2. **Install dependencies** (requires Python 3.11+)
   ```bash
   pip install boto3 qdrant-client opensearch-py requests-aws4auth \
               strands-agents pypdf python-dotenv rank-bm25 numpy \
               ipykernel jupyter
   ```

3. **Register Jupyter kernel**
   ```bash
   python -m ipykernel install --user --name python311 --display-name "Python 3.11 (RAG)"
   ```

4. **Open and run any notebook** — credentials are loaded automatically from `.env`.

## Stack

- **Embeddings**: Amazon Bedrock Titan Text Embeddings V2 (1024 dims)
- **LLM**: Amazon Bedrock Claude Sonnet via AWS Strands Agents
- **Vector DB**: Qdrant Cloud (falls back to OpenSearch → in-memory)
- **PDF parsing**: pypdf (no LangChain dependency)

## Data

Sample documents are in the `data/` folder and used across all notebooks.
