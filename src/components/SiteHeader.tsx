import { Link } from "@tanstack/react-router";
import { Search, User, ShoppingCart, ChevronDown } from "lucide-react";
import { StrataLogo } from "./StrataLogo";

const nav = [
  { label: "HOME", to: "/" },
  { label: "COLLECTIONS", to: "/collections", caret: true },
  { label: "ABOUT", to: "/" },
  { label: "SUSTAINABILITY", to: "/" },
  { label: "PROJECTS", to: "/" },
  { label: "CONTACT", to: "/" },
];

export function SiteHeader() {
  return (
    <header className="absolute top-0 left-0 right-0 z-30">
      <div className="mx-auto flex max-w-[1400px] items-start justify-between px-8 py-6">
        <Link to="/" className="text-primary">
          <StrataLogo />
        </Link>
        <nav className="hidden lg:flex items-center gap-9 pt-4">
          {nav.map((n) => (
            <Link
              key={n.label}
              to={n.to}
              className="flex items-center gap-1 text-[13px] tracking-[0.18em] text-foreground/85 hover:text-primary transition-colors"
            >
              {n.label}
              {n.caret && <ChevronDown className="h-3 w-3" />}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-5 pt-4 text-foreground/80">
          <button aria-label="Search" className="hover:text-primary transition-colors">
            <Search className="h-5 w-5" />
          </button>
          <button aria-label="Account" className="hover:text-primary transition-colors">
            <User className="h-5 w-5" />
          </button>
          <button aria-label="Cart" className="relative hover:text-primary transition-colors">
            <ShoppingCart className="h-5 w-5" />
            <span className="absolute -top-2 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
              0
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
