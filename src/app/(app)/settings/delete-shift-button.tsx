"use client";

export function DeleteShiftButton({
  code,
  deleteAction,
}: {
  code: string;
  deleteAction: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <button
      type="submit"
      formAction={deleteAction}
      onClick={(event) => {
        if (!window.confirm(`ຢືນຢັນລຶບກະ ${code}?`)) event.preventDefault();
      }}
      className="text-xs font-medium text-rose-600 hover:underline"
    >
      ລຶບ
    </button>
  );
}
