import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Leaf, Hand, Mountain, Home, Heart, Minus, Plus, ShoppingCart, ChevronRight } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import downlightImg from "@/assets/product-downlight.jpg";
import tealightImg from "@/assets/product-tealight.jpg";
import steelImg from "@/assets/product-steel-earth.jpg";
import steelV1 from "@/assets/collections/steel-earth-v1.jpg";
import steelV2 from "@/assets/collections/steel-earth-v2.jpg";
import steelV3 from "@/assets/collections/steel-earth-v3.jpg";
import pureRammed from "@/assets/collections/pure-rammed-earth.jpg";
import tealightCollection from "@/assets/collections/tealight.jpg";
import pendantPure from "@/assets/products/pendant-pure-earth.jpg";
import pendantMetal from "@/assets/products/pendant-metal-earth.jpg";
import pendantInstalled1 from "@/assets/products/pendant-installed-1.jpg";
import pendantInstalled2 from "@/assets/products/pendant-installed-2.jpg";

type Feature = { icon: React.ComponentType<{ className?: string }>; label: string };
type Spec = { label: string; value: string };

type Product = {
  slug: string;
  eyebrow: string;
  titleTop: string;
  titleBottom: string;
  titleAccent: "top" | "bottom";
  tagline: string[];
  headline: string;
  description: React.ReactNode;
  features: Feature[];
  price: string;
  priceNote: string;
  footerTag: string;
  theme: "light" | "dark";
  gallery: string[];
  specs: Spec[];
};

