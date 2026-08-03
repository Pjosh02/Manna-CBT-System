import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import fs from "fs";
import path from "path";

export async function GET(
  request: NextRequest,
  context: any
) {
  try {
    const params = await context.params;
    const id = params.id;
    if (!id) {
      return new Response("User ID is required", { status: 400 });
    }

    // Fetch the user's passportUrl from the database
    const user = await prisma.user.findUnique({
      where: { id },
      select: { passportUrl: true },
    });

    if (!user || !user.passportUrl) {
      return new Response("No passport image found", { status: 404 });
    }

    const passportUrl = user.passportUrl;

    // 1. Check if it's base64 data URL
    if (passportUrl.startsWith("data:")) {
      const match = passportUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        return new Response("Invalid image data format", { status: 400 });
      }

      const contentType = match[1];
      const base64Data = match[2];
      const fileBuffer = Buffer.from(base64Data, "base64");

      return new Response(fileBuffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // 2. Check if it's a legacy file URL (relative path like /api/uploads/filename.jpg or /uploads/filename.jpg)
    const filename = path.basename(passportUrl);
    const safeFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), "public", "uploads", safeFilename);

    if (fs.existsSync(filePath)) {
      const fileBuffer = fs.readFileSync(filePath);
      let contentType = "image/jpeg";
      const ext = path.extname(safeFilename).toLowerCase();
      
      if (ext === ".png") contentType = "image/png";
      else if (ext === ".webp") contentType = "image/webp";
      else if (ext === ".gif") contentType = "image/gif";
      else if (ext === ".svg") contentType = "image/svg+xml";

      return new Response(fileBuffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    return new Response("Image Not Found", { status: 404 });
  } catch (err: any) {
    console.error("Serve user passport error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
