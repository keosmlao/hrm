"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, apiDelete, apiFetch, apiPost } from "@/lib/api";
import { AuroraBackground } from "@/app/home/page";

/* ===== Types ===== */

interface Participant {
  employeeCode: string;
  displayName: string;
  departmentName: string | null;
  positionName: string | null;
  notified: boolean;
  responseStatus: "pending" | "accepted" | "rejected";
  responseReason: string | null;
  respondedAt: string | null;
  joinedAt: string;
}

interface Meeting {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  meetingDate: string | null;
  startTime: string | null;
  endTime: string | null;
  createdByCode: string;
  createdByName: string | null;
  createdAt: string;
  participantCount: number;
  isJoined: boolean;
  isOwner: boolean;
  isViewerParticipant: boolean;
  myResponseStatus: "pending" | "accepted" | "rejected" | null;
  myResponseReason: string | null;
  myRespondedAt: string | null;
  participants: Participant[];
}

interface Employee { employeeCode: string; displayName: string; departmentName: string | null; }

interface PageData {
  viewer: { employeeCode: string; displayName: string; isIT: boolean; isOrganizer: boolean };
  meetings: Meeting[];
  employees: Employee[];
  summary: { totalMeetings: number; myMeetings: number; joinedMeetings: number };
}

interface Notice { tone: "success" | "error"; message: string; }

interface MeetingForm {
  title: string;
  description: string;
  location: string;
  meetingDate: string;
  startTime: string;
  endTime: string;
}

const initialForm: MeetingForm = { title: "", description: "", location: "", meetingDate: "", startTime: "", endTime: "" };

function cn(...classes: Array<string | false | null | undefined>) { return classes.filter(Boolean).join(" "); }

async function fetchPageData() { return apiFetch<PageData>("/page-data/meetings"); }

/* ===== Page ===== */

