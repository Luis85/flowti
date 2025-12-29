export type PaymentStatus = "new" | "collected";

export type Payment = {
  id: string;
  status: PaymentStatus;
  customer: string;
  subject: string;
  orderId: string;
  amount: number;
};

export const DAY_IN_MS = 86400000;

export type PaymentConfig = {
  paymentDelayMs: number;
  paymentJitterMs: number;
  paymentSuccessChance: number; // 0..1
  useOrderTotal: boolean;
  fixedAmount: number;
  subjectPrefix: string;
};

// used by the PaymentSystem
export const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  paymentDelayMs: DAY_IN_MS * 3,
  paymentJitterMs: DAY_IN_MS / 3,
  paymentSuccessChance: 0.98,
  useOrderTotal: true,
  fixedAmount: 10,
  subjectPrefix: "Payment received for order",
};

