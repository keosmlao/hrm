import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { EmployeeForm } from "../../employee-form";
import { loadOptions } from "../../options";
import { updateEmployee } from "../../actions";

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  await requireRole("ADMIN", "HR");
  const { code } = await params;

  const [employee, options] = await Promise.all([
    prisma.employee.findUnique({ where: { code }, include: { profile: true } }),
    loadOptions(),
  ]);
  if (!employee) notFound();

  const p = employee.profile;

  return (
    <>
      <PageHeader
        title={`ແກ້ໄຂ: ${employee.fullnameLo}`}
        subtitle={`ລະຫັດ ${employee.code}`}
      />
      <EmployeeForm
        action={updateEmployee.bind(null, code)}
        options={options}
        values={{
          code: employee.code,
          titleLo: employee.titleLo,
          fullnameLo: employee.fullnameLo,
          fullnameEn: employee.fullnameEn,
          nickname: employee.nickname,
          mobile: employee.mobile,
          hireDate: employee.hireDate,
          divisionCode: employee.divisionCode,
          departmentCode: employee.departmentCode,
          unitCode: employee.unitCode,
          positionCode: employee.positionCode,
          hrStatus: p?.hrStatus ?? "ACTIVE",
          gender: p?.gender,
          dob: p?.dob,
          nationalId: p?.nationalId,
          maritalStatus: p?.maritalStatus,
          email: p?.email,
          address: p?.address,
          probationEndDate: p?.probationEndDate,
          managerCode: p?.managerCode,
          baseSalary: p ? Number(p.baseSalary) : 0,
          positionAllowance: p ? Number(p.positionAllowance) : 0,
          bankName: p?.bankName,
          bankAccountNo: p?.bankAccountNo,
          socialSecurityNo: p?.socialSecurityNo,
        }}
        submitLabel="ບັນທຶກການແກ້ໄຂ"
      />
    </>
  );
}

export const dynamic = "force-dynamic";
