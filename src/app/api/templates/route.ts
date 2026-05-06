import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { templates, getTemplatesByCategory } from "@/lib/templates";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const grouped = searchParams.get("grouped");

  if (grouped === "true") {
    return NextResponse.json(getTemplatesByCategory());
  }

  return NextResponse.json(templates);
}
