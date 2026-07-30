"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  HelpCircle,
  CheckCircle,
  AlertCircle,
  FileText,
  Eye,
  Settings,
  BookOpen,
  ChevronRight,
} from "lucide-react";
import MathRenderer from "@/components/MathRenderer";

export default function NewQuestionPage() {
  return (
    <React.Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 animate-pulse flex items-center justify-center">
            <img src="/logo.png" alt="Manna Academy Logo" className="w-16 h-16 object-contain" />
          </div>
          <span className="text-slate-500 text-sm font-semibold">Loading question editor...</span>
        </div>
      </div>
    }>
      <NewQuestionForm />
    </React.Suspense>
  );
}

function NewQuestionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const classId = searchParams.get("classId");

  // Authentication & Subject Lists
  const [user, setUser] = useState<any>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Math Formula Palette states
  const [showMathHelper, setShowMathHelper] = useState(false);
  const [mathTab, setMathTab] = useState("fractions");
  const [activeInputId, setActiveInputId] = useState<string>("question-textarea");

  // Success / Error status banner states
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Session saved questions
  const [sessionSavedQuestions, setSessionSavedQuestions] = useState<any[]>([]);

  // Form Fields
  const [form, setForm] = useState({
    subjectId: "",
    assessmentType: "Exam",
    questionText: "",
    hasPassage: false,
    passageTitle: "",
    passageText: "",
    imageUrl: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctOption: "A",
    points: 1,
    questionType: "MCQ",
    difficulty: "MEDIUM",
    tags: "",
  });

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Image Drag-and-Drop state
  const [isDragOver, setIsDragOver] = useState(false);

  // Load Session and Subjects
  useEffect(() => {
    const loadSessionAndData = async () => {
      try {
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();
        if (!sessionData.user || sessionData.user.role !== "TEACHER") {
          router.push("/login");
          return;
        }
        setUser(sessionData.user);

        // Fetch subjects
        const subjectsRes = await fetch("/api/teacher/subjects");
        const subjectsData = await subjectsRes.json();
        setSubjects(subjectsData.subjects || []);

        // Prepopulate default subject & questionType if available
        const prepopulatedSubjectId = searchParams.get("subjectId");
        const typeParam = searchParams.get("type") || "mcq";
        setForm((prev) => ({
          ...prev,
          subjectId: prepopulatedSubjectId || "",
          questionType: typeParam.toUpperCase(),
        }));

        // If editing, fetch the specific question details
        if (editId) {
          const res = await fetch(`/api/teacher/questions`);
          const data = await res.json();
          const questionToEdit = (data.questions || []).find((q: any) => q.id === editId);
          if (questionToEdit) {
            setForm({
              subjectId: questionToEdit.subjectId,
              assessmentType: questionToEdit.assessmentType || "Exam",
              questionText: questionToEdit.questionText || "",
              hasPassage: !!(questionToEdit.passageTitle || questionToEdit.passageText),
              passageTitle: questionToEdit.passageTitle || "",
              passageText: questionToEdit.passageText || "",
              imageUrl: questionToEdit.imageUrl || "",
              optionA: questionToEdit.optionA || "",
              optionB: questionToEdit.optionB || "",
              optionC: questionToEdit.optionC || "",
              optionD: questionToEdit.optionD || "",
              correctOption: questionToEdit.correctOption || "A",
              points: questionToEdit.points || 1,
              difficulty: questionToEdit.difficulty || "MEDIUM",
              tags: questionToEdit.tags || "",
              questionType: questionToEdit.questionType || "MCQ",
            });
          }
        }
      } catch (err) {
        console.error("Error loading question editor data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadSessionAndData();
  }, [editId, router, searchParams]);

  // Insert Rich Text Formatting at cursor selection
  const insertFormatting = (tagOpen: string, tagClose: string) => {
    const textarea = document.getElementById(activeInputId) as HTMLTextAreaElement | HTMLInputElement;
    if (!textarea) return;

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const text = textarea.value;
    const selected = text.substring(start, end);
    const replacement = tagOpen + selected + tagClose;

    const newText = text.substring(0, start) + replacement + text.substring(end);

    if (activeInputId === "question-textarea") {
      setForm((prev) => ({ ...prev, questionText: newText }));
    } else if (activeInputId === "optionA") {
      setForm((prev) => ({ ...prev, optionA: newText }));
      if (errors.optionA) setErrors((prev) => ({ ...prev, optionA: "" }));
    } else if (activeInputId === "optionB") {
      setForm((prev) => ({ ...prev, optionB: newText }));
      if (errors.optionB) setErrors((prev) => ({ ...prev, optionB: "" }));
    } else if (activeInputId === "optionC") {
      setForm((prev) => ({ ...prev, optionC: newText }));
      if (errors.optionC) setErrors((prev) => ({ ...prev, optionC: "" }));
    } else if (activeInputId === "optionD") {
      setForm((prev) => ({ ...prev, optionD: newText }));
      if (errors.optionD) setErrors((prev) => ({ ...prev, optionD: "" }));
    }

    // Reset selection focus range
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tagOpen.length, start + tagOpen.length + selected.length);
    }, 0);
  };

  // Insert LaTeX math templates at cursor selection
  const insertMath = (latexTemplate: string, placeholderLengthOffset: number = 0) => {
    const textarea = document.getElementById(activeInputId) as HTMLTextAreaElement | HTMLInputElement;
    if (!textarea) return;

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const text = textarea.value;
    const replacement = latexTemplate;

    const newText = text.substring(0, start) + replacement + text.substring(end);

    if (activeInputId === "question-textarea") {
      setForm((prev) => ({ ...prev, questionText: newText }));
    } else if (activeInputId === "optionA") {
      setForm((prev) => ({ ...prev, optionA: newText }));
      if (errors.optionA) setErrors((prev) => ({ ...prev, optionA: "" }));
    } else if (activeInputId === "optionB") {
      setForm((prev) => ({ ...prev, optionB: newText }));
      if (errors.optionB) setErrors((prev) => ({ ...prev, optionB: "" }));
    } else if (activeInputId === "optionC") {
      setForm((prev) => ({ ...prev, optionC: newText }));
      if (errors.optionC) setErrors((prev) => ({ ...prev, optionC: "" }));
    } else if (activeInputId === "optionD") {
      setForm((prev) => ({ ...prev, optionD: newText }));
      if (errors.optionD) setErrors((prev) => ({ ...prev, optionD: "" }));
    }

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + latexTemplate.length - placeholderLengthOffset;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Handle Drag & Drop Upload
  const handleUploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      setFormSubmitting(true);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload file");
      setForm((prev) => ({ ...prev, imageUrl: data.url }));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = () => {
    setIsDragOver(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUploadFile(file);
  };

  // Validate form inputs
  const validateForm = (): boolean => {
    const tempErrors: Record<string, string> = {};

    if (!form.subjectId) tempErrors.subjectId = "Please select a subject before saving";
    if (!form.questionText.trim()) tempErrors.questionText = "Question text cannot be empty";
    
    if (form.questionType !== "THEORY") {
      if (!form.optionA.trim()) tempErrors.optionA = "Option A is required";
      if (!form.optionB.trim()) tempErrors.optionB = "Option B is required";
      if (!form.optionC.trim()) tempErrors.optionC = "Option C is required";
      if (!form.optionD.trim()) tempErrors.optionD = "Option D is required";
      if (!form.correctOption) tempErrors.correctOption = "Please select a correct option";
    }

    if (form.points <= 0) tempErrors.points = "Points must be at least 1";

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  // Save question handler
  const handleSave = async (statusType: "DRAFT" | "PUBLISHED", actionType: "exit" | "another") => {
    if (!form.subjectId) {
      setErrorMsg("Please select a subject before saving.");
      setErrors((prev) => ({ ...prev, subjectId: "Please select a subject before saving" }));
      return;
    }

    if (!validateForm()) {
      setErrorMsg("Please fix the validation errors in the form before saving.");
      return;
    }

    setFormSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    const isTheory = form.questionType === "THEORY";
    const payload = {
      id: editId || undefined,
      subjectId: form.subjectId,
      questionText: form.questionText,
      imageUrl: form.imageUrl || null,
      passageTitle: form.hasPassage && form.passageTitle.trim() ? form.passageTitle : null,
      passageText: form.hasPassage && form.passageText.trim() ? form.passageText : null,
      optionA: isTheory ? "" : form.optionA,
      optionB: isTheory ? "" : form.optionB,
      optionC: isTheory ? "" : form.optionC,
      optionD: isTheory ? "" : form.optionD,
      correctOption: isTheory ? "A" : form.correctOption,
      assessmentType: form.assessmentType,
      points: form.points,
      status: statusType,
      difficulty: form.difficulty,
      tags: form.tags,
      questionType: form.questionType || "MCQ",
    };

    try {
      const res = await fetch("/api/teacher/questions", {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save question");

      // Accumulate saved question
      if (data.question) {
        setSessionSavedQuestions((prev) => [...prev, data.question]);
      }

      if (actionType === "another") {
        setSuccessMsg("Question saved successfully! Form reset for next entry.");
        // Reset form except subject and assessmentType
        setForm((prev) => ({
          ...prev,
          questionText: "",
          hasPassage: false,
          passageTitle: "",
          passageText: "",
          imageUrl: "",
          optionA: "",
          optionB: "",
          optionC: "",
          optionD: "",
          correctOption: "A",
          points: 1,
          difficulty: "MEDIUM",
          tags: "",
        }));
      } else {
        router.push(classId ? `/teacher?classId=${classId}` : "/teacher");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to process question save request.");
    } finally {
      setFormSubmitting(false);
    }
  };

  // HTML renderer utility for preview column
  const renderPreviewHtml = (text: string) => {
    if (!text) {
      return <span className="text-slate-400 italic">No question content drafted yet.</span>;
    }
    return <MathRenderer text={text} isHtml={true} className="text-slate-800 leading-relaxed font-medium" />;
  };

  // Single question preview card renderer
  const renderQuestionCard = (q: any, isLive: boolean) => {
    const subjectName = subjects.find((s) => s.id === q.subjectId)?.name || "Subject Not Selected";
    const hasPassage = q.hasPassage !== undefined ? q.hasPassage : !!(q.passageTitle || q.passageText);
    const passTitle = q.passageTitle || "";
    const passText = q.passageText || "";
    
    return (
      <div 
        key={q.id || (isLive ? "live-draft" : Math.random().toString())}
        className={`border rounded-xl p-5 bg-slate-50/50 space-y-4 text-slate-800 ${
          isLive 
            ? "border-[#1B2A6B]/30 ring-2 ring-[#1B2A6B]/5 shadow-sm" 
            : "border-slate-200 opacity-90 shadow-sm bg-white"
        }`}
      >
        {/* Question Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#1B2A6B] text-white">
            {subjectName}
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#FFD100] text-[#1B2A6B]">
            {q.assessmentType}
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200 text-slate-600">
            {q.points} pt(s)
          </span>
          {isLive && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#1B2A6B]/10 text-[#1B2A6B] border border-[#1B2A6B]/20 animate-pulse">
              Live Draft
            </span>
          )}
        </div>

        {/* Comprehension Passage Preview */}
        {hasPassage && (passTitle.trim() || passText.trim()) && (
          <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 max-h-[160px] overflow-y-auto">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#1B2A6B]" />
              <span>{passTitle || "Passage Title"}</span>
            </h4>
            <p className="text-[11px] text-slate-600 whitespace-pre-line leading-relaxed font-sans">
              {passText || "Passage content text."}
            </p>
          </div>
        )}

        {/* Question Text */}
        <div className="text-slate-800 text-sm font-semibold">
          {renderPreviewHtml(q.questionText)}
        </div>

        {/* Diagram Reference Diagram */}
        {q.imageUrl && (
          <div className="rounded-lg overflow-hidden border border-slate-200 max-h-[200px] bg-white flex items-center justify-center">
            <img src={q.imageUrl} alt="Diagram Reference" className="max-h-[180px] object-contain p-2" />
          </div>
        )}

        {/* Options list */}
        {q.questionType !== "THEORY" && (
          <div className="space-y-2 mt-4 pt-4 border-t border-slate-200/60">
            {[
              { key: "A", val: q.optionA },
              { key: "B", val: q.optionB },
              { key: "C", val: q.optionC },
              { key: "D", val: q.optionD },
            ].map((item) => (
              <div
                key={item.key}
                className={`flex items-center gap-3 p-3 rounded-lg border text-xs font-medium transition ${
                  q.correctOption === item.key
                    ? "bg-[#FFD100]/10 border-[#FFD100] text-[#1B2A6B] font-bold"
                    : "bg-white border-slate-200 text-slate-600"
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold border ${
                  q.correctOption === item.key
                    ? "bg-[#1B2A6B] text-white border-[#1B2A6B]"
                    : "bg-slate-50 text-slate-500 border-slate-200"
                }`}>
                  {item.key}
                </div>
                {item.val ? (
                  <MathRenderer text={item.val} inline={true} isHtml={true} className={q.correctOption === item.key ? "font-bold text-[#1B2A6B]" : "text-slate-600"} />
                ) : (
                  <span className="text-slate-400 italic">Option content not provided</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 animate-pulse flex items-center justify-center">
            <img src="/logo.png" alt="Manna Academy Logo" className="w-16 h-16 object-contain" />
          </div>
          <span className="text-slate-500 text-sm font-semibold">Loading question editor...</span>
        </div>
      </div>
    );
  }

  const querySubjectId = searchParams.get("subjectId");
  const showSubjectPrompt = !querySubjectId && !editId;

  if (showSubjectPrompt) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-12 flex flex-col">
        {/* Header */}
        <header className="bg-[#1B2A6B] border-b border-[#152052] text-white px-6 py-4 flex items-center justify-between sticky top-0 z-40 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(classId ? `/teacher?classId=${classId}` : "/teacher")}
              className="p-2 hover:bg-[#152052] rounded-lg transition mr-1 cursor-pointer"
              title="Go back to dashboard"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <div className="flex items-center gap-2 text-xs text-[#FFD100]/90 font-semibold uppercase tracking-wider">
                <span>Question Bank</span>
                <span>&gt;</span>
                <span className="text-white">
                  {form.questionType === "THEORY" ? "Add Theory Question" : "Add MCQ"}
                </span>
              </div>
              <h1 className="text-lg font-bold mt-0.5">
                {form.questionType === "THEORY" ? "Author Theory Question" : "Author MCQ"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <img src="/logo-white.png" alt="Manna Academy Logo" className="w-8 h-8 object-contain" />
            <span className="text-xs font-semibold tracking-wider uppercase opacity-90 hidden sm:inline">Manna Portal</span>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-xl w-full bg-white border border-slate-200 rounded-2xl p-8 shadow-md text-center space-y-6">
            <div className="w-16 h-16 bg-[#1B2A6B]/10 rounded-full flex items-center justify-center mx-auto text-[#1B2A6B]">
              <BookOpen className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 font-sans">Select a Subject First</h2>
              <p className="text-slate-500 text-sm mt-1 font-sans">
                To author a new question, you must assign it to a subject. Please select one of your class subjects below.
              </p>
            </div>

            {subjects.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm font-medium">
                No subjects assigned to your class yet. Please add a subject first.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto pr-1">
                {subjects.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => {
                      const resolvedClassId = sub.classes?.[0]?.id || "";
                      router.replace(`/teacher/questions/new?subjectId=${sub.id}${resolvedClassId ? `&classId=${resolvedClassId}` : ""}`);
                      setForm((prev) => ({ ...prev, subjectId: sub.id }));
                    }}
                    className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-[#1B2A6B] hover:bg-[#1B2A6B]/5 text-left transition font-semibold text-slate-700 hover:text-[#1B2A6B] cursor-pointer group"
                  >
                    <span className="text-sm font-sans">{sub.name}</span>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#1B2A6B]" />
                  </button>
                ))}
              </div>
            )}
            
            <button
              onClick={() => router.push(classId ? `/teacher?classId=${classId}` : "/teacher")}
              className="text-xs text-slate-400 hover:text-slate-600 transition block mx-auto underline font-sans"
            >
              Cancel and go back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-12">
      {/* 1. TOP HEADER & BREADCRUMBS */}
      <header className="bg-[#1B2A6B] border-b border-[#152052] text-white px-6 py-4 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(classId ? `/teacher?classId=${classId}` : "/teacher")}
            className="p-2 hover:bg-[#152052] rounded-lg transition mr-1 cursor-pointer"
            title="Go back to dashboard"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs text-[#FFD100]/90 font-semibold uppercase tracking-wider">
              <span>Question Bank</span>
              <span>&gt;</span>
              <span className="text-white">
                {editId ? "Edit Question" : form.questionType === "THEORY" ? "Add Theory Question" : "Add MCQ"}
              </span>
            </div>
            <h1 className="text-lg font-bold mt-0.5">
              {editId 
                ? `Modify ${form.questionType === "THEORY" ? "Theory" : "Multiple-Choice"} Question` 
                : `Author New ${form.questionType === "THEORY" ? "Theory" : "Multiple-Choice"} Question`}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <img src="/logo-white.png" alt="Manna Academy Logo" className="w-8 h-8 object-contain" />
          <span className="text-xs font-semibold tracking-wider uppercase opacity-90 hidden sm:inline">Manna Portal</span>
        </div>
      </header>

      {/* STATUS NOTIFICATIONS */}
      <div className="max-w-7xl mx-auto px-4 mt-6">
        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-3 mb-4 shadow-sm">
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span className="text-sm font-medium">{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-start gap-3 mb-4 shadow-sm">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm font-medium">{errorMsg}</div>
          </div>
        )}
      </div>

      {/* 2. TWO COLUMN PANEL LAYOUT */}
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* LEFT COLUMN: QUESTION FORM (60% width) */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
            <h2 className="text-md font-bold text-slate-800 flex items-center gap-2 pb-3 border-b border-slate-100">
              <Settings className="w-4.5 h-4.5 text-[#1B2A6B]" />
              <span>Question Parameters</span>
            </h2>

            {/* SUBJECT, DIFFICULTY & POINTS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Subject</label>
                <select
                  value={form.subjectId}
                  onChange={(e) => {
                    setForm({ ...form, subjectId: e.target.value });
                    if (errors.subjectId) setErrors({ ...errors, subjectId: "" });
                  }}
                  disabled={!!searchParams.get("subjectId")}
                  className={`w-full bg-slate-50 border ${errors.subjectId ? 'border-red-500 ring-2 ring-red-500/10' : 'border-slate-200 focus:border-[#1B2A6B]'} focus:ring-2 focus:ring-[#1B2A6B]/15 text-slate-800 rounded-lg p-2.5 outline-none transition font-medium ${
                    searchParams.get("subjectId") ? "opacity-75 bg-slate-100 cursor-not-allowed" : ""
                  }`}
                >
                  <option value="">Select Subject</option>
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </select>
                {errors.subjectId && <p className="text-xs text-red-600 mt-1 font-medium">{errors.subjectId}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Assessment Type</label>
                <select
                  value={form.assessmentType}
                  onChange={(e) => setForm({ ...form, assessmentType: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#1B2A6B] focus:ring-2 focus:ring-[#1B2A6B]/15 text-slate-800 rounded-lg p-2.5 outline-none transition font-medium"
                >
                  <option value="1st CA">1st CA</option>
                  <option value="2nd CA">2nd CA</option>
                  <option value="Exam">Exam</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Points / Weight</label>
                <input
                  type="number"
                  min={1}
                  value={form.points}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    setForm({ ...form, points: val });
                    if (errors.points) setErrors({ ...errors, points: "" });
                  }}
                  className={`w-full bg-slate-50 border ${errors.points ? 'border-red-500 ring-2 ring-red-500/10' : 'border-slate-200 focus:border-[#1B2A6B]'} focus:ring-2 focus:ring-[#1B2A6B]/15 text-slate-850 rounded-lg p-2.5 outline-none transition font-medium`}
                />
                {errors.points && <p className="text-xs text-red-600 mt-1 font-medium">{errors.points}</p>}
              </div>
            </div>



            {/* COMPREHENSION PASSAGE ACCORDION TOGGLE */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-slate-50/50">
              <label className="flex items-center gap-3 px-4 py-3 bg-slate-50 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.hasPassage}
                  onChange={(e) => setForm({ ...form, hasPassage: e.target.checked })}
                  className="w-4 h-4 rounded text-[#1B2A6B] focus:ring-[#1B2A6B]"
                />
                <div>
                  <span className="text-sm font-semibold text-slate-800">This question uses a reading comprehension passage</span>
                  <p className="text-[10px] text-slate-400">Expand to include stories, passages, or instructions that students must read first.</p>
                </div>
              </label>

              {form.hasPassage && (
                <div className="p-4 border-t border-slate-200 bg-white space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Passage Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Reading Comprehension - Section A"
                      value={form.passageTitle}
                      onChange={(e) => setForm({ ...form, passageTitle: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-[#1B2A6B] focus:ring-2 focus:ring-[#1B2A6B]/15 text-slate-800 text-sm rounded-lg p-2.5 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Passage Content</label>
                    <textarea
                      rows={4}
                      placeholder="Draft reading passage text here..."
                      value={form.passageText}
                      onChange={(e) => setForm({ ...form, passageText: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-[#1B2A6B] focus:ring-2 focus:ring-[#1B2A6B]/15 text-slate-800 text-sm rounded-lg p-2.5 outline-none transition font-sans"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* QUESTION TEXT EDITOR */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Question Content Text</label>
                  <span className="text-[10px] bg-[#1B2A6B]/5 border border-[#1B2A6B]/15 text-[#1B2A6B] px-2 py-0.5 rounded-full font-bold animate-pulse">
                    Cursor Target: {activeInputId === "question-textarea" ? "Question Text" : `Option ${activeInputId.replace("option", "")}`}
                  </span>
                </div>
                
                {/* Custom Rich Text & Math Toolbar */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-md p-1 self-start flex-wrap">
                  <button
                    type="button"
                    onClick={() => insertFormatting("<b>", "</b>")}
                    className="px-2 py-1 text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-[#1B2A6B] hover:text-white rounded transition shadow-sm cursor-pointer"
                    title="Bold"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => insertFormatting("<i>", "</i>")}
                    className="px-2 py-1 text-xs italic bg-white border border-slate-200 text-slate-700 hover:bg-[#1B2A6B] hover:text-white rounded transition shadow-sm cursor-pointer"
                    title="Italic"
                  >
                    I
                  </button>
                  <button
                    type="button"
                    onClick={() => insertFormatting("<sup>", "</sup>")}
                    className="px-2 py-1 text-xs bg-white border border-slate-200 text-slate-700 hover:bg-[#1B2A6B] hover:text-white rounded transition shadow-sm cursor-pointer"
                    title="Superscript (Exponents)"
                  >
                    x²
                  </button>
                  <button
                    type="button"
                    onClick={() => insertFormatting("<sub>", "</sub>")}
                    className="px-2 py-1 text-xs bg-white border border-slate-200 text-slate-700 hover:bg-[#1B2A6B] hover:text-white rounded transition shadow-sm cursor-pointer"
                    title="Subscript"
                  >
                    x₂
                  </button>
                  <div className="w-[1px] h-4 bg-slate-200 mx-0.5" />
                  <button
                    type="button"
                    onClick={() => setShowMathHelper(!showMathHelper)}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold border rounded transition shadow-sm cursor-pointer ${
                      showMathHelper 
                        ? "bg-[#1B2A6B] text-white border-[#1B2A6B]" 
                        : "bg-white border-slate-200 text-slate-700 hover:bg-[#1B2A6B] hover:text-white"
                    }`}
                    title="Toggle Math Formula Helper Panel"
                  >
                    <span className="font-mono font-extrabold text-sm">∑</span> Math Helper
                  </button>
                </div>
              </div>

              {/* Math Formula Helper Palette */}
              {showMathHelper && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 animate-fade-in shadow-inner">
                  {/* Tabs */}
                  <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
                    {[
                      { id: "fractions", label: "Fractions & Roots" },
                      { id: "algebra", label: "Algebra & Powers" },
                      { id: "calculus", label: "Calculus & Sums" },
                      { id: "symbols", label: "Math Symbols" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setMathTab(tab.id)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                          mathTab === tab.id
                            ? "bg-[#1B2A6B] text-white"
                            : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Tab content */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    {mathTab === "fractions" && (
                      <>
                        <button
                          type="button"
                          onClick={() => insertMath("$\\frac{a}{b}$", 4)}
                          className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-750 flex flex-col items-center gap-1 transition cursor-pointer"
                          title="Insert Inline Fraction"
                        >
                          <span className="text-sm font-semibold">{"$\\frac{a}{b}$"}</span>
                          <span className="text-[10px] text-slate-400">Inline Fraction</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => insertMath("$$\\frac{a}{b}$$", 5)}
                          className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-750 flex flex-col items-center gap-1 transition cursor-pointer"
                          title="Insert Block Fraction"
                        >
                          <span className="text-sm font-semibold">{"$$\\frac{a}{b}$$"}</span>
                          <span className="text-[10px] text-slate-400">Block Fraction</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => insertMath("$\\sqrt{x}$", 2)}
                          className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-750 flex flex-col items-center gap-1 transition cursor-pointer"
                          title="Insert Square Root"
                        >
                          <span className="text-sm font-semibold">{"$\\sqrt{x}$"}</span>
                          <span className="text-[10px] text-slate-400">Square Root</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => insertMath("$\\sqrt[n]{x}$", 5)}
                          className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-750 flex flex-col items-center gap-1 transition cursor-pointer"
                          title="Insert N-th Root"
                        >
                          <span className="text-sm font-semibold">{"$\\sqrt[n]{x}$"}</span>
                          <span className="text-[10px] text-slate-400">N-th Root</span>
                        </button>
                      </>
                    )}

                    {mathTab === "algebra" && (
                      <>
                        <button
                          type="button"
                          onClick={() => insertMath("$x^{n}$", 2)}
                          className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-750 flex flex-col items-center gap-1 transition cursor-pointer"
                        >
                          <span className="text-sm font-semibold">{"$x^n$"}</span>
                          <span className="text-[10px] text-slate-400">Exponent</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => insertMath("$x_{i}$", 2)}
                          className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-750 flex flex-col items-center gap-1 transition cursor-pointer"
                        >
                          <span className="text-sm font-semibold">{"$x_i$"}</span>
                          <span className="text-[10px] text-slate-400">Subscript</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => insertMath("$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$", 0)}
                          className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-750 flex flex-col items-center gap-1 transition cursor-pointer"
                        >
                          <span className="text-xs font-bold text-center truncate w-full">Quadratic</span>
                          <span className="text-[10px] text-slate-400">Formula</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => insertMath("$y = mx + c$", 0)}
                          className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-750 flex flex-col items-center gap-1 transition cursor-pointer"
                        >
                          <span className="text-sm font-semibold">Linear Eq</span>
                          <span className="text-[10px] text-slate-400">Formula</span>
                        </button>
                      </>
                    )}

                    {mathTab === "calculus" && (
                      <>
                        <button
                          type="button"
                          onClick={() => insertMath("$\\sum_{i=1}^{n}$", 7)}
                          className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-750 flex flex-col items-center gap-1 transition cursor-pointer"
                        >
                          <span className="text-sm font-semibold">{"$\\sum$"}</span>
                          <span className="text-[10px] text-slate-400">Summation</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => insertMath("$\\int_{a}^{b} x\\,dx$", 10)}
                          className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-750 flex flex-col items-center gap-1 transition cursor-pointer"
                        >
                          <span className="text-sm font-semibold">{"$\\int$"}</span>
                          <span className="text-[10px] text-slate-400">Integral</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => insertMath("$\\lim_{x \\to 0}$", 2)}
                          className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-750 flex flex-col items-center gap-1 transition cursor-pointer"
                        >
                          <span className="text-sm font-semibold">{"$\\lim$"}</span>
                          <span className="text-[10px] text-slate-400">Limit</span>
                        </button>
                      </>
                    )}

                    {mathTab === "symbols" && (
                      <div className="col-span-2 sm:col-span-4 flex flex-wrap gap-1.5 justify-center max-h-40 overflow-y-auto p-1 bg-white border border-slate-200 rounded-lg">
                        {[
                          { code: "$\\pm$", label: "±" },
                          { code: "$\\times$", label: "×" },
                          { code: "$\\div$", label: "÷" },
                          { code: "$\\neq$", label: "≠" },
                          { code: "$\\approx$", label: "≈" },
                          { code: "$\\le$", label: "≤" },
                          { code: "$\\ge$", label: "≥" },
                          { code: "$\\degree$", label: "°" },
                          { code: "$\\angle$", label: "∠" },
                          { code: "$\\Delta$", label: "Δ" },
                          { code: "$\\pi$", label: "π" },
                          { code: "$\\alpha$", label: "α" },
                          { code: "$\\beta$", label: "β" },
                          { code: "$\\theta$", label: "θ" },
                          { code: "$\\lambda$", label: "λ" },
                          { code: "$\\sigma$", label: "σ" },
                          { code: "$\\omega$", label: "ω" },
                          { code: "$\\Omega$", label: "Ω" },
                          { code: "$\\infty$", label: "∞" },
                        ].map((sym) => (
                          <button
                            key={sym.code}
                            type="button"
                            onClick={() => insertMath(sym.code, 0)}
                            className="px-2 py-1.5 bg-slate-50 hover:bg-[#1B2A6B] hover:text-white rounded border border-slate-200 text-xs font-mono transition cursor-pointer"
                            title={sym.code}
                          >
                            {sym.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <p className="text-[10px] text-slate-400 italic">
                    💡 Tips: Click any mathematical expression above to insert it at your current cursor position. Wrap formulas in single <b>$</b> for inline rendering or <b>$$</b> for centered block equation rendering.
                  </p>
                </div>
              )}

              <textarea
                id="question-textarea"
                rows={5}
                placeholder="Compose the core question content text. Highlight words to apply formatting, or click Math Helper formulas above to insert LaTeX."
                value={form.questionText}
                onFocus={() => setActiveInputId("question-textarea")}
                onChange={(e) => {
                  setForm({ ...form, questionText: e.target.value });
                  if (errors.questionText) setErrors({ ...errors, questionText: "" });
                }}
                className={`w-full bg-slate-50 border ${errors.questionText ? 'border-red-500 ring-2 ring-red-500/10' : 'border-slate-200 focus:border-[#1B2A6B]'} focus:ring-2 focus:ring-[#1B2A6B]/15 text-slate-800 rounded-lg p-2.5 outline-none transition font-sans`}
              />
              {errors.questionText && <p className="text-xs text-red-600 mt-1 font-medium">{errors.questionText}</p>}
            </div>

            {/* DIAGRAMS AND DIAGRAM IMAGE UPLOADER */}
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Diagram / Reference Image</label>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Drag and Drop File Picker */}
                <div
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center transition ${
                    isDragOver ? "border-[#FFD100] bg-[#FFD100]/5" : "border-slate-200 bg-slate-50/50 hover:bg-slate-50"
                  }`}
                >
                  {form.imageUrl ? (
                    <div className="relative group w-24 h-24 rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                      <img src={form.imageUrl} alt="Uploaded Diagram" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, imageUrl: "" })}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition text-xs font-bold cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-slate-400 mb-2" />
                      <label className="text-xs font-semibold text-[#1B2A6B] hover:text-[#152052] cursor-pointer">
                        <span>Drag &amp; drop or click to upload</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadFile(file);
                          }}
                          className="hidden"
                        />
                      </label>
                      <p className="text-[9px] text-slate-400 mt-1">Supports PNG, JPG, or WEBP up to 2MB.</p>
                    </>
                  )}
                </div>

                {/* Manual Text Fallback URL */}
                <div className="flex flex-col justify-center">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Or manual Image Link URL Fallback</label>
                  <input
                    type="text"
                    placeholder="e.g. /uploads/image.png"
                    value={form.imageUrl}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#1B2A6B] focus:ring-2 focus:ring-[#1B2A6B]/15 text-slate-800 text-xs rounded-lg p-2.5 outline-none transition"
                  />
                  <p className="text-[9px] text-slate-400 mt-1">If hosting diagrams externally, paste the full URL path here.</p>
                </div>
              </div>
            </div>

            {/* MULTIPLE CHOICE OPTIONS */}
            {form.questionType !== "THEORY" && (
              <>
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Multiple Choice Options</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">Option A</label>
                      <input
                        type="text"
                        id="optionA"
                        required
                        value={form.optionA}
                        onFocus={() => setActiveInputId("optionA")}
                        onChange={(e) => {
                          setForm({ ...form, optionA: e.target.value });
                          if (errors.optionA) setErrors({ ...errors, optionA: "" });
                        }}
                        className={`w-full bg-slate-50 border ${errors.optionA ? 'border-red-500 ring-2 ring-red-500/10' : 'border-slate-200 focus:border-[#1B2A6B]'} focus:ring-2 focus:ring-[#1B2A6B]/15 text-slate-800 text-sm rounded-lg p-2.5 outline-none transition font-medium`}
                      />
                      {errors.optionA && <p className="text-xs text-red-600 mt-1 font-medium">{errors.optionA}</p>}
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">Option B</label>
                      <input
                        type="text"
                        id="optionB"
                        required
                        value={form.optionB}
                        onFocus={() => setActiveInputId("optionB")}
                        onChange={(e) => {
                          setForm({ ...form, optionB: e.target.value });
                          if (errors.optionB) setErrors({ ...errors, optionB: "" });
                        }}
                        className={`w-full bg-slate-50 border ${errors.optionB ? 'border-red-500 ring-2 ring-red-500/10' : 'border-slate-200 focus:border-[#1B2A6B]'} focus:ring-2 focus:ring-[#1B2A6B]/15 text-slate-800 text-sm rounded-lg p-2.5 outline-none transition font-medium`}
                      />
                      {errors.optionB && <p className="text-xs text-red-600 mt-1 font-medium">{errors.optionB}</p>}
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">Option C</label>
                      <input
                        type="text"
                        id="optionC"
                        required
                        value={form.optionC}
                        onFocus={() => setActiveInputId("optionC")}
                        onChange={(e) => {
                          setForm({ ...form, optionC: e.target.value });
                          if (errors.optionC) setErrors({ ...errors, optionC: "" });
                        }}
                        className={`w-full bg-slate-50 border ${errors.optionC ? 'border-red-500 ring-2 ring-red-500/10' : 'border-slate-200 focus:border-[#1B2A6B]'} focus:ring-2 focus:ring-[#1B2A6B]/15 text-slate-800 text-sm rounded-lg p-2.5 outline-none transition font-medium`}
                      />
                      {errors.optionC && <p className="text-xs text-red-600 mt-1 font-medium">{errors.optionC}</p>}
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">Option D</label>
                      <input
                        type="text"
                        id="optionD"
                        required
                        value={form.optionD}
                        onFocus={() => setActiveInputId("optionD")}
                        onChange={(e) => {
                          setForm({ ...form, optionD: e.target.value });
                          if (errors.optionD) setErrors({ ...errors, optionD: "" });
                        }}
                        className={`w-full bg-slate-50 border ${errors.optionD ? 'border-red-500 ring-2 ring-red-500/10' : 'border-slate-200 focus:border-[#1B2A6B]'} focus:ring-2 focus:ring-[#1B2A6B]/15 text-slate-800 text-sm rounded-lg p-2.5 outline-none transition font-medium`}
                      />
                      {errors.optionD && <p className="text-xs text-red-600 mt-1 font-medium">{errors.optionD}</p>}
                    </div>
                  </div>
                </div>

                {/* CORRECT OPTION */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Correct Option</label>
                  <div className="grid grid-cols-4 gap-3">
                    {["A", "B", "C", "D"].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setForm({ ...form, correctOption: opt })}
                        className={`p-3 rounded-lg border text-sm font-bold transition flex items-center justify-center cursor-pointer ${
                          form.correctOption === opt
                            ? "bg-[#FFD100] border-[#FFD100] text-[#1B2A6B] shadow-sm"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        Option {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

          </div>

          {/* FORM ACTIONS FOOTER PANEL */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <button
              type="button"
              onClick={() => router.push(classId ? `/teacher?classId=${classId}` : "/teacher")}
              className="bg-white hover:bg-slate-50 text-slate-700 px-5 py-2.5 border border-slate-200 rounded-xl font-semibold transition cursor-pointer shadow-sm text-center"
            >
              Cancel
            </button>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => handleSave("DRAFT", "exit")}
                disabled={formSubmitting}
                className="bg-white hover:bg-slate-50 text-[#1B2A6B] border border-[#1B2A6B]/40 px-5 py-2.5 rounded-xl font-semibold transition cursor-pointer shadow-sm text-center"
              >
                Save Draft
              </button>
              
              {!editId && (
                <button
                  type="button"
                  onClick={() => handleSave("PUBLISHED", "another")}
                  disabled={formSubmitting}
                  className="bg-white hover:bg-slate-50 text-[#1B2A6B] border-2 border-[#1B2A6B] px-5 py-2.5 rounded-xl font-semibold transition cursor-pointer shadow-sm text-center"
                >
                  Save &amp; Add Another
                </button>
              )}

              <button
                type="button"
                onClick={() => handleSave("PUBLISHED", "exit")}
                disabled={formSubmitting}
                className="bg-[#1B2A6B] hover:bg-[#152052] text-white px-6 py-2.5 rounded-xl font-semibold transition cursor-pointer shadow-sm border-b-2 border-b-[#FFD100] text-center"
              >
                {editId ? "Update & Publish" : "Save & Publish"}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: STICKY LIVE STUDENT-VIEW PREVIEW (40% width) */}
        <div className="lg:col-span-2">
          <div className="sticky top-20 bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6 max-h-[85vh] flex flex-col">
            <h2 className="text-md font-bold text-slate-800 flex items-center gap-2 pb-3 border-b border-slate-100 flex-shrink-0">
              <Eye className="w-4.5 h-4.5 text-[#1B2A6B]" />
              <span>Real-Time Student Preview</span>
            </h2>

            {/* PREVIEW CONTAINER */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-1">
              {/* Already saved questions in this session */}
              {sessionSavedQuestions.map((q) => renderQuestionCard(q, false))}

              {/* Current in-progress question */}
              {renderQuestionCard(form, true)}
            </div>

            {/* Explanatory note */}
            <div className="bg-slate-50 rounded-xl p-4 flex gap-3 text-xs text-slate-500 flex-shrink-0 mt-4">
              <HelpCircle className="w-5 h-5 text-[#1B2A6B] flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-700 block mb-0.5">Live Student Simulation</span>
                This panel renders the exact layout, tags, formatting, and choice states students see in proctored exam sessions.
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
