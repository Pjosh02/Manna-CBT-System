"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Lock, Mail, AlertCircle, Eye, EyeOff, User, Hash } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [loginTab, setLoginTab] = useState<"student" | "staff">("student");
  const [name, setName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Check if already logged in
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        if (data.user) {
          redirectToRole(data.user.role);
        }
      } catch (err) {
        console.error("Session check failed", err);
      }
    }
    checkSession();
  }, []);

  const redirectToRole = (role: string) => {
    if (role === "ADMIN") router.push("/admin");
    else if (role === "TEACHER") router.push("/teacher");
    else if (role === "STUDENT") router.push("/student");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const body = loginTab === "student"
        ? { name, rollNumber }
        : { email, password };

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      redirectToRole(data.user.role);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please check your credentials.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-zinc-100 to-blue-50 p-4 relative overflow-hidden font-sans">
      {/* Background ambient blue glow circles */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#002B7F]/5 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[#002B7F]/5 blur-[120px]" />

      <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-2xl p-8 sm:p-10 shadow-[0_20px_50px_-12px_rgba(0,43,127,0.12)] relative z-10">
        <div className="flex flex-col items-center mb-6">
          <div className="w-28 h-28 flex items-center justify-center mb-4">
            <img src="/logo.png" alt="Manna Academy Logo" className="w-28 h-28 object-contain" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#002B7F]">Manna Academy CBT</h1>
          <p className="text-slate-500 text-sm mt-1 text-center font-medium">
            School Computer-Based Test Management System
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200/60 mb-6 gap-1">
          <button
            type="button"
            onClick={() => { setLoginTab("student"); setError(""); }}
            className={`flex-1 py-2.5 text-center text-sm font-bold rounded-lg transition-all duration-200 cursor-pointer ${
              loginTab === "student"
                ? "bg-[#002B7F] text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50/50"
            }`}
          >
            Student Login
          </button>
          <button
            type="button"
            onClick={() => { setLoginTab("staff"); setError(""); }}
            className={`flex-1 py-2.5 text-center text-sm font-bold rounded-lg transition-all duration-200 cursor-pointer ${
              loginTab === "staff"
                ? "bg-[#002B7F] text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50/50"
            }`}
          >
            Staff Login
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3.5 flex items-start gap-2.5 mb-6 text-sm shadow-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          {loginTab === "student" ? (
            <>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-5 h-5 text-[#002B7F] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#002B7F] focus:ring-2 focus:ring-[#002B7F]/15 text-slate-800 placeholder-slate-400 rounded-xl py-3 pl-11 pr-4 text-sm transition outline-none shadow-sm"
                    placeholder="Chinedu Okafor"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Roll Number
                </label>
                <div className="relative">
                  <Hash className="w-5 h-5 text-[#002B7F] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#002B7F] focus:ring-2 focus:ring-[#002B7F]/15 text-slate-800 placeholder-slate-400 rounded-xl py-3 pl-11 pr-11 text-sm transition outline-none shadow-sm"
                    placeholder="e.g. 101"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 text-[#002B7F] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#002B7F] focus:ring-2 focus:ring-[#002B7F]/15 text-slate-800 placeholder-slate-400 rounded-xl py-3 pl-11 pr-4 text-sm transition outline-none shadow-sm"
                    placeholder="you@school.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-[#002B7F] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#002B7F] focus:ring-2 focus:ring-[#002B7F]/15 text-slate-800 placeholder-slate-400 rounded-xl py-3 pl-11 pr-11 text-sm transition outline-none shadow-sm"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#002B7F] hover:bg-[#002161] active:scale-[0.99] disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-[#002B7F]/20 hover:shadow-xl hover:shadow-[#002B7F]/25 cursor-pointer flex items-center justify-center gap-2 border-b-4 border-b-[#FFD100] transform outline-none focus:ring-2 focus:ring-[#002B7F]/30"
          >
            {loading ? "Signing in..." : "Access Portal"}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-200 text-center">
          <div className="bg-[#FFD100]/10 border border-[#FFD100]/30 rounded-xl p-4 text-xs text-slate-600 max-w-sm mx-auto shadow-sm">
            <span className="font-bold text-[#002B7F] block mb-1">Temporary Staging Credentials</span>
            <p className="space-y-1 font-medium leading-relaxed">
              <strong>Admin:</strong> <span className="font-mono text-slate-800 select-all">admin@school.com</span> / <span className="font-mono text-slate-800">admin123</span> <br />
              <strong>Teacher:</strong> <span className="font-mono text-slate-800 select-all">teacher@school.com</span> / <span className="font-mono text-slate-800">teacher123</span> <br />
              <strong>Student:</strong> <span className="font-mono text-slate-800 select-all">Chinedu Okafor</span> / <span className="font-mono text-slate-800">101</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
