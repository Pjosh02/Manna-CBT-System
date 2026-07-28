import { SignJWT, jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "cbt-system-fallback-secret-key-1234567890-very-secure"
);

export async function signJWT(payload: any, expiry: string = "24h") {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiry)
    .sign(SECRET);
}

export async function verifyJWT(token: string): Promise<any> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as any;
  } catch (error) {
    return null;
  }
}
