import { LinkButton } from "@/components/ui";

export default function ThankYouPage() {
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
        ✓
      </div>
      <h1 className="text-2xl font-semibold">ສົ່ງໃບສະໝັກສຳເລັດແລ້ວ</h1>
      <p className="mt-2 text-sm text-muted">
        ຂອບໃຈທີ່ສົນໃຈຮ່ວມງານກັບ ODIEN GROUP — ຝ່າຍບຸກຄົນຈະກວດສອບ ແລະ
        ຕິດຕໍ່ກັບຫາທ່ານໃນໄວໆນີ້
      </p>
      <div className="mt-6">
        <LinkButton href="/careers">ເບິ່ງຕຳແໜ່ງອື່ນໆ</LinkButton>
      </div>
    </div>
  );
}
