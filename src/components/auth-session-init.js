"use client";

import { useEffect } from "react";
import { initializeAuthSession } from "@/lib/auth";

export default function AuthSessionInit() {
  useEffect(() => {
    initializeAuthSession();
  }, []);

  return null;
}
