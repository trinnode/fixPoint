import { createInvoice, listInvoices } from "@/lib/invoices";
import { escrowResponse, EscrowError } from "@/lib/errors";
import { SELLER_ADDR } from "@/lib/hedera";

export async function GET() {
  const invoices = await listInvoices();
  return Response.json({ invoices });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      throw new EscrowError("BAD_INPUT", "Expected JSON body");
    }
    const usdCents = Number(body.usdCents);
    const payByTs = Number(body.payByTs);
    const reviewSec = Number(body.reviewSec);
    const deliveryTs = body.deliveryTs ? Number(body.deliveryTs) : null;
    const memo = typeof body.memo === "string" ? body.memo : "";
    const metaHash = typeof body.metaHash === "string" ? body.metaHash : undefined;
    const sellerAddr = typeof body.sellerAddr === "string" ? body.sellerAddr : SELLER_ADDR;

    if (!Number.isInteger(usdCents)) {
      throw new EscrowError("BAD_INPUT", "usdCents must be an integer number of cents");
    }
    if (!Number.isFinite(payByTs) || payByTs <= 0) {
      throw new EscrowError("BAD_INPUT", "payByTs must be a unix timestamp in seconds");
    }
    if (!Number.isFinite(reviewSec) || reviewSec < 0) {
      throw new EscrowError("BAD_INPUT", "reviewSec must be a number of seconds");
    }

    const invoice = await createInvoice({
      sellerAddr,
      usdCents,
      payByTs,
      reviewSec,
      deliveryTs,
      memo,
      metaHash,
    });
    return Response.json({ invoice }, { status: 201 });
  } catch (err) {
    return escrowResponse(err);
  }
}
