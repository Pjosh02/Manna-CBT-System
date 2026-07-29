"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  Users,
  BookOpen,
  Calendar,
  BarChart3,
  Plus,
  Trash2,
  Edit,
  LogOut,
  Loader2,
  FileSpreadsheet,
  FileText,
  Upload,
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  X,
} from "lucide-react";
import MathRenderer from "@/components/MathRenderer";

export default function TeacherDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("roster");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>("");

  // Data lists
  const [students, setStudents] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);

  // UI state
  const [modalType, setModalType] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [studentForm, setStudentForm] = useState({ name: "", rollNumber: "", passportUrl: "" });
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [subjectForm, setSubjectForm] = useState({ name: "" });
  const [examForm, setExamForm] = useState({
    title: "",
    date: "",
    durationMinutes: "45",
    status: "LIVE",
    subjects: [] as { subjectId: string; numberOfQuestions: string }[],
  });
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  
  // Question Bank search & filters state
  const [filterDifficulty, setFilterDifficulty] = useState<string>("");
  const [filterTag, setFilterTag] = useState<string>("");

  const filteredQuestions = questions.filter((q) => {
    if (selectedSubjectId && q.subjectId !== selectedSubjectId) return false;
    if (filterDifficulty && q.difficulty !== filterDifficulty) return false;
    if (filterTag) {
      if (!q.tags) return false;
      const cleanTag = filterTag.toLowerCase().trim();
      const tagsList = q.tags.toLowerCase().split(",").map((t: string) => t.trim());
      if (!tagsList.some((t: string) => t.includes(cleanTag))) return false;
    }
    return true;
  });

  // Fetch Teacher data
  const fetchClassData = async (classIdToFetch: string) => {
    if (!classIdToFetch) return;
    setLoading(true);
    try {
      const classQuery = `?classId=${classIdToFetch}`;
      const [studentsRes, questionsRes, subjectsRes, examsRes, resultsRes] = await Promise.all([
        fetch(`/api/teacher/students${classQuery}`),
        fetch(`/api/teacher/questions${classQuery}`),
        fetch(`/api/teacher/subjects${classQuery}`),
        fetch(`/api/teacher/exams${classQuery}`),
        fetch(`/api/teacher/results${classQuery}`),
      ]);

      const studentsData = await studentsRes.json();
      const questionsData = await questionsRes.json();
      const subjectsData = await subjectsRes.json();
      const examsData = await examsRes.json();
      const resultsData = await resultsRes.json();

      setStudents(studentsData.students || []);
      setQuestions(questionsData.questions || []);
      
      const classSubjects = (subjectsData.subjects || []).filter((sub: any) =>
        sub.classes?.some((c: any) => c.id === classIdToFetch)
      );
      setSubjects(classSubjects);
      if (classSubjects.length > 0) {
        setSelectedSubjectId((prev) => {
          if (prev === null) return null;
          if (classSubjects.some((s: any) => s.id === prev)) return prev;
          return null; // Default to null (All Subjects)
        });
      } else {
        setSelectedSubjectId(null);
      }
      setExams(examsData.exams || []);
      setResults(resultsData.results || []);
    } catch (error) {
      console.error("Error loading teacher class data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initSession = async () => {
      try {
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();
        if (!sessionData.user || sessionData.user.role !== "TEACHER") {
          router.push("/login");
          return;
        }
        setUser(sessionData.user);
        
        const userClasses = sessionData.user.classes || [];
        const initialClassId = sessionData.user.classId || (userClasses.length > 0 ? userClasses[0].id : "");
        setSelectedClassId(initialClassId);
        fetchClassData(initialClassId);
      } catch (err) {
        console.error("Error loading session:", err);
      }
    };
    initSession();
  }, []);

  // Proctoring Monitor States & Logic
  const [proctorExamId, setProctorExamId] = useState<string | null>(null);
  const [proctorData, setProctorData] = useState<any>(null);
  const [proctorLoading, setProctorLoading] = useState(false);

  const fetchProctorData = async (examId: string) => {
    try {
      const res = await fetch(`/api/teacher/exams/${examId}/proctor`);
      const data = await res.json();
      if (res.ok) {
        setProctorData(data);
      }
    } catch (err) {
      console.error("Proctor fetch error:", err);
    }
  };

  useEffect(() => {
    if (!proctorExamId) {
      setProctorData(null);
      return;
    }
    fetchProctorData(proctorExamId);
    const interval = setInterval(() => {
      fetchProctorData(proctorExamId);
    }, 5000);
    return () => clearInterval(interval);
  }, [proctorExamId]);

  const handleForceSubmit = async (studentId: string) => {
    if (!proctorExamId) return;
    if (!confirm("Are you sure you want to force submit this student's exam paper?")) return;
    try {
      const res = await fetch(`/api/teacher/exams/${proctorExamId}/proctor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      if (res.ok) {
        alert("Student's exam has been force submitted.");
        fetchProctorData(proctorExamId);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to force submit");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClassChange = (newClassId: string) => {
    setSelectedClassId(newClassId);
    fetchClassData(newClassId);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  // Student manual creation / edit
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError("");

    const roll = parseInt(studentForm.rollNumber, 10);
    if (isNaN(roll) || roll < 1 || roll > 10000) {
      setFormError("Roll number must be a positive integer between 1 and 10000");
      setFormSubmitting(false);
      return;
    }

    const isEdit = !!editingStudent;
    const url = "/api/teacher/students";
    const method = isEdit ? "PATCH" : "POST";
    const bodyPayload = isEdit
      ? { id: editingStudent.id, ...studentForm }
      : { ...studentForm, classId: selectedClassId };

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${isEdit ? "update" : "add"} student`);
      
      if (isEdit) {
        setStudents(students.map((s) => (s.id === data.student.id ? data.student : s)));
      } else {
        setStudents([...students, data.student]);
      }
      
      setModalType(null);
      setEditingStudent(null);
      setStudentForm({ name: "", rollNumber: "", passportUrl: "" });
      fetchClassData(selectedClassId);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleUploadPassport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload passport");
      setStudentForm((prev) => ({ ...prev, passportUrl: data.url }));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError("");

    try {
      const res = await fetch("/api/teacher/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: subjectForm.name, classId: selectedClassId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add subject");

      setModalType(null);
      setSubjectForm({ name: "" });
      fetchClassData(selectedClassId);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete Student
  const handleDeleteStudent = async (id: string) => {
    if (!confirm("Are you sure you want to remove this student?")) return;
    try {
      const res = await fetch(`/api/admin/students?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setStudents(students.filter((s) => s.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Subject
  const handleDeleteSubject = async (id: string, teacherId: string | null) => {
    if (teacherId !== user?.id) {
      alert("You can only delete subjects that you created.");
      return;
    }
    if (!confirm("Are you sure you want to delete this subject? This will also delete all associated questions, exams, and student attempts!")) return;
    try {
      const res = await fetch(`/api/teacher/subjects?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete subject");
      fetchClassData(selectedClassId);
    } catch (err: any) {
      alert(err.message);
    }
  };



  // Delete Question
  const handleDeleteQuestion = async (id: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return;
    try {
      const res = await fetch(`/api/teacher/questions?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setQuestions(questions.filter((q) => q.id !== id));
        fetchClassData(selectedClassId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Schedule Exam Subject Configuration Helpers
  const handleAddSubjectToExam = () => {
    setExamForm({
      ...examForm,
      subjects: [...examForm.subjects, { subjectId: "", numberOfQuestions: "5" }],
    });
  };

  const handleRemoveSubjectFromExam = (index: number) => {
    const updated = [...examForm.subjects];
    updated.splice(index, 1);
    setExamForm({ ...examForm, subjects: updated });
  };

  const handleUpdateExamSubject = (index: number, key: string, value: string) => {
    const updated = [...examForm.subjects];
    updated[index] = { ...updated[index], [key]: value };
    setExamForm({ ...examForm, subjects: updated });
  };

  // Schedule Exam
  const handleAddExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError("");

    if (examForm.subjects.length === 0) {
      setFormError("At least one subject must be assigned to the exam");
      setFormSubmitting(false);
      return;
    }

    try {
      const payload = {
        id: editingExamId,
        title: examForm.title,
        classId: selectedClassId,
        startTime: `${examForm.date}T00:00:00.000Z`,
        endTime: `${examForm.date}T23:59:59.999Z`,
        durationMinutes: examForm.durationMinutes,
        status: examForm.status,
        subjects: examForm.subjects,
      };
      const method = editingExamId ? "PATCH" : "POST";
      const res = await fetch("/api/teacher/exams", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to schedule exam");

      if (editingExamId) {
        setExams(exams.map((ex) => (ex.id === editingExamId ? data.exam : ex)));
      } else {
        setExams([data.exam, ...exams]);
      }

      setModalType(null);
      setEditingExamId(null);
      setExamForm({
        title: "",
        date: "",
        durationMinutes: "45",
        status: "LIVE",
        subjects: [],
      });
      fetchClassData(selectedClassId);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete Exam
  const handleDeleteExam = async (id: string) => {
    if (!confirm("Are you sure you want to delete this exam?")) return;
    try {
      const res = await fetch(`/api/admin/exams?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setExams(exams.filter((ex) => ex.id !== id));
        fetchClassData(selectedClassId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle Results Visibility
  const handleToggleResultsVisibility = async (id: string, currentReleased: boolean) => {
    try {
      const res = await fetch("/api/teacher/exams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          resultsReleased: !currentReleased,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to toggle results visibility");
      
      setExams(exams.map((ex) => (ex.id === id ? { ...ex, resultsReleased: data.exam.resultsReleased } : ex)));
      setResults((prev) => prev.map((r) => r.exam.id === id ? { ...r, exam: { ...r.exam, resultsReleased: data.exam.resultsReleased } } : r));
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 animate-pulse flex items-center justify-center">
            <img src="/logo.png" alt="Manna Academy Logo" className="w-16 h-16 object-contain" />
          </div>
          <span className="text-slate-500 text-sm font-semibold">Loading Manna Academy Teacher Dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans animate-fade-in">
      {/* Top Header */}
      <header className="bg-[#1B2A6B] border-b border-[#152052] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center">
            <img src="/logo-white.png" alt="Manna Academy Logo" className="w-10 h-10 object-contain" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Manna Academy Teacher Dashboard</h1>
            {user?.classes && user.classes.length > 1 ? (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-zinc-350 text-xs">Active Class:</span>
                <select
                  value={selectedClassId}
                  onChange={(e) => handleClassChange(e.target.value)}
                  className="bg-[#152052] border border-[#1b2a6b]/40 text-red-400 font-semibold text-xs rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-[#FFD100]/50 cursor-pointer"
                >
                  {user.classes.map((c: any) => (
                    <option key={c.id} value={c.id} className="bg-[#1B2A6B] text-white">
                      {c.name} {c.arm}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-zinc-550 text-xs mt-0.5">
                Class Room: <span className="text-red-400 font-semibold">{user?.className || "Unassigned"}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-white">{user?.name}</p>
            <p className="text-xs text-[#FFD100] font-semibold uppercase tracking-wider">Teacher Account</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2.5 bg-[#152052] hover:bg-[#FFD100] hover:text-[#1B2A6B] text-white border border-[#1b2a6b]/20 rounded-xl transition cursor-pointer"
            title="Log Out"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </header>

      {/* Main Body Layout */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Sidebar tabs */}
        <aside className={`transition-all duration-300 ${sidebarCollapsed ? 'w-20' : 'w-full md:w-64'} bg-[#1B2A6B] md:border-r border-[#152052] p-4 space-y-1 text-white flex-shrink-0`}>
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} mb-4 px-2`}>
            {!sidebarCollapsed && <span className="text-xs uppercase font-extrabold tracking-wider text-slate-350">Navigation</span>}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 rounded-lg bg-[#152052] hover:bg-[#FFD100] hover:text-[#1B2A6B] text-slate-200 transition cursor-pointer"
              title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          <button
            onClick={() => setActiveTab("roster")}
            className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3 px-4'} py-3 rounded-xl text-sm font-medium transition cursor-pointer ${
              activeTab === "roster" ? "bg-[#FFD100] text-[#1B2A6B] font-bold shadow-sm" : "text-slate-200 hover:bg-[#152052] hover:text-white"
            }`}
            title="Class Roster"
          >
            <Users className="w-4.5 h-4.5 flex-shrink-0" />
            {!sidebarCollapsed && <span>Class Roster ({students.length})</span>}
          </button>

          <button
            onClick={() => setActiveTab("questions")}
            className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3 px-4'} py-3 rounded-xl text-sm font-medium transition cursor-pointer ${
              activeTab === "questions" ? "bg-[#FFD100] text-[#1B2A6B] font-bold shadow-sm" : "text-slate-200 hover:bg-[#152052] hover:text-white"
            }`}
            title="Questions Bank"
          >
            <BookOpen className="w-4.5 h-4.5 flex-shrink-0" />
            {!sidebarCollapsed && <span>Questions Bank ({questions.length})</span>}
          </button>

          <button
            onClick={() => setActiveTab("exams")}
            className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3 px-4'} py-3 rounded-xl text-sm font-medium transition cursor-pointer ${
              activeTab === "exams" ? "bg-[#FFD100] text-[#1B2A6B] font-bold shadow-sm" : "text-slate-200 hover:bg-[#152052] hover:text-white"
            }`}
            title="Scheduled Tests"
          >
            <Calendar className="w-4.5 h-4.5 flex-shrink-0" />
            {!sidebarCollapsed && <span>Scheduled Tests ({exams.length})</span>}
          </button>

          <button
            onClick={() => setActiveTab("subjects")}
            className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3 px-4'} py-3 rounded-xl text-sm font-medium transition cursor-pointer ${
              activeTab === "subjects" ? "bg-[#FFD100] text-[#1B2A6B] font-bold shadow-sm" : "text-slate-200 hover:bg-[#152052] hover:text-white"
            }`}
            title="Class Subjects"
          >
            <BookOpen className="w-4.5 h-4.5 flex-shrink-0" />
            {!sidebarCollapsed && <span>Class Subjects ({subjects.length})</span>}
          </button>

          <button
            onClick={() => setActiveTab("results")}
            className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3 px-4'} py-3 rounded-xl text-sm font-medium transition cursor-pointer ${
              activeTab === "results" ? "bg-[#FFD100] text-[#1B2A6B] font-bold shadow-sm" : "text-slate-200 hover:bg-[#152052] hover:text-white"
            }`}
            title="Class Performance"
          >
            <BarChart3 className="w-4.5 h-4.5 flex-shrink-0" />
            {!sidebarCollapsed && <span>Class Performance</span>}
          </button>
        </aside>

        {/* Content panel */}
        <main className="flex-1 p-6 overflow-y-auto">

          {/* Quick Summary Stats Bar — always visible */}
          <div className="mb-6 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Students</p>
                <p className="text-2xl font-extrabold text-[#1B2A6B]">{students.length}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Questions</p>
                <p className="text-2xl font-extrabold text-[#1B2A6B]">{questions.length}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Subjects</p>
                <p className="text-2xl font-extrabold text-[#1B2A6B]">{subjects.length}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Exams</p>
                <p className="text-2xl font-extrabold text-[#1B2A6B]">{exams.length}</p>
              </div>
            </div>

            {/* Summary card section */}
          </div>

          {/* TAB 1: CLASS ROSTER */}
          {activeTab === "roster" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">Manage Class Roster</h2>
                  <p className="text-slate-400 text-xs mt-0.5">Students registered under your assigned classroom division.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setModalType("student")}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Add Student
                  </button>
                </div>
              </div>

              {/* Status flags */}
              {(formSuccess || formError) && (
                <div className="space-y-2">
                  {formSuccess && (
                    <div className="p-3 bg-emerald-950/40 border border-emerald-500/20 text-emerald-450 rounded-xl text-xs flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" /> {formSuccess}
                    </div>
                  )}
                  {formError && (
                    <div className="p-3 bg-red-950/40 border border-red-500/20 text-red-400 rounded-xl text-xs whitespace-pre-line flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5" /> {formError}
                    </div>
                  )}
                </div>
              )}

              {/* Students Grid */}
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 text-slate-800">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-xs">
                        <th className="pb-3">Student Name</th>
                        <th className="pb-3">Roll Number</th>
                        <th className="pb-3">Registration Date</th>
                        <th className="pb-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.length === 0 ? (
                        <tr>
                           <td colSpan={4} className="py-4 text-center text-slate-400">No students currently registered. Use manual entry.</td>
                        </tr>
                      ) : (
                        students.map((stud) => (
                          <tr key={stud.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                            <td className="py-3.5 font-bold text-slate-800 font-semibold flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                {stud.passportUrl ? (
                                  <img src={stud.passportUrl} alt={stud.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-xs font-bold text-[#1B2A6B]">{stud.name.substring(0, 2).toUpperCase()}</span>
                                )}
                              </div>
                              <span>{stud.name}</span>
                            </td>
                            <td className="py-3.5 text-slate-500 font-mono text-xs">{stud.rollNumber || stud.email || "N/A"}</td>
                            <td className="py-3.5 text-slate-400 text-xs">{new Date(stud.createdAt).toLocaleDateString()}</td>
                            <td className="py-3.5 text-right">
                              <button
                                onClick={() => {
                                  setEditingStudent(stud);
                                  setStudentForm({ name: stud.name, rollNumber: stud.rollNumber?.toString() || "", passportUrl: stud.passportUrl || "" });
                                  setModalType("student");
                                }}
                                className="p-1.5 hover:text-[#FFD100] transition cursor-pointer mr-1.5"
                                title="Edit Student"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteStudent(stud.id)}
                                className="p-1.5 hover:text-[#FFD100] transition cursor-pointer"
                                title="Delete Student"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: QUESTIONS BANK */}
          {activeTab === "questions" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">My Questions Bank</h2>
                  <p className="text-slate-400 text-xs mt-0.5">Author and view multiple-choice exam questions.</p>
                </div>
              </div>

              {/* Subjects List */}
              {subjects.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Class Subjects Selector</p>
                  <div className="max-h-60 overflow-y-auto pr-1 space-y-2 border border-slate-100 rounded-xl p-2 bg-slate-50/50">
                    {/* All Subjects selection */}
                    <div
                      onClick={() => setSelectedSubjectId(null)}
                      className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer select-none ${
                        selectedSubjectId === null
                          ? "bg-[#1B2A6B]/5 border-[#1B2A6B]/30 text-[#1B2A6B] font-bold"
                          : "bg-white border-slate-200 hover:border-[#1B2A6B]/30 text-slate-800"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <BookOpen className={`w-4 h-4 ${selectedSubjectId === null ? "text-[#1B2A6B]" : "text-slate-400"}`} />
                        <span className="font-semibold text-sm">All Subjects</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-slate-500 font-medium">
                          ({questions.length} Q)
                        </span>
                      </div>
                    </div>

                    {subjects.map((sub) => {
                      const isSelected = selectedSubjectId === sub.id;
                      return (
                        <div
                          key={sub.id}
                          onClick={() => setSelectedSubjectId(sub.id)}
                          className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer select-none ${
                            isSelected
                              ? "bg-[#1B2A6B]/5 border-[#1B2A6B]/30 text-[#1B2A6B]"
                              : "bg-white border-slate-200 hover:border-[#1B2A6B]/30 text-slate-800"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <BookOpen className={`w-4 h-4 ${isSelected ? "text-[#1B2A6B]" : "text-slate-400"}`} />
                            <span className="font-semibold text-sm">{sub.name}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-xs text-slate-500 font-medium">
                              ({sub._count?.questions || 0} Q)
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/teacher/questions/new?subjectId=${sub.id}`);
                              }}
                              className="flex items-center gap-1 bg-[#1B2A6B] hover:bg-[#152052] text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add Question
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {(formSuccess || formError) && (
                <div className="space-y-2">
                  {formSuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" /> {formSuccess}
                    </div>
                  )}
                  {formError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs whitespace-pre-line flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5" /> {formError}
                    </div>
                  )}
                </div>
              )}
              {/* Question Filters Panel */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-450 mb-1">Filter by Difficulty</label>
                  <select
                    value={filterDifficulty}
                    onChange={(e) => setFilterDifficulty(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-700 text-xs rounded-lg p-2 outline-none font-medium"
                  >
                    <option value="">All Difficulties</option>
                    <option value="EASY">EASY</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HARD">HARD</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-450 mb-1">Search Tags</label>
                  <input
                    type="text"
                    placeholder="e.g. algebra, speed"
                    value={filterTag}
                    onChange={(e) => setFilterTag(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-750 text-xs rounded-lg p-2 outline-none font-medium font-sans"
                  />
                </div>
              </div>

              {/* Questions Grid */}
              <div className="space-y-4">
                {filteredQuestions.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400">
                    {selectedSubjectId || filterDifficulty || filterTag
                      ? "No questions found matching the selected subject or filter criteria."
                      : "Your questions bank is empty. Author questions to get started."}
                  </div>
                ) : (
                  filteredQuestions.map((q) => (
                    <div key={q.id} className="bg-white border border-slate-200 hover:border-[#1B2A6B]/30 rounded-2xl p-5 space-y-3 relative group shadow-sm text-slate-800 animate-fade-in">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#1B2A6B] text-white">
                            {q.subject?.name}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#FFD100] text-[#1B2A6B]">
                            {q.assessmentType || "Exam"}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                            {q.points || 1} pt(s)
                          </span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                            q.difficulty === "EASY"
                              ? "bg-emerald-50 border-emerald-250 text-emerald-700"
                              : q.difficulty === "HARD"
                              ? "bg-red-50 border-red-250 text-red-700 font-extrabold"
                              : "bg-blue-50 border-blue-250 text-blue-700"
                          }`}>
                            {q.difficulty || "MEDIUM"}
                          </span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                            q.status === "DRAFT"
                              ? "bg-amber-50 border-amber-200 text-amber-700"
                              : "bg-emerald-50 border-emerald-200 text-emerald-700"
                          }`}>
                            {q.status || "PUBLISHED"}
                          </span>
                          {q.tags && q.tags.split(",").map((tag: string, idx: number) => {
                            const trimmed = tag.trim();
                            if (!trimmed) return null;
                            return (
                              <span key={idx} className="text-[10px] bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded font-medium">
                                #{trimmed}
                              </span>
                            );
                          })}
                        </div>

                        <div className="flex gap-2 opacity-80 md:opacity-0 group-hover:opacity-100 transition duration-200">
                          <button
                            onClick={() => router.push(`/teacher/questions/new?edit=${q.id}`)}
                            className="p-1 text-slate-500 hover:text-[#1B2A6B] transition cursor-pointer"
                            title="Edit Question"
                          >
                            <Edit className="w-4.5 h-4.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="p-1 text-slate-550 hover:text-red-650 transition cursor-pointer"
                            title="Delete Question"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {q.passageTitle && (
                        <div className="bg-orange-500/5 border border-orange-500/10 rounded-xl p-3 text-xs text-orange-400 max-w-2xl">
                          <p className="font-bold mb-1">From comprehension novel: {q.passageTitle}</p>
                          <p className="line-clamp-2 text-slate-500 font-normal italic">"{q.passageText}"</p>
                        </div>
                      )}

                      <MathRenderer text={q.questionText} isHtml={true} className="text-slate-800 font-semibold" />

                      {q.imageUrl && (
                        <div className="border border-zinc-800/80 rounded-xl overflow-hidden max-w-[200px]">
                          <img src={q.imageUrl} alt="diagram" className="w-full h-auto" />
                        </div>
                      )}

                      {/* Options checklist */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                        {[
                          { key: "A", label: q.optionA },
                          { key: "B", label: q.optionB },
                          { key: "C", label: q.optionC },
                          { key: "D", label: q.optionD },
                          ...(q.optionE ? [{ key: "E", label: q.optionE }] : []),
                          ...(q.optionF ? [{ key: "F", label: q.optionF }] : []),
                        ].map((opt) => (
                          <div
                            key={opt.key}
                            className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                              q.correctOption === opt.key
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold"
                                : "bg-zinc-950/40 border-zinc-850 text-slate-500"
                            }`}
                          >
                            <span className="w-5 h-5 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">
                              {opt.key}
                            </span>
                            {opt.label ? (
                              <MathRenderer text={opt.label} inline={true} isHtml={true} className={q.correctOption === opt.key ? "font-bold text-emerald-400" : "text-slate-500"} />
                            ) : (
                              <span className="text-slate-400 italic">Option content not provided</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: SCHEDULED TESTS */}
          {activeTab === "exams" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Test Schedules</h2>
                  <p className="text-zinc-550 text-xs mt-0.5">Manage evaluation schedules for your classroom division.</p>
                </div>
                <button
                  onClick={() => {
                    setExamForm({
                      title: "",
                      date: "",
                      durationMinutes: "45",
                      status: "LIVE",
                      subjects: [],
                    });
                    setModalType("exam");
                  }}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Schedule Exam
                </button>
              </div>

              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 text-slate-800">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-xs">
                        <th className="pb-3">Title</th>
                        <th className="pb-3">Duration</th>
                        <th className="pb-3">Exam Date</th>
                        <th className="pb-3">Subject Blueprint</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3 text-center font-bold">Results</th>
                        <th className="pb-3 text-right font-bold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exams.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-4 text-center text-slate-400">No exams scheduled for your class yet.</td>
                        </tr>
                      ) : (
                        exams.map((ex) => (
                          <tr key={ex.id} className="border-b border-b border-slate-100 hover:bg-slate-50/50">
                            <td className="py-3.5 font-bold text-slate-800 font-semibold">{ex.title}</td>
                            <td className="py-3.5 text-slate-500">{ex.durationMinutes} mins</td>
                            <td className="py-3.5 text-xs text-slate-400">
                              {new Date(ex.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </td>
                            <td className="py-3.5">
                              <div className="flex flex-wrap gap-1">
                                {ex.examSubjects?.map((es: any) => (
                                  <span key={es.subjectId} className="text-[10px] bg-zinc-950 border border-zinc-850 px-2 py-0.5 rounded text-slate-500 font-semibold">
                                    {es.subject?.name}: <span className="text-[#FFD100]">{es.numberOfQuestions} Qs</span>
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-3.5">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${
                                  ex.status === "LIVE"
                                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                    : "bg-blue-500/10 border-blue-500/30 text-blue-400"
                                }`}
                              >
                                {ex.status === "LIVE" ? "OPEN" : "CLOSED"}
                              </span>
                            </td>
                            <td className="py-3.5 text-center">
                              <button
                                onClick={() => handleToggleResultsVisibility(ex.id, ex.resultsReleased)}
                                className={`px-3 py-1.5 rounded-full text-[10px] font-extrabold transition flex items-center gap-1.5 mx-auto cursor-pointer shadow-sm border ${
                                  ex.resultsReleased
                                    ? "bg-emerald-55 border-emerald-300 text-emerald-700"
                                    : "bg-amber-55 border-amber-300 text-amber-700"
                                }`}
                              >
                                {ex.resultsReleased ? (
                                  <>
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Released</span>
                                  </>
                                ) : (
                                  <>
                                    <EyeOff className="w-3.5 h-3.5" />
                                    <span>Hidden</span>
                                  </>
                                )}
                              </button>
                            </td>
                            <td className="py-3.5 text-right space-x-1.5 flex items-center justify-end">
                              <button
                                onClick={() => setProctorExamId(ex.id)}
                                className="p-1.5 hover:text-emerald-600 inline-block transition cursor-pointer text-slate-450"
                                title="Live Proctoring / Monitor Students"
                              >
                                <Users className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingExamId(ex.id);
                                  setExamForm({
                                    title: ex.title,
                                    date: ex.startTime ? new Date(ex.startTime).toISOString().split("T")[0] : "",
                                    durationMinutes: String(ex.durationMinutes),
                                    status: ex.status === "CLOSED" ? "CLOSED" : "LIVE",
                                    subjects: ex.examSubjects.map((es: any) => ({
                                      subjectId: es.subjectId,
                                      numberOfQuestions: String(es.numberOfQuestions),
                                    })),
                                  });
                                  setModalType("exam");
                                }}
                                className="p-1.5 hover:text-[#1B2A6B] inline-block transition cursor-pointer"
                                title="Edit Exam"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteExam(ex.id)}
                                className="p-1.5 hover:text-[#FFD100] inline-block transition cursor-pointer"
                                title="Delete Exam"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CLASS RESULTS */}
          {activeTab === "results" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold">Class Grading Sheet</h2>
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 text-slate-800">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-xs">
                        <th className="pb-3">Student Name</th>
                        <th className="pb-3">Roll Number</th>
                        <th className="pb-3">Exam Session</th>
                        <th className="pb-3 text-center">Score</th>
                        <th className="pb-3 text-center">Time Spent</th>
                        <th className="pb-3 text-right">Completion Date</th>
                        <th className="pb-3 text-right font-bold">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-4 text-center text-slate-400">No grades recorded yet. Students have not submitted active tests.</td>
                        </tr>
                      ) : (
                        results.map((res) => (
                          <tr key={res.id} className="border-b border-b border-slate-100 hover:bg-slate-50/50">
                            <td className="py-3.5 font-bold text-slate-800 font-semibold">{res.student.name}</td>
                            <td className="py-3.5 text-slate-500 font-mono text-xs">{res.student.rollNumber || res.student.email || "N/A"}</td>
                            <td className="py-3.5 text-slate-500">{res.exam.title}</td>
                            <td className="py-3.5 text-center">
                              <span
                                className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                                  res.score >= 50
                                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                                    : "bg-red-500/10 border border-red-500/20 text-red-400"
                                }`}
                              >
                                {res.score}%
                              </span>
                            </td>
                            <td className="py-3.5 text-center text-slate-500 text-xs">
                              {Math.floor(res.timeSpent / 60)}m {res.timeSpent % 60}s
                            </td>
                            <td className="py-3.5 text-right text-slate-400 text-xs">
                              {new Date(res.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-3.5 text-right">
                              <button
                                onClick={() => handleToggleResultsVisibility(res.exam.id, res.exam.resultsReleased)}
                                className={`px-3 py-1 text-xs font-bold rounded-lg transition border cursor-pointer ${
                                  res.exam.resultsReleased
                                    ? "bg-emerald-50 border-emerald-250 text-emerald-700 hover:bg-emerald-100"
                                    : "bg-[#1B2A6B] border-[#1B2A6B] text-white hover:bg-[#152052]"
                                }`}
                              >
                                {res.exam.resultsReleased ? "Released" : "Release"}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: CLASS SUBJECTS */}
          {activeTab === "subjects" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Class Subjects</h2>
                  <p className="text-xs text-slate-500 mt-1">Manage subjects currently enabled for your class.</p>
                </div>
                <button
                  onClick={() => {
                    setModalType("subject");
                    setSubjectForm({ name: "" });
                  }}
                  className="flex items-center gap-2 bg-[#1B2A6B] hover:bg-[#152052] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer shadow-sm border-b-2 border-b-[#FFD100]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Subject</span>
                </button>
              </div>

              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 text-slate-800">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-xs">
                        <th className="pb-3">Subject Name</th>
                        <th className="pb-3">Registration Date</th>
                        <th className="pb-3 text-center">Questions Bank</th>
                        <th className="pb-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjects.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-slate-400">No subjects assigned to this classroom yet. Click Add Subject to register.</td>
                        </tr>
                      ) : (
                        subjects.map((sub) => (
                          <tr key={sub.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                            <td className="py-3.5 font-bold text-slate-800 font-semibold">{sub.name}</td>
                            <td className="py-3.5 text-slate-500 text-xs">
                              {new Date(sub.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-3.5 text-center text-slate-500 font-mono text-xs">
                              {sub._count?.questions || 0} Question(s)
                            </td>
                            <td className="py-3.5 text-right">
                              {sub.teacherId === user?.id ? (
                                <button
                                  onClick={() => handleDeleteSubject(sub.id, sub.teacherId)}
                                  className="p-1.5 hover:text-red-650 transition cursor-pointer text-slate-400"
                                  title="Delete Subject"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              ) : (
                                <span className="text-xs text-slate-400 italic font-normal">System Subject</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* =============================================================== */}
      {/* MODALS PANEL */}
      {/* =============================================================== */}
      {modalType && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl text-slate-800">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-855 capitalize font-sans">
                {modalType === "student" && editingStudent
                  ? "Edit Student Details"
                  : modalType === "student"
                  ? `Add Student to Class`
                  : modalType === "exam"
                  ? (editingExamId ? "Edit Examination Schedule" : "Schedule New Examination")
                  : modalType === "subject"
                  ? "Add Subject to Class"
                  : `Add ${modalType}`}
              </h3>
            </div>

            {formError && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
                {formError}
              </div>
            )}

            <form
              onSubmit={
                modalType === "student"
                  ? handleAddStudent
                  : modalType === "subject"
                  ? handleAddSubject
                  : handleAddExam
              }
              className="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-sm"
            >
              {/* Add Student Manual */}
              {modalType === "student" && (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Student Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Chinedu Okafor"
                      value={studentForm.name}
                      onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-[#1B2A6B] focus:ring-2 focus:ring-[#1B2A6B]/15 text-slate-850 rounded-lg p-2.5 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Roll Number</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={10000}
                      placeholder="e.g. 101"
                      value={studentForm.rollNumber}
                      onChange={(e) => setStudentForm({ ...studentForm, rollNumber: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-[#1B2A6B] focus:ring-2 focus:ring-[#1B2A6B]/15 text-slate-850 rounded-lg p-2.5 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Passport Photograph</label>
                    <div className="flex items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="w-14 h-14 rounded-full bg-slate-200 border border-slate-350 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {studentForm.passportUrl ? (
                          <img src={studentForm.passportUrl} alt="Passport Preview" className="w-full h-full object-cover" />
                        ) : (
                          <Users className="w-6 h-6 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleUploadPassport}
                          className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#1B2A6B] file:text-white hover:file:bg-[#152052] file:cursor-pointer cursor-pointer"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">PNG, JPG or JPEG. Max size 2MB.</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Add Exam Form */}
              {modalType === "exam" && (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Exam Session Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mathematics CA Test"
                      value={examForm.title}
                      onChange={(e) => setExamForm({ ...examForm, title: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-red-500 text-white rounded-lg p-2.5 outline-none transition"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Duration (Minutes)</label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={examForm.durationMinutes}
                        onChange={(e) => setExamForm({ ...examForm, durationMinutes: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 focus:border-red-500 text-white rounded-lg p-2.5 outline-none transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Status</label>
                      <select
                        value={examForm.status}
                        onChange={(e) => setExamForm({ ...examForm, status: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 focus:border-red-500 text-white rounded-lg p-2.5 outline-none transition"
                      >
                        <option value="LIVE">Open</option>
                        <option value="CLOSED">Close</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Exam Date</label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="date"
                        required
                        value={examForm.date}
                        onClick={(e) => {
                          try {
                            (e.target as any).showPicker();
                          } catch (err) {}
                        }}
                        onChange={(e) => setExamForm({ ...examForm, date: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 focus:border-red-500 text-white text-xs rounded-lg p-2.5 pl-9 outline-none transition"
                      />
                    </div>
                  </div>

                  {/* Subjects Configuration */}
                  <div className="border-t border-zinc-800/80 pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Questions per Subject</label>
                      <button
                        type="button"
                        onClick={handleAddSubjectToExam}
                        className="text-xs text-[#FFD100] hover:text-red-400 font-semibold flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Connect Subject
                      </button>
                    </div>

                    {examForm.subjects.length === 0 ? (
                      <p className="text-zinc-650 text-xs italic py-2">Add subjects to load questions for this test.</p>
                    ) : (
                      <div className="space-y-2">
                        {examForm.subjects.map((sub, i) => (
                          <div key={i} className="flex items-center gap-3 bg-zinc-950 p-2.5 rounded-lg border border-zinc-855">
                            <div className="flex-1">
                              <select
                                required
                                value={sub.subjectId}
                                onChange={(e) => handleUpdateExamSubject(i, "subjectId", e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 text-white text-xs rounded p-2"
                              >
                                <option value="">Choose Subject</option>
                                {subjects.map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="w-20">
                              <input
                                type="number"
                                required
                                min="1"
                                placeholder="Qty"
                                value={sub.numberOfQuestions}
                                onChange={(e) => handleUpdateExamSubject(i, "numberOfQuestions", e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 text-white text-xs rounded p-2 text-center"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveSubjectFromExam(i)}
                              className="text-slate-400 hover:text-[#FFD100] p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Add Subject Form */}
              {modalType === "subject" && (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Subject Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mathematics"
                      value={subjectForm.name}
                      onChange={(e) => setSubjectForm({ name: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-[#1B2A6B] focus:ring-2 focus:ring-[#1B2A6B]/15 text-slate-800 text-sm rounded-lg p-2.5 outline-none transition"
                    />
                  </div>
                </>
              )}

              {/* Form Actions */}
              <div className="border-t border-slate-100 pt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setModalType(null);
                    setEditingQuestion(null);
                    setEditingExamId(null);
                    setSubjectForm({ name: "" });
                  }}
                  className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 border border-slate-200 rounded-xl font-semibold transition cursor-pointer shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="bg-[#1B2A6B] hover:bg-[#152052] disabled:bg-slate-200 disabled:text-slate-400 text-white px-5 py-2 rounded-xl font-semibold transition cursor-pointer shadow-sm border-b-2 border-b-[#FFD100]"
                >
                  {formSubmitting ? "Saving..." : "Save Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROCTORING MONITOR CONSOLE MODAL OVERLAY */}
      {proctorExamId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col text-slate-800 font-sans animate-fade-in">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-[#1B2A6B] text-white">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#FFD100]" /> Live Exam Monitoring Console
                </h3>
                <p className="text-xs text-slate-350 mt-1">
                  Exam: <span className="font-semibold">{proctorData?.examTitle || "Loading..."}</span> ({proctorData?.durationMinutes} mins)
                </p>
              </div>
              <button
                onClick={() => setProctorExamId(null)}
                className="p-1.5 hover:bg-[#152052] rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content List */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {!proctorData ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-[#1B2A6B]" />
                  <span className="text-xs font-semibold">Connecting to exam stream...</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-xs">
                        <th className="pb-3">Student Name</th>
                        <th className="pb-3">Roll / Email</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3 text-center">Tab Switches</th>
                        <th className="pb-3">IP Address</th>
                        <th className="pb-3">Last Active</th>
                        <th className="pb-3 text-center">Score</th>
                        <th className="pb-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {proctorData.students.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-4 text-center text-slate-400">No students enrolled in this class.</td>
                        </tr>
                      ) : (
                        proctorData.students.map((student: any) => (
                          <tr key={student.studentId} className="border-b border-slate-100 hover:bg-slate-50/50">
                            <td className="py-3.5 font-bold text-slate-800 font-semibold">{student.name}</td>
                            <td className="py-3.5 text-slate-500 font-mono text-xs">{student.rollNumber}</td>
                            <td className="py-3.5">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded border font-bold ${
                                  student.status === "ONLINE"
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                    : student.status === "SUBMITTED"
                                    ? "bg-blue-50 border-blue-200 text-blue-700"
                                    : student.status === "OFFLINE"
                                    ? "bg-amber-50 border-amber-200 text-amber-700"
                                    : "bg-slate-50 border-slate-200 text-slate-450"
                                }`}
                              >
                                {student.status}
                              </span>
                            </td>
                            <td className="py-3.5 text-center">
                              <span
                                className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded ${
                                  student.tabSwitches >= 3
                                    ? "bg-red-50 border border-red-200 text-red-700 font-black animate-pulse"
                                    : student.tabSwitches > 0
                                    ? "bg-amber-50 border border-amber-200 text-amber-700"
                                    : "bg-slate-50 border border-slate-200 text-slate-500"
                                }`}
                              >
                                {student.tabSwitches} / 3
                              </span>
                            </td>
                            <td className="py-3.5 text-xs text-slate-500 font-mono">{student.ipAddress || "—"}</td>
                            <td className="py-3.5 text-xs text-slate-400">
                              {student.lastActive ? new Date(student.lastActive).toLocaleTimeString() : "—"}
                            </td>
                            <td className="py-3.5 text-center font-mono text-xs font-bold text-slate-700">
                              {student.score !== null ? `${student.score}%` : "—"}
                            </td>
                            <td className="py-3.5 text-right">
                              {student.status !== "SUBMITTED" ? (
                                <button
                                  onClick={() => handleForceSubmit(student.studentId)}
                                  className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer border-b-2 border-red-800 font-sans"
                                >
                                  Force Submit
                                </button>
                              ) : (
                                <span className="text-xs text-slate-400 italic">Submitted</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
