import Link from "next/link";
import { ApplicationForm } from "../application-form";

export default function GeneralApplyPage() {
  return (
    <>
      <Link
        href="/careers"
        className="text-sm text-muted hover:text-foreground"
      >
        ← ກັບໄປລາຍການຕຳແໜ່ງ
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-semibold">ຝາກໃບສະໝັກທົ່ວໄປ</h1>
        <p className="mt-1 text-sm text-muted">
          ບໍ່ພົບຕຳແໜ່ງທີ່ຕ້ອງການ? ຝາກຂໍ້ມູນໄວ້ — HR ຈະຕິດຕໍ່ກັບເມື່ອມີຕຳແໜ່ງທີ່ເໝາະສົມ
        </p>
      </div>

      <ApplicationForm />
    </>
  );
}
