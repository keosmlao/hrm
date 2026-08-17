"use server";

import { redirect } from "next/navigation";
import { destroySession } from "@/lib/session";

export async function employeeLogout() {
  await destroySession();
  redirect("/employee/login");
}
