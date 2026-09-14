import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Form, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import stylesheet from "../styles/pricing.css?url";

export const links = () => [{ rel: "stylesheet", href: stylesheet }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing } = await authenticate.admin(request);
  let activePlan = "free";

  try {
    const { hasActivePayment, appSubscriptions } = await billing.check({
      plans: ["basic", "pro", "enterprise"],
      isTest: true,
    });
    if (hasActivePayment && appSubscriptions.length > 0) {
      activePlan = appSubscriptions[0].name;
    }
  } catch (err) {
    console.error("[Pricing Loader] Failed to check billing status:", err);
  }

  return { activePlan };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing } = await authenticate.admin(request);
  const formData = await request.formData();
  const plan = formData.get("plan") as string;

  if (plan === "free") {
    try {
      const { hasActivePayment, appSubscriptions } = await billing.check({
        plans: ["basic", "pro", "enterprise"],
        isTest: true,
      });
      if (hasActivePayment && appSubscriptions.length > 0) {
        await billing.cancel({
          subscriptionId: appSubscriptions[0].id,
          isTest: true,
        });
      }
    } catch (err) {
      console.error("[Pricing Action] Failed to cancel subscription:", err);
    }
    return { success: true };
  }

  // Request subscription redirect
  return await billing.request({
    plan,
    isTest: true,
    returnUrl: "https://admin.shopify.com/store/cars1-egr58mjc/apps/product-seo-auditor",
  });
};

export default function PricingPage() {
  const { activePlan } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";

  return (
    <div className="pricing-page">
      <div className="pricing-header">
        <h1 className="pricing-title">💎 App Subscription Plans</h1>
        <p className="pricing-subtitle">
          Scale your Shopify store product SEO audits with a plan that fits your growth. Start with a 7-day free trial.
        </p>
      </div>

      <div className="pricing-grid">
        {/* Free Plan */}
        <div className={`plan-card ${activePlan === "free" ? "plan-card--pro" : ""}`}>
          <h2 className="plan-name">Free Plan</h2>
          <div className="plan-price-box">
            <span className="plan-price">$0</span>
            <span className="plan-period">/month</span>
          </div>
          <p className="plan-desc">For small stores starting out to test basic SEO metrics.</p>
          <ul className="plan-features">
            <li className="feature-item"><span className="feature-icon">✓</span> Scan up to 10 products</li>
            <li className="feature-item"><span className="feature-icon">✓</span> Detailed SEO Health Score</li>
            <li className="feature-item"><span className="feature-icon">✓</span> Basic issues overview</li>
          </ul>
          {activePlan === "free" ? (
            <button className="plan-action-btn plan-action-btn--active" disabled>Active Plan</button>
          ) : (
            <Form method="POST">
              <input type="hidden" name="plan" value="free" />
              <button type="submit" className="plan-action-btn" disabled={isSubmitting}>
                {isSubmitting ? "Changing..." : "Downgrade to Free"}
              </button>
            </Form>
          )}
        </div>

        {/* Basic Plan */}
        <div className={`plan-card ${activePlan === "basic" ? "plan-card--pro" : ""}`}>
          <h2 className="plan-name">Basic Plan</h2>
          <div className="plan-price-box">
            <span className="plan-price">$9.99</span>
            <span className="plan-period">/month</span>
          </div>
          <p className="plan-desc">Ideal for small growing stores with moderate product catalogs.</p>
          <ul className="plan-features">
            <li className="feature-item"><span className="feature-icon">✓</span> Scan up to 100 products</li>
            <li className="feature-item"><span className="feature-icon">✓</span> Detailed SEO reports</li>
            <li className="feature-item"><span className="feature-icon">✓</span> Title & Meta recommendations</li>
            <li className="feature-item"><span className="feature-icon">✓</span> Scan history persistence</li>
          </ul>
          {activePlan === "basic" ? (
            <button className="plan-action-btn plan-action-btn--active" disabled>Active Plan</button>
          ) : (
            <Form method="POST">
              <input type="hidden" name="plan" value="basic" />
              <button type="submit" className="plan-action-btn plan-action-btn--primary" disabled={isSubmitting}>
                {isSubmitting ? "Redirecting..." : "Subscribe to Basic"}
              </button>
            </Form>
          )}
        </div>

        {/* Pro Plan */}
        <div className={`plan-card plan-card--pro ${activePlan === "pro" ? "plan-card--active" : ""}`}>
          <div className="plan-badge">Most Popular</div>
          <h2 className="plan-name">Pro Plan</h2>
          <div className="plan-price-box">
            <span className="plan-price">$19.99</span>
            <span className="plan-period">/month</span>
          </div>
          <p className="plan-desc">Perfect for active merchants who want full SEO capabilities without limits.</p>
          <ul className="plan-features">
            <li className="feature-item"><span className="feature-icon">✓</span> Scan unlimited products</li>
            <li className="feature-item"><span className="feature-icon">✓</span> Advanced bulk recommendations</li>
            <li className="feature-item"><span className="feature-icon">✓</span> Full scan history & trends</li>
            <li className="feature-item"><span className="feature-icon">✓</span> Priority SEO Audit speed</li>
          </ul>
          {activePlan === "pro" ? (
            <button className="plan-action-btn plan-action-btn--active" disabled>Active Plan</button>
          ) : (
            <Form method="POST">
              <input type="hidden" name="plan" value="pro" />
              <button type="submit" className="plan-action-btn plan-action-btn--primary" disabled={isSubmitting}>
                {isSubmitting ? "Redirecting..." : "Subscribe to Pro"}
              </button>
            </Form>
          )}
        </div>
      </div>
    </div>
  );
}
