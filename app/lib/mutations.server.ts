// ── Product SEO Auditor — Shopify Admin GraphQL Mutations ─────────────────────
// Server-only module. Never imported by client code.
// All mutations go through authenticate.admin() — auth is always enforced.

import type { MutationResult } from "../types/products";

interface AdminClient {
  graphql(
    query: string,
    options?: { variables?: Record<string, unknown> }
  ): Promise<{ json(): Promise<unknown> }>;
}

// ── Internal response shapes ──────────────────────────────────────────────────

interface UserError {
  field: string[] | null;
  message: string;
}

interface ProductUpdateResponse {
  data?: {
    productUpdate: {
      product: { id: string } | null;
      userErrors: UserError[];
    };
  };
  errors?: Array<{ message: string }>;
}

interface MediaUpdateResponse {
  data?: {
    productUpdateMedia: {
      media: unknown[];
      mediaUserErrors: Array<{ field: string[] | null; message: string }>;
    };
  };
  errors?: Array<{ message: string }>;
}

// ── Mutations ─────────────────────────────────────────────────────────────────

const UPDATE_PRODUCT_MUTATION = `#graphql
  mutation UpdateProduct($input: ProductInput!) {
    productUpdate(input: $input) {
      product {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const UPDATE_PRODUCT_MEDIA_MUTATION = `#graphql
  mutation UpdateProductMedia($productId: ID!, $media: [UpdateMediaInput!]!) {
    productUpdateMedia(productId: $productId, media: $media) {
      media {
        ... on MediaImage {
          id
        }
      }
      mediaUserErrors {
        field
        message
      }
    }
  }
`;

// ── Helper ────────────────────────────────────────────────────────────────────

function firstError(errors?: UserError[]): string | undefined {
  return errors && errors.length > 0 ? errors[0].message : undefined;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Updates the SEO title and/or meta description for a Shopify product.
 * Pass only the fields you want to change — the other field is left untouched.
 */
export async function updateProductSeo(
  admin: AdminClient,
  productId: string,
  fields: { title?: string; description?: string }
): Promise<MutationResult> {
  const response = await admin.graphql(UPDATE_PRODUCT_MUTATION, {
    variables: {
      input: {
        id: productId,
        seo: fields,
      },
    },
  });

  const json = (await response.json()) as ProductUpdateResponse;

  if (json.errors && json.errors.length > 0) {
    return { ok: false, error: json.errors[0].message };
  }

  const userErrors = json.data?.productUpdate?.userErrors;
  const userError = firstError(userErrors);
  if (userError) return { ok: false, error: userError };

  if (!json.data?.productUpdate?.product) {
    return { ok: false, error: "Product not found or update was rejected." };
  }

  return { ok: true };
}

/**
 * Updates the HTML description body of a Shopify product.
 * The provided text is wrapped in <p> tags to produce valid HTML.
 */
export async function updateProductDescription(
  admin: AdminClient,
  productId: string,
  description: string
): Promise<MutationResult> {
  // Wrap plain text in paragraph tags if it doesn't already contain HTML
  const descriptionHtml = description.trim().startsWith("<")
    ? description.trim()
    : `<p>${description.trim()}</p>`;

  const response = await admin.graphql(UPDATE_PRODUCT_MUTATION, {
    variables: {
      input: {
        id: productId,
        descriptionHtml,
      },
    },
  });

  const json = (await response.json()) as ProductUpdateResponse;

  if (json.errors && json.errors.length > 0) {
    return { ok: false, error: json.errors[0].message };
  }

  const userErrors = json.data?.productUpdate?.userErrors;
  const userError = firstError(userErrors);
  if (userError) return { ok: false, error: userError };

  return { ok: true };
}

/**
 * Updates the alt text of a specific product media image.
 *
 * @param productId   - Shopify GID of the product, e.g. "gid://shopify/Product/..."
 * @param mediaId     - Shopify GID of the MediaImage, e.g. "gid://shopify/MediaImage/..."
 * @param altText     - New alt text string (empty string clears the alt text)
 */
export async function updateImageAltText(
  admin: AdminClient,
  productId: string,
  mediaId: string,
  altText: string
): Promise<MutationResult> {
  const response = await admin.graphql(UPDATE_PRODUCT_MEDIA_MUTATION, {
    variables: {
      productId,
      media: [{ id: mediaId, alt: altText }],
    },
  });

  const json = (await response.json()) as MediaUpdateResponse;

  if (json.errors && json.errors.length > 0) {
    return { ok: false, error: json.errors[0].message };
  }

  const mediaErrors = json.data?.productUpdateMedia?.mediaUserErrors;
  if (mediaErrors && mediaErrors.length > 0) {
    return { ok: false, error: mediaErrors[0].message };
  }

  return { ok: true };
}
