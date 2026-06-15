import logo from "@/assets/strata-logo.png";

export function StrataLogo({ className = "" }: { className?: string }) {
  return (
    <img
      src={logo}
      alt="STRATA — Forged by Earth"
      className={`h-20 w-auto object-contain ${className}`}
    />
  );
}
