import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ອະນຸຍາດ dev resources (HMR, stack-frames ຯລຯ) ຈາກ tunnel HTTPS ຕອນ dev/ທົດລອງ LIFF
  // ແລະ ຈາກເຄື່ອງອື່ນໃນ LAN 10.0.x.x (ເປີດແອັບຜ່ານ IP ແທນ localhost)
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "gen-weekend-replies-architectural.trycloudflare.com",
    "192.168.1.35",
    "192.168.1.*",
    "10.0.*.*",
  ],
};

export default nextConfig;
