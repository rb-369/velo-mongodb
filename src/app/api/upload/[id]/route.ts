import { NextResponse } from "next/server";
import { collections } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return new NextResponse("Image ID required", { status: 400 });
    }

    const doc = await collections.uploads.findOne({ id });
    if (!doc || !doc.data) {
      return new NextResponse("Image not found", { status: 404 });
    }

    const buffer = Buffer.isBuffer(doc.data)
      ? doc.data
      : Buffer.from((doc.data as any).buffer || doc.data);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": doc.contentType || "image/jpeg",
        "Content-Length": String(buffer.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error serving uploaded image:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
