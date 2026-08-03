import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import fs from "fs";
import path from "path";

const defaultAvatar = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#cbd5e1" width="128" height="128">
  <rect width="100%" height="100%" fill="#f1f5f9"/>
  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="#94a3b8"/>
</svg>
`;

function serveDefaultAvatar() {
  return new Response(defaultAvatar.trim(), {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400", // Cache for 1 day
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return new Response("User ID is required", { status: 400 });
    }

    // Fetch the user's passportUrl from the database
    const user = await prisma.user.findUnique({
      where: { id },
      select: { passportUrl: true },
    });

    if (!user || !user.passportUrl) {
      return serveDefaultAvatar();
    }

    const passportUrl = user.passportUrl;

    // 1. Check if it's base64 data URL
    if (passportUrl.startsWith("data:")) {
      const match = passportUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
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

    return serveDefaultAvatar();
  } catch (err: any) {
    console.error("Serve user passport error:", err);
    return serveDefaultAvatar(); // Return default avatar instead of breaking the UI on database/network error
  }
}
