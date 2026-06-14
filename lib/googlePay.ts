/**
 * Google Pay browser-side helper.
 *
 *  ── How this works ──────────────────────────────────────────────────────────
 *  ▸ TEST mode (default): uses DIRECT tokenization in the sandbox — no fake
 *    payment gateway (which triggers OR_BIBED_06). Nothing is actually charged.
 *
 *  ▸ PRODUCTION mode: switch the env vars to use your real merchant id and
 *    your processor's gateway (e.g. 'razorpay', 'stripe', 'cashfree'). The
 *    `paymentMethodToken` returned by GPay is then forwarded to your backend
 *    where the processor charges the card and gives you a definitive result.
 *    The public root signing keys you saw in the JSON file are used by the
 *    processor on the server to verify/decrypt that token.
 */

const GPAY_SCRIPT_SRC = 'https://pay.google.com/gp/p/js/pay.js';

export type GpayEnv = 'TEST' | 'PRODUCTION';

export const GPAY_ENV: GpayEnv =
  ((import.meta.env.VITE_GOOGLE_PAY_ENV as GpayEnv) || 'TEST') === 'PRODUCTION'
    ? 'PRODUCTION'
    : 'TEST';

export const GPAY_MERCHANT_ID =
  (import.meta.env.VITE_GOOGLE_PAY_MERCHANT_ID as string | undefined) ||
  '12345678901234567890';

export const GPAY_MERCHANT_NAME =
  (import.meta.env.VITE_GOOGLE_PAY_MERCHANT_NAME as string | undefined) ||
  'Arogya Care';

export const GPAY_GATEWAY =
  (import.meta.env.VITE_GOOGLE_PAY_GATEWAY as string | undefined) || 'example';

export const GPAY_GATEWAY_MERCHANT_ID =
  (import.meta.env.VITE_GOOGLE_PAY_GATEWAY_MERCHANT_ID as string | undefined) ||
  'exampleGatewayMerchantId';

const ALLOWED_AUTH_METHODS = ['PAN_ONLY', 'CRYPTOGRAM_3DS'] as const;
const ALLOWED_CARD_NETWORKS = ['MASTERCARD', 'VISA', 'AMEX', 'DISCOVER', 'JCB', 'RUPAY'] as const;

const baseCardPaymentMethod = {
  type: 'CARD',
  parameters: {
    allowedAuthMethods: ALLOWED_AUTH_METHODS as unknown as string[],
    allowedCardNetworks: ALLOWED_CARD_NETWORKS as unknown as string[],
    billingAddressRequired: false,
  },
};

/**
 * TEST: use DIRECT tokenization so Google's sandbox never hits a fake
 * `example` gateway — that triggers OR_BIBED_06 ("merchant trouble").
 * PRODUCTION: real PAYMENT_GATEWAY + your processor credentials.
 */
const cardPaymentMethod = () => {
  if (GPAY_ENV === 'TEST') {
    return {
      ...baseCardPaymentMethod,
      tokenizationSpecification: {
        type: 'DIRECT' as const,
      },
    };
  }
  return {
    ...baseCardPaymentMethod,
    tokenizationSpecification: {
      type: 'PAYMENT_GATEWAY' as const,
      parameters: {
        gateway: GPAY_GATEWAY,
        gatewayMerchantId: GPAY_GATEWAY_MERCHANT_ID,
      },
    },
  };
};

export type GpayPaymentInput = {
  amountRupees: number;
  /** Short label shown in the GPay sheet, e.g. "Dr. Mehta consultation". */
  label: string;
  /** Optional unique transaction id (we make one if omitted). */
  transactionId?: string;
};

let _scriptPromise: Promise<void> | null = null;

