import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Leaf, HeartHandshake, Home, Mountain, ShieldCheck, Wind, Waves, X } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { StrataLogo } from "@/components/StrataLogo";
import heroImg from "@/assets/hero-strata.jpg";
import downlightImg from "@/assets/product-downlight.jpg";
import steelEarthImg from "@/assets/product-steel-earth.jpg";
import tealightImg from "@/assets/product-tealight.jpg";
import designerImg from "@/assets/designer-story.jpg";
import pendantImg from "@/assets/products/pendant-pure-earth.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "STRATA — Light with Purpose. Decorate Consciously." },
      {
        name: "description",
        content:
          "Handcrafted rammed earth lighting and décor from South Africa. Natural materials, timeless design, built to last.",
      },
      { property: "og:title", content: "STRATA — Forged by Earth" },
      {
        property: "og:description",
        content: "Handcrafted rammed earth lighting and décor that bring natural warmth into everyday spaces.",
      },
    ],
  }),
  component: Index,
});

const heroFeatures = [
  { icon: Leaf, label: "NATURAL\nMATERIALS" },
  { icon: HeartHandshake, label: "HANDCRAFTED\nWITH CARE" },
  { icon: Home, label: "TIMELESS\nDESIGN" },
  { icon: Mountain, label: "BUILT TO\nLAST" },
];

const ecoFeatures = [
  { icon: Leaf, label: "LOW CARBON\nFOOTPRINT" },
  { icon: ShieldCheck, label: "NON TOXIC\n& SAFE" },
  { icon: Wind, label: "THERMAL\nREGULATION" },
  { icon: Waves, label: "NATURALLY\nBREATHABLE" },
  { icon: Mountain, label: "SUSTAINABLE\nLIVING" },
];

