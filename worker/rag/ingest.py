"""
Reads corpus.jsonl and POSTs it in batches to the Worker's
/admin/enqueue-ingest route, which just pushes each chunk onto the
`rag-ingest` Cloudflare Queue and returns immediately — the Worker's queue()
consumer does the actual embed (Workers AI) + upsert (Vectorize) work
asynchronously, with automatic retry-with-backoff on transient failures
(e.g. a secret-propagation-delay 403 right after rotating ADMIN_KEY) instead
of this script having to be re-run by hand. Failures that exhaust retries
land in the `rag-ingest-dlq` dead letter queue instead of vanishing silently.

Usage:
    ADMIN_KEY=... python ingest.py

To check whether everything actually landed in Vectorize after a run:
    npx wrangler vectorize get-vectors evgeniimatveev-corpus-m3 --ids=<some-id>
(allow a minute or two — Vectorize indexing is eventually consistent, an
empty result right after ingest doesn't necessarily mean it failed.)
"""

import json
import os
import sys
import time
import urllib.request

WORKER_URL = "https://evgeniimatveev-ask.evgeniimatveevusa.workers.dev/admin/enqueue-ingest"
CORPUS_FILE = os.path.join(os.path.dirname(__file__), "corpus.jsonl")
BATCH_SIZE = 100  # just enqueuing now, not embedding synchronously — safe to send larger batches


def load_chunks():
    chunks = []
    with open(CORPUS_FILE, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                chunks.append(json.loads(line))
    return chunks


def post_batch(batch, admin_key):
    payload = json.dumps({"chunks": batch}).encode("utf-8")
    req = urllib.request.Request(
        WORKER_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "X-Admin-Key": admin_key,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main():
    admin_key = os.environ.get("ADMIN_KEY")
    if not admin_key:
        print("Set ADMIN_KEY env var first.", file=sys.stderr)
        sys.exit(1)

    chunks = load_chunks()
    print(f"Loaded {len(chunks)} chunks.")

    total_enqueued = 0
    for i in range(0, len(chunks), BATCH_SIZE):
        batch = chunks[i : i + BATCH_SIZE]
        try:
            result = post_batch(batch, admin_key)
            total_enqueued += result.get("enqueued", 0)
            print(f"[{i + len(batch)}/{len(chunks)}] enqueued={result.get('enqueued')}")
        except Exception as e:
            print(f"[{i + len(batch)}/{len(chunks)}] FAILED: {e}", file=sys.stderr)
        time.sleep(0.1)  # gentle pacing

    print(f"Done. Total enqueued: {total_enqueued}. Processing happens async — check Vectorize in a minute or two.")


if __name__ == "__main__":
    main()
