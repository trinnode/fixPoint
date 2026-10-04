import { publishAudit } from "@/lib/invoices";
import { escrowResponse, EscrowError } from "@/lib/errors";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.txHash !== "string" || body.txHash.length === 0) {
      throw new EscrowError("BAD_INPUT", "txHash is required");
    }
    const result = await publishAudit(body.txHash);
    return Response.json(result);
  } catch (err) {
    return escrowResponse(err);
  }
}
