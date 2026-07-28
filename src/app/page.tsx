"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        if (data.user) {
          const role = data.user.role;
          if (role === "ADMIN") router.replace("/admin");
          else if (role === "TEACHER") router.replace("/teacher");
          else if (role === "STUDENT") router.replace("/student");
          else router.replace("/login");
        } else {
          router.replace("/login");
        }
      } catch (err) {
        console.error("Session check failed, redirecting to login:", err);
        router.replace("/login");
      }
    }
    checkSession();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 animate-pulse flex items-center justify-center">
          <img src="/logo.png" alt="Manna Academy Logo" className="w-16 h-16 object-contain" />
        </div>
        <span className="text-slate-500 text-sm font-semibold">Loading Manna Academy Portal...</span>
      </div>
    </div>
  );
}
