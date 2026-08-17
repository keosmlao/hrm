import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ອະນຸຍາດ dev resources (HMR ຯລຯ) ຈາກ tunnel HTTPS ຕອນ dev/ທົດລອງ LIFF
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "gen-weekend-replies-architectural.trycloudflare.com",
    "192.168.1.35",
  ],
};

export default nextConfig;
