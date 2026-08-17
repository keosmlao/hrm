import { NextResponse, type NextRequest } from "next/server";
import { decryptSession, COOKIE_NAME } from "@/lib/jwt";

const PUBLIC_PATHS = ["/login"];

// ໜ້າສາທາລະນະ (ບໍ່ຕ້ອງ login HRM) — ໜ້າສະໝັກງານ ແລະ ໜ້າລົງເວລາຜ່ານ LINE
// (/clock ໃຊ້ການຢືນຢັນຕົວຕົນຜ່ານ LINE ID token ແທນ session ຂອງ HRM)
const PUBLIC_PREFIXES = ["/careers", "/clock", "/employee/login"];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await decryptSession(request.cookies.get(COOKIE_NAME)?.value);

  // ໜ້າສະໝັກງານສາທາລະນະ — ເຂົ້າໄດ້ສະເໝີ ບໍ່ວ່າຈະ login ຫຼືບໍ່
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.includes(pathname)) {
    return session
      ? NextResponse.redirect(new URL("/dashboard", request.url))
      : NextResponse.next();
  }

  if (!session) {
    // ພະນັກງານ → ໜ້າ login ຂອງພະນັກງານ; ອື່ນໆ → login ຫຼັກ
    const loginPath = pathname === "/employee" || pathname.startsWith("/employee/")
      ? "/employee/login"
      : "/login";
    return NextResponse.redirect(new URL(loginPath, request.url));
  }

  // ສົ່ງ path ຕໍ່ໃຫ້ layout — layout ອ່ານຜ່ານ headers() ແລ້ວກວດສິດເມນູ
  // (ກວດຢູ່ນີ້ບໍ່ໄດ້ ເພາະ proxy ເຂົ້າເຖິງ DB ບໍ່ໄດ້)
  const headers = new Headers(request.headers);
  headers.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
