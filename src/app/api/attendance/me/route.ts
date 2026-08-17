import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestEmployee } from "@/lib/employee-auth";
import { getEmployeeAttendanceContext } from "@/lib/hrm-settings";
import { getApprovalSteps, resolveStepApprovers, APPROVER_TYPE_LABEL } from "@/lib/trip-approvals";
import { isVehicleApprover } from "@/lib/vehicle-approvals";

/** ສະຖານະປັດຈຸບັນຂອງພະນັກງານ — ຜ່ານ LINE (idToken) ຫຼື web portal (session) */
export async function POST(request: NextRequest) {
  const { idToken } = (await request.json().catch(() => ({}))) as {
    idToken?: string;
  };
  const auth = await getRequestEmployee(idToken);
  if (auth.kind === "unauthenticated") {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }
  if (auth.kind === "unlinked") {
    return NextResponse.json({ linked: false, lineName: auth.lineName });
  }
  const employee = auth.employee;

  const now = new Date();
  const { policy, workDate } = await getEmployeeAttendanceContext(employee.code, now);
  const today = await prisma.attendance.findUnique({
    where: {
      employeeCode_workDate: {
        employeeCode: employee.code,
        workDate,
      },
    },
    select: { checkInAt: true, checkOutAt: true, lateMinutes: true, workedMinutes: true },
  });

  const currentYear = workDate.getUTCFullYear();
  const [profile, position, division, department, unit, leaveTypes, leaveBalances, leaveRequests, overtimeRequests, payslips, tripRequests] = await Promise.all([
    prisma.employeeProfile.findUnique({
      where: { employeeCode: employee.code },
      select: { email: true, address: true, photoUrl: true, hrStatus: true },
    }),
    employee.positionCode ? prisma.position.findUnique({ where: { code: employee.positionCode }, select: { nameLo: true } }) : null,
    employee.divisionCode ? prisma.division.findUnique({ where: { code: employee.divisionCode }, select: { nameLo: true } }) : null,
    employee.departmentCode ? prisma.department.findUnique({ where: { code: employee.departmentCode }, select: { nameLo: true } }) : null,
    employee.unitCode ? prisma.unit.findUnique({ where: { code: employee.unitCode }, select: { nameLo: true } }) : null,
    prisma.leaveType.findMany({ where: { isActive: true }, select: { id: true, name: true, daysPerYear: true, requiresProof: true }, orderBy: { name: "asc" } }),
    prisma.leaveBalance.findMany({
      where: { employeeCode: employee.code, year: currentYear },
      select: { leaveTypeId: true, entitled: true, used: true, carriedOver: true },
    }),
    prisma.leaveRequest.findMany({
      where: { employeeCode: employee.code },
      include: { leaveType: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.overtimeRequest.findMany({
      where: { employeeCode: employee.code },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.payslip.findMany({
      where: {
        employeeCode: employee.code,
        period: { status: { in: ["APPROVED", "PAID", "CLOSED"] } },
      },
      include: { period: { select: { year: true, month: true, status: true } } },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.vehicleTrip.findMany({
      where: { OR: [{ requestedByCode: employee.code }, { driverCode: employee.code }, { members: { some: { employeeCode: employee.code } } }] },
      include: {
        saleCustomers: { select: { id: true, sequence: true, customerName: true, address: true, status: true }, orderBy: { sequence: "asc" } },
        saleProducts: { select: { productCode: true, productName: true, unit: true, loadedQty: true, soldQty: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  const balanceByType = new Map(leaveBalances.map((balance) => [balance.leaveTypeId, balance]));

  // ອ້າງອີງປ້າຍທະບຽນລົດ (ERP) ສຳລັບ trip ທີ່ຈັດລົດແລ້ວ
  const tripVehicleIds = [...new Set(tripRequests.map((t) => t.vehicleId).filter((v): v is string => !!v && /^\d+$/.test(v)))];
  const tripVehicles = tripVehicleIds.length
    ? await prisma.carVehicle.findMany({ where: { id: { in: tripVehicleIds.map(BigInt) } }, select: { id: true, plateNo: true } })
    : [];
  const plateById = new Map(tripVehicles.map((v) => [v.id.toString(), v.plateNo]));

  // ຂັ້ນຕອນອະນຸມັດ (global) — ໃຫ້ພະນັກງານເຫັນ "ຂັ້ນ X/Y"
  const approvalSteps = await getApprovalSteps();
  const totalApprovalSteps = approvalSteps.length;

  // ກ່ອງອະນຸມັດ — ຄຳຮ້ອງທີ່ຢູ່ຂັ້ນປັດຈຸບັນ ແລະ ພະນັກງານຄົນນີ້ເປັນຜູ້ອະນຸມັດ
  const pendingRequests = totalApprovalSteps > 0
    ? await prisma.vehicleTrip.findMany({
        where: { requestedByCode: { not: null }, approvedAt: null, status: { not: "CANCELLED" } },
        include: { requestedBy: { select: { fullnameLo: true } }, members: { include: { employee: { select: { fullnameLo: true } } } } },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const approvals: {
    id: string; destination: string; requester: string; date: Date; endDate: Date;
    departTime: string | null; returnTime: string | null; tripNo: number; note: string | null;
    members: string[]; stepLabel: string; stepIndex: number; totalSteps: number;
  }[] = [];
  for (const t of pendingRequests) {
    if (!t.requestedByCode || t.requestedByCode === employee.code) continue; // ບໍ່ອະນຸມັດຄຳຮ້ອງຕົນເອງ
    if (t.approvalLevel >= totalApprovalSteps) continue; // ອະນຸມັດຄົບແລ້ວ (ລໍຖ້າຈັດລົດ)
    const step = approvalSteps[t.approvalLevel];
    if (!step) continue;
    const approvers = await resolveStepApprovers(step, t.requestedByCode);
    if (!approvers.has(employee.code)) continue;
    approvals.push({
      id: t.id, destination: t.destination, requester: t.requestedBy?.fullnameLo ?? t.requestedByCode,
      date: t.date, endDate: t.endDate, departTime: t.departTime, returnTime: t.returnTime, tripNo: t.tripNo, note: t.note,
      members: t.members.map((m) => m.employee.fullnameLo),
      stepLabel: APPROVER_TYPE_LABEL[step.approverType] ?? step.approverType, stepIndex: t.approvalLevel + 1, totalSteps: totalApprovalSteps,
    });
  }

  // ລົດທີ່ໃຫ້ພະນັກງານເລືອກເອງ (ERP, ບໍ່ retired)
  const cars = await prisma.carVehicle.findMany({ where: { status: { not: "retired" } }, select: { id: true, plateNo: true, name: true }, orderBy: { plateNo: "asc" } });
  const plateMap = new Map(cars.map((c) => [c.id.toString(), c.plateNo]));

  // ກ່ອງອະນຸມັດ "ລົດ" — ຖ້າພະນັກງານຄົນນີ້ ເປັນຜູ້ມີສິດອະນຸມັດລົດ (ຈັດກຸ່ມ ຕາມ ລົດ+ວັນ)
  const vehicleApprovals: { key: string; vehicleId: string; plateNo: string; date: string; plans: { tripId: string; requester: string; destination: string; tripNo: number; isBorrower: boolean }[] }[] = [];
  if (await isVehicleApprover(employee.code)) {
    const pendingVeh = await prisma.vehicleTrip.findMany({
      where: { requestedByCode: { not: null }, vehicleId: { not: null }, vehicleApprovedAt: null, status: { not: "CANCELLED" } },
      include: { requestedBy: { select: { fullnameLo: true } } },
      orderBy: [{ vehicleId: "asc" }, { date: "asc" }, { tripNo: "asc" }],
    });
    const groups = new Map<string, (typeof vehicleApprovals)[number]>();
    for (const t of pendingVeh) {
      if (!t.vehicleId) continue;
      const key = `${t.vehicleId}|${t.date.toISOString().slice(0, 10)}`;
      let g = groups.get(key);
      if (!g) { g = { key, vehicleId: t.vehicleId, plateNo: plateMap.get(t.vehicleId) ?? t.vehicleId, date: t.date.toISOString(), plans: [] }; groups.set(key, g); }
      g.plans.push({ tripId: t.id, requester: t.requestedBy?.fullnameLo ?? t.requestedByCode ?? "-", destination: t.destination, tripNo: t.tripNo, isBorrower: t.isVehicleBorrower });
    }
    vehicleApprovals.push(...groups.values());
  }

  return NextResponse.json({
    linked: true,
    code: employee.code,
    name: employee.fullnameLo,
    approvals,
    vehicleApprovals,
    vehicles: cars.map((v) => ({ id: v.id.toString(), plateNo: v.plateNo, name: v.name })),
    profile: {
      title: employee.titleLo,
      nickname: employee.nickname,
      mobile: employee.mobile,
      email: profile?.email ?? null,
      address: profile?.address ?? null,
      photoUrl: profile?.photoUrl ?? null,
      hrStatus: profile?.hrStatus ?? employee.employmentStatus,
      position: position?.nameLo ?? employee.positionCode,
      division: division?.nameLo ?? employee.divisionCode,
      department: department?.nameLo ?? employee.departmentCode,
      unit: unit?.nameLo ?? employee.unitCode,
      hireDate: employee.hireDate,
    },
    shift: {
      code: policy.shiftCode,
      name: policy.shiftName,
      startTime: policy.workStart,
      endTime: policy.workEnd,
      breakMinutes: policy.breakMinutes,
    },
    today,
    leave: {
      types: leaveTypes.map((type) => {
        const balance = balanceByType.get(type.id);
        const entitled = balance?.entitled ?? type.daysPerYear;
        const used = balance?.used ?? 0;
        const carriedOver = balance?.carriedOver ?? 0;
        return { ...type, entitled, used, carriedOver, remaining: entitled + carriedOver - used };
      }),
      requests: leaveRequests.map((request) => ({
        id: request.id,
        type: request.leaveType.name,
        startDate: request.startDate,
        endDate: request.endDate,
        days: request.days,
        status: request.status,
        reason: request.reason,
        rejectReason: request.rejectReason,
      })),
    },
    overtime: overtimeRequests.map((request) => ({
      id: request.id,
      workDate: request.workDate,
      startTime: request.startTime,
      endTime: request.endTime,
      hours: request.hours,
      rate: request.rate,
      status: request.status,
      reason: request.reason,
      rejectReason: request.rejectReason,
    })),
    payslips: payslips.map((slip) => ({
      id: slip.id,
      year: slip.period.year,
      month: slip.period.month,
      status: slip.period.status,
      grossPay: Number(slip.grossPay),
      totalDeduction: Number(slip.totalDeduction),
      netPay: Number(slip.netPay),
    })),
    trips: tripRequests.map((trip) => ({
      id: trip.id,
      date: trip.date,
      endDate: trip.endDate,
      tripNo: trip.tripNo,
      destination: trip.destination,
      departTime: trip.departTime,
      returnTime: trip.returnTime,
      // ສະຖານະສະແດງຜົນ: PENDING (ລໍຖ້າ) / REJECTED / ຫຼືສະຖານະ trip ຈິງ
      status:
        trip.approvedAt === null
          ? trip.status === "CANCELLED"
            ? "REJECTED"
            : "PENDING"
          : trip.status,
      vehiclePlate: trip.vehicleId ? plateById.get(trip.vehicleId) ?? null : null,
      rejectReason: trip.rejectReason,
      // ຄວາມຄືບໜ້າການອະນຸມັດ (ສະເພາະຄຳຮ້ອງທີ່ຍັງລໍຖ້າ)
      approvalLevel: trip.approvalLevel,
      totalApprovalSteps,
      currentStepLabel:
        trip.approvedAt === null && trip.status !== "CANCELLED" && trip.approvalLevel < totalApprovalSteps
          ? APPROVER_TYPE_LABEL[approvalSteps[trip.approvalLevel].approverType] ?? approvalSteps[trip.approvalLevel].approverType
          : null,
      tripType: trip.tripType,
      workflowStatus: trip.workflowStatus,
      salesTarget: Number(trip.salesTarget),
      customers: trip.saleCustomers,
      products: trip.saleProducts.map((product) => ({ ...product, loadedQty: Number(product.loadedQty), soldQty: Number(product.soldQty) })),
    })),
  });
}
