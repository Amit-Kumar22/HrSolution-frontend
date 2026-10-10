"use client";

import { useState } from "react";

export default function PublicImage({ src, alt = "", className, fallback = null, ...imageProps }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) return fallback;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      loading="lazy"
      {...imageProps}
    />
  );
}
