import { useEffect, useRef, useState } from 'react';
import {
  canUseGooglePay,
  getPaymentsClient,
  payWithGooglePay,
  buildPaymentDataRequest,
  type GpaySuccess,
  type GpayPaymentInput,
  GPAY_ENV,
} from '../lib/googlePay';

type Props = {
  amountRupees: number;
  label: string;
  /** Disable the button (e.g. form not yet valid). */
  disabled?: boolean;
  onPaying?: () => void;
  onSuccess: (result: GpaySuccess) => void;
  onError?: (err: Error) => void;
  /** Called when the user dismisses the GPay sheet. */
  onCancel?: () => void;
  buttonType?: 'pay' | 'book' | 'plain' | 'buy';
  /** Fallback button label when GPay isn't available on this device. */
  fallbackLabel?: string;
  /** Called when user clicks the fallback button (no GPay available). */
  onFallback?: () => void;
};

/**
 * Renders the **official** Google Pay button using the SDK's
 * `paymentsClient.createButton` (which conforms to GPay's brand guidelines).
 * Falls back to a styled button when GPay is unavailable in the browser.
 */
export const GooglePayButton = ({
  amountRupees,
  label,
  disabled,
  onPaying,
  onSuccess,
  onError,
  onCancel,
  buttonType = 'pay',
  fallbackLabel,
  onFallback,
}: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await canUseGooglePay();
      if (!cancelled) setAvailable(ok);
    })();
    return () => { cancelled = true; };
  }, []);

  // Mount the official button once we know the device supports GPay.
  useEffect(() => {
    if (!available || !containerRef.current) return;
    let mounted = true;

    (async () => {
      try {
        const client = await getPaymentsClient();
        if (!mounted || !containerRef.current) return;
        // Clear any previous render (HMR / re-renders).
        containerRef.current.innerHTML = '';
        const button = client.createButton({
          buttonType,
          buttonColor: 'default',
          buttonSizeMode: 'fill',
          onClick: handlePay,
          allowedPaymentMethods: buildPaymentDataRequest({ amountRupees, label }).allowedPaymentMethods,
        });
        containerRef.current.appendChild(button);
      } catch (e: any) {
        onError?.(e instanceof Error ? e : new Error(String(e?.message || e)));
      }
    })();

    return () => { mounted = false; };
    // Re-render the button when amount/label/disable state change so its click
    // handler captures fresh values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, amountRupees, label, disabled]);

  const handlePay = async () => {
    if (disabled || busy) return;
    setBusy(true);
    onPaying?.();
    try {
      const input: GpayPaymentInput = { amountRupees, label };
      const result = await payWithGooglePay(input);
      onSuccess(result);
    } catch (e: any) {
      const code = e?.statusCode || e?.code;
      if (code === 'CANCELED') {
        onCancel?.();
      } else {
        onError?.(e instanceof Error ? e : new Error(String(e?.message || e)));
      }
    } finally {
      setBusy(false);
    }
  };

  if (available === null) {
    return (
      <div className="h-11 rounded-full bg-white/[0.05] animate-pulse" aria-hidden />
    );
  }

  if (!available) {
    return (
      <button
        type="button"
        onClick={onFallback}
        disabled={disabled || busy}
        className="w-full h-11 rounded-full text-sm font-black text-white transition active:scale-95 disabled:opacity-40"
        style={{
          background: 'linear-gradient(135deg,#10b981,#0891b2)',
          boxShadow: '0 0 20px rgba(16,185,129,0.35)',
        }}
      >
        {fallbackLabel || `Pay ₹${amountRupees}`}
      </button>
    );
  }

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className={[
          'gpay-button-container w-full',
          disabled || busy ? 'pointer-events-none opacity-50' : '',
        ].join(' ')}
      />
      {GPAY_ENV === 'TEST' && (
        <div className="mt-1 text-[9px] font-bold uppercase tracking-widest text-amber-300/70 text-center">
          Sandbox · Test mode
        </div>
      )}
    </div>
  );
};
