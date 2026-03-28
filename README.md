# AI BI Agent — Conversational Business Intelligence

> Ask questions in plain English. Get charts, tables, and insights from 3.4M+ e-commerce orders.

A production-grade AI-powered BI agent that converts natural language queries into SQL, executes them against the Instacart Market Basket dataset (32M+ product-order rows), and returns interactive visualizations — all through a conversational chat interface.

---

## Demo

```
User: "What are the top 10 most ordered products?"
→ Generates SQL → Executes against DuckDB → Returns bar chart + data table

User: "Now show me their reorder rates"
→ Uses conversation memory → Follows up on previous context → Returns updated chart
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                     │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Chat UI  │  │ Chart Render │  │  Data Table       │  │
│  │ (React)  │  │ (Recharts)   │  │  (Dynamic cols)   │  │
│  └────┬─────┘  └──────────────┘  └──────────────────┘  │
│       │ POST /api/query                                  │
│       │  (JSON payload: question, session_id)            │
│       │  (Response: answer, sql, data, chart_config)     │
└───────┼─────────────────────────────────────────────────┘
        │ HTTP
┌───────▼─────────────────────────────────────────────────┐
│                   Backend (FastAPI)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────┐  │
│  │  API Routes  │  │  BI Agent   │  │  DB Service    │  │
│  │  (FastAPI)   │→ │ (LangChain) │→ │  (DuckDB)      │  │
│  └─────────────┘  └──────┬──────┘  └────────────────┘  │
│                           │                              │
│                    ┌──────▼──────┐                       │
│                    │  OpenAI API │                       │
│                    │  (GPT-4o-m) │                       │
│                    └─────────────┘                       │
└─────────────────────────────────────────────────────────┘
        │
┌───────▼─────────────────────────────────────────────────┐
│              DuckDB (In-Memory OLAP)                     │
│  orders │ order_products_prior │ products │ aisles │ ... │
│  3.4M   │ 32M rows             │ 50K      │ 134    │     │
└─────────────────────────────────────────────────────────┘
```

---

## Key Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| **Analytics DB** | DuckDB | Columnar, in-memory, handles 32M rows without server process. Pandas chokes at this scale. SQLite lacks OLAP optimization. |
| **LLM** | GPT-4o-mini | Best cost/performance for structured SQL generation. $0.15/1M input tokens vs $2.50 for GPT-4o. Upgrade path available. |
| **NL→SQL** | LangChain + structured prompting | Schema-aware prompt with table relationships, data notes, and output format. Simpler than fine-tuned models, more controllable. |
| **Frontend** | Next.js 14 + Tailwind + Recharts | Modern React with SSR capability. Recharts for native React charting. Tailwind for rapid, consistent styling. |
| **Error Recovery** | 3-attempt retry with error feedback | On SQL failure, error message fed back to LLM for self-correction. Covers 90%+ of transient generation errors. |
| **Chart Selection** | LLM-determined | Agent selects chart type based on query semantics (categorical→bar, temporal→line, proportion→pie). More intelligent than rule-based. |
| **Conversation Memory** | In-memory session store | Last 5 turns maintained per session. Enables follow-up queries. Trade-off: no persistence across restarts (acceptable for demo). |

---

## How to Run

### Prerequisites
- Python 3.10+
- Node.js 18+
- OpenAI API key

### 1. Clone & Setup

```bash
git clone https://github.com/yashshalwaig/conversational-bi-agent.git
cd conversational-bi-agent

# Copy environment config
cp .env.example backend/.env
# Edit backend/.env and add your OPENAI_API_KEY
```

### 2. Download Dataset

