"use client";

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  Home,
  BookOpen,
  Bell,
  Search,
  Plus,
  Bookmark,
  Calculator as CalcIcon,
  Maximize2,
  Minimize2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Flag,
  Loader2,
  X,
  Clock,
  FileText,
} from "lucide-react";
import MathRenderer from "@/components/MathRenderer";

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function shuffleOptions(question: any, studentId: string) {
  if (!question) return [];
  const options = [
    { key: "A", text: question.optionA },
    { key: "B", text: question.optionB },
    { key: "C", text: question.optionC },
    { key: "D", text: question.optionD },
  ];
  if (question.optionE) options.push({ key: "E", text: question.optionE });
  if (question.optionF) options.push({ key: "F", text: question.optionF });

  if (!studentId) return options; // Fallback if studentId is not loaded yet

  // Deterministic shuffle
  return options
    .map((opt) => ({
      opt,
      hash: hashString(studentId + question.id + opt.key),
    }))
    .sort((a, b) => a.hash - b.hash)
    .map((item) => item.opt);
}

export default function TestPage({ params }: { params: Promise<{ examId: string }> }) {
  const router = useRouter();
  const unwrappedParams = React.use(params);
  const examId = unwrappedParams.examId;

  // State
  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState<any>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<Record<string, { selectedOption: string | null; isFlagged: boolean }>>({});
  const [studentId, setStudentId] = useState<string>("");
  const [tabSwitchesCount, setTabSwitchesCount] = useState<number>(0);
  const [examStarted, setExamStarted] = useState<boolean>(false);

  // Active exam tracking
  const [activeSubjectIndex, setActiveSubjectIndex] = useState(0);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);

  // Time tracking
  const [timeLeft, setTimeLeft] = useState<number>(0); // in seconds
  const [totalDuration, setTotalDuration] = useState<number>(0);
  const [timerLow, setTimerLow] = useState(false);

  // Popups & features
  const [showCalculator, setShowCalculator] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [proctorWarnings, setProctorWarnings] = useState<string[]>([]);
  const [reportQuestionModal, setReportQuestionModal] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");

  // Calculator states
  const [calcExpr, setCalcExpr] = useState("");
  const [calcResult, setCalcResult] = useState("");

  // Refs
  const initialTimeLeftRef = useRef<number>(0);
  const timeLeftRef = useRef<number>(0);

  // Sync ref with state
  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  // Fetch test details
  const fetchTestDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/student/test?examId=${examId}`);
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to load exam. Check if you already submitted it.");
        router.push("/student");
        return;
      }

      setExam(data.exam);
      setSubjects(data.subjects || []);
      setAttempts(data.attempts || {});
      setStudentId(data.studentId || "");
      setTabSwitchesCount(data.tabSwitches || 0);

      // Check if already started
      const localStorageKey = `cbt_exam_start_${examId}`;
      const examStart = localStorage.getItem(localStorageKey);
      const now = Date.now();

      if (examStart) {
        setExamStarted(true);
        const startTimeStamp = parseInt(examStart, 10);
        const durationSeconds = data.exam.durationMinutes * 60;
        const elapsedSeconds = Math.floor((now - startTimeStamp) / 1000);
        const remainingSeconds = Math.max(0, durationSeconds - elapsedSeconds);

        setTimeLeft(remainingSeconds);
        timeLeftRef.current = remainingSeconds;
        setTotalDuration(durationSeconds);
        initialTimeLeftRef.current = remainingSeconds;
      } else {
        const durationSeconds = data.exam.durationMinutes * 60;
        setTimeLeft(durationSeconds);
        timeLeftRef.current = durationSeconds;
        setTotalDuration(durationSeconds);
        initialTimeLeftRef.current = durationSeconds;
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTestDetails();
  }, [examId]);

  // Proctoring: Blur detection (Tab switching warning)
  useEffect(() => {
    if (loading || !exam || !examStarted) return;

    const handleBlur = async () => {
      // Suppress warning if submit modal or question reporting modal is active
      if (showSubmitModal || reportQuestionModal) return;

      try {
        const res = await fetch("/api/student/test/log-infraction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ examId }),
        });
        const data = await res.json();
        
        if (data.success) {
          setTabSwitchesCount(data.tabSwitches);
          
          if (data.status === "SUBMITTED" || data.tabSwitches >= 3) {
            alert("EXAM AUTO-SUBMITTED: You have exceeded the maximum allowed tab switches (3 warnings). Your exam is being submitted now.");
            submitExam();
            return;
          }

          const warningText = `Tab switch detected at ${new Date().toLocaleTimeString()}. Warning ${data.tabSwitches} of 3.`;
          setProctorWarnings((prev) => [...prev, warningText]);
          alert(`WARNING: Tab switching is monitored. This is warning ${data.tabSwitches} of 3. Exceeding 3 warnings will result in auto-submission.`);
        }
      } catch (err) {
        console.error("Error logging infraction:", err);
      }
    };

    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("blur", handleBlur);
    };
  }, [loading, exam, examId, examStarted, showSubmitModal, reportQuestionModal]);

  // Ping hook to track student active state
  useEffect(() => {
    if (loading || !exam || !examStarted) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/student/test/ping", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ examId }),
        });
        const data = await res.json();
        
        if (data.success) {
          setTabSwitchesCount(data.tabSwitches);
          if (data.status === "SUBMITTED") {
            clearInterval(interval);
            alert("Your exam has been submitted (either by you, a proctor, or due to cheating warnings). Redirecting...");
            localStorage.removeItem(`cbt_exam_start_${examId}`);
            router.push("/student");
          }
        }
      } catch (err) {
        console.error("Ping error:", err);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [loading, exam, examId, examStarted, router]);

  // Timer countdown hook using absolute time tracking
  useEffect(() => {
    if (loading || !exam || !examStarted) return;

    const localStorageKey = `cbt_exam_start_${examId}`;
    const storedStart = localStorage.getItem(localStorageKey);
    if (!storedStart) return;

    const startTimeStamp = parseInt(storedStart, 10);
    const durationSeconds = exam.durationMinutes * 60;

    const tick = () => {
      const now = Date.now();
      const elapsed = Math.floor((now - startTimeStamp) / 1000);
      const remaining = Math.max(0, durationSeconds - elapsed);

      setTimeLeft(remaining);

      if (remaining <= 0) {
        setTimeLeft(0);
        handleAutoSubmit();
        return true; // Stop ticking
      }

      if (remaining <= 300) {
        setTimerLow(true);
      }
      return false;
    };

    // Run initial tick
    const shouldStop = tick();
    if (shouldStop) return;

    const interval = setInterval(() => {
      const stop = tick();
      if (stop) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [loading, exam, examId, examStarted]);

  // Active question getters
  const activeSubject = subjects[activeSubjectIndex];
  const activeQuestion = activeSubject?.questions?.[activeQuestionIndex];
  const activeAttempt = activeQuestion ? attempts[activeQuestion.id] || { selectedOption: null, isFlagged: false } : { selectedOption: null, isFlagged: false };

  const mcqQuestions = activeSubject?.questions?.filter((q: any) => q.questionType !== "THEORY") || [];
  const theoryQuestions = activeSubject?.questions?.filter((q: any) => q.questionType === "THEORY") || [];

  const activeQuestionMcqIndex = activeQuestion ? mcqQuestions.findIndex((q: any) => q.id === activeQuestion.id) : -1;
  const activeQuestionTheoryIndex = activeQuestion ? theoryQuestions.findIndex((q: any) => q.id === activeQuestion.id) : -1;

  const visualQuestionLabel = activeQuestion?.questionType === "THEORY"
    ? `T ${activeQuestionTheoryIndex + 1}`
    : `Q ${activeQuestionMcqIndex + 1}`;

  // Save attempts to database (autosave)
  const saveAttempt = async (qId: string, subId: string, option: string | null, flag: boolean) => {
    // Update local state first
    setAttempts((prev) => ({
      ...prev,
      [qId]: { selectedOption: option, isFlagged: flag },
    }));

    try {
      await fetch("/api/student/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId,
          subjectId: subId,
          questionId: qId,
          selectedOption: option,
          isFlagged: flag,
        }),
      });
    } catch (err) {
      console.error("Autosave error:", err);
    }
  };

  // Format countdown string
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Submit test API
  const submitExam = async () => {
    localStorage.removeItem(`cbt_exam_start_${examId}`);
    const timeSpent = initialTimeLeftRef.current - timeLeftRef.current;
    try {
      const res = await fetch("/api/student/test/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId,
          timeSpent: Math.max(1, timeSpent),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      alert("Your paper has been submitted successfully.");
      router.push("/student");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAutoSubmit = () => {
    alert("Time has expired! Your answers are being submitted automatically.");
    submitExam();
  };

  // Fullscreen toggle helper
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  // Question navigation helpers
  const handleNext = () => {
    if (activeQuestionIndex < activeSubject.questions.length - 1) {
      setActiveQuestionIndex(activeQuestionIndex + 1);
    } else if (activeSubjectIndex < subjects.length - 1) {
      setActiveSubjectIndex(activeSubjectIndex + 1);
      setActiveQuestionIndex(0);
    }
  };

  const handlePrev = () => {
    if (activeQuestionIndex > 0) {
      setActiveQuestionIndex(activeQuestionIndex - 1);
    } else if (activeSubjectIndex > 0) {
      setActiveSubjectIndex(activeSubjectIndex - 1);
      setActiveQuestionIndex(subjects[activeSubjectIndex - 1].questions.length - 1);
    }
  };

  // Question Palette Calculations
  const getSubjectQuestionsAttempted = (sub: any) => {
    return sub.questions.filter((q: any) => {
      const option = attempts[q.id]?.selectedOption;
      return option && option.trim() !== "";
    }).length;
  };

  const getTotalQuestionsAttempted = () => {
    let count = 0;
    subjects.forEach((sub) => {
      count += getSubjectQuestionsAttempted(sub);
    });
    return count;
  };

  const getTotalQuestionsCount = () => {
    let count = 0;
    subjects.forEach((sub) => {
      count += sub.questions.length;
    });
    return count;
  };

  // Report question handler
  const handleReportQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportReason.trim() || !reportQuestionModal) return;
    try {
      const res = await fetch("/api/student/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: reportQuestionModal,
          reason: reportReason,
        }),
      });
      if (res.ok) {
        alert("Thank you. The report has been filed and sent to the administrator.");
        setReportQuestionModal(null);
        setReportReason("");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Calculator button handler
  const handleCalcBtn = (val: string) => {
    if (val === "C") {
      setCalcExpr("");
      setCalcResult("");
    } else if (val === "=") {
      try {
        // Safe math evaluation
        const clean = calcExpr.replace(/[^0-9+\-*/.]/g, "");
        const res = Function(`"use strict"; return (${clean})`)();
        setCalcResult(res.toString());
      } catch (err) {
        setCalcResult("Error");
      }
    } else {
      setCalcExpr(calcExpr + val);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 animate-pulse flex items-center justify-center">
            <img src="/logo.png" alt="Manna Academy Logo" className="w-16 h-16 object-contain" />
          </div>
          <span className="text-slate-500 text-sm font-semibold">Building examination environment...</span>
        </div>
      </div>
    );
  }

  if (!examStarted) {
    return (
      <div className="min-h-screen bg-[#1B2A6B] flex items-center justify-center p-6 text-white text-center font-sans">
        <div className="max-w-md w-full bg-white text-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 animate-fade-in">
          <img src="/logo.png" alt="Manna Academy Logo" className="w-20 h-20 object-contain mx-auto" />
          <div>
            <h2 className="text-xl font-black text-[#1B2A6B]">{exam?.title || "CBT Practice Examination"}</h2>
            <p className="text-xs text-slate-400 mt-1 uppercase font-bold tracking-wider">Exam Environment Entrance</p>
          </div>

          <div className="text-left bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2 text-slate-550">
            <p className="font-bold text-slate-700 text-sm pb-1.5 border-b border-slate-200">System Rules & Guidelines:</p>
            <p>• ⏱️ **Duration**: You have **{exam?.durationMinutes} minutes** to complete the exam.</p>
            <p>• 💻 **Fullscreen**: Fullscreen mode is enforced. Exiting fullscreen is monitored.</p>
            <p>• 🚫 **Tab Switching**: Tab switching, minimizing, or opening other applications is **forbidden** and logged. Exceeding **3 warnings** results in auto-submission.</p>
            <p>• 💾 **Autosave**: Answers are saved automatically after selection.</p>
          </div>

          <button
            onClick={() => {
              const localStorageKey = `cbt_exam_start_${examId}`;
              localStorage.setItem(localStorageKey, String(Date.now()));
              setExamStarted(true);
              if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch((err) => console.log("Fullscreen request failed", err));
              }
            }}
            className="w-full bg-[#1B2A6B] hover:bg-[#152052] text-white border-b-4 border-[#FFD100] hover:border-[#FFD100]/80 font-bold py-3.5 rounded-2xl shadow-lg transition active:scale-95 cursor-pointer uppercase tracking-wider text-xs font-sans"
          >
            Start Exam
          </button>
        </div>
      </div>
    );
  }

  // Calculate subjects completed
  const completedSubjectsCount = subjects.filter(
    (sub) => getSubjectQuestionsAttempted(sub) === sub.questions.length
  ).length;

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans select-none animate-fade-in"
      onContextMenu={(e) => e.preventDefault()} // proctoring block right-click
      onCopy={(e) => e.preventDefault()} // proctoring block copy
    >
      {/* 1. GLOBAL LAYOUT - Top Navigation Bar */}
      <header className="bg-[#1B2A6B] border-b border-[#152052] px-6 py-2.5 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 flex items-center justify-center">
            <img src="/logo-white.png" alt="Manna Academy Logo" className="w-9 h-9 object-contain" />
          </div>
          <span className="text-base font-extrabold text-white hidden sm:block">Manna Academy CBT Practice</span>
        </div>

        <div className="hidden sm:block flex-1 max-w-sm mx-6 relative">
          <Search className="w-4 h-4 text-[#FFD100]/60 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            disabled
            placeholder="Search disabled during test"
            className="w-full bg-[#152052] border border-[#1b2a6b]/20 text-[#FFD100]/40 text-xs rounded-full py-2.5 pl-9 pr-4 transition outline-none cursor-not-allowed"
          />
        </div>

        <div className="flex items-center gap-3.5">
          <button
            disabled
            className="hidden md:flex items-center gap-1.5 bg-[#152052] text-xs text-slate-400 px-3.5 py-2 rounded-full border border-[#1b2a6b]/20 cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" /> Create +
          </button>

          <button disabled className="p-2 text-slate-400 cursor-not-allowed">
            <Bell className="w-4.5 h-4.5" />
          </button>

          <div className="w-8 h-8 rounded-full bg-[#152052] border border-[#1b2a6b]/20 flex items-center justify-center font-bold text-xs text-white">
            EX
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex">
        {/* 1. GLOBAL LAYOUT - Left Sidebar */}
        <aside className="w-20 bg-white border-r border-slate-200 flex flex-col items-center py-6 gap-6 flex-shrink-0 shadow-sm">
          <button
            onClick={() => {
              if (confirm("Are you sure you want to exit the exam? Unsaved attempts might be lost.")) {
                router.push("/student");
              }
            }}
            className="flex flex-col items-center gap-1.5 text-slate-455 hover:text-[#1B2A6B] transition cursor-pointer"
          >
            <div className="p-2.5 hover:bg-slate-50 rounded-2xl border border-transparent hover:border-slate-200 transition">
              <Home className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-medium">Home</span>
          </button>

          <button className="flex flex-col items-center gap-1.5 text-[#1B2A6B] transition">
            <div className="p-2.5 bg-[#1B2A6B]/10 border border-[#1B2A6B]/20 rounded-2xl">
              <BookOpen className="w-5 h-5 text-[#1B2A6B]" />
            </div>
            <span className="text-[10px] font-extrabold text-[#1B2A6B]">CBT Test</span>
          </button>
        </aside>

        {/* 2. EXAM/TEST-TAKING INTERFACE */}
        <main className="flex-1 flex flex-col min-h-0 bg-slate-50">
          {/* Header Row of Exam */}
          <div className="border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white shadow-sm">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                <span>{activeSubject?.subjectName || "Subject Details"}</span>
              </h2>
              <p className="text-xs text-slate-550 mt-0.5 font-medium">
                Practice Session Code: <span className="font-mono text-slate-650 font-semibold">{exam?.id.slice(0, 8)}</span>
              </p>
            </div>

            {/* Time Stack & Action buttons */}
            <div className="flex flex-col sm:items-end gap-1.5">
              <div className="flex items-center gap-4">
                {/* Monospace Countdown Timer */}
                <div
                  className={`font-mono text-2xl font-black tracking-widest px-4 py-1.5 border rounded-xl flex items-center gap-2 shadow-sm ${
                    timerLow
                      ? "bg-red-50 border-red-300 text-red-600 animate-pulse"
                      : "bg-emerald-50 border-emerald-200 text-emerald-750"
                  }`}
                >
                  <Clock className="w-5 h-5 animate-pulse" />
                  <span>{formatTime(timeLeft)}</span>
                </div>

                {/* Quit / Submit Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (confirm("Are you sure you want to quit this exam? Your timer will run out!")) {
                        router.push("/student");
                      }
                    }}
                    className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
                  >
                    Quit
                  </button>
                  <button
                    onClick={() => setShowSubmitModal(true)}
                    className="px-5 py-2 bg-[#1B2A6B] hover:bg-[#152052] text-white border-b-2 border-[#FFD100] rounded-xl text-xs font-bold transition cursor-pointer shadow-md shadow-blue-500/10"
                  >
                    Submit
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-slate-450 font-semibold uppercase tracking-wider">
                Duration: {exam?.durationMinutes} minutes / Autosubmits at 0:00:00
              </p>
            </div>
          </div>

          {/* Subject Tabs Row */}
          <div className="border-b border-slate-200 bg-white px-6 py-2.5 flex items-center justify-between overflow-x-auto gap-4 shadow-sm">
            <div className="flex items-center gap-2">
              {subjects.map((sub, idx) => (
                <button
                  key={sub.subjectId}
                  onClick={() => {
                    setActiveSubjectIndex(idx);
                    setActiveQuestionIndex(0);
                  }}
                  className={`px-4 py-2 rounded-full text-xs font-bold tracking-tight transition cursor-pointer ${
                    activeSubjectIndex === idx
                      ? "bg-[#1B2A6B] text-white border border-[#152052] shadow-sm"
                      : "bg-slate-50 border border-slate-200 text-slate-650 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {sub.subjectName}
                </button>
              ))}
            </div>

            {/* Right details of tabs row */}
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold bg-blue-50 border border-blue-100 text-[#1B2A6B] px-3 py-1.5 rounded-full shadow-sm">
                {completedSubjectsCount} of {subjects.length} Subjects Completed
              </span>

              {/* Action circle buttons */}
              <button
                onClick={() => saveAttempt(activeQuestion.id, activeSubject.subjectId, activeAttempt.selectedOption, !activeAttempt.isFlagged)}
                className={`w-9 h-9 border rounded-full flex items-center justify-center transition cursor-pointer shadow-sm ${
                  activeAttempt.isFlagged
                    ? "bg-amber-50 border-amber-300 text-amber-700"
                    : "bg-white border-slate-200 text-slate-450 hover:text-slate-805 hover:bg-slate-50"
                }`}
                title="Bookmark / Flag Question for Review"
              >
                <Bookmark className="w-4 h-4" />
              </button>

              <button
                onClick={() => setShowCalculator(!showCalculator)}
                className={`w-9 h-9 border rounded-full flex items-center justify-center transition cursor-pointer shadow-sm ${
                  showCalculator
                    ? "bg-blue-50 border-[#1B2A6B] text-[#1B2A6B]"
                    : "bg-white border-slate-200 text-slate-455 hover:text-slate-805 hover:bg-slate-50"
                }`}
                title="Calculator"
              >
                <CalcIcon className="w-4 h-4" />
              </button>

              <button
                onClick={toggleFullscreen}
                className="w-9 h-9 bg-white border border-slate-200 text-slate-455 hover:text-slate-805 hover:bg-slate-50 rounded-full flex items-center justify-center transition cursor-pointer shadow-sm"
                title="Fullscreen Toggle"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Core Panel: Question body + Passage layout */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
            {/* Proctor Alert banner */}
            {proctorWarnings.length > 0 && (
              <div className="absolute top-0 inset-x-0 z-35 bg-red-50 border-b border-red-200 p-2.5 text-center text-red-700 text-xs font-bold flex items-center justify-center gap-2 shadow-sm animate-slide-in">
                <AlertTriangle className="w-4 h-4 text-red-650" />
                <span>Tab focus lost! Proctoring alerts logged: {proctorWarnings.length} incident(s).</span>
              </div>
            )}

            {/* Question Display Screen */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {/* English passage board */}
              {activeQuestion?.passageText && (
                <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5 text-sm text-amber-900 max-w-3xl leading-relaxed shadow-sm">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-amber-500/10">
                    <BookOpen className="w-4 h-4 text-amber-700" />
                    <span className="font-extrabold text-xs uppercase tracking-wider text-amber-700">
                      Reading Comprehension: {activeQuestion.passageTitle}
                    </span>
                  </div>
                  <p className="italic font-medium">"{activeQuestion.passageText}"</p>
                </div>
              )}

              {/* Geometry/Diagram Container */}
              {activeQuestion?.imageUrl && (
                <div className="border border-slate-200 bg-white p-4 rounded-2xl inline-block max-w-[280px] shadow-sm">
                  <img src={activeQuestion.imageUrl} alt="Exam Figure/Diagram" className="w-full h-auto rounded-lg" />
                </div>
              )}

              {/* Question Item */}
              <div className="space-y-4 max-w-4xl">
                <div className="flex items-start gap-4">
                  <span className="px-3 h-9 bg-[#1B2A6B] text-white font-bold rounded-xl flex items-center justify-center flex-shrink-0 text-sm shadow-sm">
                    {visualQuestionLabel}
                  </span>
                  <div className="text-base md:text-lg font-bold leading-relaxed text-slate-900 pt-1">
                    {activeQuestion?.questionText ? (
                      <MathRenderer text={activeQuestion.questionText} isHtml={true} />
                    ) : (
                      "Question has not been loaded correctly."
                    )}
                  </div>
                </div>

                {activeQuestion?.questionType === "THEORY" ? (
                  <div className="pl-13 py-6 space-y-4 max-w-2xl">
                    <div className="bg-blue-50/50 border border-[#1B2A6B]/25 text-[#1B2A6B] rounded-2xl p-6 flex items-start gap-4 shadow-sm">
                      <div className="p-3 bg-white rounded-xl border border-[#1B2A6B]/15 shadow-sm text-slate-800 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-6 h-6 text-[#1B2A6B]" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-extrabold tracking-wide uppercase text-slate-700">Theory Question</p>
                        <p className="text-xs text-slate-550 leading-relaxed font-medium">
                          Please type your answer in the editor below. Your response is saved automatically.
                        </p>
                        {activeQuestion.instruction && (
                          <div className="mt-3 p-3 bg-amber-50 border border-amber-250 text-amber-800 rounded-xl text-xs font-semibold leading-relaxed">
                            <span className="text-amber-900 font-extrabold">Instruction: </span>
                            {activeQuestion.instruction}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Your Written Answer:</label>
                      <textarea
                        rows={8}
                        value={activeAttempt.selectedOption || ""}
                        onChange={(e) => saveAttempt(activeQuestion.id, activeSubject.subjectId, e.target.value, activeAttempt.isFlagged)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-[#1B2A6B] focus:ring-1 focus:ring-[#1B2A6B]/25 text-slate-850 text-sm rounded-xl p-3 outline-none transition resize-y font-medium"
                        placeholder="Type your response or answer here..."
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3.5 pl-13">
                    {shuffleOptions(activeQuestion, studentId).map((opt, index) => {
                      const isSelected = activeAttempt.selectedOption === opt.key;
                      const visualLabel = ["A", "B", "C", "D", "E", "F"][index];
                      return (
                        <div
                          key={opt.key}
                          onClick={() => saveAttempt(activeQuestion.id, activeSubject.subjectId, opt.key, activeAttempt.isFlagged)}
                          className={`p-4 rounded-xl border flex items-center gap-3.5 cursor-pointer transition select-none shadow-sm ${
                            isSelected
                              ? "bg-blue-50 border-2 border-[#1B2A6B] text-[#1B2A6B] font-bold"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                          }`}
                        >
                          {/* Circular radio button */}
                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition ${
                              isSelected ? "border-[#1B2A6B] bg-[#1B2A6B]" : "border-slate-350 bg-white"
                            }`}
                          >
                            <div className={`w-2 h-2 rounded-full bg-[#FFD100] ${isSelected ? "block" : "hidden"}`} />
                          </div>

                          {/* Letter A-F (Visual label) */}
                          <span className={`font-extrabold w-4 ${isSelected ? 'text-[#1B2A6B]' : 'text-slate-455'}`}>{visualLabel}.</span>

                          {/* Answer text */}
                          {opt.text ? (
                            <MathRenderer text={opt.text} inline={true} isHtml={true} className={`text-sm ${isSelected ? 'text-[#1B2A6B] font-semibold' : 'text-slate-800'}`} />
                          ) : (
                            <span className="text-slate-400 italic">Option content not loaded</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Calculator sidebar overlay */}
            {showCalculator && (
              <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-slate-200 bg-white p-5 flex flex-col gap-4 relative z-30 animate-slide-in shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-sm font-bold flex items-center gap-2 text-slate-800">
                    <CalcIcon className="w-4 h-4 text-[#1B2A6B]" /> Floating Calculator
                  </span>
                  <button onClick={() => setShowCalculator(false)} className="p-1 hover:text-red-600 transition">
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>

                <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-2 shadow-inner">
                  <div className="h-10 text-right font-mono text-slate-500 select-text overflow-x-auto flex items-center justify-end text-sm">
                    {calcExpr || "0"}
                  </div>
                  <div className="h-12 text-right font-mono text-xl font-bold text-slate-800 select-text overflow-x-auto flex items-center justify-end">
                    {calcResult || "0"}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-sm font-bold">
                  {["C", "(", ")", "/"].map((b) => (
                    <button key={b} onClick={() => handleCalcBtn(b)} className="py-3 bg-slate-100 hover:bg-slate-200 text-[#1B2A6B] rounded-lg cursor-pointer transition">
                      {b}
                    </button>
                  ))}
                  {["7", "8", "9", "*"].map((b) => (
                    <button key={b} onClick={() => handleCalcBtn(b)} className="py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60 rounded-lg cursor-pointer transition">
                      {b}
                    </button>
                  ))}
                  {["4", "5", "6", "-"].map((b) => (
                    <button key={b} onClick={() => handleCalcBtn(b)} className="py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60 rounded-lg cursor-pointer transition">
                      {b}
                    </button>
                  ))}
                  {["1", "2", "3", "+"].map((b) => (
                    <button key={b} onClick={() => handleCalcBtn(b)} className="py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60 rounded-lg cursor-pointer transition">
                      {b}
                    </button>
                  ))}
                  {["0", ".", "="].map((b) => (
                    <button
                      key={b}
                      onClick={() => handleCalcBtn(b)}
                      className={`py-3 rounded-lg cursor-pointer transition ${
                        b === "=" ? "col-span-2 bg-[#1B2A6B] hover:bg-[#152052] text-white border-b-2 border-[#FFD100]" : "bg-slate-50 hover:bg-slate-100 text-slate-705 border border-slate-200/60"
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Control row */}
          <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-between bg-white shadow-sm">
            {/* Report Question flag */}
            <button
              onClick={() => setReportQuestionModal(activeQuestion.id)}
              className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-red-650 font-bold transition cursor-pointer"
            >
              <Flag className="w-3.5 h-3.5" />
              <span>Report Question</span>
            </button>

            {/* Prev/Next buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrev}
                disabled={activeSubjectIndex === 0 && activeQuestionIndex === 0}
                className="flex items-center gap-1 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <button
                onClick={handleNext}
                disabled={
                  activeSubjectIndex === subjects.length - 1 &&
                  activeQuestionIndex === activeSubject.questions.length - 1
                }
                className="flex items-center gap-1 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sticky Bottom Question Palette */}
          <div className="border-t border-slate-200 bg-white p-5 space-y-4 shadow-inner">
            <div className="flex items-center justify-between text-xs font-bold text-slate-455 border-b border-slate-100 pb-2">
              <span className="uppercase tracking-wider">Question Navigator Palette</span>
              <span>
                Attempted {getSubjectQuestionsAttempted(activeSubject)} of {activeSubject?.questions?.length} Questions
              </span>
            </div>

            {/* MCQ Questions section */}
            {mcqQuestions.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                  Multiple Choice Questions ({mcqQuestions.length})
                </span>
                <div className="flex flex-wrap gap-2">
                  {mcqQuestions.map((q: any, mcqIdx: number) => {
                    const idx = activeSubject.questions.findIndex((x: any) => x.id === q.id);
                    const isCurrent = activeQuestionIndex === idx;
                    const isAttempted = !!(attempts[q.id]?.selectedOption && attempts[q.id]?.selectedOption?.trim() !== "");
                    const isFlagged = !!attempts[q.id]?.isFlagged;

                    let btnClass = "w-14 h-9 text-xs font-bold rounded-xl flex items-center justify-center transition border cursor-pointer ";
                    if (isAttempted) {
                      btnClass += "bg-emerald-600 border-emerald-600 text-white ";
                    } else if (isFlagged) {
                      btnClass += "bg-amber-50 border-amber-300 text-amber-700 ";
                    } else {
                      btnClass += "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 ";
                    }
                    if (isCurrent) {
                      btnClass += "ring-2 ring-[#1B2A6B]/40 ring-offset-1 border-[#1B2A6B] font-extrabold ";
                    }

                    return (
                      <button
                        key={q.id}
                        onClick={() => setActiveQuestionIndex(idx)}
                        className={btnClass}
                      >
                        Q {mcqIdx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Theory Questions section */}
            {theoryQuestions.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-slate-100">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                  Theory Questions ({theoryQuestions.length})
                </span>
                <div className="flex flex-wrap gap-2">
                  {theoryQuestions.map((q: any, theoryIdx: number) => {
                    const idx = activeSubject.questions.findIndex((x: any) => x.id === q.id);
                    const isCurrent = activeQuestionIndex === idx;
                    const isAttempted = !!(attempts[q.id]?.selectedOption && attempts[q.id]?.selectedOption?.trim() !== "");
                    const isFlagged = !!attempts[q.id]?.isFlagged;

                    let btnClass = "w-14 h-9 text-xs font-bold rounded-xl flex items-center justify-center transition border cursor-pointer ";
                    if (isAttempted) {
                      btnClass += "bg-emerald-600 border-emerald-600 text-white ";
                    } else if (isFlagged) {
                      btnClass += "bg-amber-50 border-amber-300 text-amber-700 ";
                    } else {
                      btnClass += "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 ";
                    }
                    if (isCurrent) {
                      btnClass += "ring-2 ring-[#1B2A6B]/40 ring-offset-1 border-[#1B2A6B] font-extrabold ";
                    }

                    return (
                      <button
                        key={q.id}
                        onClick={() => setActiveQuestionIndex(idx)}
                        className={btnClass}
                      >
                        T {theoryIdx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* =============================================================== */}
      {/* 2. EXAM SUBMISSION SUMMARY CONFIRMATION MODAL */}
      {/* =============================================================== */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-6 text-slate-800 animate-fade-in">
            <div className="text-center">
              <img src="/logo.png" alt="Manna Academy Logo" className="w-16 h-16 object-contain mx-auto mb-3" />
              <h3 className="text-lg font-black text-slate-850 font-sans">Submit Examination Paper</h3>
              <p className="text-slate-500 text-xs mt-1">Review your coverage outline before final sheet submission.</p>
            </div>

            {/* Report mapping */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-150 text-xs text-slate-550">
              <div className="flex justify-between pb-2 border-b border-slate-200 font-bold text-slate-700">
                <span>Subject Name</span>
                <span>Attempts</span>
              </div>
              {subjects.map((sub) => (
                <div key={sub.subjectId} className="flex justify-between">
                  <span>{sub.subjectName}</span>
                  <span className="font-semibold text-slate-800">
                    {getSubjectQuestionsAttempted(sub)} / {sub.questions.length} Attempted
                  </span>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t border-slate-200 font-bold text-slate-700 font-bold">
                <span>Total Attempts</span>
                <span>
                  {getTotalQuestionsAttempted()} / {getTotalQuestionsCount()}
                </span>
              </div>
            </div>

            {/* Final warn */}
            <div className="p-3 bg-amber-50 border border-amber-250 text-amber-800 rounded-xl text-[11px] leading-relaxed flex gap-2 shadow-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
              <span>You cannot modify your choices once submitted. Double-check flagged questions.</span>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end text-sm">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 border border-slate-200 rounded-xl font-semibold transition cursor-pointer shadow-sm"
              >
                Back To Test
              </button>
              <button
                onClick={submitExam}
                className="bg-[#1B2A6B] hover:bg-[#152052] text-white px-5 py-2 rounded-xl font-bold transition cursor-pointer shadow-sm border-b-2 border-b-[#FFD100]"
              >
                Submit Paper
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =============================================================== */}
      {/* 3. REPORT QUESTION CONSOLE MODAL */}
      {/* =============================================================== */}
      {reportQuestionModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 text-slate-800 animate-fade-in">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-2">
              <Flag className="w-4 h-4 text-[#FFD100]" /> Report Question Error
            </h3>
            <p className="text-slate-500 text-xs">Specify what is wrong with this question (incorrect options, typo, layout error).</p>

            <form onSubmit={handleReportQuestion} className="space-y-4 mt-4 text-xs">
              <textarea
                required
                placeholder="Describe the issue in detail..."
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-[#1B2A6B] focus:ring-2 focus:ring-[#1B2A6B]/15 text-slate-800 rounded-xl p-3 min-h-[100px] outline-none resize-none transition"
              />

              <div className="flex justify-end gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => setReportQuestionModal(null)}
                  className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl border border-slate-200 transition cursor-pointer font-semibold shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#1B2A6B] hover:bg-[#152052] text-white px-5 py-2 rounded-xl transition cursor-pointer font-bold border-b-2 border-b-[#FFD100] shadow-sm"
                >
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
