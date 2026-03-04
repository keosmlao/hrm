import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const employees = await prisma.odg_employee.findMany({
      take: 100,
      orderBy: { employee_id: 'asc' },
    });
    return NextResponse.json(employees);
  } catch (err) {
    console.error("Database query error:", err);
    return NextResponse.json(
      { error: "Failed to fetch employees" },
      { status: 500 }
    );
  }
}
