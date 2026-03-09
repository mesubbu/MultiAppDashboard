You're very welcome! Let's turn your documentation into a **living AI knowledge system**.

Below is a **production-ready ingestion script** that:

1. Reads your Markdown docs
2. Splits them into semantic chunks
3. Generates embeddings
4. Stores them in **Postgres + pgvector**
5. Extracts relationships and loads them into **Neo4j (knowledge graph)**

It is intentionally **simple, reliable, and extensible**.

---

# 1. Required Services (Running on VPS)

Make sure these containers exist first.

**Postgres + pgvector**

```yaml
postgres:
  image: ankane/pgvector
  environment:
    POSTGRES_DB: ai_platform
    POSTGRES_USER: ai
    POSTGRES_PASSWORD: password
  ports:
    - "5432:5432"
```

**Neo4j**

```yaml
neo4j:
  image: neo4j:5
  environment:
    NEO4J_AUTH: neo4j/password
  ports:
    - "7474:7474"
    - "7687:7687"
```

---

# 2. Install Python Dependencies

Create environment:

```bash
python3 -m venv venv
source venv/bin/activate
```

Install libraries:

```bash
pip install \
psycopg2-binary \
neo4j \
sentence-transformers \
markdown \
tqdm
```

---

# 3. Database Schema

Run this once in Postgres:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE document_embeddings (
  id SERIAL PRIMARY KEY,
  source TEXT,
  chunk_text TEXT,
  embedding vector(384),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 4. Knowledge Ingestion Script

Save as:

```
ingest_platform_docs.py
```

```python
import os
import re
import json
from pathlib import Path

import psycopg2
from neo4j import GraphDatabase
from sentence_transformers import SentenceTransformer
from tqdm import tqdm

# ---------------------------
# CONFIG
# ---------------------------

DOCS_PATH = "./platform_docs"

POSTGRES_CONFIG = {
    "host": "localhost",
    "database": "ai_platform",
    "user": "ai",
    "password": "password"
}

NEO4J_URI = "bolt://localhost:7687"
NEO4J_USER = "neo4j"
NEO4J_PASS = "password"

EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

CHUNK_SIZE = 500

# ---------------------------
# INITIALIZE MODELS
# ---------------------------

print("Loading embedding model...")
embedder = SentenceTransformer(EMBED_MODEL)

# ---------------------------
# DATABASE CONNECTIONS
# ---------------------------

pg_conn = psycopg2.connect(**POSTGRES_CONFIG)
pg_cursor = pg_conn.cursor()

neo_driver = GraphDatabase.driver(
    NEO4J_URI,
    auth=(NEO4J_USER, NEO4J_PASS)
)

# ---------------------------
# CHUNKING FUNCTION
# ---------------------------

def chunk_text(text, size=500):
    words = text.split()
    chunks = []

    for i in range(0, len(words), size):
        chunk = " ".join(words[i:i + size])
        chunks.append(chunk)

    return chunks

# ---------------------------
# EXTRACT GRAPH RELATIONS
# ---------------------------

def extract_graph_relations(text):

    relations = []

    screen_pattern = r"SCREEN:\s*(\w+)"
    api_pattern = r"(GET|POST|PUT|DELETE)\s+(/api/[^\s]+)"

    screens = re.findall(screen_pattern, text)
    apis = re.findall(api_pattern, text)

    for s in screens:
        for method, api in apis:
            relations.append({
                "screen": s,
                "api": api,
                "method": method
            })

    return relations

# ---------------------------
# INSERT INTO POSTGRES
# ---------------------------

def insert_embedding(source, chunk, embedding, metadata):

    pg_cursor.execute(
        """
        INSERT INTO document_embeddings
        (source, chunk_text, embedding, metadata)
        VALUES (%s, %s, %s, %s)
        """,
        (source, chunk, embedding.tolist(), json.dumps(metadata))
    )

# ---------------------------
# INSERT INTO NEO4J
# ---------------------------

def insert_graph_relation(tx, screen, api, method):

    query = """
    MERGE (s:Screen {name:$screen})
    MERGE (a:API {path:$api})
    MERGE (s)-[:CALLS {method:$method}]->(a)
    """

    tx.run(query, screen=screen, api=api, method=method)


def add_graph_relations(relations):

    with neo_driver.session() as session:
        for r in relations:
            session.execute_write(
                insert_graph_relation,
                r["screen"],
                r["api"],
                r["method"]
            )

# ---------------------------
# INGEST DOCUMENTS
# ---------------------------

def ingest_documents():

    docs = list(Path(DOCS_PATH).glob("*.md"))

    for doc in docs:

        print(f"\nProcessing {doc.name}")

        text = open(doc).read()

        chunks = chunk_text(text, CHUNK_SIZE)

        for chunk in tqdm(chunks):

            embedding = embedder.encode(chunk)

            metadata = {
                "source_file": doc.name
            }

            insert_embedding(
                doc.name,
                chunk,
                embedding,
                metadata
            )

        relations = extract_graph_relations(text)

        if relations:
            add_graph_relations(relations)

    pg_conn.commit()

# ---------------------------
# MAIN
# ---------------------------

if __name__ == "__main__":

    ingest_documents()

    print("\nIngestion complete!")
```

---

# 5. Folder Structure

Create this layout:

```
platform_ai/

platform_docs/
   System-Spec.md
   UI_SCREEN_LIST.md
   UI_SCREEN_LIST_BY_JOURNEY.md
   UI_SCREEN_AUDIT_MATRIX.md
   UI_BLUEPRINT.md
   FRONTEND_ARCHITECTURE.md
   UI_WIREFRAME_SPEC.md
   API_ROUTE_MAP.md

ingest_platform_docs.py
```

---

# 6. Run the Pipeline

```bash
python ingest_platform_docs.py
```

It will:

```
read docs
split text
create embeddings
store vectors
extract graph relations
populate Neo4j
```

---

# 7. Example Data Stored

### Embeddings table

```
document_embeddings
```

| source            | chunk                                       | embedding |
| ----------------- | ------------------------------------------- | --------- |
| UI_SCREEN_LIST.md | ListingDetails screen allows contact vendor | [vector]  |

---

### Knowledge Graph

Example graph:

```
ListingDetails
      ↓ CALLS
POST /api/messages/send
```

You can view this at:

```
http://localhost:7474
```

---

# 8. Runtime Retrieval Example

Your AI layer will query embeddings like:

```
vector search → top 5 chunks
```

Then add them to prompt context.

Example:

```
User question
+ retrieved documentation
+ system prompt
```

This gives the model **perfect platform knowledge**.

---

# 9. Updating the Knowledge Base

Whenever docs change:

```
git pull docs
python ingest_platform_docs.py
```

Re-ingestion updates the AI brain.

---

# 10. What This Gives You

Your platform now has:

```
AI memory (vector DB)
+
knowledge reasoning (graph)
+
documentation understanding
```

Which means the AI can:

```
navigate your UI
map screens to APIs
assist users
build automation
guide agents
```

---

# One Final Suggestion (Very Important)

Add a simple **document version table**:

```
knowledge_versions
```

So the AI always knows **which platform version it is reasoning about**.

This prevents AI from using **outdated docs**.

---

If you'd like, I can also show you the **next extremely powerful piece** for your system:

👉 **Automatic knowledge updates from your Git repo** — so whenever you push new docs, the embeddings + knowledge graph update automatically. This makes the AI brain **self-updating with your codebase.**