const PRODUCTS: Record<string, Product> = {
  "ceiling-down-light": {
    slug: "ceiling-down-light",
    eyebrow: "RAMMED EARTH",
    titleTop: "CEILING",
    titleBottom: "DOWN LIGHT",
    titleAccent: "top",
    tagline: ["NATURAL", "SUSTAINABLE", "TIMELESS"],
    headline: "Illuminate naturally.\nLive consciously.",
    description: (
      <>
        Handcrafted from natural <strong className="font-medium text-foreground">rammed earth</strong>, each
        down light is a unique blend of ancient building wisdom and contemporary design. The recessed GU10
        light source casts a <strong className="font-medium text-foreground">soft, warm glow</strong> —
        perfect for creating calm, grounded spaces.
      </>
    ),
    features: [
      { icon: Leaf, label: "SUSTAINABLY\nMADE" },
      { icon: Heart, label: "HANDCRAFTED\n& UNIQUE" },
      { icon: Mountain, label: "NATURAL\nMATERIALS" },
      { icon: Home, label: "MINIMALIST\nDESIGN" },
    ],
    price: "R999",
    priceNote: "ex VAT",
    footerTag: "EARTH MADE.  PURPOSE DRIVEN.  BEAUTIFULLY LIT.",
    theme: "light",
    gallery: [downlightImg, pureRammed, tealightImg],
    specs: [
      { label: "Material", value: "Pure rammed earth" },
      { label: "Light source", value: "GU10 (recessed)" },
      { label: "Finish", value: "Natural, unsealed" },
      { label: "Dimensions", value: "Ø 110 × 140 mm" },
      { label: "Weight", value: "1.4 kg" },
      { label: "Lead time", value: "2 – 3 weeks" },
    ],
  },
  "tealight-candle-holder": {
    slug: "tealight-candle-holder",
    eyebrow: "RAMMED EARTH",
    titleTop: "TEALIGHT",
    titleBottom: "CANDLE HOLDER",
    titleAccent: "top",
    tagline: ["NATURAL", "SUSTAINABLE", "ARTISAN MADE"],
    headline: "Bring the warmth of\nthe earth into your space.",
    description: (
      <>
        Handcrafted using the ancient art of{" "}
        <strong className="font-medium text-dark-panel-foreground">rammed earth</strong>, each piece is
        uniquely layered with natural{" "}
        <strong className="font-medium text-dark-panel-foreground">yellow</strong> and{" "}
        <strong className="font-medium text-dark-panel-foreground">red earth tones</strong> — celebrating
        texture, color, and the beauty of imperfection.
      </>
    ),
    features: [
      { icon: Leaf, label: "SUSTAINABLY\nMADE" },
      { icon: Hand, label: "HANDCRAFTED\n& UNIQUE" },
      { icon: Mountain, label: "NATURAL\nMATERIALS" },
      { icon: Home, label: "MINIMALIST\nDESIGN" },
    ],
    price: "R249",
    priceNote: "ex VAT",
    footerTag: "LIGHT WITH PURPOSE.  DECORATE CONSCIOUSLY.",
    theme: "dark",
    gallery: [tealightImg, tealightCollection, pureRammed],
    specs: [
      { label: "Material", value: "Layered rammed earth" },
      { label: "Candle", value: "Standard tealight" },
      { label: "Finish", value: "Natural, unsealed" },
      { label: "Dimensions", value: "Ø 90 × 100 mm" },
      { label: "Weight", value: "0.8 kg" },
      { label: "Lead time", value: "1 – 2 weeks" },
    ],
  },
  "metal-and-rammed-earth": {
    slug: "metal-and-rammed-earth",
    eyebrow: "STEEL + EARTH",
    titleTop: "METAL &",
    titleBottom: "RAMMED EARTH",
    titleAccent: "bottom",
    tagline: ["FORGED", "GROUNDED", "ARCHITECTURAL"],
    headline: "Where strength meets\nthe softness of the earth.",
    description: (
      <>
        A meeting of two elemental materials —{" "}
        <strong className="font-medium text-foreground">blackened steel</strong> and{" "}
        <strong className="font-medium text-foreground">layered rammed earth</strong>. Each piece is hand
        forged and hand pressed, pairing architectural precision with the quiet warmth of natural sediment.
      </>
    ),
    features: [
      { icon: Leaf, label: "SUSTAINABLY\nMADE" },
      { icon: Hand, label: "HAND FORGED\n& PRESSED" },
      { icon: Mountain, label: "STEEL +\nEARTH" },
      { icon: Home, label: "ARCHITECTURAL\nDESIGN" },
    ],
    price: "R1 499",
    priceNote: "ex VAT",
    footerTag: "FORGED BY HAND.  GROUNDED BY EARTH.",
    theme: "light",
    gallery: [steelImg, steelV1, steelV2, steelV3],
    specs: [
      { label: "Material", value: "Blackened steel + rammed earth" },
      { label: "Light source", value: "GU10 (recessed)" },
      { label: "Finish", value: "Raw steel, natural earth" },
      { label: "Dimensions", value: "Ø 130 × 220 mm" },
      { label: "Weight", value: "2.6 kg" },
      { label: "Lead time", value: "3 – 4 weeks" },
    ],
  },
  "pendant-light": {
    slug: "pendant-light",
    eyebrow: "PENDANT COLLECTION",
    titleTop: "RAMMED EARTH",
    titleBottom: "PENDANT LIGHT",
    titleAccent: "bottom",
    tagline: ["LAYERED", "AMBIENT", "STATEMENT"],
    headline: "A sculptural glow,\nsuspended in earth.",
    description: (
      <>
        Hand pressed in layered{" "}
        <strong className="font-medium text-foreground">rammed earth</strong>, our pendant lights are
        offered in two variants — a{" "}
        <strong className="font-medium text-foreground">pure earth</strong> cylinder, and a{" "}
        <strong className="font-medium text-foreground">blackened steel + earth</strong> pairing.
        Both cast a warm, ambient glow and become quiet sculpture above kitchens, dining tables and
        entrance halls.
      </>
    ),
    features: [
      { icon: Leaf, label: "SUSTAINABLY\nMADE" },
      { icon: Hand, label: "HAND\nPRESSED" },
      { icon: Mountain, label: "LAYERED\nEARTH" },
      { icon: Home, label: "STATEMENT\nPIECE" },
    ],
    price: "R1 899",
    priceNote: "from · ex VAT",
    footerTag: "TWO VARIANTS.  ONE EARTHEN GLOW.",
    theme: "light",
    gallery: [pendantPure, pendantMetal, pendantInstalled1, pendantInstalled2],
    specs: [
      { label: "Variants", value: "Pure earth · Metal + earth" },
      { label: "Light source", value: "E27 pendant fitting" },
      { label: "Cord", value: "Black braided, 1.5 m" },
      { label: "Dimensions", value: "Ø 160 × 180 mm" },
      { label: "Weight", value: "2.1 kg" },
      { label: "Lead time", value: "3 – 4 weeks" },
    ],
  },
};

