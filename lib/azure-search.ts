// ── TASK 2: Azure AI Search Client with Traceable Citations ───────────────────
import { SearchClient, AzureKeyCredential, SearchOptions } from "@azure/search-documents";

// ── Type Definitions ──────────────────────────────────────────────────────────
export interface MedVivaDocument {
  id: string;
  content: string;
  filename: string;          // e.g. "Pharmacology_KD_Tripathi.pdf"
  pageNumber: number;        // e.g. 142
  topic: string;             // e.g. "Pharmacology"
  chunkIndex: number;        // position of chunk within document
  contentVector: number[];   // embedding vector from text-embedding-3-small
}

export interface SearchChunk {
  content: string;
  filename: string;
  pageNumber: number;
  topic: string;
  score: number;
  // Formatted citation string ready to inject into AI response
  citation: string;
}

// ── Client Initialization ─────────────────────────────────────────────────────
function getSearchClient(): SearchClient<MedVivaDocument> {
  return new SearchClient<MedVivaDocument>(
    process.env.AZURE_SEARCH_ENDPOINT!,
    process.env.AZURE_SEARCH_INDEX_NAME!,
    new AzureKeyCredential(process.env.AZURE_SEARCH_API_KEY!)
  );
}

// ── TASK 2 CORE: Search with Metadata Extraction ─────────────────────────────
export async function searchKnowledgeBase(
  query: string,
  topic?: string,
  filename?: string,
  topK: number = 5
): Promise<SearchChunk[]> {
  try {
    const client = getSearchClient();

    let filterString = "";
    if (topic && filename) {
      // Escape single quotes in filename just in case
      const safeFilename = filename.replace(/'/g, "''");
      filterString = `topic eq '${topic}' and filename eq '${safeFilename}'`;
    } else if (topic) {
      filterString = `topic eq '${topic}'`;
    } else if (filename) {
      const safeFilename = filename.replace(/'/g, "''");
      filterString = `filename eq '${safeFilename}'`;
    }

    const searchOptions: SearchOptions<MedVivaDocument> = {
      select: ["content", "filename", "pageNumber", "topic", "chunkIndex"],
      top: topK,
      filter: filterString || undefined,
      // Use simple search — semantic config is created only after first upload
      queryType: "simple",
    };

    const results = await client.search(query || "*", searchOptions);

    const chunks: SearchChunk[] = [];
    for await (const result of results.results) {
      const doc = result.document;
      const citation = `[Source: ${doc.filename}, Page: ${doc.pageNumber}]`;
      chunks.push({
        content: doc.content,
        filename: doc.filename,
        pageNumber: doc.pageNumber,
        topic: doc.topic,
        score: result.score ?? 0,
        citation,
      });
    }

    return chunks.sort((a, b) => b.score - a.score);
  } catch (err: unknown) {
    // Index doesn't exist yet — return empty (guardrail will trigger refusal)
    if (err instanceof Error && err.message.includes("was not found")) {
      return [];
    }
    throw err;
  }
}


// ── Build Grounded Context String for System Prompt Injection ─────────────────
export function buildGroundedContext(chunks: SearchChunk[]): string {
  if (chunks.length === 0) return "";

  return chunks
    .map(
      (chunk, idx) =>
        `--- PASSAGE ${idx + 1} ${chunk.citation} ---\n${chunk.content}`
    )
    .join("\n\n");
}

// ── TASK 2: Create/Update Azure AI Search Index with Metadata Fields ──────────
// Run this ONCE to create the index schema. Call from a setup script.
export async function createSearchIndex(): Promise<void> {
  const { SearchIndexClient } = await import("@azure/search-documents");

  const indexClient = new SearchIndexClient(
    process.env.AZURE_SEARCH_ENDPOINT!,
    new AzureKeyCredential(process.env.AZURE_SEARCH_API_KEY!)
  );

  await indexClient.createOrUpdateIndex({
    name: process.env.AZURE_SEARCH_INDEX_NAME!,
    fields: [
      { name: "id",             type: "Edm.String",           key: true,        filterable: true  },
      { name: "content",        type: "Edm.String",           searchable: true, filterable: false },
      { name: "filename",       type: "Edm.String",           searchable: true, filterable: true,  facetable: true },
      { name: "pageNumber",     type: "Edm.Int32",            searchable: false, filterable: true,  sortable: true  },
      { name: "topic",          type: "Edm.String",           searchable: true,  filterable: true,  facetable: true },
      { name: "chunkIndex",     type: "Edm.Int32",            searchable: false, filterable: true  },
      {
        name: "contentVector",
        type: "Collection(Edm.Single)",
        searchable: true,
        vectorSearchDimensions: 1536,            // text-embedding-3-small dimensions
        vectorSearchProfileName: "medviva-vector-profile",
      },
    ],
    vectorSearch: {
      profiles: [{ name: "medviva-vector-profile", algorithmConfigurationName: "medviva-hnsw" }],
      algorithms: [{ name: "medviva-hnsw", kind: "hnsw", parameters: { metric: "cosine" } }],
    },
    semanticSearch: {
      configurations: [
        {
          name: "medviva-semantic-config",
          prioritizedFields: {
            contentFields: [{ name: "content" }],
            keywordsFields: [{ name: "topic" }, { name: "filename" }],
          },
        },
      ],
    },
  });

  console.log("✅ MedViva knowledge index created successfully.");
}
