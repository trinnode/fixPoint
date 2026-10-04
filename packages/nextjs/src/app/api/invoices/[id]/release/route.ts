import { releaseInvoice } from "@/lib/invoices";
import { escrowResponse, EscrowError } from "@/lib/errors";
import type { Actor } from "@/lib/hedera";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const actor = body.actor as Actor;
    if (actor !== "seller" && actor !== "buyer") {
      throw new EscrowError("BAD_INPUT", "actor must be 'seller' or 'buyer'");
    }
    const invoice = await releaseInvoice(id, { actor });
    return Response.json({ invoice });
  } catch (err) {
    return escrowResponse(err);
  }
}
