# Persistent Memory System Design

Reference doc for implementing ChatGPT/Grok-style persistent memory using OpenRouter embeddings + ChromaDB.

## Architecture

```
User Message → Extract Facts → Embed via OpenRouter → Store in ChromaDB
                                                            ↓
System Prompt ← Inject Relevant Memories ← Query ChromaDB ← User Query
```

## OpenRouter Embeddings API

**Endpoint:** `POST https://openrouter.ai/api/v1/embeddings`

**Model:** `google/gemini-embedding-001` (768 dims, ~$0.01/1M tokens)

```python
async def get_embeddings(texts: list[str]) -> list[list[float]]:
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/embeddings",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "google/gemini-embedding-001",
                "input": texts  # Can be array for batch
            }
        )
        data = response.json()
        return [item["embedding"] for item in data["data"]]
```

## ChromaDB Storage

```python
import chromadb

client = chromadb.PersistentClient(path="./data/chroma")
memories = client.get_or_create_collection(
    name="user_memories",
    metadata={"hnsw:space": "cosine"}
)

# Store
memories.add(
    ids=["mem_001"],
    documents=["User prefers dark mode"],
    embeddings=[[0.1, 0.2, ...]],  # From OpenRouter
    metadatas=[{"user_id": "abc123"}]
)

# Query
results = memories.query(
    query_embeddings=[[0.1, 0.2, ...]],
    n_results=5,
    where={"user_id": "abc123"}
)
```

## Memory Service Class

```python
class MemoryService:
    def __init__(self, api_key: str, db_path: str = "./data/chroma"):
        self._api_key = api_key
        self._client = chromadb.PersistentClient(path=db_path)
        self._collection = self._client.get_or_create_collection("user_memories")
    
    async def store(self, user_id: str, fact: str):
        embedding = await self._embed([fact])
        self._collection.add(
            ids=[f"mem_{user_id}_{hash(fact)}"],
            documents=[fact],
            embeddings=embedding,
            metadatas=[{"user_id": user_id}]
        )
    
    async def search(self, user_id: str, query: str, n: int = 5) -> list[str]:
        embedding = await self._embed([query])
        results = self._collection.query(
            query_embeddings=embedding,
            n_results=n,
            where={"user_id": user_id}
        )
        return results["documents"][0] if results["documents"] else []
    
    async def _embed(self, texts: list[str]) -> list[list[float]]:
        # Call OpenRouter embeddings API
        ...
```

## Integration Points

1. **Extraction**: Use LLM to detect memorable facts from conversation
2. **Injection**: Prepend relevant memories to system prompt
3. **Management**: API endpoints for users to view/delete memories

## Dependencies

```
pip install chromadb httpx
```

## Cost Estimate

| Model | Dims | $/1M tokens |
|-------|------|-------------|
| google/gemini-embedding-001 | 768 | ~$0.01 |
| openai/text-embedding-3-small | 1536 | $0.02 |
| openai/text-embedding-3-large | 3072 | $0.13 |
