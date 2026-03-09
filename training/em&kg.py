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
