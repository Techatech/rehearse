import Stripe from 'stripe';

export interface StripePaymentService {
  createCustomer(email: string, name: string, workosId: string): Promise<Stripe.Customer>;
  createCheckoutSession(customerId: string, priceId: string, successUrl: string, cancelUrl: string): Promise<Stripe.Checkout.Session>;
  createPortalSession(customerId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session>;
  getSubscription(subscriptionId: string): Promise<Stripe.Subscription>;
  cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription>;
  getCustomer(customerId: string): Promise<Stripe.Customer>;
  startFreeTrial(customerId: string, priceId: string): Promise<Stripe.Subscription>;
}

export function createStripePaymentService(apiKey: string): StripePaymentService {
  const stripe = new Stripe(apiKey, {
    apiVersion: '2025-10-29.clover',
  });

  return {
    /**
     * Create a new Stripe customer
     */
    async createCustomer(email: string, name: string, workosId: string): Promise<Stripe.Customer> {
      return await stripe.customers.create({
        email,
        name,
        metadata: {
          workos_id: workosId,
        },
      });
    },

    /**
     * Create a checkout session for subscription purchase
     */
    async createCheckoutSession(
      customerId: string,
      priceId: string,
      successUrl: string,
      cancelUrl: string
    ): Promise<Stripe.Checkout.Session> {
      return await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        subscription_data: {
          metadata: {
            customer_id: customerId,
          },
        },
      });
    },

    /**
     * Create a billing portal session for subscription management
     */
    async createPortalSession(customerId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session> {
      return await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });
    },

    /**
     * Get subscription details
     */
    async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
      return await stripe.subscriptions.retrieve(subscriptionId);
    },

    /**
     * Cancel a subscription
     */
    async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
      return await stripe.subscriptions.cancel(subscriptionId);
    },

    /**
     * Get customer details
     */
    async getCustomer(customerId: string): Promise<Stripe.Customer> {
      return await stripe.customers.retrieve(customerId) as Stripe.Customer;
    },

    /**
     * Start a 3-day free trial for Pro subscription
     */
    async startFreeTrial(customerId: string, priceId: string): Promise<Stripe.Subscription> {
      // Create subscription with 3-day trial
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        trial_period_days: 3,
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription',
        },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          trial_type: 'pro_trial',
        },
      });

      return subscription;
    },
  };
}
