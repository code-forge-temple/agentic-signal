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
## Sharing Weaviate: Roles, Audit Logs and Backups

The setup above has no authentication: anyone who can reach the port can read, change or delete every collection. That's fine on your own machine. For a Weaviate that several people share, set up the following too.

**The RAG node's [owner key](/docs/nodes/ai/rag#owner-key-and-deleting-collections)** stops people from accidentally changing or deleting each other's collections in Agentic Signal. It isn't access control: anyone with the Weaviate API key can still change any collection directly in Weaviate. Real access control comes from Weaviate itself.

### An API key per person, with roles

1. Turn on API-key authentication and role-based access control (RBAC), and remove `AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=true`. See [Enable and configure RBAC](https://docs.weaviate.io/deploy/configuration/configuring-rbac); the setting names differ between Weaviate versions (the docs use both `AUTHORIZATION_RBAC_ENABLED` and `AUTHORIZATION_ENABLE_RBAC`), so check them for yours.
2. Give each person their own Weaviate user and API key. With `AUTHENTICATION_DB_USERS_ENABLED=true`, users can be added and removed without restarting Weaviate ([Manage users](https://docs.weaviate.io/weaviate/configuration/rbac/manage-users)).
3. Give each user a role: read-only for people who only ask questions, read-write for those who maintain the content. A team's rights can be limited to its own collections by a name pattern, such as `Engineering*` for collections named `engineering_…`. A pattern like that also covers each collection's `…Meta` class, which the RAG node needs to read too.
4. Each person enters their own key in the RAG node's `API Key` field, and saves it in [Settings → Credentials](./configuration#credentials).

### Who did what: the audit log

With Weaviate's roles turned on and a Weaviate API key per person, Weaviate logs every decision on whether to allow a request. Each entry has the user, the action (create, read, update, delete), the collection, and whether it was allowed or refused. A collection deletion appears there under the deleting user's name. Two limits: it records who was allowed or refused to do what, not what the data looked like before, and keeping and searching the logs depends on how you store Weaviate's logs ([Logging](https://docs.weaviate.io/deploy/configuration/logging)).

### Regular backups

The audit log tells you who deleted or changed something, not what was there before. To get data back after a mistake, back Weaviate up regularly, and keep copies off the machine.

- **To a folder:** start Weaviate with `-e ENABLE_MODULES=backup-filesystem -e BACKUP_FILESYSTEM_PATH=/var/lib/weaviate/backups` (on a mounted volume), then create a backup with a unique id, for example from a scheduled task:

  ```bash
  curl -X POST http://localhost:9090/v1/backups/filesystem \
    -H "Content-Type: application/json" \
    -d '{"id": "backup-2026-11-14"}'
  ```

  Add `-H "Authorization: Bearer <admin API key>"` once authentication is on. A backup is restored with `POST /v1/backups/filesystem/<id>/restore`.
- **To cloud storage:** Weaviate also has backup modules for S3, Google Cloud Storage and Azure.

See [Backups](https://docs.weaviate.io/deploy/configuration/backups) for the details, including restoring only some collections.
