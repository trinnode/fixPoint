import { getInvoice } from "@/lib/invoices";
import { escrowResponse } from "@/lib/errors";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invoice = await getInvoice(id);
    return Response.json({ invoice });
  } catch (err) {
    return escrowResponse(err);
  }
}
