import { expireInvoice } from "@/lib/invoices";
import { escrowResponse } from "@/lib/errors";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invoice = await expireInvoice(id);
    return Response.json({ invoice });
  } catch (err) {
    return escrowResponse(err);
  }
}