Download from [Kaggle](https://www.kaggle.com/datasets/psparks/instacart-market-basket-analysis) and extract CSVs to `data/`:

```bash
mkdir -p data
# Option A: Kaggle CLI
bash scripts/download_data.sh

# Option B: Manual download from Kaggle, extract to data/
```

Required files in `data/`:
- `orders.csv`, `order_products__prior.csv`, `order_products__train.csv`
- `products.csv`, `aisles.csv`, `departments.csv`

### 3. Start Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 4. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

### 5. Open Application

Navigate to **http://localhost:3000**

---

## API Documentation

### `POST /api/query`
Process a natural language BI question.

**Request:**
```json
{
  "question": "What are the top 10 most ordered products?",
  "session_id": "optional-session-uuid"
}
```

**Response:**
```json
{
  "answer": "The most ordered product is Banana with 472,565 orders...",
  "sql": "SELECT p.product_name, COUNT(*) as order_count FROM ...",
  "data": [{"product_name": "Banana", "order_count": 472565}, ...],
  "chart_config": {
    "chart_type": "bar",
    "x_column": "product_name",
    "y_column": "order_count",
    "title": "Top 10 Most Ordered Products"
  },
  "row_count": 10,
  "execution_time_ms": 145.23,
  "session_id": "uuid-here"
}
```

### `GET /api/health`
Returns database status, loaded tables, and row counts.

### `GET /api/schema`
Returns full database schema with column types and relationships.

### `GET /api/suggestions`
Returns example questions to help users get started.

**Full interactive docs**: http://localhost:8000/docs (Swagger UI)

---

## Project Structure

```
ai-bi-agent/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app with lifespan management
│   │   ├── config.py            # Pydantic settings (env-based)
│   │   ├── api/
│   │   │   └── routes.py        # REST endpoints
│   │   ├── services/
│   │   │   ├── database.py      # DuckDB service (load, query, schema)
│   │   │   └── agent.py         # LangChain BI agent (NL→SQL→result)
│   │   ├── models/
│   │   │   └── schemas.py       # Pydantic request/response models
│   │   └── prompts/
│   │       └── templates.py     # System prompt, retry prompt, context
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx         # Main chat page
│   │   │   ├── layout.tsx       # Root layout
│   │   │   └── globals.css      # Tailwind + custom styles
│   │   ├── components/
│   │   │   ├── ChartRenderer.tsx # Dynamic chart rendering (6 types)
│   │   │   ├── DataTable.tsx     # Responsive data table
│   │   │   ├── MessageBubble.tsx # Chat message with SQL/chart/table
│   │   │   └── QueryInput.tsx    # Input with suggestions
│   │   ├── lib/
│   │   │   └── api.ts           # API client
│   │   └── types/
│   │       └── index.ts         # TypeScript interfaces
│   ├── package.json
│   └── Dockerfile
├── data/                         # CSV files (gitignored)
├── scripts/
│   └── download_data.sh          # Dataset download helper
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## Known Limitations & Failure Modes

| Limitation | Why | Mitigation |
|-----------|-----|-----------|
| **No absolute timestamps** | Dataset only has relative days_since_prior_order | Agent prompt explicitly notes this; LLM avoids calendar queries |
| **LLM hallucination** | May generate SQL with non-existent columns | Schema included in prompt; 3-retry error recovery |
| **32M row full scans** | Some queries may be slow without indexes | DuckDB columnar scan is fast; LIMIT enforced; timeout at 30s |
| **Session volatility** | Conversation memory lost on restart | Acceptable for demo; production would use Redis/DB |
| **Single-user** | No auth, no multi-tenancy | Demo scope; production would add JWT + user isolation |
| **Cost** | Each query costs ~$0.001 with GPT-4o-mini | Acceptable; production would add caching for repeated queries |

---

## Tech Stack

- **Backend**: Python 3.11, FastAPI, DuckDB, LangChain, OpenAI
- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS, Recharts
- **Infrastructure**: Docker, Docker Compose
- **Data**: Instacart Market Basket Analysis (Kaggle, 6 CSV files, ~37M total rows)

---

## Author

**Yash Sanjeev Halwai**
AI Engineer | 2+ years | RAG · Agentic AI · LLM Orchestration
