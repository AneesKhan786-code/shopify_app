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

interface GqlProductByIdResponse {
  data?: {
    product: GqlProductNode | null;
  };
  errors?: Array<{ message: string }>;
}

// ── GraphQL queries ───────────────────────────────────────────────────────────

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

const PRODUCT_BY_ID_QUERY = `#graphql
  query GetProductById($id: ID!) {
    product(id: $id) {
      id
      title
      description
      handle
      status
      images(first: 10) {
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
`;

/** Maximum products per GraphQL page — Shopify's hard limit is 250. */
const PAGE_SIZE = 250;

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapNode(node: GqlProductNode): ScannedProduct {
  return {
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
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetches every product in the store using cursor-based pagination.
 * Automatically iterates through all pages until hasNextPage = false or limit is reached.
 *
 * @param admin - Shopify admin client.
 * @param limit - Optional limit on the number of products to fetch.
 * @throws {Error} If any GraphQL page request fails or returns errors.
 * @returns Flat array of ScannedProduct records.
 */
export async function fetchAllProducts(
  admin: AdminClient,
  limit?: number
): Promise<ScannedProduct[]> {
  const collected: ScannedProduct[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;
  let pageNumber = 0;

  while (hasNextPage) {
    pageNumber++;
    
    // Determine number of items to fetch for this page based on limit
    const toFetch = limit 
      ? Math.min(PAGE_SIZE, limit - collected.length) 
      : PAGE_SIZE;

    if (toFetch <= 0) {
      break;
    }

    const variables: Record<string, unknown> = { first: toFetch };
    if (cursor !== null) variables.after = cursor;

    const response = await admin.graphql(PRODUCTS_QUERY, { variables });
    const json = (await response.json()) as GqlProductsResponse;

    if (json.errors && json.errors.length > 0) {
      throw new Error(
        `GraphQL error on page ${pageNumber}: ${json.errors[0].message}`
      );
    }

    if (!json.data?.products) {
      throw new Error(
        `Unexpected response on page ${pageNumber} — missing products field`
      );
    }

    const { nodes, pageInfo } = json.data.products;
    for (const node of nodes) {
      collected.push(mapNode(node));
    }

    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }

  return collected;
}

/**
 * Fetches a single product by its Shopify Global ID (GID).
 *
 * @param gid - Full Shopify GID, e.g. "gid://shopify/Product/8173749067039"
 * @returns The ScannedProduct, or null if the product does not exist.
 * @throws {Error} If the GraphQL request itself fails.
 */
export async function fetchProductById(
  admin: AdminClient,
  gid: string
): Promise<ScannedProduct | null> {
  const response = await admin.graphql(PRODUCT_BY_ID_QUERY, {
    variables: { id: gid },
  });
  const json = (await response.json()) as GqlProductByIdResponse;

  if (json.errors && json.errors.length > 0) {
    throw new Error(`GraphQL error: ${json.errors[0].message}`);
  }

  const node = json.data?.product;
  if (!node) return null;

  return mapNode(node);
}
