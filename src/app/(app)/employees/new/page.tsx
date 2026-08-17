import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { EmployeeForm } from "../employee-form";
import { loadOptions } from "../options";
import { createEmployee } from "../actions";

export default async function NewEmployeePage() {
  await requireRole("ADMIN", "HR");
  const options = await loadOptions();

  return (
    <>
      <PageHeader
        title="ເພີ່ມພະນັກງານໃໝ່"
        subtitle="ຈະຖືກບັນທຶກເຂົ້າຖານຂໍ້ມູນພະນັກງານກາງ (odg_employee)"
      />
      <EmployeeForm
        action={createEmployee}
        options={options}
        isNew
        submitLabel="ສ້າງພະນັກງານ"
      />
    </>
  );
}

export const dynamic = "force-dynamic";