export const Route = createFileRoute("/products/$slug")({
  loader: ({ params }): { product: Product } => {
    const product = PRODUCTS[params.slug];
    if (!product) throw notFound();
    return { product };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.product;
    const title = p ? `${p.titleTop} ${p.titleBottom} — STRATA` : "Product — STRATA";
    const desc = p ? `${p.headline.replace(/\n/g, " ")} Handcrafted rammed earth by Strata.` : "";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  component: ProductDetailPage,
  notFoundComponent: () => (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-[1400px] px-8 pt-40 pb-24 text-center">
        <p className="text-[11px] tracking-[0.4em] text-primary">404</p>
        <h1 className="mt-4 font-serif text-4xl text-foreground">Product not found</h1>
        <Link to="/collections" className="mt-6 inline-block text-[12px] tracking-[0.3em] text-primary hover:underline">
          BROWSE COLLECTIONS
        </Link>
      </div>
      <SiteFooter />
    </div>
  ),
});

function ProductDetailPage() {
  const { product } = Route.useLoaderData() as { product: Product };
  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const isDark = product.theme === "dark";

  const sectionBg = isDark ? "bg-dark-panel" : "bg-secondary";
  const sectionFg = isDark ? "text-dark-panel-foreground" : "text-foreground";
  const eyebrowColor = isDark ? "text-primary-foreground/90" : "text-primary";
  const accentColor = "text-primary";
  const titleMain = isDark ? "text-dark-panel-foreground" : "text-foreground";
  const bodyColor = isDark ? "text-dark-panel-foreground/75" : "text-foreground/75";
  const ruleColor = isDark ? "bg-primary-foreground/30" : "bg-primary/40";
  const iconRing = isDark ? "border-primary-foreground/40 text-primary-foreground" : "border-primary/40 text-primary";
  const iconLabel = isDark ? "text-dark-panel-foreground/85" : "text-foreground/75";

  const handleAdd = () => {
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main>
        <section className={`${sectionBg} ${sectionFg} pt-28 pb-20 lg:pt-32 lg:pb-24`}>
          <div className="mx-auto max-w-[1400px] px-6 sm:px-10 lg:px-12">
            <nav className="mb-10 flex items-center gap-2 text-[11px] tracking-[0.28em] opacity-70">
              <Link to="/" className="hover:opacity-100 hover:text-primary transition">HOME</Link>
              <ChevronRight className="h-3 w-3" />
              <Link to="/collections" className="hover:opacity-100 hover:text-primary transition">COLLECTIONS</Link>
              <ChevronRight className="h-3 w-3" />
              <span className="opacity-100">{product.titleTop} {product.titleBottom}</span>
            </nav>

            <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-20 items-center">
              <div className="order-2 lg:order-1">
                <p className={`text-[12px] sm:text-[13px] tracking-[0.42em] ${eyebrowColor} flex items-center gap-4`}>
                  <span className={`h-px w-8 ${ruleColor}`} />
                  {product.eyebrow}
                  <span className={`h-px w-8 ${ruleColor}`} />
                </p>

                <h1 className={`mt-6 font-serif font-semibold leading-[0.95] tracking-tight ${titleMain}`}>
                  <span
                    className={`block text-5xl sm:text-6xl lg:text-7xl ${
                      product.titleAccent === "top" ? titleMain : titleMain
                    }`}
                  >
                    {product.titleTop}
                  </span>
                  <span
                    className={`block text-4xl sm:text-5xl lg:text-6xl mt-1 ${
                      product.titleAccent === "bottom" ? accentColor : titleMain
                    }`}
                  >
                    {product.titleBottom}
                  </span>
                </h1>

                <p className={`mt-5 text-[11px] sm:text-[12px] tracking-[0.34em] ${bodyColor}`}>
                  {product.tagline.map((t, i) => (
                    <span key={t}>
                      {t}
                      {i < product.tagline.length - 1 && <span className="mx-3 opacity-60">•</span>}
                    </span>
                  ))}
                </p>

                <div className={`mt-6 h-px w-24 ${ruleColor}`} />

                <h2 className={`mt-8 font-serif text-2xl sm:text-[28px] leading-snug ${titleMain} whitespace-pre-line`}>
                  {product.headline}
                </h2>

                <p className={`mt-5 max-w-[480px] text-[14px] leading-relaxed ${bodyColor}`}>
                  {product.description}
                </p>

                <div className="mt-10 grid grid-cols-4 gap-4 max-w-[440px]">
                  {product.features.map(({ icon: Icon, label }) => (
                    <div key={label} className="flex flex-col items-center text-center">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-full border ${iconRing}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <p className={`mt-3 text-[10px] leading-[1.3] tracking-[0.18em] whitespace-pre-line ${iconLabel}`}>
                        {label}
                      </p>
                    </div>
                  ))}
                </div>

                <div className={`mt-10 flex flex-col gap-6`}>
                  <div className="flex items-baseline gap-3">
                    <span className={`font-serif italic text-4xl sm:text-5xl ${titleMain}`}>{product.price}</span>
                    <span className={`text-[12px] tracking-[0.28em] ${bodyColor}`}>{product.priceNote}</span>
                  </div>
                  <div className={`h-px w-40 ${ruleColor}`} />

                  <div className="flex flex-wrap items-center gap-4">
                    <div
                      className={`flex items-center border ${
                        isDark ? "border-primary-foreground/30" : "border-foreground/20"
                      }`}
                    >
                      <button
                        onClick={() => setQty(Math.max(1, qty - 1))}
                        className={`px-4 py-3 ${
                          isDark ? "text-dark-panel-foreground hover:bg-primary-foreground/10" : "text-foreground hover:bg-foreground/5"
                        }`}
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className={`min-w-10 text-center text-sm tracking-widest ${titleMain}`}>{qty}</span>
                      <button
                        onClick={() => setQty(qty + 1)}
                        className={`px-4 py-3 ${
                          isDark ? "text-dark-panel-foreground hover:bg-primary-foreground/10" : "text-foreground hover:bg-foreground/5"
                        }`}
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={handleAdd}
                      className="group inline-flex items-center gap-3 bg-primary px-7 py-3.5 text-[11px] tracking-[0.28em] text-primary-foreground hover:bg-accent transition-colors"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      {added ? "ADDED TO CART" : "ADD TO CART"}
                    </button>
                  </div>
                </div>

                <div className={`mt-12 h-px w-full max-w-[520px] ${ruleColor}`} />
                <p className={`mt-5 text-[11px] tracking-[0.32em] ${eyebrowColor}`}>{product.footerTag}</p>
              </div>

              <div className="order-1 lg:order-2">
                <div className="relative aspect-[4/5] w-full overflow-hidden bg-background/30">
                  <img
                    src={product.gallery[activeImage]}
                    alt={`${product.titleTop} ${product.titleBottom}`}
                    className="h-full w-full object-cover"
                  />
                </div>
                {product.gallery.length > 1 && (
                  <div className="mt-4 grid grid-cols-4 gap-3">
                    {product.gallery.map((src, i) => (
                      <button
                        key={src}
                        onClick={() => setActiveImage(i)}
                        className={`relative aspect-square overflow-hidden border transition ${
                          activeImage === i
                            ? "border-primary"
                            : isDark
                              ? "border-primary-foreground/20 hover:border-primary-foreground/50"
                              : "border-foreground/15 hover:border-foreground/40"
                        }`}
                        aria-label={`View image ${i + 1}`}
                      >
                        <img src={src} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-background py-20">
          <div className="mx-auto max-w-[1400px] px-6 sm:px-10 lg:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-12 lg:gap-20">
              <div>
                <p className="text-[11px] tracking-[0.4em] text-primary">— SPECIFICATIONS</p>
                <h3 className="mt-4 font-serif text-3xl sm:text-4xl text-foreground">
                  Made by hand,<br />measured with care.
                </h3>
                <p className="mt-5 text-sm leading-relaxed text-foreground/70 max-w-[380px]">
                  Each piece is unique — small variations in color, layering and texture are part of the
                  rammed earth process and the character of the work.
                </p>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-6 self-start">
                {product.specs.map((s) => (
                  <div key={s.label} className="border-b border-border pb-4">
                    <dt className="text-[10px] tracking-[0.32em] text-foreground/55">{s.label.toUpperCase()}</dt>
                    <dd className="mt-2 font-serif text-lg text-foreground">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <section className="bg-secondary py-20">
          <div className="mx-auto max-w-[1400px] px-6 sm:px-10 lg:px-12">
            <p className="text-[11px] tracking-[0.4em] text-primary">— ALSO IN THE COLLECTION</p>
            <h3 className="mt-3 font-serif text-3xl text-foreground">Continue exploring</h3>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
              {Object.values(PRODUCTS)
                .filter((p) => p.slug !== product.slug)
                .map((p) => (
                  <Link
                    key={p.slug}
                    to="/products/$slug"
                    params={{ slug: p.slug }}
                    className="group block bg-background overflow-hidden"
                  >
                    <div className="aspect-[4/3] overflow-hidden">
                      <img
                        src={p.gallery[0]}
                        alt={`${p.titleTop} ${p.titleBottom}`}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                    <div className="p-6">
                      <p className="text-[10px] tracking-[0.32em] text-primary">{p.eyebrow}</p>
                      <p className="mt-2 font-serif text-xl text-foreground">
                        {p.titleTop} {p.titleBottom}
                      </p>
                      <p className="mt-3 text-[11px] tracking-[0.28em] text-foreground/60 group-hover:text-primary transition">
                        VIEW PRODUCT →
                      </p>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
