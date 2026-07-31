"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  Home,
  BookOpen,
  Bell,
  Search,
  Plus,
  Play,
  CheckCircle,
  Clock,
  LogOut,
  Loader2,
  Calendar,
  AlertCircle,
  Award,
  Edit,
  Download,
} from "lucide-react";

export default function StudentDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [exams, setExams] = useState<any[]>([]);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const [downloadingExamId, setDownloadingExamId] = useState<string | null>(null);

  const handleDownloadQuestions = async (examId: string) => {
    if (!examId) return;
    setDownloadingExamId(examId);
    try {
      const link = document.createElement("a");
      link.href = `/api/results/${examId}/download-review`;
      link.target = "_blank";
      link.setAttribute("download", `Exam_Review_${examId}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Error downloading review PDF:", err);
      alert("Failed to download questions. Please try again.");
    } finally {
      setTimeout(() => {
        setDownloadingExamId(null);
      }, 2000);
    }
  };

  const fetchSessionAndExams = async () => {
    setLoading(true);
    try {
      const sessionRes = await fetch("/api/auth/session");
      const sessionData = await sessionRes.json();
      if (!sessionData.user || sessionData.user.role !== "STUDENT") {
        router.push("/login");
        return;
      }
      setUser(sessionData.user);

      const examsRes = await fetch("/api/student/exams");
      const examsData = await examsRes.json();
      const examsList = examsData.exams || [];
      setExams(examsList);

      const readyResults = examsList.filter((e: any) => e.hasTaken && e.resultsReleased);
      const newNotifications = readyResults.map((e: any) => ({
        id: e.id,
        title: "Results Ready",
        message: `Your results for "${e.title}" are ready. Score: ${e.correctAnswers !== null && e.correctAnswers !== undefined ? `${e.correctAnswers}/${e.totalQuestions}` : `${e.score}%`}`,
        date: new Date(e.endTime || Date.now()).toLocaleDateString(),
      }));
      setNotifications(newNotifications);
    } catch (error) {
      console.error("Error loading student portal:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionAndExams();
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const getInitials = (name: string) => {
    if (!name) return "";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 animate-pulse flex items-center justify-center">
            <img src="/logo.png" alt="Manna Academy Logo" className="w-16 h-16 object-contain" />
          </div>
          <span className="text-slate-500 text-sm font-semibold">Loading Manna Academy Student Dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-55 text-slate-800 flex flex-col font-sans">
      {/* 1. GLOBAL LAYOUT - Top Navigation Bar */}
      <header className="bg-[#1B2A6B] border-b border-[#152052] text-white px-6 py-3 flex items-center justify-between sticky top-0 z-40">
        {/* Left: App Logo/Name */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 flex items-center justify-center">
            <img src="/logo-white.png" alt="Manna Academy Logo" className="w-9 h-9 object-contain" />
          </div>
          <span className="text-base font-bold tracking-tight text-white hidden sm:block font-bold">Manna Academy CBT</span>
        </div>

        {/* Center: Search Bar (Rounded, gray, magnifying glass) */}
        <div className="hidden sm:block flex-1 max-w-md mx-6 relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search exams, subjects, resources..."
            className="w-full bg-slate-100 border border-slate-200 focus:border-[#FFD100] text-slate-700 text-xs rounded-full py-2.5 pl-9 pr-4 transition outline-none"
          />
        </div>

        {/* Right: Results, Change Password, Bell, Profile Picture */}
        <div className="flex items-center gap-3">
          {/* Results Action Button */}
          <button
            onClick={() => setShowResultsModal(true)}
            className="flex items-center gap-1.5 bg-[#FFD100] hover:bg-[#FFD100]/90 text-xs text-[#1B2A6B] font-extrabold px-3.5 py-2 rounded-full border border-transparent transition cursor-pointer shadow-sm"
          >
            <Award className="w-3.5 h-3.5 text-[#1B2A6B]" />
            <span className="hidden sm:inline">Results</span>
          </button>

          {/* Change Password Edit Button */}
          <button
            onClick={() => {
              setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
              setPasswordError("");
              setPasswordSuccess("");
              setShowPasswordModal(true);
            }}
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs text-white font-bold px-3 py-2 rounded-full border border-zinc-700 transition cursor-pointer"
            title="Change Password"
          >
            <Edit className="w-3.5 h-3.5 text-[#FFD100]" />
            <span className="hidden md:inline">Edit Profile</span>
          </button>

          {/* Bell Notifications Button */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 text-slate-200 hover:text-white transition relative cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-4.5 h-4.5" />
              {notifications.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 text-slate-800 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-extrabold text-[#1B2A6B] uppercase tracking-wider">Notifications</span>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="text-xs text-slate-400 hover:text-slate-600 transition"
                  >
                    Close
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2.5">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-2">No new notifications.</p>
                  ) : (
                    notifications.map((notif) => (
                      <div key={notif.id} className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 animate-pulse">
                            {notif.title}
                          </span>
                          <span className="text-[9px] text-slate-400">{notif.date}</span>
                        </div>
                        <p className="text-xs text-slate-600 font-medium leading-relaxed">{notif.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User profile picture or initials avatar */}
          <div
            className="w-8 h-8 rounded-full bg-[#FFD100]/20 border border-[#FFD100]/30 flex items-center justify-center overflow-hidden font-bold text-xs text-[#FFD100] cursor-pointer"
            title={`${user?.name} (${user?.role})`}
          >
            {user?.passportUrl ? (
              <img src={user.passportUrl} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              getInitials(user?.name)
            )}
          </div>

          <button
            onClick={handleLogout}
            className="p-1.5 text-zinc-450 hover:text-[#FFD100] transition cursor-pointer flex items-center gap-1.5"
            title="Log Out"
          >
            <LogOut className="w-4.5 h-4.5" />
            <span className="hidden sm:inline text-xs font-semibold">Log out</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex">
        {/* 1. GLOBAL LAYOUT - Left Sidebar (Icon + label stack) */}
        <aside className="w-20 bg-[#1B2A6B] border-r border-[#152052] text-white flex-shrink-0 flex flex-col items-center py-6 gap-6 flex-shrink-0">
          <button className="flex flex-col items-center gap-1.5 text-[#FFD100] transition group cursor-pointer">
            <div className="p-2.5 bg-[#FFD100]/10 border border-[#FFD100]/20 rounded-2xl">
              <Home className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold tracking-wider">Home</span>
          </button>

          <button
            onClick={() => {}}
            className="flex flex-col items-center gap-1.5 text-slate-300 hover:text-white transition group cursor-pointer"
          >
            <div className="p-2.5 hover:bg-[#152052] border border-transparent hover:border-[#152052] rounded-2xl">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-medium tracking-wider">CBT Test</span>
          </button>
        </aside>

        {/* Dashboard Workspace */}
        <main className="flex-1 p-6 space-y-8 overflow-y-auto">
          {/* Welcome Card */}
          <div className="bg-gradient-to-r from-slate-100 to-indigo-50 border border-slate-200 rounded-3xl p-6 text-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">Welcome, {user?.name}!</h2>
              <p className="text-slate-500 text-xs mt-1">
                Classroom scope: <span className="text-[#1B2A6B] font-bold">{user?.className || "No classroom"}</span>. Ready to evaluate your progress?
              </p>
            </div>
            <div className="bg-white border border-slate-200 px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2 text-slate-700 shadow-sm">
              <Clock className="w-4 h-4 text-[#FFD100]" />
              <span className="font-semibold text-slate-600 font-medium">Academic Term: 2025/2026</span>
            </div>
          </div>

          {/* Exam listings */}
          <div className="space-y-6">
            <h3 className="text-base font-bold tracking-wider uppercase text-slate-500">Assigned Examinations</h3>

            {exams.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-slate-500 text-center text-zinc-500 text-sm">
                No examinations assigned to your class at this time.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {exams.map((exam) => (
                  <div
                    key={exam.id}
                    className={`bg-white border border-slate-200 shadow-sm rounded-2xl p-5 text-slate-800 flex flex-col justify-between transition-all duration-300 ${
                      exam.hasTaken
                        ? "border-emerald-500/20 hover:border-emerald-500/30"
                        : exam.timingStatus === "LIVE"
                        ? "border-red-500/30 hover:border-red-500/50 shadow-lg shadow-red-500/5"
                        : "border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <div className="space-y-4">
                      {/* Badge / Header */}
                      <div className="flex items-center justify-between">
                        {exam.hasTaken ? (
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-450 border border-emerald-500/20">
                            COMPLETED
                          </span>
                        ) : exam.timingStatus === "LIVE" ? (
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded bg-[#1B2A6B]/10 text-[#1B2A6B] border border-[#1B2A6B]/20 animate-pulse">
                            ACTIVE & LIVE
                          </span>
                        ) : exam.timingStatus === "SCHEDULED" ? (
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/25">
                            UPCOMING
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded bg-zinc-850 text-slate-500 border border-zinc-800">
                            CLOSED
                          </span>
                        )}

                        <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{exam.durationMinutes} Minutes</span>
                        </div>
                      </div>

                      {/* Info */}
                      <div>
                        <h4 className="text-base font-bold text-slate-800 font-semibold">{exam.title}</h4>
                        <p className="text-slate-500 text-xs mt-1">
                          Test Window: {new Date(exam.startTime).toLocaleDateString()} to{" "}
                          {new Date(exam.endTime).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Blueprint mapping */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {exam.examSubjects.map((es: any) => (
                          <span
                            key={es.subjectId}
                            className="text-[10px] font-semibold bg-zinc-950 border border-zinc-850 px-2 py-0.5 rounded text-slate-500"
                          >
                            {es.subjectName}: {es.numberOfQuestions} Qs
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="border-t border-slate-100 pt-4 mt-5 flex items-center justify-between">
                      {exam.hasTaken ? (
                        <div className="flex items-center justify-between w-full">
                          {exam.resultsReleased ? (
                            <>
                              <div className="flex items-center gap-1.5 text-emerald-500 font-semibold text-xs">
                                <CheckCircle className="w-4 h-4 text-emerald-500" />
                                <span>Attempt Evaluated</span>
                              </div>
                              <span className="font-mono text-base font-extrabold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-250">
                                {exam.correctAnswers !== null && exam.correctAnswers !== undefined ? `${exam.correctAnswers}/${exam.totalQuestions}` : `${exam.score}%`}
                              </span>
                            </>
                          ) : (
                            <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-xs">
                              <CheckCircle className="w-4 h-4 text-slate-400" />
                              <span>Completed — awaiting results</span>
                            </div>
                          )}
                        </div>
                      ) : exam.timingStatus === "LIVE" ? (
                        <button
                          onClick={() => router.push(`/student/test/${exam.id}`)}
                          className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#1B2A6B] hover:bg-[#152052] text-white text-xs font-bold rounded-xl transition shadow-sm border-b-2 border-b-[#FFD100] cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" /> Start Examination
                        </button>
                      ) : exam.timingStatus === "SCHEDULED" ? (
                        <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold py-2">
                          <Calendar className="w-4 h-4" />
                          <span>Unlocks on {new Date(exam.startTime).toLocaleString()}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold py-2">
                          <AlertCircle className="w-4 h-4" />
                          <span>Test Window Closed</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* 2. CHANGE PASSWORD MODAL */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-slate-800">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 font-sans">Change Password</h3>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold transition text-lg"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setPasswordError("");
                setPasswordSuccess("");
                if (passwordForm.newPassword !== passwordForm.confirmPassword) {
                  setPasswordError("New passwords do not match.");
                  return;
                }
                setPasswordSubmitting(true);
                try {
                  const res = await fetch("/api/student/change-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      currentPassword: passwordForm.currentPassword,
                      newPassword: passwordForm.newPassword,
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "Failed to update password");
                  setPasswordSuccess("Password updated successfully!");
                  setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
                  setTimeout(() => {
                    setShowPasswordModal(false);
                  }, 1500);
                } catch (err: any) {
                  setPasswordError(err.message);
                } finally {
                  setPasswordSubmitting(false);
                }
              }}
              className="p-6 space-y-4"
            >
              {passwordError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Current Password</label>
                <input
                  type="password"
                  required
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#1B2A6B] focus:ring-2 focus:ring-[#1B2A6B]/15 text-slate-800 text-sm rounded-lg p-2.5 outline-none transition"
                  placeholder="Enter current password"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#1B2A6B] focus:ring-2 focus:ring-[#1B2A6B]/15 text-slate-800 text-sm rounded-lg p-2.5 outline-none transition"
                  placeholder="At least 4 characters"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#1B2A6B] focus:ring-2 focus:ring-[#1B2A6B]/15 text-slate-800 text-sm rounded-lg p-2.5 outline-none transition"
                  placeholder="Confirm new password"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordSubmitting}
                  className="px-4 py-2 text-xs font-semibold bg-[#1B2A6B] hover:bg-[#152052] text-white rounded-xl transition cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {passwordSubmitting ? "Updating..." : "Save Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. DETAILED RESULTS MODAL */}
      {showResultsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl text-slate-800">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 font-sans">
                <Award className="w-5 h-5 text-[#1B2A6B]" />
                <span>My Exam Results Sheet</span>
              </h3>
              <button
                onClick={() => setShowResultsModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold transition text-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {exams.filter((e: any) => e.hasTaken).length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">You have not completed any examinations yet.</p>
              ) : (
                <div className="space-y-3">
                  {exams.filter((e: any) => e.hasTaken).map((exam) => {
                    const isReleased = exam.resultsReleased;
                    return (
                      <div 
                        key={exam.id} 
                        className={`p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in border transition ${
                          isReleased
                            ? "bg-slate-50 border-slate-150"
                            : "bg-slate-50 border-slate-150 opacity-70"
                        }`}
                      >
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">{exam.title}</h4>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Window: {new Date(exam.startTime).toLocaleDateString()} - {new Date(exam.endTime).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {isReleased ? (
                            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 mr-1">
                                Released
                              </span>
                              <span className="font-mono text-sm font-extrabold text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-250 font-bold mr-2">
                                {exam.correctAnswers !== null && exam.correctAnswers !== undefined ? `${exam.correctAnswers}/${exam.totalQuestions}` : `${exam.score}%`}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDownloadQuestions(exam.id)}
                                disabled={downloadingExamId === exam.id}
                                className="px-3 py-1.5 text-xs font-bold bg-[#FFD100] hover:bg-[#FFD100]/95 text-[#1B2A6B] rounded-xl transition cursor-pointer shadow-sm flex items-center gap-1.5 border-b-2 border-b-[#1B2A6B] disabled:opacity-50"
                              >
                                {downloadingExamId === exam.id ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span>Generating...</span>
                                  </>
                                ) : (
                                  <>
                                    <Download className="w-3 h-3" />
                                    <span>Download Questions</span>
                                  </>
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-slate-450 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg">
                              ⌛ Pending Release
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowResultsModal(false)}
                className="px-5 py-2.5 text-xs font-bold bg-slate-150 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer shadow-sm border border-slate-200"
              >
                Close Sheet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
