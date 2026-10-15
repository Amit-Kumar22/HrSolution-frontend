"use client";

import { useEffect } from "react";
import { handleAuthPageShow, initializeAuthSession } from "@/lib/auth";

export default function AuthSessionInit() {
  useEffect(() => {
    initializeAuthSession();
    window.addEventListener("pageshow", handleAuthPageShow);
    return () => window.removeEventListener("pageshow", handleAuthPageShow);
  }, []);

  return null;
}
