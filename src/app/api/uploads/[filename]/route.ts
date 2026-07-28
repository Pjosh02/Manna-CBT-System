import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
  request: NextRequest,
  // Next.js dynamic routing passes params here
  context: any
) {
  try {
    const params = await context.params;
    const filename = params.filename;
    if (!filename) {
      return new Response("Filename is required", { status: 400 });
    }

    const safeFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), "public", "uploads", safeFilename);

    if (!fs.existsSync(filePath)) {
      return new Response("Image Not Found", { status: 404 });
    }

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
  } catch (err: any) {
    console.error("Serve image error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
