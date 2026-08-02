"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  Users,
  BookOpen,
  Calendar,
  Flag,
  BarChart3,
  Plus,
  Trash2,
  CheckCircle,
  LogOut,
  Loader2,
  Layers,
  Award,
  ChevronRight,
  ChevronLeft,
  Eye,
  EyeOff,
  Edit,
  FileSpreadsheet,
  AlertCircle,
} from "lucide-react";
import MathRenderer from "@/components/MathRenderer";

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("analytics");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  // Data states
  const [analytics, setAnalytics] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);

  // Modals state
  const [modalType, setModalType] = useState<string | null>(null);

  // Form states
  const [classForm, setClassForm] = useState({ name: "", arm: "", academicSession: "2025/2026" });
  const [subjectForm, setSubjectForm] = useState({ name: "", classIds: [] as string[] });
  const [teacherForm, setTeacherForm] = useState({ name: "", email: "", password: "", classIds: [] as string[] });
  const [studentForm, setStudentForm] = useState({ name: "", rollNumber: "", classId: "", passportUrl: "" });
  const [showTeacherPassword, setShowTeacherPassword] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [editingTeacher, setEditingTeacher] = useState<any>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (modalType !== "teacher") {
      setShowTeacherPassword(false);
      setEditingTeacher(null);
      setTeacherForm({ name: "", email: "", password: "", classIds: [] as string[] });
    }
    if (modalType !== "student") {
      setEditingStudent(null);
      setStudentForm({ name: "", rollNumber: "", classId: "", passportUrl: "" });
    }
  }, [modalType]);
  const [examForm, setExamForm] = useState({
    title: "",
    classId: "",
    date: "",
    durationMinutes: "45",
    status: "LIVE",
    subjects: [] as { subjectId: string; numberOfQuestions: string }[],
  });
  const [editingExamId, setEditingExamId] = useState<string | null>(null);

  const [formError, setFormError] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedCaSubjectId, setSelectedCaSubjectId] = useState<string | null>(null);
  const [caScores, setCaScores] = useState<Record<string, { firstCA: string; secondCA: string; examScore: string }>>({});

  useEffect(() => {
    if (classes.length > 0 && !selectedClassId) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes]);

  useEffect(() => {
    const classSubs = subjects.filter((s) => s.classes?.some((c: any) => c.id === selectedClassId) || s.classId === selectedClassId);
    if (classSubs.length > 0) {
      setSelectedCaSubjectId(classSubs[0].id);
    } else {
      setSelectedCaSubjectId(null);
    }
  }, [selectedClassId, subjects]);

  useEffect(() => {
    const initialScores: Record<string, { firstCA: string; secondCA: string; examScore: string }> = {};
    students.forEach((s) => {
      const subScore = s.subjectScores?.find((sc: any) => sc.subjectId === selectedCaSubjectId);
      initialScores[s.id] = {
        firstCA: subScore?.firstCA?.toString() || "",
        secondCA: subScore?.secondCA?.toString() || "",
        examScore: subScore?.examScore?.toString() || "",
      };
    });
    setCaScores(initialScores);
  }, [students, selectedCaSubjectId]);

  const handleCaChange = (studentId: string, field: 'firstCA' | 'secondCA' | 'examScore', value: string) => {
    setCaScores((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
      },
    }));
  };

  const handleSaveSingleCA = async (studentId: string) => {
    const scores = caScores[studentId];
    if (!scores) return;

    setFormSubmitting(true);
    setFormError("");
    setFormSuccess("");
    try {
      const res = await fetch("/api/students/ca", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: studentId,
          subjectId: selectedCaSubjectId,
          firstCA: scores.firstCA === "" ? null : parseFloat(scores.firstCA),
          secondCA: scores.secondCA === "" ? null : parseFloat(scores.secondCA),
          examScore: scores.examScore === "" ? null : parseFloat(scores.examScore),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update CA scores");
      
      setFormSuccess("CA scores updated successfully!");
      fetchData();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleSaveAllCA = async () => {
    const classStudents = students.filter(s => s.classId === selectedClassId);
    const payload = classStudents.map((s) => {
      const scores = caScores[s.id] || { firstCA: "", secondCA: "", examScore: "" };
      return {
        id: s.id,
        subjectId: selectedCaSubjectId,
        firstCA: scores.firstCA === "" ? null : parseFloat(scores.firstCA),
        secondCA: scores.secondCA === "" ? null : parseFloat(scores.secondCA),
        examScore: scores.examScore === "" ? null : parseFloat(scores.examScore),
      };
    });

    setFormSubmitting(true);
    setFormError("");
    setFormSuccess("");
    try {
      const res = await fetch("/api/students/ca", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update all CA scores");

      setFormSuccess(`Successfully saved CA scores for ${data.count} students!`);
      fetchData();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Fetch all initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Session
      const sessionRes = await fetch("/api/auth/session");
      const sessionData = await sessionRes.json();
      if (!sessionData.user || sessionData.user.role !== "ADMIN") {
        router.push("/login");
        return;
      }
      setUser(sessionData.user);

      // 2. Fetch lists
      const [analyticsRes, classesRes, subjectsRes, teachersRes, studentsRes, examsRes, reportsRes] = await Promise.all([
        fetch("/api/admin/analytics"),
        fetch("/api/admin/classes"),
        fetch("/api/admin/subjects"),
        fetch("/api/admin/teachers"),
        fetch("/api/admin/students"),
        fetch("/api/admin/exams"),
        fetch("/api/admin/reports"),
      ]);

      const analyticsData = await analyticsRes.json();
      const classesData = await classesRes.json();
      const subjectsData = await subjectsRes.json();
      const teachersData = await teachersRes.json();
      const studentsData = await studentsRes.json();
      const examsData = await examsRes.json();
      const reportsData = await reportsRes.json();

      setAnalytics(analyticsData);
      setClasses(classesData.classes || []);
      setSubjects(subjectsData.subjects || []);
      setTeachers(teachersData.teachers || []);
      setStudents(studentsData.students || []);
      setExams(examsData.exams || []);
      setReports(reportsData.reports || []);
    } catch (error) {
      console.error("Error loading admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  // Add Class
  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError("");
    try {
      const res = await fetch("/api/admin/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(classForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create class");
      setClasses([...classes, data.class]);
      setModalType(null);
      setClassForm({ name: "", arm: "", academicSession: "2025/2026" });
      fetchData(); // refresh counts
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete Class
  const handleDeleteClass = async (id: string) => {
    if (!confirm("Are you sure you want to delete this class?")) return;
    try {
      const res = await fetch(`/api/admin/classes?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setClasses(classes.filter((c) => c.id !== id));
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add Subject
  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError("");
    try {
      const res = await fetch("/api/admin/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subjectForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create subject");
      setSubjects([...subjects, data.subject]);
      setModalType(null);
      setSubjectForm({ name: "", classIds: [] });
      fetchData();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete Subject
  const handleDeleteSubject = async (id: string) => {
    if (!confirm("Are you sure you want to delete this subject?")) return;
    try {
      const res = await fetch(`/api/admin/subjects?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setSubjects(subjects.filter((s) => s.id !== id));
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add Teacher
  // Add / Edit Teacher
  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError("");

    const isEdit = !!editingTeacher;
    const url = "/api/admin/teachers";
    const method = isEdit ? "PATCH" : "POST";
    const bodyPayload = isEdit
      ? { id: editingTeacher.id, ...teacherForm }
      : teacherForm;

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${isEdit ? "update" : "create"} teacher`);
      
      if (isEdit) {
        setTeachers(teachers.map((t) => (t.id === data.teacher.id ? data.teacher : t)));
      } else {
        setTeachers([...teachers, data.teacher]);
      }
      
      setModalType(null);
      setEditingTeacher(null);
      setTeacherForm({ name: "", email: "", password: "", classIds: [] as string[] });
      fetchData();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete Teacher
  const handleDeleteTeacher = async (id: string) => {
    if (!confirm("Are you sure you want to delete this teacher account?")) return;
    try {
      const res = await fetch(`/api/admin/teachers?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setTeachers(teachers.filter((t) => t.id !== id));
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add / Edit Student
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
    const url = "/api/admin/students";
    const method = isEdit ? "PATCH" : "POST";
    const bodyPayload = isEdit
      ? { id: editingStudent.id, ...studentForm }
      : studentForm;

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${isEdit ? "update" : "create"} student`);
      
      if (isEdit) {
        setStudents(students.map((s) => (s.id === data.student.id ? data.student : s)));
      } else {
        setStudents([...students, data.student]);
      }
      
      setModalType(null);
      setEditingStudent(null);
      setStudentForm({ name: "", rollNumber: "", classId: "", passportUrl: "" });
      fetchData();
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

  // Delete Student
  const handleDeleteStudent = async (id: string) => {
    if (!confirm("Are you sure you want to delete this student account?")) return;
    try {
      const res = await fetch(`/api/admin/students?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setStudents(students.filter((s) => s.id !== id));
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add Subject row to Exam scheduler
  const handleAddSubjectToExam = () => {
    setExamForm({
      ...examForm,
      subjects: [...examForm.subjects, { subjectId: "", numberOfQuestions: "5" }],
    });
  };

  // Remove Subject row from Exam scheduler
  const handleRemoveSubjectFromExam = (index: number) => {
    const updated = [...examForm.subjects];
    updated.splice(index, 1);
    setExamForm({ ...examForm, subjects: updated });
  };

  // Update Subject row details
  const handleUpdateExamSubject = (index: number, key: string, value: string) => {
    const updated = [...examForm.subjects];
    updated[index] = { ...updated[index], [key]: value };
    setExamForm({ ...examForm, subjects: updated });
  };

  // Add Exam
  const handleAddExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError("");

    // Validation
    if (examForm.subjects.length === 0) {
      setFormError("At least one subject must be assigned to the exam");
      setFormSubmitting(false);
      return;
    }

    try {
      const payload = {
        id: editingExamId,
        title: examForm.title,
        classId: examForm.classId,
        startTime: `${examForm.date}T00:00:00.000Z`,
        endTime: `${examForm.date}T23:59:59.999Z`,
        durationMinutes: examForm.durationMinutes,
        status: examForm.status,
        subjects: examForm.subjects,
      };
      const method = editingExamId ? "PATCH" : "POST";
      const res = await fetch("/api/admin/exams", {
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
        classId: "",
        date: "",
        durationMinutes: "45",
        status: "LIVE",
        subjects: [],
      });
      fetchData();
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
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Resolve Report
  const handleResolveReport = async (id: string) => {
    try {
      const res = await fetch("/api/admin/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "RESOLVED" }),
      });
      if (res.ok) {
        setReports(reports.map((r) => (r.id === id ? { ...r, status: "RESOLVED" } : r)));
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 animate-pulse flex items-center justify-center">
            <img src="/logo.png" alt="Manna Academy Logo" className="w-16 h-16 object-contain" />
          </div>
          <span className="text-slate-500 text-sm font-semibold">Loading Manna Academy Admin Dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-[#1B2A6B] border-b border-[#152052] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center">
            <img src="/logo-white.png" alt="Manna Academy Logo" className="w-10 h-10 object-contain" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Manna Academy Admin</h1>
            <p className="text-slate-300 text-xs">Control Panel & System Settings</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold">{user?.name}</p>
            <p className="text-xs text-[#FFD100] font-semibold uppercase tracking-wider">{user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2.5 bg-zinc-800 hover:bg-red-950/40 hover:text-[#FFD100] border border-zinc-700/80 hover:border-red-500/30 rounded-xl transition cursor-pointer flex items-center gap-2"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline text-xs font-semibold">Log out</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Navigation Sidebar */}
        <aside className={`transition-all duration-300 ${sidebarCollapsed ? 'md:w-20' : 'md:w-64'} w-full bg-[#1B2A6B] md:border-r border-[#152052] p-3 md:p-4 text-white flex-shrink-0 flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible gap-2 md:gap-1.5 md:space-y-1`}>
          <div className={`hidden md:flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} mb-4 px-2`}>
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
            onClick={() => setActiveTab("analytics")}
            className={`w-auto md:w-full flex items-center ${sidebarCollapsed ? 'md:justify-center' : 'gap-3 px-4'} py-2.5 md:py-3 px-3 md:px-4 rounded-xl text-sm font-medium transition cursor-pointer flex-shrink-0 ${
              activeTab === "analytics" ? "bg-[#FFD100] text-[#1B2A6B] font-bold shadow-sm" : "text-slate-200 hover:bg-[#152052] hover:text-white"
            }`}
            title="Overview & Analytics"
          >
            <BarChart3 className="w-4.5 h-4.5 flex-shrink-0" />
            <span className={sidebarCollapsed ? "inline md:hidden" : ""}>Overview & Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab("classes")}
            className={`w-auto md:w-full flex items-center ${sidebarCollapsed ? 'md:justify-center' : 'gap-3 px-4'} py-2.5 md:py-3 px-3 md:px-4 rounded-xl text-sm font-medium transition cursor-pointer flex-shrink-0 ${
              activeTab === "classes" ? "bg-[#FFD100] text-[#1B2A6B] font-bold shadow-sm" : "text-slate-200 hover:bg-[#152052] hover:text-white"
            }`}
            title="Classes & Subjects"
          >
            <Layers className="w-4.5 h-4.5 flex-shrink-0" />
            <span className={sidebarCollapsed ? "inline md:hidden" : ""}>Classes & Subjects</span>
          </button>

          <button
            onClick={() => setActiveTab("teachers")}
            className={`w-auto md:w-full flex items-center ${sidebarCollapsed ? 'md:justify-center' : 'gap-3 px-4'} py-2.5 md:py-3 px-3 md:px-4 rounded-xl text-sm font-medium transition cursor-pointer flex-shrink-0 ${
              activeTab === "teachers" ? "bg-[#FFD100] text-[#1B2A6B] font-bold shadow-sm" : "text-slate-200 hover:bg-[#152052] hover:text-white"
            }`}
            title="Teachers & Students"
          >
            <Users className="w-4.5 h-4.5 flex-shrink-0" />
            <span className={sidebarCollapsed ? "inline md:hidden" : ""}>Teachers & Students</span>
          </button>

          <button
            onClick={() => setActiveTab("exams")}
            className={`w-auto md:w-full flex items-center ${sidebarCollapsed ? 'md:justify-center' : 'gap-3 px-4'} py-2.5 md:py-3 px-3 md:px-4 rounded-xl text-sm font-medium transition cursor-pointer flex-shrink-0 ${
              activeTab === "exams" ? "bg-[#FFD100] text-[#1B2A6B] font-bold shadow-sm" : "text-slate-200 hover:bg-[#152052] hover:text-white"
            }`}
            title="Exams Scheduler"
          >
            <Calendar className="w-4.5 h-4.5 flex-shrink-0" />
            <span className={sidebarCollapsed ? "inline md:hidden" : ""}>Exams Scheduler</span>
          </button>

          <button
            onClick={() => setActiveTab("ca")}
            className={`w-auto md:w-full flex items-center ${sidebarCollapsed ? 'md:justify-center' : 'gap-3 px-4'} py-2.5 md:py-3 px-3 md:px-4 rounded-xl text-sm font-medium transition cursor-pointer flex-shrink-0 ${
              activeTab === "ca" ? "bg-[#FFD100] text-[#1B2A6B] font-bold shadow-sm" : "text-slate-200 hover:bg-[#152052] hover:text-white"
            }`}
            title="CA & Exam Scores"
          >
            <FileSpreadsheet className="w-4.5 h-4.5 flex-shrink-0" />
            <span className={sidebarCollapsed ? "inline md:hidden" : ""}>CA & Exam Scores</span>
          </button>

          <button
            onClick={() => setActiveTab("reports")}
            className={`w-auto md:w-full flex items-center ${sidebarCollapsed ? 'md:justify-center' : 'gap-3 px-4'} py-2.5 md:py-3 px-3 md:px-4 rounded-xl text-sm font-medium transition cursor-pointer flex-shrink-0 ${
              activeTab === "reports" ? "bg-[#FFD100] text-[#1B2A6B] font-bold shadow-sm" : "text-slate-200 hover:bg-[#152052] hover:text-white"
            }`}
            title="Flagged Reports"
          >
            <div className="flex items-center gap-3 w-full">
              <Flag className="w-4.5 h-4.5 flex-shrink-0" />
              <span className={sidebarCollapsed ? "inline md:hidden" : ""}>Flagged Reports</span>
              {analytics?.counts?.reports > 0 && (
                <span className={`bg-red-500 text-white text-xxs px-2 py-0.5 rounded-full font-bold shadow-sm ${sidebarCollapsed ? 'md:hidden' : ''}`}>
                  {analytics.counts.reports}
                </span>
              )}
            </div>
          </button>
        </aside>

        {/* Workspace Area */}
        <main className="flex-1 p-6 overflow-y-auto">
          {/* TAB 1: OVERVIEW & ANALYTICS */}
          {activeTab === "analytics" && (
            <div className="space-y-8">
              {/* Stat Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Total Classes", value: analytics?.counts?.classes, icon: Layers },
                  { label: "Active Subjects", value: analytics?.counts?.subjects, icon: BookOpen },
                  { label: "Assigned Teachers", value: analytics?.counts?.teachers, icon: Users },
                  { label: "Enrolled Students", value: analytics?.counts?.students, icon: GraduationCap },
                ].map((stat, i) => (
                  <div key={i} className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 flex items-center justify-between text-slate-800">
                    <div>
                      <p className="text-slate-300 text-xs font-semibold uppercase tracking-wider">{stat.label}</p>
                      <h3 className="text-2xl font-extrabold mt-1 text-slate-800">{stat.value || 0}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-[#1B2A6B]/10 border border-[#1B2A6B]/20 flex items-center justify-center text-[#1B2A6B]">
                      <stat.icon className="w-5 h-5" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Advanced Analytics Columns */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Performers */}
                <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 text-slate-800">
                  <div className="flex items-center gap-2 mb-4">
                    <Award className="w-5 h-5 text-[#FFD100]" />
                    <h3 className="text-base font-bold">Top Performing Students</h3>
                  </div>
                  {analytics?.topStudents?.length === 0 ? (
                    <p className="text-slate-400 text-sm py-4">No exam results recorded yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {analytics?.topStudents?.map((student: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
                          <div className="flex items-center gap-3">
                            <span className="w-6 text-sm font-bold text-zinc-600">#{i + 1}</span>
                            <div>
                              <p className="text-sm font-semibold">{student.name}</p>
                              <p className="text-xs text-slate-400">{student.email || (student.rollNumber ? `Roll No: ${student.rollNumber}` : 'N/A')}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[#FFD100] font-bold">{student.averageScore}%</span>
                            <p className="text-xs text-slate-400">{student.examsTaken} exam(s)</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Most Missed Questions */}
                <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 text-slate-800">
                  <div className="flex items-center gap-2 mb-4">
                    <Flag className="w-5 h-5 text-[#FFD100]" />
                    <h3 className="text-base font-bold">High Failure-Rate Questions</h3>
                  </div>
                  {analytics?.mostMissedQuestions?.length === 0 ? (
                    <p className="text-slate-400 text-sm py-4">No question attempt logs available yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {analytics?.mostMissedQuestions?.map((q: any, i: number) => (
                        <div key={i} className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                              {q.subject}
                            </span>
                            <span className="text-xs font-bold text-[#FFD100]">{q.failureRate}% Failure Rate</span>
                          </div>
                          <div className="text-sm text-slate-700 line-clamp-2 italic flex">
                            <span>"</span>
                            <MathRenderer text={q.questionText} inline={true} isHtml={true} />
                            <span>"</span>
                          </div>
                          <p className="text-xs text-slate-400">Missed in {q.incorrectAttempts} of {q.totalAttempts} total attempts.</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CLASSES & SUBJECTS */}
          {activeTab === "classes" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Classes & Subjects Database</h2>
                <div className="flex gap-3">
                  <button
                    onClick={() => setModalType("class")}
                    className="flex items-center gap-2 bg-[#1B2A6B] hover:bg-[#152052] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer shadow-sm border-b-2 border-b-[#FFD100]"
                  >
                    <Plus className="w-4 h-4" /> Add Class
                  </button>
                  <button
                    onClick={() => setModalType("subject")}
                    className="flex items-center gap-2 bg-white hover:bg-slate-50 text-[#1B2A6B] px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold transition cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Add Subject
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Classes Table */}
                <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 text-slate-800">
                  <h3 className="text-base font-bold mb-4">Classes List</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="border-b border-zinc-800 text-slate-400 font-semibold uppercase tracking-wider text-xs">
                          <th className="pb-3">Class Name</th>
                          <th className="pb-3">Arm</th>
                          <th className="pb-3">Session</th>
                          <th className="pb-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classes.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-4 text-center text-slate-400">No classes registered.</td>
                          </tr>
                        ) : (
                          classes.map((cls) => (
                            <tr key={cls.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                              <td className="py-3.5 font-medium">{cls.name}</td>
                              <td className="py-3.5 text-slate-500">{cls.arm}</td>
                              <td className="py-3.5 text-slate-400">{cls.academicSession}</td>
                              <td className="py-3.5 text-right">
                                <button
                                  onClick={() => handleDeleteClass(cls.id)}
                                  className="p-1.5 hover:text-[#FFD100] transition cursor-pointer"
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

                {/* Subjects Table */}
                <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 text-slate-800">
                  <h3 className="text-base font-bold mb-4">Subjects Registry</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="border-b border-zinc-800 text-slate-400 font-semibold uppercase tracking-wider text-xs">
                          <th className="pb-3">Subject Name</th>
                          <th className="pb-3">Assigned Classes</th>
                          <th className="pb-3">Questions Count</th>
                          <th className="pb-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subjects.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-4 text-center text-slate-400">No subjects registered.</td>
                          </tr>
                        ) : (
                          subjects.map((sub) => (
                            <tr key={sub.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                              <td className="py-3.5 font-medium">{sub.name}</td>
                              <td className="py-3.5">
                                <div className="flex flex-wrap gap-1">
                                  {sub.classes?.map((c: any) => (
                                    <span key={c.id} className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-zinc-700/60">
                                      {c.name} {c.arm}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="py-3.5 text-slate-500">{sub._count?.questions || 0} questions</td>
                              <td className="py-3.5 text-right">
                                <button
                                  onClick={() => handleDeleteSubject(sub.id)}
                                  className="p-1.5 hover:text-[#FFD100] transition cursor-pointer"
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
            </div>
          )}

          {/* TAB 3: TEACHERS & STUDENTS */}
          {activeTab === "teachers" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">User Access Management</h2>
                <div className="flex gap-3">
                  <button
                    onClick={() => setModalType("teacher")}
                    className="flex items-center gap-2 bg-[#1B2A6B] hover:bg-[#152052] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer shadow-sm border-b-2 border-b-[#FFD100]"
                  >
                    <Plus className="w-4 h-4" /> Add Teacher
                  </button>
                  <button
                    onClick={() => setModalType("student")}
                    className="flex items-center gap-2 bg-white hover:bg-slate-50 text-[#1B2A6B] px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold transition cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Add Student
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Teachers Table */}
                <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 text-slate-800">
                  <h3 className="text-base font-bold mb-4">Teachers List</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="border-b border-zinc-800 text-slate-400 font-semibold uppercase tracking-wider text-xs">
                          <th className="pb-3">Name</th>
                          <th className="pb-3">Email</th>
                          <th className="pb-3">Assigned Class</th>
                          <th className="pb-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teachers.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-4 text-center text-slate-400">No teachers registered.</td>
                          </tr>
                        ) : (
                          teachers.map((t) => (
                            <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                              <td className="py-3.5 font-medium">{t.name}</td>
                              <td className="py-3.5 text-slate-500">{t.email}</td>
                              <td className="py-3.5">
                                {t.classes && t.classes.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {t.classes.map((c: any) => (
                                      <span key={c.id} className="text-xs bg-[#1B2A6B]/10 border border-[#1B2A6B]/25 text-[#1B2A6B] px-2 py-0.5 rounded">
                                        {c.name} {c.arm}
                                      </span>
                                    ))}
                                  </div>
                                ) : t.class ? (
                                  <span className="text-xs bg-[#1B2A6B]/10 border border-[#1B2A6B]/25 text-[#1B2A6B] px-2 py-0.5 rounded">
                                    {t.class.name} {t.class.arm}
                                  </span>
                                ) : (
                                  <span className="text-xs text-zinc-600 italic">None</span>
                                )}
                              </td>
                              <td className="py-3.5 text-right">
                                <button
                                  onClick={() => {
                                    setEditingTeacher(t);
                                    setTeacherForm({
                                      name: t.name,
                                      email: t.email,
                                      password: "",
                                      classIds: t.classes ? t.classes.map((c: any) => c.id) : (t.classId ? [t.classId] : [])
                                    });
                                    setModalType("teacher");
                                  }}
                                  className="p-1.5 hover:text-[#FFD100] transition cursor-pointer mr-1.5"
                                  title="Edit Teacher"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteTeacher(t.id)}
                                  className="p-1.5 hover:text-[#FFD100] transition cursor-pointer"
                                  title="Delete Teacher"
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

                {/* Students Table */}
                <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 text-slate-800">
                  <h3 className="text-base font-bold mb-4">Students Registry</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="border-b border-zinc-800 text-slate-400 font-semibold uppercase tracking-wider text-xs">
                          <th className="pb-3">Name</th>
                          <th className="pb-3">Roll Number</th>
                          <th className="pb-3">Class Scope</th>
                          <th className="pb-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-4 text-center text-slate-400">No students registered.</td>
                          </tr>
                        ) : (
                          students.map((s) => (
                            <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                              <td className="py-3.5 font-medium flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                  {s.passportUrl ? (
                                    <img src={s.passportUrl} alt={s.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-xs font-bold text-[#1B2A6B]">{s.name.substring(0, 2).toUpperCase()}</span>
                                  )}
                                </div>
                                <span>{s.name}</span>
                              </td>
                              <td className="py-3.5 text-slate-500 font-mono text-xs">{s.rollNumber || "N/A"}</td>
                              <td className="py-3.5">
                                {s.class ? (
                                  <span className="text-xs bg-slate-100 text-slate-700 border border-zinc-700 text-slate-700 px-2 py-0.5 rounded">
                                    {s.class.name} {s.class.arm}
                                  </span>
                                ) : (
                                  <span className="text-xs text-zinc-600 italic">None</span>
                                )}
                              </td>
                              <td className="py-3.5 text-right">
                                <button
                                  onClick={() => {
                                    setEditingStudent(s);
                                    setStudentForm({ name: s.name, rollNumber: s.rollNumber?.toString() || "", classId: s.classId || "", passportUrl: s.passportUrl || "" });
                                    setModalType("student");
                                  }}
                                  className="p-1.5 hover:text-[#FFD100] transition cursor-pointer mr-1.5"
                                  title="Edit Student"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteStudent(s.id)}
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
            </div>
          )}

          {/* TAB 4: EXAMS SCHEDULER */}
          {activeTab === "exams" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Exam Schedules & Configuration</h2>
                <button
                  onClick={() => {
                    setEditingExamId(null);
                    setExamForm({
                      title: "",
                      classId: "",
                      date: "",
                      durationMinutes: "45",
                      status: "LIVE",
                      subjects: [],
                    });
                    setModalType("exam");
                  }}
                  className="flex items-center gap-2 bg-[#1B2A6B] hover:bg-[#152052] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer shadow-sm border-b-2 border-b-[#FFD100]"
                >
                  <Plus className="w-4 h-4" /> Create Exam Session
                </button>
              </div>

              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 text-slate-800">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-zinc-800 text-slate-400 font-semibold uppercase tracking-wider text-xs">
                        <th className="pb-3">Exam Session Title</th>
                        <th className="pb-3">Target Class</th>
                        <th className="pb-3">Duration</th>
                        <th className="pb-3">Exam Date</th>
                        <th className="pb-3">Assigned Subjects</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exams.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-4 text-center text-slate-400">No exams configured yet.</td>
                        </tr>
                      ) : (
                        exams.map((ex) => (
                          <tr key={ex.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                            <td className="py-4 font-bold text-slate-850">{ex.title}</td>
                            <td className="py-4 text-slate-500">{ex.class ? `${ex.class.name} ${ex.class.arm}` : "N/A"}</td>
                            <td className="py-4 text-slate-700 font-medium">{ex.durationMinutes} mins</td>
                            <td className="py-4 text-slate-300 text-xs">
                              {new Date(ex.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </td>
                            <td className="py-4">
                              <div className="space-y-1">
                                {ex.examSubjects?.map((es: any) => (
                                  <div key={es.subjectId} className="text-xs text-slate-500 flex items-center justify-between min-w-[140px] bg-slate-50 p-1.5 rounded border border-slate-200">
                                    <span>{es.subject?.name}:</span>
                                    <span className="font-semibold text-[#FFD100]">{es.numberOfQuestions} Qs</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="py-4">
                              <span
                                className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${
                                  ex.status === "LIVE"
                                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                    : ex.status === "SCHEDULED"
                                    ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                                    : ex.status === "CLOSED"
                                    ? "bg-zinc-500/10 border-zinc-500/30 text-zinc-450"
                                    : "bg-orange-500/10 border-orange-500/30 text-orange-400"
                                }`}
                              >
                                {ex.status}
                              </span>
                            </td>
                            <td className="py-4 text-right space-x-1.5 flex items-center justify-end">
                              <button
                                onClick={() => {
                                  setEditingExamId(ex.id);
                                  setExamForm({
                                    title: ex.title,
                                    classId: ex.classId,
                                    date: ex.startTime ? new Date(ex.startTime).toISOString().split("T")[0] : "",
                                    durationMinutes: String(ex.durationMinutes),
                                    status: ex.status,
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

          {/* TAB: CA & EXAM SCORES */}
          {activeTab === "ca" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">Continuous Assessment & Exam Scores</h2>
                  <p className="text-slate-400 text-xs mt-0.5">View and update academic CA and final exam scores per class.</p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 outline-none cursor-pointer focus:ring-1 focus:ring-[#1B2A6B]"
                  >
                    <option value="">Select Class Room</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.arm}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedCaSubjectId || ""}
                    onChange={(e) => setSelectedCaSubjectId(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 outline-none cursor-pointer focus:ring-1 focus:ring-[#1B2A6B]"
                    disabled={!selectedClassId}
                  >
                    <option value="">Select Subject</option>
                    {subjects
                      .filter((s) => s.classes?.some((c: any) => c.id === selectedClassId) || s.classId === selectedClassId)
                      .map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={handleSaveAllCA}
                    disabled={formSubmitting || !selectedClassId || !selectedCaSubjectId}
                    className="flex items-center gap-2 bg-[#FFD100] hover:bg-[#FFD100]/90 text-[#1B2A6B] px-4 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>{formSubmitting ? "Saving..." : "Save All Scores"}</span>
                  </button>
                </div>
              </div>

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

              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 text-slate-800">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-xs">
                        <th className="pb-3">Student Name</th>
                        <th className="pb-3">Roll Number</th>
                        <th className="pb-3 text-center">First CA (20)</th>
                        <th className="pb-3 text-center">Second CA (20)</th>
                        <th className="pb-3 text-center">Exam Score (60)</th>
                        <th className="pb-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!selectedClassId ? (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-slate-400">Please select a class from the dropdown to load students.</td>
                        </tr>
                      ) : students.filter((s) => s.classId === selectedClassId).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-slate-400">No students registered in this class.</td>
                        </tr>
                      ) : (
                        students
                          .filter((s) => s.classId === selectedClassId)
                          .map((stud) => {
                            const scores = caScores[stud.id] || { firstCA: "", secondCA: "", examScore: "" };
                            return (
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
                                <td className="py-3.5 text-slate-500 font-mono text-xs">{stud.rollNumber || "N/A"}</td>
                                <td className="py-3.5 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.5"
                                    value={scores.firstCA}
                                    onChange={(e) => handleCaChange(stud.id, "firstCA", e.target.value)}
                                    placeholder="0.0"
                                    className="w-24 bg-slate-50 border border-slate-200 focus:border-[#1B2A6B] focus:ring-1 focus:ring-[#1B2A6B]/20 text-slate-850 text-xs rounded-lg p-2 outline-none text-center inline-block transition"
                                  />
                                </td>
                                <td className="py-3.5 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.5"
                                    value={scores.secondCA}
                                    onChange={(e) => handleCaChange(stud.id, "secondCA", e.target.value)}
                                    placeholder="0.0"
                                    className="w-24 bg-slate-50 border border-slate-200 focus:border-[#1B2A6B] focus:ring-1 focus:ring-[#1B2A6B]/20 text-slate-850 text-xs rounded-lg p-2 outline-none text-center inline-block transition"
                                  />
                                </td>
                                <td className="py-3.5 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    max="60"
                                    step="0.5"
                                    value={scores.examScore}
                                    onChange={(e) => handleCaChange(stud.id, "examScore", e.target.value)}
                                    placeholder="0.0"
                                    className="w-24 bg-slate-50 border border-slate-200 focus:border-[#1B2A6B] focus:ring-1 focus:ring-[#1B2A6B]/20 text-slate-850 text-xs rounded-lg p-2 outline-none text-center inline-block transition"
                                  />
                                </td>
                                <td className="py-3.5 text-right">
                                  <button
                                    onClick={() => handleSaveSingleCA(stud.id)}
                                    disabled={formSubmitting || !selectedCaSubjectId}
                                    className="px-3.5 py-1.5 text-xs font-bold bg-[#1B2A6B] hover:bg-[#152052] text-white rounded-lg transition border border-transparent shadow-sm cursor-pointer disabled:opacity-50"
                                  >
                                    Save Row
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: FLAGGED REPORTS */}
          {activeTab === "reports" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold">Student Reported Questions</h2>
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 text-slate-800">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-zinc-800 text-slate-400 font-semibold uppercase tracking-wider text-xs">
                        <th className="pb-3">Student</th>
                        <th className="pb-3">Subject</th>
                        <th className="pb-3">Question Issue</th>
                        <th className="pb-3">Reason For Report</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-slate-400">No question reports filed.</td>
                        </tr>
                      ) : (
                        reports.map((rep) => (
                          <tr key={rep.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                            <td className="py-4 font-medium">
                              <p>{rep.student.name}</p>
                              <span className="text-xs text-slate-400 font-mono">{rep.student.email || (rep.student.rollNumber ? `Roll No: ${rep.student.rollNumber}` : '')}</span>
                            </td>
                            <td className="py-4 text-slate-500">{rep.question.subject.name}</td>
                            <td className="py-4 max-w-xs">
                              <div className="text-slate-700 italic truncate flex gap-1 items-center">
                                <span>"</span>
                                <MathRenderer text={rep.question.questionText} inline={true} isHtml={true} />
                                <span>"</span>
                              </div>
                              <div className="flex flex-wrap gap-2 text-[10px] font-mono text-slate-400 mt-1">
                                <span className="flex items-center gap-0.5">A: <MathRenderer text={rep.question.optionA} inline={true} isHtml={true} /></span>
                                <span className="flex items-center gap-0.5">B: <MathRenderer text={rep.question.optionB} inline={true} isHtml={true} /></span>
                                <span className="flex items-center gap-0.5">C: <MathRenderer text={rep.question.optionC} inline={true} isHtml={true} /></span>
                                <span className="flex items-center gap-0.5">D: <MathRenderer text={rep.question.optionD} inline={true} isHtml={true} /></span>
                                <span className="text-[#FFD100] font-bold">Correct: {rep.question.correctOption}</span>
                              </div>
                            </td>
                            <td className="py-4 text-slate-500 font-medium">{rep.reason}</td>
                            <td className="py-4">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${
                                  rep.status === "OPEN"
                                    ? "bg-red-500/10 border-red-500/20 text-red-400"
                                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                }`}
                              >
                                {rep.status}
                              </span>
                            </td>
                            <td className="py-4 text-right">
                              {rep.status === "OPEN" && (
                                <button
                                  onClick={() => handleResolveReport(rep.id)}
                                  className="flex items-center gap-1.5 ml-auto text-xs bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-600 hover:text-white px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" /> Resolve
                                </button>
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
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative text-slate-800">
            <div className="p-6 border-b border-zinc-800">
              <h3 className="text-lg font-bold text-white capitalize">
                {modalType === "student" && editingStudent
                  ? "Edit Student Details"
                  : modalType === "teacher" && editingTeacher
                  ? "Edit Teacher Details"
                  : modalType === "exam" && editingExamId
                  ? "Edit Exam Session"
                  : `Create New ${modalType === "exam" ? "Exam Session" : modalType}`}
              </h3>
            </div>

            {formError && (
              <div className="mx-6 mt-4 p-3 bg-red-950/40 border border-red-500/30 text-red-400 rounded-xl text-xs">
                {formError}
              </div>
            )}

            <form
              onSubmit={
                modalType === "class"
                  ? handleAddClass
                  : modalType === "subject"
                  ? handleAddSubject
                  : modalType === "teacher"
                  ? handleAddTeacher
                  : modalType === "student"
                  ? handleAddStudent
                  : handleAddExam
              }
              className="p-6 space-y-4 max-h-[70vh] overflow-y-auto"
            >
              {/* Add Class Form */}
              {modalType === "class" && (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Class Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. SS3"
                      value={classForm.name}
                      onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-[#1B2A6B] focus:ring-2 focus:ring-[#1B2A6B]/15 text-slate-800 text-sm rounded-lg p-2.5 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Arm / Division</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Gold"
                      value={classForm.arm}
                      onChange={(e) => setClassForm({ ...classForm, arm: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-[#1B2A6B] focus:ring-2 focus:ring-[#1B2A6B]/15 text-slate-800 text-sm rounded-lg p-2.5 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Academic Session</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 2025/2026"
                      value={classForm.academicSession}
                      onChange={(e) => setClassForm({ ...classForm, academicSession: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-[#1B2A6B] focus:ring-2 focus:ring-[#1B2A6B]/15 text-slate-800 text-sm rounded-lg p-2.5 outline-none transition"
                    />
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
                      onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-[#1B2A6B] focus:ring-2 focus:ring-[#1B2A6B]/15 text-slate-800 text-sm rounded-lg p-2.5 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Connect to Classes</label>
                    <div className="grid grid-cols-2 gap-2 mt-1.5">
                      {classes.map((cls) => (
                        <label key={cls.id} className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs cursor-pointer select-none text-slate-700">
                          <input
                            type="checkbox"
                            checked={subjectForm.classIds.includes(cls.id)}
                            onChange={(e) => {
                              const updated = e.target.checked
                                ? [...subjectForm.classIds, cls.id]
                                : subjectForm.classIds.filter((id) => id !== cls.id);
                              setSubjectForm({ ...subjectForm, classIds: updated });
                            }}
                            className="accent-red-600"
                          />
                          <span>{cls.name} {cls.arm}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Add Teacher Form */}
              {modalType === "teacher" && (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Teacher Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Mr. John Doe"
                      value={teacherForm.name}
                      onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-[#1B2A6B] focus:ring-2 focus:ring-[#1B2A6B]/15 text-slate-800 text-sm rounded-lg p-2.5 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="teacher@school.com"
                      value={teacherForm.email}
                      onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-[#1B2A6B] focus:ring-2 focus:ring-[#1B2A6B]/15 text-slate-800 text-sm rounded-lg p-2.5 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Password</label>
                    <div className="relative">
                      <input
                        type={showTeacherPassword ? "text" : "password"}
                        required={!editingTeacher}
                        placeholder={editingTeacher ? "•••••••• (Leave blank to keep current)" : "••••••••"}
                        value={teacherForm.password}
                        onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 text-white text-sm rounded-lg p-2.5 pr-10 outline-none transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowTeacherPassword(!showTeacherPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                      >
                        {showTeacherPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Assign Classes</label>
                    <div className="grid grid-cols-2 gap-2 mt-1.5 max-h-40 overflow-y-auto p-1 border border-slate-100 rounded-lg">
                      {classes.length === 0 ? (
                        <p className="col-span-2 text-xs text-slate-400 italic py-2">No classes registered yet.</p>
                      ) : (
                        classes.map((cls) => (
                          <label key={cls.id} className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs cursor-pointer select-none text-slate-700 hover:bg-slate-100 transition">
                            <input
                              type="checkbox"
                              checked={teacherForm.classIds?.includes(cls.id) || false}
                              onChange={(e) => {
                                const updated = e.target.checked
                                  ? [...(teacherForm.classIds || []), cls.id]
                                  : (teacherForm.classIds || []).filter((id) => id !== cls.id);
                                setTeacherForm({ ...teacherForm, classIds: updated });
                              }}
                              className="accent-[#1B2A6B]"
                            />
                            <span>{cls.name} {cls.arm}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Add Student Form */}
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
                      className="w-full bg-slate-50 border border-slate-200 focus:border-[#1B2A6B] focus:ring-2 focus:ring-[#1B2A6B]/15 text-slate-800 text-sm rounded-lg p-2.5 outline-none transition"
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
                      className="w-full bg-slate-50 border border-slate-200 focus:border-[#1B2A6B] focus:ring-2 focus:ring-[#1B2A6B]/15 text-slate-800 text-sm rounded-lg p-2.5 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Class Designation</label>
                    <select
                      required
                      value={studentForm.classId}
                      onChange={(e) => setStudentForm({ ...studentForm, classId: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-[#1B2A6B] text-slate-800 text-sm rounded-lg p-2.5 outline-none transition"
                    >
                      <option value="">Choose Class (Required)</option>
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name} {cls.arm} ({cls.academicSession})
                        </option>
                      ))}
                    </select>
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
                      placeholder="e.g. First Term Examination"
                      value={examForm.title}
                      onChange={(e) => setExamForm({ ...examForm, title: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-[#1B2A6B] focus:ring-2 focus:ring-[#1B2A6B]/15 text-slate-800 text-sm rounded-lg p-2.5 outline-none transition"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Target Class</label>
                      <select
                        required
                        value={examForm.classId}
                        onChange={(e) => setExamForm({ ...examForm, classId: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-[#1B2A6B] text-slate-800 text-sm rounded-lg p-2.5 outline-none transition"
                      >
                        <option value="">Select Class</option>
                        {classes.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.name} {cls.arm}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Duration (Minutes)</label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={examForm.durationMinutes}
                        onChange={(e) => setExamForm({ ...examForm, durationMinutes: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-[#1B2A6B] text-slate-800 text-sm rounded-lg p-2.5 outline-none transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Exam Date</label>
                    <input
                      type="date"
                      required
                      value={examForm.date}
                      onChange={(e) => setExamForm({ ...examForm, date: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-red-500 text-white text-xs rounded-lg p-2.5 outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Status</label>
                    <select
                      value={examForm.status}
                      onChange={(e) => setExamForm({ ...examForm, status: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-[#1B2A6B] text-slate-800 text-sm rounded-lg p-2.5 outline-none transition"
                    >
                      <option value="LIVE">LIVE (Immediately available to students)</option>
                      <option value="SCHEDULED">SCHEDULED (Available once start time arrives)</option>
                      <option value="DRAFT">DRAFT</option>
                    </select>
                  </div>

                  {/* Dynamic Subjects Grid */}
                  <div className="border-t border-zinc-800/80 pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Subject Blueprint & Questions</label>
                      <button
                        type="button"
                        onClick={handleAddSubjectToExam}
                        className="text-xs text-[#FFD100] hover:text-red-400 font-semibold flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Subject
                      </button>
                    </div>

                    {examForm.subjects.length === 0 ? (
                      <p className="text-zinc-600 text-xs italic py-2">No subjects added. Add at least one.</p>
                    ) : (
                      <div className="space-y-3">
                        {examForm.subjects.map((sub, i) => (
                          <div key={i} className="flex items-center gap-3 bg-zinc-950 p-3 rounded-lg border border-zinc-850">
                            <div className="flex-1">
                              <select
                                required
                                value={sub.subjectId}
                                onChange={(e) => handleUpdateExamSubject(i, "subjectId", e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 text-white text-xs rounded p-2 outline-none"
                              >
                                <option value="">Choose Subject</option>
                                {subjects.map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="w-24">
                              <input
                                type="number"
                                required
                                min="1"
                                placeholder="Qty"
                                value={sub.numberOfQuestions}
                                onChange={(e) => handleUpdateExamSubject(i, "numberOfQuestions", e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded p-2 text-center"
                                title="Number of questions to serve"
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

              {/* Form Buttons */}
              <div className="border-t border-zinc-800 pt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setModalType(null);
                    setEditingExamId(null);
                  }}
                  className="bg-slate-100 text-slate-700 hover:bg-zinc-800 text-slate-700 px-4 py-2 border border-zinc-700/60 rounded-xl text-sm font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="bg-[#1B2A6B] hover:bg-[#152052] disabled:bg-slate-200 text-white px-5 py-2 rounded-xl text-sm font-semibold transition cursor-pointer border-b-2 border-b-[#FFD100]"
                >
                  {formSubmitting ? "Creating..." : "Save Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
