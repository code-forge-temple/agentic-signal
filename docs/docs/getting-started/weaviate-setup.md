# Weaviate Setup

Use a local Weaviate instance as the vector database for RAG workflows in `Agentic Signal`.

## Run Weaviate with Docker

The following Docker command starts Weaviate with persistence, anonymous access, and no built-in vectorizer module:

```sh
docker run -d \
  --name weaviate \
  --restart unless-stopped \
  -p 8080:8080 \
  -p 50051:50051 \
  -v weaviate_data:/var/lib/weaviate \
  -e PERSISTENCE_DATA_PATH=/var/lib/weaviate \
  -e AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=true \
  -e DEFAULT_VECTORIZER_MODULE=none \
  -e RAFT_BOOTSTRAP_EXPECT=1 \
  -e ENABLE_API_BASED_MODULES=false \
  -e QUERY_DEFAULTS_LIMIT=25 \
  -e CLUSTER_HOSTNAME=node1 \
  -e DISABLE_TELEMETRY=true \
  cr.weaviate.io/semitechnologies/weaviate:1.37.0
```

### Important port note for local development

If you run `Agentic Signal` locally, the frontend also uses port `8080`. To avoid a port conflict, start Weaviate on host port `9090` instead:

```sh
docker run -d \
  --name weaviate \
  --restart unless-stopped \
  -p 9090:8080 \
  -p 50051:50051 \
  -v weaviate_data:/var/lib/weaviate \
  -e PERSISTENCE_DATA_PATH=/var/lib/weaviate \
  -e AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=true \
  -e DEFAULT_VECTORIZER_MODULE=none \
  -e RAFT_BOOTSTRAP_EXPECT=1 \
  -e ENABLE_API_BASED_MODULES=false \
  -e QUERY_DEFAULTS_LIMIT=25 \
  -e CLUSTER_HOSTNAME=node1 \
  -e DISABLE_TELEMETRY=true \
  cr.weaviate.io/semitechnologies/weaviate:1.37.0
```

Then point your `Agentic Signal` Weaviate integration to `http://localhost:9090`.

:::info Note
- `RAFT_BOOTSTRAP_EXPECT=1` is required for single-node Weaviate 1.25+ so the node can elect itself as leader. Without it, schema requests can fail with `leader not found`.
- `AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=true` allows `Agentic Signal` to connect without additional Weaviate auth. You can remove this setting if you want to require authentication and pass credentials via the [RAG node](/docs/nodes/ai/rag)'s `API Key (optional)` field instead.
- `DEFAULT_VECTORIZER_MODULE=none` is useful when using an external embeddings service.
- Keep `DISABLE_TELEMETRY=true` enabled if you want to avoid automatic telemetry from Weaviate.
:::