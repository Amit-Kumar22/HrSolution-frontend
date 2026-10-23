"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function HistoryBack({ fallbackHref = "/#careers", className = "service-back", children }) {
  return (
    <Link href={fallbackHref} className={className}>
      <ArrowLeft size={14} /> {children || "Back"}
    </Link>
  );
}
