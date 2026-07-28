import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { signJWT } from "@/lib/jwt";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, rollNumber } = body;

    let user = null;
    let inputPassword = "";

    // Determine login strategy
    if (rollNumber !== undefined && name !== undefined) {
      // Student login
      if (!name || !rollNumber) {
        return NextResponse.json(
          { error: "Full Name and Roll Number are required" },
          { status: 400 }
        );
      }

      const rollInt = parseInt(rollNumber.toString(), 10);
      if (isNaN(rollInt)) {
        return NextResponse.json(
          { error: "Roll number must be a valid integer" },
          { status: 400 }
        );
      }

      user = await prisma.user.findFirst({
        where: { rollNumber: rollInt, role: "STUDENT" },
        include: { class: true },
      });

      if (!user || user.name.trim().toLowerCase() !== name.trim().toLowerCase()) {
        return NextResponse.json(
          { error: "Invalid credentials" },
          { status: 401 }
        );
      }

      inputPassword = rollNumber.toString();
    } else {
      // Staff login
      if (!email || !password) {
        return NextResponse.json(
          { error: "Email and password are required" },
          { status: 400 }
        );
      }

      user = await prisma.user.findUnique({
        where: { email },
        include: { class: true },
      });

      if (!user) {
        return NextResponse.json(
          { error: "Invalid credentials" },
          { status: 401 }
        );
      }

      inputPassword = password;
    }

    const isMatch = await bcrypt.compare(inputPassword, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Create token payload
    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      classId: user.classId || null,
      className: user.class ? `${user.class.name} ${user.class.arm}` : null,
    };

    const token = await signJWT(payload);

    // Set cookie
    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        classId: user.classId,
      },
    });

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error: any) {
    console.error("Login API error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
