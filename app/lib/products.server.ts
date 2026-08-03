// ── Product SEO Auditor — Server-only GraphQL functions ───────────────────────
// This module must only be imported in server-side code (loaders / actions).
// It is never bundled into the client.

import type { ScannedProduct } from "../types/products";

// ── Minimal interface for the Shopify Admin GraphQL client ────────────────────
// Matches the shape returned by authenticate.admin(request).admin
// without importing internal Shopify SDK types directly.
interface AdminClient {
  graphql(
    query: string,
    options?: { variables?: Record<string, unknown> }
  ): Promise<{ json(): Promise<unknown> }>;
}

// ── Internal GraphQL response shapes ─────────────────────────────────────────

interface GqlProductImageNode {
  id: string;
  url: string;
  altText: string | null;
}

interface GqlProductNode {
  id: string;
  title: string;
  description: string;
  handle: string;
  status: string;
  images: { nodes: GqlProductImageNode[] };
  seo: { title: string | null; description: string | null } | null;
}

interface GqlProductsResponse {
  data?: {
    products: {
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
      nodes: GqlProductNode[];
    };
  };
  errors?: Array<{ message: string }>;
}

// ── GraphQL query ─────────────────────────────────────────────────────────────

const PRODUCTS_QUERY = `#graphql
  query GetProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        description
        handle
        status
        images(first: 1) {
          nodes {
            id
            url
            altText
          }
        }
        seo {
          title
          description
        }
      }
    }
  }
`;

/** Maximum products per GraphQL page — Shopify's hard limit is 250. */
const PAGE_SIZE = 250;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetches every product in the store using cursor-based pagination.
 * Automatically iterates through all pages until hasNextPage = false.
 *
 * @throws {Error} If any GraphQL page request fails or returns errors.
 * @returns Flat array of all ScannedProduct records.
 */
export async function fetchAllProducts(
  admin: AdminClient
): Promise<ScannedProduct[]> {
  const collected: ScannedProduct[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;
  let pageNumber = 0;

  while (hasNextPage) {
    pageNumber++;
    const variables: Record<string, unknown> = { first: PAGE_SIZE };
    if (cursor !== null) variables.after = cursor;

    const response = await admin.graphql(PRODUCTS_QUERY, { variables });
    const json = (await response.json()) as GqlProductsResponse;

    // Surface GraphQL-level errors immediately
    if (json.errors && json.errors.length > 0) {
      throw new Error(
        `GraphQL error on page ${pageNumber}: ${json.errors[0].message}`
      );
    }

    if (!json.data?.products) {
      throw new Error(
        `Unexpected response shape on page ${pageNumber} — missing products field`
      );
    }

    const { nodes, pageInfo } = json.data.products;

    for (const node of nodes) {
      collected.push({
        id: node.id,
        title: node.title,
        description: node.description ?? "",
        handle: node.handle,
        status: node.status as ScannedProduct["status"],
        images: node.images.nodes.map((img) => ({
          id: img.id,
          url: img.url,
          altText: img.altText,
        })),
        seo: {
          title: node.seo?.title ?? null,
          description: node.seo?.description ?? null,
        },
      });
    }

    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }

  return collected;
}
