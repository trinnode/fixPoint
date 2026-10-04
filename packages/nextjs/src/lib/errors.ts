// Typed errors that mirror the custom errors in FixpointEscrow.sol. The API
// surfaces the code to the client so the UI can show a precise, honest message
// instead of a generic 500.

export type EscrowErrorCode =
  | "INVOICE_NOT_FOUND"
  | "INVOICE_NOT_PAYABLE"
  | "INVOICE_EXPIRED"
  | "INVOICE_ALREADY_PAID"
  | "NOT_SELLER"
  | "NOT_BUYER"
  | "SELLER_CANNOT_PAY"
  | "REVIEW_WINDOW_NOT_PASSED"
  | "PRICE_REJECTED"
  | "RECEIPT_NOT_ASSOCIATED"
  | "INSUFFICIENT_PAYMENT"
  | "INVOICE_NOT_EXPIRED"
  | "BAD_INPUT"
  | "PYTH_UNAVAILABLE";

export class EscrowError extends Error {
  constructor(
    public code: EscrowErrorCode,
    message: string,
    public status = 400
  ) {
    super(message);
    this.name = "EscrowError";
  }
}

export function escrowResponse(err: unknown) {
  if (err instanceof EscrowError) {
    return Response.json(
      { error: { code: err.code, message: err.message } },
      { status: err.status }
    );
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  return Response.json({ error: { code: "BAD_INPUT", message } }, { status: 500 });
}
