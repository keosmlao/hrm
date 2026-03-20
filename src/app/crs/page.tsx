"use client";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
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
  registeredAt: string;
}

interface Topic {
  id: number;
  title: string;
  imageUrl: string | null;
  description: string | null;
  location: string | null;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdByName: string | null;
  isActive: boolean;
  registeredCount: number;
  isRegistered: boolean;
  myRegisteredAt: string | null;
  participants: Participant[];
}

interface PageData {
  viewer: {
    employeeCode: string;
    displayName: string;
    departmentCode: string | null;
    departmentName: string | null;
    positionCode: string | null;
    positionName: string | null;
    canManage: boolean;
  };
  canManage: boolean;
  summary: {
    totalEmployees: number;
    totalTopics: number;
    openTopics: number;
    totalRegistrations: number;
    uniqueRegistrants: number;
    myRegistrations: number;
  };
  topics: Topic[];
}

interface Notice {
  tone: "success" | "error";
  message: string;
}

interface RegistrationResponse {
  ok: true;
  lineNotification: {
    sent: boolean;
    reason?: "missing_user_id" | "not_configured" | "api_error";
  };
}

interface TopicFormState {
  title: string;
  imageUrl: string;
  description: string;
  location: string;
  scheduledAt: string;
}

const initialForm = {
  title: "",
  imageUrl: "",
  description: "",
  location: "",
  scheduledAt: "",
} satisfies TopicFormState;

async function fetchPageData() {
  return apiFetch<PageData>("/page-data/crs");
}

function getRegistrationNoticeMessage(response: RegistrationResponse) {
  if (response.lineNotification.sent) {
    return "ລົງທະບຽນ CRS ສຳເລັດ ແລະ ສົ່ງ LINE ແຈ້ງເຕືອນແລ້ວ";
  }

  if (response.lineNotification.reason === "not_configured") {
    return "ລົງທະບຽນ CRS ສຳເລັດ, ແຕ່ຍັງບໍ່ໄດ້ຕັ້ງ LINE Messaging API";
  }

  if (response.lineNotification.reason === "api_error") {
    return "ລົງທະບຽນ CRS ສຳເລັດ, ແຕ່ສົ່ງ LINE ແຈ້ງເຕືອນບໍ່ສຳເລັດ";
  }

  return "ລົງທະບຽນ CRS ສຳເລັດ";
}

/* ===== Page ===== */

