import { Instagram, Facebook } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="bg-footer text-dark-panel-foreground">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-8 py-5 md:flex-row md:items-center md:justify-between">
        <p className="text-xs tracking-[0.25em] text-dark-panel-foreground/80">HANDMADE IN SOUTH AFRICA</p>
        <p className="text-xs tracking-[0.3em] text-dark-panel-foreground/90">WWW.STRATAEARTH.COM</p>
        <div className="flex items-center gap-4 text-dark-panel-foreground/80">
          <Instagram className="h-4 w-4" />
          <Facebook className="h-4 w-4" />
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm0 4a3 3 0 0 1 3 3v3.5c0 2-1 3.2-2.4 3.8l.9 3.7h-3l-.7-3.5h-.3V18H7V7a3 3 0 0 1 3-3h2z"/></svg>
        </div>
      </div>
    </footer>
  );
}
