import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { deleteShopScanHistory } from "../lib/scan-history.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  // Delete all scan history for this shop regardless of session state.
  // This is both a data hygiene requirement and pre-emptive GDPR compliance.
  // The .catch() ensures session cleanup above is never blocked by a DB failure.
  await deleteShopScanHistory(shop).catch((err) => {
    console.error(`[Webhook] Failed to delete scan history for ${shop}:`, err);
  });

  return new Response();
};