export default function CrsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PageData | null>(null);
  const [forbiddenMessage, setForbiddenMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [form, setForm] = useState(initialForm);
  const [creating, setCreating] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageInputKey, setImageInputKey] = useState(0);
  const [actionTopicId, setActionTopicId] = useState<number | null>(null);
  const [togglingTopicId, setTogglingTopicId] = useState<number | null>(null);
  const [editingTopicId, setEditingTopicId] = useState<number | null>(null);
  const [deletingTopicId, setDeletingTopicId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let active = true;

    fetchPageData()
      .then((response) => {
        if (!active) return;
        setData(response);
        setForbiddenMessage(null);
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof ApiError) {
          if (error.status === 401) { router.replace("/login"); return; }
          if (error.status === 403) { setForbiddenMessage(error.message); return; }
          setNotice({ tone: "error", message: error.message });
          return;
        }
        setNotice({ tone: "error", message: "ບໍ່ສາມາດໂຫຼດຂໍ້ມູນ CRS ໄດ້" });
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [router]);

  const reloadData = async (successMessage?: string) => {
    const nextData = await fetchPageData();
    setData(nextData);
    setForbiddenMessage(null);
    if (successMessage) setNotice({ tone: "success", message: successMessage });
  };

  const handleCreateTopic = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setNotice(null);
    try {
      if (editingTopicId) {
        await apiFetch("/crs/topics", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topicId: editingTopicId, title: form.title, imageUrl: form.imageUrl, description: form.description, location: form.location, scheduledAt: form.scheduledAt }),
        });
      } else {
        await apiPost("/crs/topics", { title: form.title, imageUrl: form.imageUrl, description: form.description, location: form.location, scheduledAt: form.scheduledAt });
      }
      setForm(initialForm);
      setEditingTopicId(null);
      setImageInputKey((c) => c + 1);
      setShowModal(false);
      await reloadData(editingTopicId ? "ບັນທຶກການແກ້ໄຂແລ້ວ" : "ສ້າງຫົວຂໍ້ CRS ສຳເລັດ");
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof ApiError ? error.message : "ເກີດຂໍ້ຜິດພາດ" });
    } finally {
      setCreating(false);
    }
  };

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setNotice(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploaded = await apiFetch<{ url: string }>("/crs/upload", { method: "POST", body: formData });
      setForm((c) => ({ ...c, imageUrl: uploaded.url }));
      setNotice({ tone: "success", message: "ອັບໂຫຼດຮູບສຳເລັດ" });
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof ApiError ? error.message : "ບໍ່ສາມາດອັບໂຫຼດຮູບໄດ້" });
      setImageInputKey((c) => c + 1);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleClearImage = () => {
    setForm((c) => ({ ...c, imageUrl: "" }));
    setImageInputKey((c) => c + 1);
  };

  const handleEditTopic = (topic: Topic) => {
    setEditingTopicId(topic.id);
    setForm({ title: topic.title, imageUrl: topic.imageUrl || "", description: topic.description || "", location: topic.location || "", scheduledAt: toDatetimeLocalValue(topic.scheduledAt) });
    setNotice(null);
    setShowModal(true);
  };

  const handleCancelEditing = () => {
    setEditingTopicId(null);
    setForm(initialForm);
    setImageInputKey((c) => c + 1);
    setShowModal(false);
  };

  const openCreateModal = () => {
    setEditingTopicId(null);
    setForm(initialForm);
    setImageInputKey((c) => c + 1);
    setNotice(null);
    setShowModal(true);
  };

  const handleDeleteTopic = async (topicId: number) => {
    if (!window.confirm("ຕ້ອງການລົບຫົວຂໍ້ CRS ນີ້ແທ້ບໍ?")) return;
    setDeletingTopicId(topicId);
    setNotice(null);
    try {
      await apiDelete("/crs/topics", { topicId });
      if (editingTopicId === topicId) { setEditingTopicId(null); setForm(initialForm); setImageInputKey((c) => c + 1); }
      await reloadData("ລົບຫົວຂໍ້ CRS ແລ້ວ");
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof ApiError ? error.message : "ບໍ່ສາມາດລົບໄດ້" });
    } finally {
      setDeletingTopicId(null);
    }
  };

  const handleRegister = async (topicId: number) => {
    setActionTopicId(topicId);
    setNotice(null);
    try {
      const response = await apiPost<RegistrationResponse>("/crs/registrations", { topicId });
      await reloadData(getRegistrationNoticeMessage(response));
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof ApiError ? error.message : "ບໍ່ສາມາດລົງທະບຽນໄດ້" });
    } finally {
      setActionTopicId(null);
    }
  };

  const handleCancelRegistration = async (topicId: number) => {
    setActionTopicId(topicId);
    setNotice(null);
    try {
      await apiDelete("/crs/registrations", { topicId });
      await reloadData("ຍົກເລີກການລົງທະບຽນແລ້ວ");
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof ApiError ? error.message : "ບໍ່ສາມາດຍົກເລີກໄດ້" });
    } finally {
      setActionTopicId(null);
    }
  };

  const handleToggleTopic = async (topicId: number, isActive: boolean) => {
    setTogglingTopicId(topicId);
    setNotice(null);
    try {
      await apiFetch("/crs/topics", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topicId, isActive }) });
      await reloadData(isActive ? "ເປີດຮັບລົງທະບຽນແລ້ວ" : "ປິດຮັບລົງທະບຽນແລ້ວ");
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof ApiError ? error.message : "ບໍ່ສາມາດອັບເດດໄດ້" });
    } finally {
      setTogglingTopicId(null);
    }
  };

  /* --- Loading / Forbidden --- */

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#edf0f7]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2F65AB]/20 border-t-[#2F65AB]" />
          <p className="text-sm text-slate-400">ກຳລັງໂຫຼດ CRS...</p>
        </div>
      </div>
    );
  }

  if (forbiddenMessage) {
    return (
      <div className="aurora-page min-h-screen text-slate-900">
        <AuroraBackground />
        <main className="relative z-10 flex min-h-screen items-center justify-center px-4">
          <div className="w-full max-w-md rounded-3xl border border-white/60 bg-white/70 p-8 text-center shadow-lg backdrop-blur-xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2F65AB]">
              <LockIcon className="h-6 w-6 text-white" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-800">ບໍ່ສາມາດເຂົ້າເຖິງ</h2>
            <p className="mt-2 text-sm text-slate-500">{forbiddenMessage}</p>
            <Link href="/home" className="mt-5 inline-flex rounded-xl bg-[#2F65AB] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#265189]">
              ກັບໜ້າຫຼັກ
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (!data) return null;

  const s = data.summary;

  return (
    <div className="aurora-page min-h-screen text-slate-900">
      <AuroraBackground />

      {/* Header */}
      <header className="px-4 pt-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between rounded-2xl border border-white/60 bg-white/70 px-4 py-2.5 shadow-lg shadow-black/[0.03] backdrop-blur-xl sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2F65AB] shadow-sm">
              <CalendarCheckIcon className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-slate-400">CRS</p>
              <p className="text-sm font-bold text-slate-800">ລົງທະບຽນຫົວຂໍ້</p>
            </div>
          </div>
          <Link href="/home" className="rounded-xl px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-[#2F65AB]/5 hover:text-[#2F65AB]">
            ກັບໜ້າຫຼັກ
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-4 pb-10 pt-6 sm:px-6">
        <div className="space-y-6">

          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCell label="ຫົວຂໍ້ເປີດ" value={s.openTopics} />
            <StatCell label="ຫົວຂໍ້ທັງໝົດ" value={s.totalTopics} />
            <StatCell label={data.canManage ? "ລົງທະບຽນທັງໝົດ" : "ລົງທະບຽນຂອງຂ້ອຍ"} value={data.canManage ? s.totalRegistrations : s.myRegistrations} />
            <StatCell label={data.canManage ? "ພະນັກງານທັງໝົດ" : "ຜູ້ລົງທະບຽນ"} value={data.canManage ? s.totalEmployees : s.uniqueRegistrants} />
          </div>

          {/* Notice */}
          {notice && (
            <div className={cn(
              "rounded-2xl border px-4 py-3 text-sm font-medium",
              notice.tone === "success"
                ? "border-emerald-200 bg-emerald-50/80 text-emerald-700"
                : "border-rose-200 bg-rose-50/80 text-rose-700"
            )}>
              {notice.message}
            </div>
          )}

          {/* Modal */}
          {showModal && data.canManage && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={handleCancelEditing} />
              <div className="relative w-full max-w-lg rounded-2xl border border-white/60 bg-white shadow-2xl">
                {/* Modal header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">
                      {editingTopicId ? "ແກ້ໄຂຫົວຂໍ້ CRS" : "ສ້າງຫົວຂໍ້ CRS ໃໝ່"}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {editingTopicId ? "ອັບເດດລາຍລະອຽດຂອງຫົວຂໍ້" : "ສ້າງຫົວຂໍ້ໃຫ້ພະນັກງານລົງທະບຽນ"}
                    </p>
                  </div>
                  <button type="button" onClick={handleCancelEditing} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
                    <CloseIcon className="h-4 w-4" />
                  </button>
                </div>

                {/* Modal body */}
                <form id="crs-topic-form" onSubmit={handleCreateTopic} className="max-h-[70vh] overflow-y-auto px-5 py-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5 sm:col-span-2">
                      <span className="text-sm font-medium text-slate-600">ຫົວຂໍ້</span>
                      <input
                        value={form.title}
                        onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-[#2F65AB] focus:ring-2 focus:ring-[#2F65AB]/20"
                        placeholder="ຕົວຢ່າງ: CRS Basic Excel Workshop"
                        maxLength={180}
                        required
                        autoFocus
                      />
                    </label>

                    <div className="space-y-2 sm:col-span-2">
                      <span className="text-sm font-medium text-slate-600">ຮູບປະກອບ</span>
                      <input
                        key={imageInputKey}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={(e) => { void handleImageUpload(e); }}
                        disabled={uploadingImage}
                        className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-[#2F65AB] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-[#265189] disabled:opacity-60"
                      />
                      {form.imageUrl && (
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium text-emerald-600">ຮູບພ້ອມແລ້ວ</span>
                          <button type="button" onClick={handleClearImage} className="text-xs font-medium text-rose-500 hover:text-rose-600">ລົບຮູບ</button>
                        </div>
                      )}
                    </div>

                    {form.imageUrl.trim() && (
                      <div className="sm:col-span-2">
                        <TopicCover imageUrl={form.imageUrl.trim()} title={form.title || "Preview"} />
                      </div>
                    )}

                    <label className="space-y-1.5">
                      <span className="text-sm font-medium text-slate-600">ສະຖານທີ່</span>
                      <input
                        value={form.location}
                        onChange={(e) => setForm((c) => ({ ...c, location: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-[#2F65AB] focus:ring-2 focus:ring-[#2F65AB]/20"
                        placeholder="Meeting Room / Online"
                        maxLength={120}
                      />
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-sm font-medium text-slate-600">ວັນເວລາ</span>
                      <input
                        type="datetime-local"
                        value={form.scheduledAt}
                        onChange={(e) => setForm((c) => ({ ...c, scheduledAt: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-[#2F65AB] focus:ring-2 focus:ring-[#2F65AB]/20"
                      />
                    </label>

                    <label className="space-y-1.5 sm:col-span-2">
                      <span className="text-sm font-medium text-slate-600">ລາຍລະອຽດ</span>
                      <textarea
                        value={form.description}
                        onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
                        className="min-h-24 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-[#2F65AB] focus:ring-2 focus:ring-[#2F65AB]/20"
                        placeholder="ອະທິບາຍຈຸດປະສົງ, ກຸ່ມເປົ້າໝາຍ"
                        maxLength={1000}
                      />
                    </label>
                  </div>
                </form>

                {/* Modal footer */}
                <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-5 py-4">
                  <button type="button" onClick={handleCancelEditing} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50">
                    ຍົກເລີກ
                  </button>
                  <button
                    type="submit"
                    form="crs-topic-form"
                    disabled={creating || uploadingImage}
                    className="rounded-xl bg-[#2F65AB] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#265189] disabled:opacity-60"
                  >
                    {uploadingImage ? "ກຳລັງອັບໂຫຼດ..." : creating ? "ກຳລັງບັນທຶກ..." : editingTopicId ? "ບັນທຶກ" : "ສ້າງຫົວຂໍ້"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Topics list */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800">ຫົວຂໍ້ CRS</h3>
                <p className="mt-0.5 text-xs text-slate-400">ເລືອກຫົວຂໍ້ເພື່ອລົງທະບຽນ</p>
              </div>
              {data.canManage && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#2F65AB] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#265189]"
                >
                  <PlusIcon className="h-4 w-4" />
                  ສ້າງຫົວຂໍ້
                </button>
              )}
            </div>

            {data.topics.length === 0 ? (
              <div className="rounded-3xl border border-white/60 bg-white/65 px-6 py-10 text-center backdrop-blur-xl">
                <p className="text-sm font-medium text-slate-500">
                  {data.canManage ? "ຍັງບໍ່ມີຫົວຂໍ້ — ສ້າງຫົວຂໍ້ໃໝ່ຂ້າງເທິງ" : "ຍັງບໍ່ມີຫົວຂໍ້ເປີດລົງທະບຽນ"}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {data.topics.map((topic) => {
                  const isBusy = actionTopicId === topic.id;
                  const canCancel = topic.isRegistered && topic.isActive;
                  const canRegister = !topic.isRegistered && topic.isActive;

                  return (
                    <div key={topic.id} className="overflow-hidden rounded-2xl border border-white/60 bg-white/70 shadow-sm backdrop-blur-sm transition-all hover:shadow-md">
                      {topic.imageUrl && <TopicCover imageUrl={topic.imageUrl} title={topic.title} compact />}

                      <div className="p-4">
                        {/* Status + count */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "inline-flex rounded-lg px-2 py-0.5 text-[0.65rem] font-semibold",
                              topic.isActive ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                            )}>
                              {topic.isActive ? "Open" : "Closed"}
                            </span>
                            {topic.isRegistered && (
                              <span className="inline-flex rounded-lg bg-[#2F65AB]/10 px-2 py-0.5 text-[0.65rem] font-semibold text-[#2F65AB]">
                                Registered
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-medium text-slate-400">{topic.registeredCount} ຄົນ</span>
                        </div>

                        {/* Title + desc */}
                        <h4 className="mt-2.5 text-base font-bold text-slate-800">{topic.title}</h4>
                        {topic.description && (
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">{topic.description}</p>
                        )}

                        {/* Meta */}
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                          {topic.scheduledAt && <span>{formatDateTime(topic.scheduledAt)}</span>}
                          {topic.location && <span>{topic.location}</span>}
                        </div>

                        {/* Action */}
                        <button
                          type="button"
                          disabled={isBusy || (!canRegister && !canCancel)}
                          onClick={() => {
                            if (canCancel) { void handleCancelRegistration(topic.id); return; }
                            if (canRegister) { void handleRegister(topic.id); }
                          }}
                          className={cn(
                            "mt-4 w-full rounded-xl py-2.5 text-sm font-semibold transition-all",
                            canCancel
                              ? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                              : canRegister
                                ? "bg-[#2F65AB] text-white hover:bg-[#265189]"
                                : topic.isRegistered
                                  ? "cursor-default border border-[#2F65AB]/20 bg-[#2F65AB]/5 text-[#2F65AB]"
                                  : "cursor-default border border-slate-200 bg-slate-50 text-slate-400"
                          )}
                        >
                          {isBusy
                            ? "ກຳລັງດຳເນີນການ..."
                            : canCancel
                              ? "ຍົກເລີກລົງທະບຽນ"
                              : topic.isRegistered
                                ? "ລົງທະບຽນແລ້ວ"
                                : !topic.isActive
                                  ? "ປິດຮັບແລ້ວ"
                                  : "ລົງທະບຽນ"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Admin summary */}
          {data.canManage && data.topics.length > 0 && (
            <section>
              <div className="mb-4">
                <h3 className="text-lg font-bold text-slate-800">ສະຫຼຸບຜູ້ເຂົ້າຮ່ວມ</h3>
                <p className="mt-0.5 text-xs text-slate-400">ກວດລາຍຊື່ ແລະ ຈັດການແຕ່ລະຫົວຂໍ້</p>
              </div>

              <div className="space-y-4">
                {data.topics.map((topic) => (
                  <div key={`admin-${topic.id}`} className="overflow-hidden rounded-2xl border border-white/60 bg-white/70 backdrop-blur-sm">
                    {topic.imageUrl && <TopicCover imageUrl={topic.imageUrl} title={topic.title} compact />}

                    <div className="border-b border-slate-100 p-4 sm:p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "rounded-lg px-2 py-0.5 text-[0.65rem] font-semibold",
                              topic.isActive ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                            )}>
                              {topic.isActive ? "Open" : "Closed"}
                            </span>
                            <span className="text-xs text-slate-400">{topic.registeredCount} ຄົນລົງທະບຽນ</span>
                          </div>
                          <h4 className="mt-2 text-base font-bold text-slate-800">{topic.title}</h4>
                          {topic.description && <p className="mt-1 text-xs text-slate-400">{topic.description}</p>}
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2">
                          <button type="button" onClick={() => handleEditTopic(topic)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50">
                            ແກ້ໄຂ
                          </button>
                          <button
                            type="button"
                            disabled={deletingTopicId === topic.id}
                            onClick={() => { void handleDeleteTopic(topic.id); }}
                            className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-60"
                          >
                            {deletingTopicId === topic.id ? "ລົບ..." : "ລົບ"}
                          </button>
                          <button
                            type="button"
                            disabled={togglingTopicId === topic.id}
                            onClick={() => handleToggleTopic(topic.id, !topic.isActive)}
                            className={cn(
                              "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60",
                              topic.isActive
                                ? "border-amber-200 text-amber-600 hover:bg-amber-50"
                                : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                            )}
                          >
                            {togglingTopicId === topic.id ? "..." : topic.isActive ? "ປິດຮັບ" : "ເປີດຮັບ"}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 sm:p-5">
                      {/* Stats */}
                      <div className="mb-4 grid grid-cols-3 gap-3">
                        <StatCell label="ລົງທະບຽນ" value={topic.registeredCount} />
                        <StatCell label="ຍັງເຫຼືອ" value={Math.max(data.summary.totalEmployees - topic.registeredCount, 0)} />
                        <StatCell label="ກຳນົດການ" value={formatDateTime(topic.scheduledAt) || "-"} small />
                      </div>

                      {/* Participants */}
                      {topic.participants.length === 0 ? (
                        <p className="rounded-xl bg-slate-50 px-4 py-3 text-center text-xs text-slate-400">ຍັງບໍ່ມີຜູ້ລົງທະບຽນ</p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {topic.participants.map((p) => (
                            <div key={`${topic.id}-${p.employeeCode}`} className="flex items-center justify-between rounded-xl bg-slate-50/80 px-3.5 py-2.5">
                              <div>
                                <p className="text-sm font-medium text-slate-700">{p.displayName}</p>
                                <p className="text-[0.65rem] text-slate-400">
                                  {p.employeeCode}{p.departmentName ? ` · ${p.departmentName}` : ""}
                                </p>
                              </div>
                              <span className="text-[0.6rem] text-slate-300">{formatDateTime(p.registeredAt)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

/* ===== Components ===== */

function cn(...classes: Array<string | false | null | undefined>) { return classes.filter(Boolean).join(" "); }

function StatCell({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="rounded-2xl bg-slate-50/80 px-3.5 py-3">
      <p className="text-[0.6rem] font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className={cn("mt-1 font-semibold text-slate-700", small ? "text-xs" : "text-sm")}>{value}</p>
    </div>
  );
}

function TopicCover({ imageUrl, title, compact = false }: { imageUrl: string; title: string; compact?: boolean }) {
  return (
    <div className={cn("relative overflow-hidden bg-slate-50", compact ? "rounded-none" : "rounded-xl")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={title}
        className="block w-full object-contain"
      />
    </div>
  );
}

/* ===== Helpers ===== */

function formatDateTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function toDatetimeLocalValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

/* ===== Icons ===== */

function CalendarCheckIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}>
      <rect x="3" y="4.5" width="14" height="12.5" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.5 2.5v4M13.5 2.5v4M3 8h14M7.5 12l1.8 1.8 3.7-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}>
      <rect x="4" y="9" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
