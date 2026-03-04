"use client";

import { useState } from "react";

export default function LogoutButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200/60 bg-white/60 px-3 py-2 text-sm font-medium text-slate-500 backdrop-blur transition-all hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-wait disabled:opacity-70"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        className="h-4 w-4"
      >
        <path
          d="M8 4.75H5.75A1.75 1.75 0 0 0 4 6.5v7A1.75 1.75 0 0 0 5.75 15.25H8"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M11 6.5 14.5 10 11 13.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14 10H8"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {isLoading ? "ກຳລັງອອກ..." : "ອອກ"}
    </button>
  );
}