function Index() {
  const [storyOpen, setStoryOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      {/* HERO */}
      <section className="relative w-full overflow-hidden bg-secondary">
        <div className="relative mx-auto max-w-[1500px] grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-12 lg:gap-16 items-center px-6 sm:px-10 lg:px-12 pt-24 sm:pt-28 lg:pt-32 pb-14 sm:pb-20 lg:pb-24 lg:min-h-[720px]">
          {/* Image first on mobile, right on desktop */}
          <div className="relative w-full order-1 lg:order-2">
            <img
              src={heroImg}
              alt="Folded sandstone strata — the inspiration for STRATA"
              className="w-full h-auto max-h-[360px] sm:max-h-[480px] md:max-h-[560px] lg:max-h-[640px] object-contain rounded-sm shadow-[0_30px_60px_-30px_rgba(0,0,0,0.45)]"
            />
          </div>

          {/* Copy */}
          <div className="relative z-10 order-2 lg:order-1">
            <p className="text-[11px] sm:text-xs lg:text-sm tracking-[0.25em] text-primary font-medium mb-4 sm:mb-5">
              EARTH MADE. PURPOSE DRIVEN.
            </p>
            <h1 className="font-serif text-[2rem] leading-[1.05] sm:text-[2.75rem] md:text-5xl lg:text-6xl xl:text-7xl font-bold text-foreground tracking-tight">
              LIGHT WITH PURPOSE.
              <br />
              DECORATE CONSCIOUSLY.
            </h1>
            <p className="mt-5 sm:mt-6 max-w-md text-sm sm:text-base leading-relaxed text-foreground/75">
              Handcrafted rammed earth lighting and décor that bring natural warmth, timeless beauty,
              and harmony into your everyday spaces.
            </p>
            <button className="mt-7 sm:mt-8 bg-primary px-7 sm:px-9 py-3.5 sm:py-4 text-[11px] sm:text-sm font-medium tracking-[0.2em] text-primary-foreground hover:bg-accent transition-colors">
              SHOP THE COLLECTION
            </button>

            <div className="mt-10 sm:mt-12 grid grid-cols-2 sm:grid-cols-4 lg:flex lg:flex-wrap gap-x-5 gap-y-5 sm:gap-x-6">
              {heroFeatures.map((f) => (
                <div key={f.label} className="flex items-center gap-3">
                  <span className="flex h-10 w-10 sm:h-11 sm:w-11 lg:h-12 lg:w-12 flex-shrink-0 items-center justify-center rounded-full border border-primary/60 text-primary">
                    <f.icon className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={1.5} />
                  </span>
                  <span className="text-[10px] sm:text-[11px] tracking-[0.18em] text-foreground/80 whitespace-pre-line leading-tight">
                    {f.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sustainable badge — desktop only */}
        <div className="absolute bottom-8 right-8 hidden xl:block z-10">
          <div className="bg-dark-panel/90 text-dark-panel-foreground px-7 py-5 backdrop-blur-sm">
            <Leaf className="h-6 w-6 text-primary mb-2" strokeWidth={1.5} />
            <p className="font-serif text-sm tracking-[0.15em] font-semibold">SUSTAINABLE</p>
            <p className="font-serif text-sm tracking-[0.15em] font-semibold">BY NATURE.</p>
            <p className="font-serif text-xs tracking-[0.15em] text-primary mt-1">MADE TO LAST.</p>
          </div>
        </div>
      </section>

      {/* PRODUCT GRID */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border">
        {/* Steel + Earth — dark card */}
        <Link
          to="/products/$slug"
          params={{ slug: "metal-and-rammed-earth" }}
          className="group relative bg-dark-panel text-dark-panel-foreground overflow-hidden grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 min-h-[420px] md:min-h-[420px] lg:min-h-[360px]"
        >
          <div className="p-7 sm:p-8 lg:p-9 flex flex-col justify-between gap-6 order-2 sm:order-1 md:order-2 lg:order-1">
            <div>
              <h3 className="font-serif text-xl sm:text-[1.35rem] lg:text-2xl font-semibold tracking-wide leading-tight">
                STEEL + EARTH
                <br />
                COLLECTION
              </h3>
              <div className="mt-3 h-px w-12 bg-primary" />
              <p className="mt-4 sm:mt-5 text-xs leading-relaxed text-dark-panel-foreground/75">
                Where strength meets nature. A bold fusion of rammed earth and mild steel.
              </p>
            </div>
            <span className="self-start bg-secondary text-secondary-foreground px-5 py-3 text-[11px] tracking-[0.2em] group-hover:bg-secondary/80 transition-colors">
              DISCOVER MORE
            </span>
          </div>
          <div className="relative w-full h-60 sm:h-full order-1 sm:order-2 md:order-1 lg:order-2">
            <img src={steelEarthImg} alt="Steel and rammed earth lights" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          </div>
        </Link>

        {/* Pure Rammed Earth — light card */}
        <Link
          to="/products/$slug"
          params={{ slug: "ceiling-down-light" }}
          className="group relative bg-secondary text-secondary-foreground overflow-hidden grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 min-h-[420px] md:min-h-[420px] lg:min-h-[360px]"
        >
          <div className="p-7 sm:p-8 lg:p-9 flex flex-col justify-between gap-6 order-2 sm:order-1 md:order-2 lg:order-1">
            <div>
              <h3 className="font-serif text-xl sm:text-[1.35rem] lg:text-2xl font-semibold tracking-wide leading-tight">
                PURE RAMMED
                <br />
                EARTH DOWN LIGHTS
              </h3>
              <div className="mt-3 h-px w-12 bg-primary" />
              <p className="mt-4 sm:mt-5 text-xs leading-relaxed text-secondary-foreground/75">
                Sculpted by hand. Inspired by earth. Designed to create calm, grounded spaces.
              </p>
            </div>
            <span className="self-start bg-primary text-primary-foreground px-5 py-3 text-[11px] tracking-[0.2em] group-hover:bg-accent transition-colors">
              EXPLORE COLLECTION
            </span>
          </div>
          <div className="relative w-full h-60 sm:h-full order-1 sm:order-2 md:order-1 lg:order-2 flex items-center justify-center bg-background/40">
            <img src={downlightImg} alt="Pure rammed earth downlight" className="h-full w-full object-contain p-4 transition-transform duration-500 group-hover:scale-[1.03]" />
          </div>
        </Link>

        {/* Tealights — dark */}
        <Link
          to="/products/$slug"
          params={{ slug: "tealight-candle-holder" }}
          className="group relative bg-dark-panel text-dark-panel-foreground overflow-hidden grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 min-h-[420px] md:min-h-[420px] lg:min-h-[360px]"
        >
          <div className="p-7 sm:p-8 lg:p-9 flex flex-col justify-between gap-6 order-2 sm:order-1 md:order-2 lg:order-1">
            <div>
              <h3 className="font-serif text-xl sm:text-[1.35rem] lg:text-2xl font-semibold tracking-wide leading-tight">
                TEALIGHT
                <br />
                CANDLE HOLDERS
              </h3>
              <div className="mt-3 h-px w-12 bg-primary" />
              <p className="mt-4 sm:mt-5 text-xs leading-relaxed text-dark-panel-foreground/75">
                Organic. Minimal. Beautifully imperfect. Bring the warmth of the earth to every moment.
              </p>
            </div>
            <span className="self-start bg-secondary text-secondary-foreground px-5 py-3 text-[11px] tracking-[0.2em] group-hover:bg-secondary/80 transition-colors">
              SHOP NOW
            </span>
          </div>
          <div className="relative w-full h-60 sm:h-full order-1 sm:order-2 md:order-1 lg:order-2">
            <img src={tealightImg} alt="Rammed earth tealight" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          </div>
        </Link>

        {/* Pendant Lights — light card */}
        <Link
          to="/products/$slug"
          params={{ slug: "pendant-light" }}
          className="group relative bg-secondary text-secondary-foreground overflow-hidden grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 min-h-[420px] md:min-h-[420px] lg:min-h-[360px]"
        >
          <div className="p-7 sm:p-8 lg:p-9 flex flex-col justify-between gap-6 order-2 sm:order-1 md:order-2 lg:order-1">
            <div>
              <h3 className="font-serif text-xl sm:text-[1.35rem] lg:text-2xl font-semibold tracking-wide leading-tight">
                RAMMED EARTH
                <br />
                PENDANT LIGHTS
              </h3>
              <div className="mt-3 h-px w-12 bg-primary" />
              <p className="mt-4 sm:mt-5 text-xs leading-relaxed text-secondary-foreground/75">
                Suspended sculpture. Two variants — pure earth or paired with metal — to anchor any room.
              </p>
            </div>
            <span className="self-start bg-primary text-primary-foreground px-5 py-3 text-[11px] tracking-[0.2em] group-hover:bg-accent transition-colors">
              EXPLORE COLLECTION
            </span>
          </div>
          <div className="relative w-full h-60 sm:h-full order-1 sm:order-2 md:order-1 lg:order-2 flex items-center justify-center bg-background/40">
            <img src={pendantImg} alt="Rammed earth pendant light" className="h-full w-full object-contain p-4 transition-transform duration-500 group-hover:scale-[1.03]" />
          </div>
        </Link>
      </section>

      {/* DESIGNER STORY CTA */}
      <section className="bg-secondary border-t border-border">
        <div className="mx-auto max-w-[1400px] px-8 py-16 grid md:grid-cols-[1fr_auto] gap-10 items-center">
          <button
            onClick={() => setStoryOpen(true)}
            className="group flex items-center gap-8 text-left w-full"
          >
            <div className="relative h-32 w-32 md:h-40 md:w-40 flex-shrink-0 overflow-hidden rounded-full ring-2 ring-primary/30">
              <img src={designerImg} alt="The designer" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
            </div>
            <div>
              <p className="text-xs tracking-[0.3em] text-primary mb-2">THE STORY BEHIND THE DESIGNER</p>
              <h2 className="font-serif text-3xl md:text-4xl font-semibold leading-tight">
                Forged in earth. Shaped by hand.
              </h2>
              <p className="mt-3 text-sm text-muted-foreground max-w-xl">
                From a first rammed-earth course in the Karoo to a craft-led studio. Click to read the journey.
              </p>
            </div>
          </button>
        </div>
      </section>

      {/* ECO FEATURES BAR */}
      <section className="bg-background border-y border-border">
        <div className="mx-auto max-w-[1400px] px-8 py-7 flex flex-wrap items-center justify-between gap-6">
          <div className="flex flex-wrap gap-8">
            {ecoFeatures.map((f) => (
              <div key={f.label} className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/60 text-primary">
                  <f.icon className="h-4 w-4" strokeWidth={1.5} />
                </span>
                <span className="text-[10px] tracking-[0.18em] text-foreground/75 whitespace-pre-line leading-tight">
                  {f.label}
                </span>
              </div>
            ))}
          </div>
          <p className="font-serif text-sm tracking-[0.15em] text-foreground/85 leading-tight">
            HONOURING ANCIENT WISDOM.
            <br />
            CREATING A BETTER FUTURE.
          </p>
        </div>
      </section>

      <SiteFooter />

      {/* DESIGNER STORY MODAL */}
      {storyOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setStoryOpen(false)}
        >
          <div
            className="relative max-w-3xl w-full bg-background rounded-lg overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setStoryOpen(false)}
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <img src={designerImg} alt="Designer at the rammed earth course" className="w-full h-72 object-cover" />
            <div className="p-8 md:p-10">
              <StrataLogo />
              <p className="mt-6 text-xs tracking-[0.3em] text-primary">THE STORY BEHIND THE DESIGNER</p>
              <h3 className="font-serif text-3xl font-semibold mt-2 leading-tight">
                A handstand on a freshly rammed block.
              </h3>
              <div className="mt-5 space-y-4 text-sm leading-relaxed text-muted-foreground">
                <p>
                  STRATA was born in the Karoo, on a small farm where I attended my first rammed earth
                  course. The moment I stood on a freshly compacted block — quite literally on my hands —
                  I knew this material would shape the next chapter of my work.
                </p>
                <p>
                  Each piece we make is forged from raw earth, layered like the sandstone cliffs that
                  inspired our name. No two are alike. Every line tells a story of place, pressure, and
                  patience.
                </p>
                <p>
                  STRATA is a celebration of slow craft — built to last, made to ground the spaces we
                  live in.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
