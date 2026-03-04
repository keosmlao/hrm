import { ImageResponse } from "next/og";

const VALID_ICON_SIZES = new Set([180, 192, 512]);

function getIconSize(request: Request) {
  const size = Number(new URL(request.url).searchParams.get("size") || "512");
  return VALID_ICON_SIZES.has(size) ? size : 512;
}

export async function GET(request: Request) {
  const size = getIconSize(request);

  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background:
            "linear-gradient(145deg, rgb(33,72,122) 0%, rgb(47,101,171) 72%, rgb(111,150,203) 100%)",
          color: "white",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            border: "6px solid rgba(255,255,255,0.18)",
            borderRadius: size * 0.22,
            inset: size * 0.04,
            position: "absolute",
          }}
        />
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: size * 0.28,
            boxShadow: "0 28px 60px rgba(21,45,74,0.35)",
            display: "flex",
            flexDirection: "column",
            height: size * 0.72,
            justifyContent: "space-between",
            padding: size * 0.11,
            position: "relative",
            width: size * 0.72,
          }}
        >
          <div
            style={{
              fontSize: size * 0.12,
              fontWeight: 700,
              letterSpacing: size * 0.02,
              opacity: 0.9,
            }}
          >
            ODG
          </div>
          <div
            style={{
              alignItems: "center",
              display: "flex",
              justifyContent: "center",
              marginTop: size * 0.02,
            }}
          >
            <div
              style={{
                fontSize: size * 0.24,
                fontWeight: 700,
                letterSpacing: size * 0.018,
              }}
            >
              HRM
            </div>
          </div>
          <div
            style={{
              alignSelf: "flex-end",
              background: "rgba(255,255,255,0.12)",
              border: "3px solid rgba(255,255,255,0.18)",
              borderRadius: 999,
              fontSize: size * 0.06,
              fontWeight: 600,
              letterSpacing: size * 0.012,
              padding: `${size * 0.025}px ${size * 0.05}px`,
            }}
          >
            GROUP
          </div>
        </div>
      </div>
    ),
    {
      width: size,
      height: size,
    }
  );
}
