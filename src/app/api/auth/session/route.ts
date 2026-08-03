import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/jwt";
import { prisma } from "@/lib/db";
import { formatPassportUrl } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const tokenCookie = request.cookies.get("token");
    const token = tokenCookie ? tokenCookie.value : null;

    if (!token) {
      return NextResponse.json({ user: null });
    }

    const payload = await verifyJWT(token);
    if (!payload) {
      return NextResponse.json({ user: null });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: payload.id },
      include: { class: true, classes: true },
    });

    return NextResponse.json({
      user: {
        id: payload.id,
        name: payload.name,
        email: payload.email,
        role: payload.role,
        classId: dbUser?.classId || null,
        className: dbUser?.class ? `${dbUser.class.name} ${dbUser.class.arm}` : null,
        classes: dbUser?.classes.map(c => ({ id: c.id, name: c.name, arm: c.arm, academicSession: c.academicSession })) || [],
        passportUrl: formatPassportUrl(payload.id, dbUser?.passportUrl || null),
      },
    });
  } catch (error) {
    console.error("Session API error:", error);
    return NextResponse.json({ user: null });
  }
}