export default function MeetingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PageData | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Create/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [participantSearch, setParticipantSearch] = useState("");

  // Actions
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [respondingId, setRespondingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    fetchPageData()
      .then(setData)
      .catch((e) => { if (e instanceof ApiError && e.status === 401) router.replace("/login"); })
      .finally(() => setLoading(false));
  }, [router]);

  const reload = async (msg?: string) => {
    const next = await fetchPageData();
    setData(next);
    if (msg) setNotice({ tone: "success", message: msg });
  };

  const openCreate = () => { setEditingId(null); setForm(initialForm); setSelectedParticipants([]); setParticipantSearch(""); setShowModal(true); };

  const openEdit = (m: Meeting) => {
    setEditingId(m.id);
    setForm({ title: m.title, description: m.description || "", location: m.location || "", meetingDate: m.meetingDate || "", startTime: m.startTime || "", endTime: m.endTime || "" });
    setSelectedParticipants(m.participants.map((p) => p.employeeCode));
    setParticipantSearch("");
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingId(null); setForm(initialForm); setSelectedParticipants([]); };

  const toggleParticipant = (code: string) => {
    setSelectedParticipants((prev) => prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      if (editingId) {
        await apiFetch("/meetings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ meetingId: editingId, ...form }) });
        // Sync participants: add new ones
        const existingCodes = data?.meetings.find((m) => m.id === editingId)?.participants.map((p) => p.employeeCode) || [];
        const newCodes = selectedParticipants.filter((c) => !existingCodes.includes(c));
        if (newCodes.length > 0) {
          await apiPost("/meetings/participants", { meetingId: editingId, employeeCodes: newCodes });
        }
        // Remove deselected
        const removedCodes = existingCodes.filter((c) => !selectedParticipants.includes(c));
        for (const code of removedCodes) {
          await apiDelete("/meetings/participants", { meetingId: editingId, employeeCode: code });
        }
      } else {
        const result = await apiPost<{ id: number }>("/meetings", form);
        const meetingId = result.id;
        if (selectedParticipants.length > 0) {
          await apiPost("/meetings/participants", { meetingId, employeeCodes: selectedParticipants });
        }
      }
      closeModal();
      await reload(editingId ? "ແກ້ໄຂການປະຊຸມແລ້ວ" : "ສ້າງການປະຊຸມສຳເລັດ ແລະ ແຈ້ງເຕືອນຜູ້ເຂົ້າຮ່ວມແລ້ວ");
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof ApiError ? error.message : "ເກີດຂໍ້ຜິດພາດ" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("ຕ້ອງການລົບການປະຊຸມນີ້ແທ້ບໍ?")) return;
    setDeletingId(id);
    try { await apiDelete("/meetings", { meetingId: id }); await reload("ລົບການປະຊຸມແລ້ວ"); } catch (error) { setNotice({ tone: "error", message: error instanceof ApiError ? error.message : "ບໍ່ສາມາດລົບໄດ້" }); } finally { setDeletingId(null); }
  };

  const openReject = (meeting: Meeting) => {
    setRejectingId(meeting.id);
    setRejectReason(meeting.myResponseStatus === "rejected" ? meeting.myResponseReason || "" : "");
    setNotice(null);
  };

  const closeReject = () => {
    setRejectingId(null);
    setRejectReason("");
  };

  const handleMeetingResponse = async (meetingId: number, status: "accepted" | "rejected", reason?: string) => {
    setRespondingId(meetingId);
    setNotice(null);
    try {
      await apiFetch("/meetings/participants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId, status, reason }),
      });
      closeReject();

      // On accept → open Google Calendar to add event
      if (status === "accepted") {
        const meeting = data?.meetings.find((m) => m.id === meetingId);
        if (meeting) {
          const gcalUrl = buildGoogleCalendarUrl(meeting);
          window.open(gcalUrl, "_blank");
        }
      }

      await reload(
        status === "accepted"
          ? "ຢືນຢັນເຂົ້າຮ່ວມປະຊຸມແລ້ວ — ກຳລັງເປີດ Google Calendar..."
          : "ບັນທຶກການປະຕິເສດພ້ອມເຫດຜົນແລ້ວ"
      );
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof ApiError ? error.message : "ບໍ່ສາມາດບັນທຶກການຕອບຮັບໄດ້" });
    } finally {
      setRespondingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#edf0f7]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2F65AB]/20 border-t-[#2F65AB]" />
          <p className="text-sm text-slate-400">ກຳລັງໂຫຼດ...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;
  const { viewer } = data;
  const viewingMeeting = viewingId ? data.meetings.find((m) => m.id === viewingId) : null;

  // Filter employees for search
  const filteredEmployees = participantSearch.trim()
    ? data.employees.filter((e) => e.displayName.includes(participantSearch) || e.employeeCode.includes(participantSearch) || e.departmentName?.includes(participantSearch))
    : [];

  return (
    <>
      <div className="aurora-page min-h-screen text-slate-900">
        <AuroraBackground />

        <header className="px-4 pt-4 sm:px-6">
          <div className="mx-auto flex max-w-5xl items-center justify-between rounded-2xl border border-white/60 bg-white/70 px-4 py-2.5 shadow-lg shadow-black/[0.03] backdrop-blur-xl sm:px-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2F65AB] shadow-sm">
                <CalendarIcon className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-slate-400">Meetings</p>
                <p className="text-sm font-bold text-slate-800">ນັດປະຊຸມ</p>
              </div>
            </div>
            <Link href="/home" className="rounded-xl px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-[#2F65AB]/5 hover:text-[#2F65AB]">
              ກັບໜ້າຫຼັກ
            </Link>
          </div>
        </header>

        <main className="relative z-10 mx-auto max-w-5xl px-4 pb-10 pt-6 sm:px-6">
          <div className="space-y-6">

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <StatCell label="ທັງໝົດ" value={data.summary.totalMeetings} />
              <StatCell label="ສ້າງໂດຍຂ້ອຍ" value={data.summary.myMeetings} />
              <StatCell label="ເຂົ້າຮ່ວມ" value={data.summary.joinedMeetings} />
            </div>

            {notice && (
              <div className={cn("rounded-2xl border px-4 py-3 text-sm font-medium", notice.tone === "success" ? "border-emerald-200 bg-emerald-50/80 text-emerald-700" : "border-rose-200 bg-rose-50/80 text-rose-700")}>
                {notice.message}
              </div>
            )}

            {/* Meetings list */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">ລາຍການປະຊຸມ</h3>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {viewer.isOrganizer ? "ສ້າງ ແລະ ກຳນົດຜູ້ເຂົ້າຮ່ວມ" : "ປະຊຸມທີ່ທ່ານຖືກເຊີນ"}
                  </p>
                </div>
                {viewer.isOrganizer && (
                  <button type="button" onClick={openCreate} className="inline-flex items-center gap-1.5 rounded-xl bg-[#2F65AB] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#265189]">
                    <PlusIcon className="h-4 w-4" /> ນັດປະຊຸມ
                  </button>
                )}
              </div>

              {data.meetings.length === 0 ? (
                <div className="rounded-2xl border border-white/60 bg-white/70 px-6 py-10 text-center backdrop-blur-sm">
                  <p className="text-sm text-slate-500">{viewer.isOrganizer ? "ຍັງບໍ່ມີການປະຊຸມ — ກົດ \"ນັດປະຊຸມ\" ເພື່ອເລີ່ມ" : "ຍັງບໍ່ມີການປະຊຸມສຳລັບທ່ານ"}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.meetings.map((m) => {
                    const isPast = m.meetingDate ? new Date(m.meetingDate) < new Date(new Date().toISOString().slice(0, 10)) : false;

                    return (
                      <div key={m.id} className="rounded-2xl border border-white/60 bg-white/70 p-4 backdrop-blur-sm transition-all hover:shadow-md">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {m.meetingDate && (
                                <span className={cn("rounded-lg px-2 py-0.5 text-[0.65rem] font-semibold", isPast ? "bg-slate-100 text-slate-400" : "bg-[#2F65AB]/10 text-[#2F65AB]")}>
                                  {formatDate(m.meetingDate)}
                                </span>
                              )}
                              {m.startTime && <span className="text-xs text-slate-400">{m.startTime}{m.endTime ? ` - ${m.endTime}` : ""}</span>}
                              {m.isViewerParticipant && (
                                <span className={cn(
                                  "rounded-lg px-2 py-0.5 text-[0.65rem] font-semibold",
                                  m.myResponseStatus === "accepted"
                                    ? "bg-emerald-50 text-emerald-600"
                                    : m.myResponseStatus === "rejected"
                                      ? "bg-rose-50 text-rose-600"
                                      : "bg-amber-50 text-amber-600"
                                )}>
                                  {m.myResponseStatus === "accepted"
                                    ? "ຢືນຢັນແລ້ວ"
                                    : m.myResponseStatus === "rejected"
                                      ? "ປະຕິເສດ"
                                      : "ລໍຖ້າການຕອບຮັບ"}
                                </span>
                              )}
                            </div>
                            <h4 className="mt-2 text-base font-bold text-slate-800">{m.title}</h4>
                            {m.description && <p className="mt-1 text-xs leading-relaxed text-slate-400">{m.description}</p>}
                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                              {m.location && <span>{m.location}</span>}
                              <span>{m.participantCount} ຄົນ</span>
                              {m.createdByName && <span>ນັດໂດຍ {m.createdByName}</span>}
                            </div>

                            {m.participants.length > 0 && (
                              <button type="button" onClick={() => setViewingId(m.id)} className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-[#2F65AB] hover:underline">
                                <span className="flex -space-x-1.5">
                                  {m.participants.slice(0, 4).map((p) => (
                                    <span key={p.employeeCode} className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2F65AB]/10 text-[0.45rem] font-bold text-[#2F65AB] ring-1 ring-white">
                                      {p.displayName.charAt(0)}
                                    </span>
                                  ))}
                                </span>
                                ເບິ່ງຜູ້ເຂົ້າຮ່ວມ
                              </button>
                            )}

                            {m.isViewerParticipant && !m.isOwner && (
                              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3">
                                <div className="flex flex-wrap items-center gap-2 text-[0.7rem] text-slate-500">
                                  <span className="font-semibold text-slate-700">ການຕອບຮັບຂອງທ່ານ</span>
                                  {m.myRespondedAt && <span>ອັບເດດ {formatDateTime(m.myRespondedAt)}</span>}
                                </div>
                                {m.myResponseStatus === "rejected" && m.myResponseReason && (
                                  <p className="mt-2 text-xs leading-relaxed text-rose-600">ເຫດຜົນ: {m.myResponseReason}</p>
                                )}
                                {m.myResponseStatus === "pending" && (
                                  <p className="mt-2 text-xs text-slate-500">ກະລຸນາເລືອກວ່າຈະເຂົ້າຮ່ວມ ຫຼື ປະຕິເສດການປະຊຸມນີ້</p>
                                )}
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    disabled={respondingId === m.id}
                                    onClick={() => { void handleMeetingResponse(m.id, "accepted"); }}
                                    className={cn(
                                      "rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-60",
                                      m.myResponseStatus === "accepted"
                                        ? "bg-emerald-600 text-white"
                                        : "border border-emerald-200 bg-white text-emerald-600 hover:bg-emerald-50"
                                    )}
                                  >
                                    {respondingId === m.id && m.myResponseStatus !== "accepted" ? "..." : "ເຂົ້າຮ່ວມ"}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={respondingId === m.id}
                                    onClick={() => openReject(m)}
                                    className={cn(
                                      "rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-60",
                                      m.myResponseStatus === "rejected"
                                        ? "bg-rose-600 text-white"
                                        : "border border-rose-200 bg-white text-rose-600 hover:bg-rose-50"
                                    )}
                                  >
                                    ປະຕິເສດ
                                  </button>
                                </div>

                                {rejectingId === m.id && (
                                  <div className="mt-3 space-y-2">
                                    <textarea
                                      value={rejectReason}
                                      onChange={(e) => setRejectReason(e.target.value)}
                                      className="min-h-20 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                                      placeholder="ລະບຸເຫດຜົນການປະຕິເສດ..."
                                      maxLength={600}
                                    />
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        disabled={respondingId === m.id || !rejectReason.trim()}
                                        onClick={() => { void handleMeetingResponse(m.id, "rejected", rejectReason); }}
                                        className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                                      >
                                        {respondingId === m.id ? "ກຳລັງບັນທຶກ..." : "ຢືນຢັນປະຕິເສດ"}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={respondingId === m.id}
                                        onClick={closeReject}
                                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-60"
                                      >
                                        ຍົກເລີກ
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {m.isOwner && (
                            <div className="flex shrink-0 flex-col gap-1.5">
                              <button type="button" onClick={() => openEdit(m)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50">ແກ້ໄຂ</button>
                              <button type="button" disabled={deletingId === m.id} onClick={() => { void handleDelete(m.id); }} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-500 hover:bg-rose-50 disabled:opacity-60">
                                {deletingId === m.id ? "..." : "ລົບ"}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>

      {/* Create/Edit modal with participant selection */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative w-full max-w-lg rounded-2xl border border-white/60 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-base font-bold text-slate-800">{editingId ? "ແກ້ໄຂການປະຊຸມ" : "ນັດປະຊຸມໃໝ່"}</h3>
              <button type="button" onClick={closeModal} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><CloseIcon className="h-4 w-4" /></button>
            </div>

            <form id="meeting-form" onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-5">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-600">ຫົວຂໍ້ <span className="text-rose-400">*</span></span>
                <input value={form.title} onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#2F65AB] focus:ring-2 focus:ring-[#2F65AB]/20" placeholder="ປະຊຸມທີມ IT ປະຈຳອາທິດ" maxLength={180} required autoFocus />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-600">ວັນທີ <span className="text-rose-400">*</span></span>
                <input type="date" value={form.meetingDate} onChange={(e) => setForm((c) => ({ ...c, meetingDate: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#2F65AB] focus:ring-2 focus:ring-[#2F65AB]/20" required />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-slate-600">ເວລາເລີ່ມ</span>
                  <input type="time" value={form.startTime} onChange={(e) => setForm((c) => ({ ...c, startTime: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#2F65AB] focus:ring-2 focus:ring-[#2F65AB]/20" />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-slate-600">ເວລາສິ້ນສຸດ</span>
                  <input type="time" value={form.endTime} onChange={(e) => setForm((c) => ({ ...c, endTime: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#2F65AB] focus:ring-2 focus:ring-[#2F65AB]/20" />
                </label>
              </div>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-600">ສະຖານທີ່</span>
                <input value={form.location} onChange={(e) => setForm((c) => ({ ...c, location: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#2F65AB] focus:ring-2 focus:ring-[#2F65AB]/20" placeholder="ຫ້ອງປະຊຸມ / Zoom" maxLength={120} />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-600">ລາຍລະອຽດ</span>
                <textarea value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} className="min-h-16 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#2F65AB] focus:ring-2 focus:ring-[#2F65AB]/20" placeholder="ວາລະ, ຈຸດປະສົງ" maxLength={1000} />
              </label>

              {/* Participant selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">ຜູ້ເຂົ້າຮ່ວມ</span>
                  <span className="text-xs text-slate-400">{selectedParticipants.length} ຄົນ</span>
                </div>

                {/* Selected chips */}
                {selectedParticipants.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedParticipants.map((code) => {
                      const emp = data?.employees.find((e) => e.employeeCode === code);
                      return (
                        <span key={code} className="inline-flex items-center gap-1 rounded-lg bg-[#2F65AB]/10 px-2 py-1 text-xs font-medium text-[#2F65AB]">
                          {emp?.displayName || code}
                          <button type="button" onClick={() => toggleParticipant(code)} className="ml-0.5 text-[#2F65AB]/60 hover:text-[#2F65AB]">&times;</button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Search */}
                <input
                  value={participantSearch}
                  onChange={(e) => setParticipantSearch(e.target.value)}
                  placeholder="ຄົ້ນຫາພະນັກງານ (ຊື່ ຫຼື ລະຫັດ)..."
                  className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-[#2F65AB] focus:ring-2 focus:ring-[#2F65AB]/20"
                />

                {/* Results */}
                {filteredEmployees.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-100">
                    {filteredEmployees.slice(0, 20).map((emp) => {
                      const selected = selectedParticipants.includes(emp.employeeCode);
                      return (
                        <button
                          key={emp.employeeCode}
                          type="button"
                          onClick={() => toggleParticipant(emp.employeeCode)}
                          className={cn("flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50", selected && "bg-[#2F65AB]/5")}
                        >
                          <div>
                            <span className="font-medium text-slate-700">{emp.displayName}</span>
                            <span className="ml-2 text-xs text-slate-400">{emp.employeeCode}</span>
                            {emp.departmentName && <span className="ml-1 text-xs text-slate-300">· {emp.departmentName}</span>}
                          </div>
                          {selected && <span className="text-xs font-bold text-[#2F65AB]">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </form>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-5 py-4">
              <button type="button" onClick={closeModal} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">ຍົກເລີກ</button>
              <button type="submit" form="meeting-form" disabled={saving} className="rounded-xl bg-[#2F65AB] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#265189] disabled:opacity-60">
                {saving ? "ກຳລັງບັນທຶກ..." : editingId ? "ບັນທຶກ" : "ສ້າງ ແລະ ແຈ້ງເຕືອນ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Participants modal */}
      {viewingMeeting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setViewingId(null)} />
          <div className="relative flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-800">ຜູ້ເຂົ້າຮ່ວມ</h3>
                <p className="text-xs text-slate-400">{viewingMeeting.title} · {viewingMeeting.participants.length} ຄົນ</p>
              </div>
              <button type="button" onClick={() => setViewingId(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><CloseIcon className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {viewingMeeting.participants.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">ຍັງບໍ່ມີຜູ້ເຂົ້າຮ່ວມ</p>
              ) : (
                <div className="space-y-2">
                  {viewingMeeting.participants.map((p) => (
                    <div key={p.employeeCode} className="flex items-center justify-between rounded-xl bg-slate-50/80 px-3.5 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-slate-700">{p.displayName}</p>
                        <p className="text-[0.65rem] text-slate-400">{p.employeeCode}{p.departmentName ? ` · ${p.departmentName}` : ""}</p>
                        {p.responseReason && <p className="mt-1 max-w-[18rem] text-[0.65rem] leading-relaxed text-rose-600">ເຫດຜົນ: {p.responseReason}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={cn(
                          "rounded-lg px-2 py-0.5 text-[0.6rem] font-semibold",
                          p.responseStatus === "accepted"
                            ? "bg-emerald-50 text-emerald-600"
                            : p.responseStatus === "rejected"
                              ? "bg-rose-50 text-rose-600"
                              : "bg-amber-50 text-amber-600"
                        )}>
                          {p.responseStatus === "accepted" ? "ເຂົ້າຮ່ວມ" : p.responseStatus === "rejected" ? "ປະຕິເສດ" : "ລໍຖ້າ"}
                        </span>
                        {p.notified ? <span className="text-[0.6rem] text-emerald-500">ແຈ້ງແລ້ວ</span> : <span className="text-[0.6rem] text-slate-300">ບໍ່ທັນແຈ້ງ</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ===== Components ===== */

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-slate-50/80 px-3.5 py-3">
      <p className="text-[0.6rem] font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

/** Build Google Calendar "Add Event" URL */
function buildGoogleCalendarUrl(m: { title: string; description: string | null; location: string | null; meetingDate: string | null; startTime: string | null; endTime: string | null }) {
  const params = new URLSearchParams();
  params.set("action", "TEMPLATE");
  params.set("text", m.title);

  if (m.meetingDate) {
    // Format: 20260319T090000/20260319T100000 (local time assumed)
    const dateClean = m.meetingDate.replace(/-/g, "");
    const start = m.startTime ? m.startTime.replace(/:/g, "") + "00" : "000000";
    const end = m.endTime ? m.endTime.replace(/:/g, "") + "00" : start;
    params.set("dates", `${dateClean}T${start}/${dateClean}T${end}`);
  }

  if (m.location) params.set("location", m.location);

  const details = [
    m.description || "",
    "",
    "ເພີ່ມຈາກລະບົບ ODG HRM",
  ].filter(Boolean).join("\n");
  if (details) params.set("details", details);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function CalendarIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}><rect x="3" y="4.5" width="14" height="12.5" rx="2" stroke="currentColor" strokeWidth="1.6" /><path d="M6.5 2.5v4M13.5 2.5v4M3 8h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function PlusIcon({ className = "h-4 w-4" }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}

function CloseIcon({ className = "h-4 w-4" }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}><path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}
