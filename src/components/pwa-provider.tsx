"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const BANNER_DISMISS_KEY = "hrm:pwa-banner-dismissed";

function isStandaloneMode() {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function PwaProvider() {
  const [ready, setReady] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isLineBrowser, setIsLineBrowser] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const userAgent = navigator.userAgent;
    const mobile = window.matchMedia("(max-width: 960px)").matches ||
      /Android|iPhone|iPad|iPod/i.test(userAgent);
    const line = /Line\//i.test(userAgent);
    const ios = /iPhone|iPad|iPod/i.test(userAgent);
    const savedDismissState = window.localStorage.getItem(BANNER_DISMISS_KEY) === "1";
    const displayModeMedia = window.matchMedia("(display-mode: standalone)");

    setIsMobile(mobile);
    setIsLineBrowser(line);
    setIsIos(ios);
    setDismissed(savedDismissState);
    setIsStandalone(isStandaloneMode());
    setReady(true);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Ignore service worker registration failures and keep the app usable.
      });
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      window.localStorage.removeItem(BANNER_DISMISS_KEY);
      setDismissed(false);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
      window.localStorage.removeItem(BANNER_DISMISS_KEY);
      setDismissed(false);
    };

    const handleDisplayModeChange = () => {
      setIsStandalone(isStandaloneMode());
    };

    let lastTouchEnd = 0;
    const preventGestureZoom = (event: Event) => {
      event.preventDefault();
    };
    const preventPinchZoom = (event: TouchEvent) => {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    };
    const preventDoubleTapZoom = (event: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    displayModeMedia.addEventListener("change", handleDisplayModeChange);
    document.addEventListener("gesturestart", preventGestureZoom, { passive: false });
    document.addEventListener("gesturechange", preventGestureZoom, { passive: false });
    document.addEventListener("gestureend", preventGestureZoom, { passive: false });
    document.addEventListener("touchmove", preventPinchZoom, { passive: false });
    document.addEventListener("touchend", preventDoubleTapZoom, { passive: false });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      displayModeMedia.removeEventListener("change", handleDisplayModeChange);
      document.removeEventListener("gesturestart", preventGestureZoom);
      document.removeEventListener("gesturechange", preventGestureZoom);
      document.removeEventListener("gestureend", preventGestureZoom);
      document.removeEventListener("touchmove", preventPinchZoom);
      document.removeEventListener("touchend", preventDoubleTapZoom);
    };
  }, []);

  const canShowBanner =
    ready &&
    !dismissed &&
    !isStandalone &&
    isMobile &&
    (Boolean(installPrompt) || isLineBrowser || isIos);

  if (!canShowBanner) {
    return null;
  }

  const title = isLineBrowser ? "ເປີດໃຊ້ແບບແອັບ" : "ຕິດຕັ້ງ ODG HRM";
  const description = isLineBrowser
    ? "ເປີດຜ່ານ browser ຂອງໂທລະສັບ ຫຼື Add to Home Screen ເພື່ອໃຊ້ແບບ PWA ທັງ project."
    : installPrompt
      ? "ສາມາດຕິດຕັ້ງເປັນແອັບໄດ້ເລີຍ ເພື່ອເຂົ້າໃຊ້ HRM ໄດ້ໄວຂຶ້ນ."
      : "ໃນ iPhone/iPad ໃຫ້ກົດ Share ແລ້ວເລືອກ Add to Home Screen.";

  const helperText = isLineBrowser
    ? "ໃນ LINE ກົດ ... ຫຼື Share > Open in Browser ແລ້ວຄ່ອຍ Add to Home Screen."
    : "ຫຼັງຕິດຕັ້ງແລ້ວ ຈະເປີດໃຊ້ແບບໜ້າຈໍ app ໄດ້ໂດຍກົງ.";

  const handleInstall = async () => {
    if (!installPrompt) return;

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setInstallPrompt(null);
    }
  };

  const handleDismiss = () => {
    window.localStorage.setItem(BANNER_DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 p-4">
      <div className="pointer-events-auto mx-auto w-full max-w-sm rounded-3xl border border-brand-200 bg-white/95 p-4 shadow-[0_22px_60px_-28px_rgba(21,45,74,0.55)] backdrop-blur sm:max-w-md">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-2xl bg-brand-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white">
            PWA
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-brand-900">{title}</p>
            <p className="mt-1 text-sm leading-6 text-brand-600">{description}</p>
            <p className="mt-2 text-xs leading-5 text-brand-500">{helperText}</p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          {installPrompt && (
            <button
              type="button"
              onClick={handleInstall}
              className="flex-1 rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
            >
              ຕິດຕັ້ງແອັບ
            </button>
          )}
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-2xl border border-brand-200 px-4 py-3 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50"
          >
            ປິດ
          </button>
        </div>
      </div>
    </div>
  );
}
