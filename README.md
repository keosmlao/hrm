# ODIEN HRM

ລະບົບບໍລິຫານຊັບພະຍາກອນບຸກຄົນແບບ Odoo ສຳລັບ ODIEN GROUP. ໂຄງການນີ້ໃຊ້ Next.js 16, React 19, Prisma 7 ແລະ PostgreSQL.

## ຟັງຊັນຫຼັກ

- Dashboard: ຈຳນວນພະນັກງານ, ຕົ້ນທຶນເງິນເດືອນ, ວັນເກີດ, ທົດລອງງານ ແລະສັນຍາໃກ້ໝົດອາຍຸ
- Employees: ປະຫວັດພະນັກງານ, ສັນຍາ, ເອກະສານ ແລະຂໍ້ມູນເງິນເດືອນ
- Attendance: ລົງເວລາ ແລະສະຫຼຸບການເຂົ້າວຽກ
- Leave: ຍື່ນໃບລາ, ຍອດວັນລາ ແລະ workflow ອະນຸມັດ
- Payroll: ຮອບເງິນເດືອນ ແລະ payslip
- Appraisal: ຮອບປະເມີນ ແລະແບບປະເມີນຜົນງານ
- Recruitment: ປະກາດວຽກ, ຮັບໃບສະໝັກ ແລະຕິດຕາມສະຖານະ
- Organization: ໂຄງສ້າງບໍລິສັດ ແລະສາຍການບັງຄັບບັນຊາ
- Role-based access: Admin, HR, Manager, Employee ແລະ Executive

## ຕິດຕັ້ງ

ຕ້ອງມີ Node.js ແລະ PostgreSQL. ສ້າງໄຟລ໌ `.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE"
SESSION_SECRET="replace-with-a-long-random-secret"

# LINE Login / LIFF channel
NEXT_PUBLIC_LIFF_ID="1234567890-AbCdEfgh"
LINE_CHANNEL_ID="1234567890"

# LINE Official Account / Messaging API channel
LINE_MESSAGING_CHANNEL_SECRET="channel-secret"
LINE_MESSAGING_CHANNEL_ACCESS_TOKEN="long-lived-channel-access-token"
# ບໍ່ຈຳເປັນ; ຖ້າບໍ່ໃສ່ ລະບົບຈະສ້າງ URL ຈາກ NEXT_PUBLIC_LIFF_ID
LINE_ATTENDANCE_LIFF_URL="https://liff.line.me/1234567890-AbCdEfgh"
```

ຈາກນັ້ນ run:

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

ເປີດ `http://localhost:3000`. Seed ຈະສ້າງ admin ຊົ່ວຄາວຕາມຄ່າໃນ `prisma/seed.ts`; ຄວນປ່ຽນ password ກ່ອນນຳໃຊ້ຈິງ.

## ຕັ້ງຄ່າລົງເວລາຜ່ານ LINE Official Account

1. ສ້າງ LINE Login channel/LIFF ແລະ Messaging API channel ຂອງ Official Account ໄວ້ພາຍໃຕ້ Provider ດຽວກັນ.
2. ກຳນົດ LIFF Endpoint URL ເປັນ `https://YOUR-DOMAIN/employee/login`, Size ເປັນ `Full` ແລະເປີດ scope `openid` ກັບ `profile`.
3. ໃສ່ຄ່າ LINE ທັງໝົດຂ້າງເທິງໃນ production environment ແລ້ວ deploy ໃໝ່.
4. ໃນ Messaging API ກຳນົດ Webhook URL ເປັນ `https://YOUR-DOMAIN/api/line/webhook`, ກົດ Verify ແລະເປີດ `Use webhook`.
5. ສ້າງ Rich Menu ປຸ່ມ “ລົງເວລາ” ແບບ URI action ໂດຍໃຊ້ `https://liff.line.me/YOUR-LIFF-ID`.

ເມື່ອພະນັກງານ Add Friend ຫຼືພິມ “ລົງເວລາ”, “ເຂົ້າວຽກ”, “ອອກວຽກ” ໃນ Official Account, bot ຈະສົ່ງປຸ່ມເປີດ LIFF. ຄັ້ງທຳອິດພະນັກງານຕ້ອງຜູກ LINE ກັບລະຫັດພະນັກງານ; ຄັ້ງຕໍ່ໄປຈະເຂົ້າໜ້າລົງເວລາໂດຍກົງ.

## ຄຳສັ່ງ

```bash
npm run dev       # development server
npm run lint      # ESLint
npm run build     # production build + TypeScript check
npm run db:migrate
npm run db:seed
npm run db:studio
```

## ໝາຍເຫດຖານຂໍ້ມູນ

ຕາຕະລາງ `odg_*` ແມ່ນຂໍ້ມູນອົງກອນເກົ່າທີ່ລະບົບອື່ນໃຊ້ຮ່ວມ. HRM ເພີ່ມຂໍ້ມູນໃນຕາຕະລາງ `hrm_*`; ຫ້າມແກ້ schema ຂອງ `odg_*` ໂດຍບໍ່ກວດຜົນກະທົບກັບລະບົບອື່ນ.
