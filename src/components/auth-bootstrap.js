"use client";

import { useEffect } from "react";
import { initializeAuthSession } from "@/lib/auth";

export default function AuthBootstrap() {
  useEffect(() => {
    initializeAuthSession();
  }, []);

  return null;
}
