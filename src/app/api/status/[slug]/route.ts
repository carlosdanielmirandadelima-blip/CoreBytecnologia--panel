import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const page = await prisma.statusPage.findUnique({
    where: { slug: params.slug },
    include: {
      monitors: {
        include: { checks: { orderBy: { createdAt: "desc" }, take: 30 } },
      },
    },
  });

  if (!page || !page.isPublic) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(page);
}
