const PAYSTACK_INLINE_SRC = "https://js.paystack.co/v1/inline.js";

export const loadPaystackInline = () => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Payment is only available in the browser"));
  }
  if (window.PaystackPop) return Promise.resolve(window.PaystackPop);

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${PAYSTACK_INLINE_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.PaystackPop) resolve(window.PaystackPop);
        else reject(new Error("Payment checkout is unavailable"));
      }, { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load payment checkout")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = PAYSTACK_INLINE_SRC;
    script.async = true;
    script.onload = () => {
      if (window.PaystackPop) resolve(window.PaystackPop);
      else reject(new Error("Payment checkout is unavailable"));
    };
    script.onerror = () => reject(new Error("Could not load payment checkout"));
    document.body.appendChild(script);
  });
};

export const channelsForMethod = (method) => {
  if (method === "bank") return ["bank_transfer", "bank"];
  if (method === "ussd") return ["ussd"];
  return ["card"];
};

export const openPaystackInline = async ({
  key,
  email,
  amountKobo,
  amount,
  reference,
  currency = "NGN",
  method,
  metadata,
}) => {
  const PaystackPop = await loadPaystackInline();
  if (!PaystackPop) throw new Error("Payment checkout is unavailable");

  const resolvedAmount = Number.isInteger(amountKobo) && amountKobo > 0
    ? amountKobo
    : Math.round(Number(amount || 0) * 100);

  if (!resolvedAmount || resolvedAmount <= 0) {
    throw new Error("Invalid payment amount");
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      fn(value);
    };

    const options = {
      key,
      email,
      amount: resolvedAmount,
      ref: reference,
      currency,
      channels: channelsForMethod(method),
      metadata: metadata || {},
      callback: (response) => finish(resolve, { status: "success", response }),
      onClose: () => finish(resolve, { status: "closed" }),
    };

    try {
      if (typeof PaystackPop.setup === "function") {
        const handler = PaystackPop.setup(options);
        if (handler && typeof handler.openIframe === "function") {
          handler.openIframe();
          return;
        }
      }
      if (typeof PaystackPop.newTransaction === "function") {
        PaystackPop.newTransaction({
          ...options,
          onSuccess: (response) => finish(resolve, { status: "success", response }),
          onCancel: () => finish(resolve, { status: "closed" }),
        });
        return;
      }
      throw new Error("Unsupported payment checkout API");
    } catch (error) {
      finish(reject, error);
    }
  });
};
