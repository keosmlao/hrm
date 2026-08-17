import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { PostingForm } from "../posting-form";
import { loadPostingOptions } from "../options";
import { createPosting } from "../../actions";

export default async function NewPostingPage() {
  await requireRole("ADMIN", "HR");
  const options = await loadPostingOptions();

  return (
    <>
      <PageHeader
        title="ສ້າງປະກາດຮັບສະໝັກ"
        subtitle="ຕັ້ງສະຖານະເປັນ 'ເປີດຮັບສະໝັກ' ເພື່ອໃຫ້ສະແດງໃນໜ້າສາທາລະນະ"
      />
      <PostingForm
        action={createPosting}
        options={options}
        submitLabel="ສ້າງປະກາດ"
      />
    </>
  );
}

export const dynamic = "force-dynamic";