/** Loads the Google Pay JS SDK once. Resolves when `window.google.payments` is ready. */
export function loadGooglePayScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  // Already available
  if ((window as any).google?.payments?.api) return Promise.resolve();
  if (_scriptPromise) return _scriptPromise;

  _scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GPAY_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Pay script')), { once: true });
      return;
    }
    const tag = document.createElement('script');
    tag.src = GPAY_SCRIPT_SRC;
    tag.async = true;
    tag.onload = () => resolve();
    tag.onerror = () => reject(new Error('Failed to load Google Pay script'));
    document.head.appendChild(tag);
  });
  return _scriptPromise;
}

/** Returns a Google PaymentsClient (creates it lazily). */
export async function getPaymentsClient(): Promise<any> {
  await loadGooglePayScript();
  const api = (window as any).google?.payments?.api;
  if (!api) throw new Error('Google Pay SDK not available.');
  return new api.PaymentsClient({ environment: GPAY_ENV });
}

/** Build the IsReadyToPayRequest (must mirror `loadPaymentData` payment methods). */
export function buildIsReadyRequest() {
  return {
    apiVersion: 2,
    apiVersionMinor: 0,
    allowedPaymentMethods: [cardPaymentMethod()],
  };
}

/** Build the PaymentDataRequest used for `loadPaymentData`. */
export function buildPaymentDataRequest(input: GpayPaymentInput) {
  const totalPrice = Math.max(0, input.amountRupees).toFixed(2);
  // In TEST + DIRECT, omit bogus merchantId — it can trigger OR_BIBED_06.
  const merchantInfo =
    GPAY_ENV === 'TEST'
      ? { merchantName: GPAY_MERCHANT_NAME }
      : { merchantId: GPAY_MERCHANT_ID, merchantName: GPAY_MERCHANT_NAME };

  return {
    apiVersion: 2,
    apiVersionMinor: 0,
    allowedPaymentMethods: [cardPaymentMethod()],
    merchantInfo,
    transactionInfo: {
      countryCode: 'IN',
      currencyCode: 'INR',
      totalPriceStatus: 'FINAL',
      totalPriceLabel: 'Total',
      totalPrice,
      checkoutOption: 'COMPLETE_IMMEDIATE_PURCHASE',
      transactionId: input.transactionId || `TX-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      displayItems: [
        {
          label: input.label,
          type: 'LINE_ITEM',
          price: totalPrice,
        },
      ],
    },
    emailRequired: false,
  };
}

/** Convenience wrapper: returns true when the user/device can pay. */
export async function canUseGooglePay(): Promise<boolean> {
  try {
    const client = await getPaymentsClient();
    const res = await client.isReadyToPay(buildIsReadyRequest());
    return Boolean(res?.result);
  } catch {
    return false;
  }
}

export type GpaySuccess = {
  /** Token id we can persist as a payment reference. */
  ref: string;
  /** Human-readable card label (e.g. "Visa •••• 1234"). */
  cardLabel?: string;
  /** Raw paymentData object for forwarding to a backend if needed. */
  raw: any;
};

/** Local demo payment — same shape as a successful GPay callback. */
export function buildMockGpaySuccess(): GpaySuccess {
  return {
    ref: `mock_gpay_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    cardLabel: 'Visa ···· 4242 (demo wallet)',
    raw: { mock: true },
  };
}

/**
 * Triggers the GPay sheet and resolves with a success object.
 * Throws if the user cancels (statusCode === 'CANCELED') or it fails.
 */
export async function payWithGooglePay(input: GpayPaymentInput): Promise<GpaySuccess> {
  const client = await getPaymentsClient();
  const data = await client.loadPaymentData(buildPaymentDataRequest(input));

  const tokenStr: string = data?.paymentMethodData?.tokenizationData?.token ?? '';
  let ref = '';
  try {
    const parsed = JSON.parse(tokenStr || '{}');
    ref = parsed?.id || parsed?.token || '';
  } catch {
    /* token may not be JSON in some test responses */
  }
  if (!ref) ref = `gpay_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

  const desc = data?.paymentMethodData?.description as string | undefined;
  return { ref, cardLabel: desc, raw: data };
}
