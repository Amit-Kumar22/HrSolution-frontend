import Link from "next/link";
import { ArrowRight } from "lucide-react";

const VARIANTS = {
  primary: "button button-primary",
  dark: "button button-dark",
  outline: "button button-outline",
};

export default function JobApplyButton({
  slug,
  label = "Apply now",
  variant = "primary",
  className = "",
}) {
  const href = slug ? `/careers/${encodeURIComponent(slug)}/apply` : "/careers";
  const classes = `${VARIANTS[variant] || VARIANTS.primary} ${className}`.trim();
  return (
    <Link className={classes} href={href}>
      {label} <ArrowRight size={16} />
    </Link>
  );
}
