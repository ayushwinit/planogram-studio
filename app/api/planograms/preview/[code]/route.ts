import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/dal";
import { presignedPlanogramPreviewUrl } from "@/lib/s3";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { code } = await ctx.params;
  if (!code || code.length > 64) return new NextResponse("Bad request", { status: 400 });

  const result = await db.query<{ planogram_id: string }>(
    `SELECT planogram_id FROM planograms
      WHERE tenant_id = $1 AND preview_image_url = $2
      LIMIT 1`,
    [session.tenantId, code],
  );
  if (result.rows.length === 0) {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = await presignedPlanogramPreviewUrl(code, 300);
  return NextResponse.redirect(url, { status: 307 });
}
