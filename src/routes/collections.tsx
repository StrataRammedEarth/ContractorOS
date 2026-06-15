import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import pureEarth from "@/assets/collections/pure-rammed-earth.jpg";
import steelV1 from "@/assets/collections/steel-earth-v1.jpg";
import steelV2 from "@/assets/collections/steel-earth-v2.jpg";
import steelV3 from "@/assets/collections/steel-earth-v3.jpg";
import tealight from "@/assets/collections/tealight.jpg";
import heroRock from "@/assets/hero-strata.jpg";
import pendantPure from "@/assets/products/pendant-pure-earth.jpg";
import pendantMetal from "@/assets/products/pendant-metal-earth.jpg";
import { Leaf, Hand, Home, Mountain, Lightbulb, Layers, Flame, Recycle } from "lucide-react";

export const Route = createFileRoute("/collections")({
  head: () => ({
    meta: [
      { title: "Collections — STRATA Forged by Earth" },
      {
        name: "description",
        content:
          "Explore the STRATA product catalog: Pure Rammed Earth ceiling down lights, Rammed Earth + Mild Steel collection, and handcrafted tealight candle holders.",
      },
      { property: "og:title", content: "Collections — STRATA" },
      {
        property: "og:description",
        content:
          "Earth made. Purpose driven. Beautifully lit. Browse the STRATA down lights and décor collection.",
      },
    ],
  }),
  component: CollectionsPage,
});

function CollectionsPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* COVER */}
      <section className="relative">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-0 px-0 pt-32 lg:pt-36">
          <div className="relative bg-dark-panel text-dark-panel-foreground overflow-hidden">
            <img
              src={heroRock}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover opacity-30"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-dark-panel/80 via-dark-panel/70 to-dark-panel/95" />
            <div className="relative flex h-full flex-col justify-between p-10 lg:p-14 min-h-[460px]">
              <div className="flex items-center gap-3 text-[11px] tracking-[0.4em] text-dark-panel-foreground/80">
                <span>STRATA</span>
                <span className="h-px w-10 bg-dark-panel-foreground/40" />
                <span>2024</span>
              </div>
              <div>
                <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl leading-[0.95] tracking-tight">
                  PRODUCT
                  <br />
                  CATALOG
                </h1>
                <div className="mt-6 h-px w-16 bg-primary" />
                <p className="mt-6 text-[11px] tracking-[0.35em] text-dark-panel-foreground/85">
                  EARTH MADE.
                  <br />
                  PURPOSE DRIVEN.
                  <br />
                  BEAUTIFULLY LIT.
                </p>
                <p className="mt-8 text-[11px] tracking-[0.3em] text-primary">
                  DOWN LIGHTS &amp; DÉCOR COLLECTION
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card p-10 lg:p-14 flex flex-col justify-center">
            <p className="text-[11px] tracking-[0.4em] text-primary">ABOUT STRATA</p>
            <h2 className="mt-4 font-serif text-3xl sm:text-4xl lg:text-5xl leading-tight text-foreground">
              FORGED BY EARTH.
              <br />
              INSPIRED BY NATURE.
            </h2>
            <div className="mt-6 space-y-4 text-sm leading-relaxed text-foreground/80 max-w-md">
              <p>
                At Strata, we celebrate the ancient art of rammed earth — a material as
                timeless as the landscapes that shape it.
              </p>
              <p>
                Each piece is handcrafted with care, blending natural textures, warm tones,
                and modern design to create lighting and décor that brings harmony,
                authenticity, and soul into your space.
              </p>
              <p className="font-medium text-foreground">
                Sustainable. Natural. Beautifully functional. Made to last generations.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-4 gap-4 max-w-md">
              {[
                { Icon: Leaf, label: "SUSTAINABLE\nMATERIALS" },
                { Icon: Hand, label: "HANDCRAFTED\nWITH CARE" },
                { Icon: Home, label: "TIMELESS\nDESIGN" },
                { Icon: Mountain, label: "INSPIRED BY\nNATURE" },
              ].map(({ Icon, label }) => (
                <div key={label} className="flex flex-col items-center text-center gap-2">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/40 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="whitespace-pre text-[9px] tracking-[0.18em] text-foreground/70 leading-snug">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SIGNATURE COLLECTION — PURE RAMMED EARTH */}
      <CollectionHeader
        eyebrow="SIGNATURE COLLECTION"
        title="PURE RAMMED EARTH CEILING DOWN LIGHTS"
        copy="Our pure rammed earth down lights bring natural warmth and organic texture into your interiors. The recessed GU10 light source casts a soft, warm glow — perfect for creating calm, grounded spaces."
        features={[
          { Icon: Layers, label: "NATURAL\nMATERIAL" },
          { Icon: Lightbulb, label: "SOFT WARM\nLIGHT" },
          { Icon: Home, label: "MINIMALIST\nDESIGN" },
          { Icon: Hand, label: "HANDMADE\nIN SA" },
        ]}
        image={pureEarth}
        tone="light"
      />

      <ProductRow
        tone="light"
        items={[
          {
            no: "04",
            name: "PURE RAMMED EARTH\nDOWN LIGHT — VARIANT 1",
            material: "Rammed Earth",
            lamp: "GU10 (Recessed)",
            finish: "Natural Earth Tones",
            price: "R1399",
            image: pureEarth,
            slug: "ceiling-down-light",
          },
          {
            no: "05",
            name: "PURE RAMMED EARTH\nDOWN LIGHT — VARIANT 2",
            material: "Rammed Earth",
            lamp: "GU10 (Recessed)",
            finish: "Natural Earth Tones",
            price: "R1399",
            image: pureEarth,
            slug: "ceiling-down-light",
          },
          {
            no: "06",
            name: "PURE RAMMED EARTH\nDOWN LIGHT — VARIANT 3",
            material: "Rammed Earth",
            lamp: "GU10 (Recessed)",
            finish: "Natural Earth Tones",
            price: "R1399",
            image: pureEarth,
            slug: "ceiling-down-light",
          },
        ]}
      />

      {/* STEEL + EARTH COLLECTION */}
      <ProductRow
        tone="dark"
        eyebrow="STEEL + EARTH COLLECTION"
        items={[
          {
            no: "07",
            name: "RAMMED EARTH + MILD STEEL\nDOWN LIGHT — VARIANT 1",
            material: "Rammed Earth\n& Mild Steel",
            lamp: "GU10 (Recessed)",
            finish: "Natural Earth\n& Rust Patina",
            price: "R1699",
            image: steelV1,
            slug: "metal-and-rammed-earth",
          },
          {
            no: "08",
            name: "RAMMED EARTH + MILD STEEL\nDOWN LIGHT — VARIANT 2",
            material: "Rammed Earth\n& Mild Steel",
            lamp: "GU10 (Recessed)",
            finish: "Natural Earth\n& Rust Patina",
            price: "R1699",
            image: steelV2,
            slug: "metal-and-rammed-earth",
          },
          {
            no: "09",
            name: "RAMMED EARTH + MILD STEEL\nDOWN LIGHT — VARIANT 3",
            material: "Rammed Earth\n& Mild Steel",
            lamp: "GU10 (Recessed)",
            finish: "Natural Earth\n& Rust Patina",
            price: "R1699",
            image: steelV3,
            slug: "metal-and-rammed-earth",
          },
        ]}
      />

      {/* PENDANT LIGHT COLLECTION */}
      <CollectionHeader
        eyebrow="PENDANT COLLECTION"
        title="RAMMED EARTH PENDANT LIGHTS"
        copy="A statement piece for kitchens, dining areas and entrance halls. Each pendant is hand pressed in layered rammed earth — available as a pure earth cylinder, or paired with a blackened steel base for an architectural finish."
        features={[
          { Icon: Layers, label: "LAYERED\nEARTH" },
          { Icon: Lightbulb, label: "AMBIENT\nGLOW" },
          { Icon: Hand, label: "HAND\nPRESSED" },
          { Icon: Home, label: "STATEMENT\nPIECE" },
        ]}
        image={pendantPure}
        tone="light"
      />

      <ProductRow
        tone="light"
        items={[
          {
            no: "10",
            name: "PURE RAMMED EARTH\nPENDANT LIGHT",
            material: "Rammed Earth",
            lamp: "E27 Pendant",
            finish: "Layered Earth Tones",
            price: "R1899",
            image: pendantPure,
            slug: "pendant-light",
          },
          {
            no: "11",
            name: "METAL & RAMMED EARTH\nPENDANT LIGHT",
            material: "Rammed Earth\n& Blackened Steel",
            lamp: "E27 Pendant",
            finish: "Earth & Patina",
            price: "R2199",
            image: pendantMetal,
            slug: "pendant-light",
          },
        ]}
      />

      {/* TEALIGHT + MATERIAL STORY + PRICING */}
      <section className="mx-auto grid max-w-[1400px] grid-cols-1 lg:grid-cols-3 gap-0">
        {/* Tealight card */}
        <Link
          to="/products/$slug"
          params={{ slug: "tealight-candle-holder" }}
          className="group bg-card p-10 lg:p-12 flex flex-col hover:bg-card/80 transition-colors"
        >
          <p className="text-[11px] tracking-[0.4em] text-primary">DECOR COLLECTION</p>
          <h3 className="mt-3 font-serif text-2xl lg:text-3xl text-foreground leading-tight">
            RAMMED EARTH
            <br />
            TEALIGHT CANDLE HOLDER
          </h3>
          <p className="mt-4 text-sm text-foreground/75 leading-relaxed">
            Handcrafted from rammed earth in natural yellow and red earth tones. Each holder
            is uniquely layered, celebrating texture, colour, and the beauty of imperfection.
          </p>
          <div className="my-6 flex-1">
            <img
              src={tealight}
              alt="Rammed earth tealight candle holders"
              className="h-56 w-full rounded-sm object-cover shadow-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 text-[9px] tracking-[0.18em] text-foreground/70">
            {[
              { Icon: Leaf, label: "NATURAL\nMATERIALS" },
              { Icon: Hand, label: "HANDCRAFTED\n& UNIQUE" },
              { Icon: Recycle, label: "SUSTAINABLE\nMADE" },
              { Icon: Home, label: "MINIMALIST\nDESIGN" },
            ].map(({ Icon, label }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/40 text-primary">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="whitespace-pre leading-snug">{label}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 border-t border-border pt-4">
            <p className="text-[10px] tracking-[0.3em] text-primary">PRICE</p>
            <p className="mt-1 font-serif text-2xl text-primary">
              R300 <span className="text-[10px] tracking-[0.25em] text-foreground/60">EX VAT EACH</span>
            </p>
          </div>
        </Link>

        {/* Material story */}
        <div className="bg-secondary p-10 lg:p-12 flex flex-col justify-center">
          <p className="text-[11px] tracking-[0.4em] text-primary">MATERIAL STORY</p>
          <h3 className="mt-4 font-serif text-3xl lg:text-4xl text-foreground leading-tight">
            SUSTAINABLE BY NATURE.
            <br />
            MADE TO LAST.
          </h3>
          <div className="mt-5 space-y-3 text-sm text-foreground/80 leading-relaxed">
            <p>
              Rammed earth is one of the world's most{" "}
              <span className="font-semibold">sustainable building materials.</span>
            </p>
            <p>It is natural, non-toxic, energy efficient, and beautifully resilient.</p>
            <p>
              By using earth, we reduce our impact and create meaningful products that honour
              the planet.
            </p>
          </div>
          <div className="mt-8 grid grid-cols-4 gap-3">
            {[
              { Icon: Leaf, label: "LOW CARBON\nFOOTPRINT" },
              { Icon: Recycle, label: "NON\nTOXIC" },
              { Icon: Flame, label: "THERMAL\nREGULATION" },
              { Icon: Home, label: "BUILT TO\nLAST" },
            ].map(({ Icon, label }) => (
              <div key={label} className="flex flex-col items-center text-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/40 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="whitespace-pre text-[9px] tracking-[0.18em] text-foreground/70 leading-snug">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing summary */}
        <div className="bg-card flex flex-col">
          <div className="p-10 lg:p-12 flex-1">
            <p className="text-[11px] tracking-[0.4em] text-primary">PRICING ———</p>
            <ul className="mt-6 divide-y divide-border">
              <PriceRow name="PURE RAMMED EARTH CEILING DOWN LIGHTS" price="R1399" suffix="EX VAT" />
              <PriceRow name="RAMMED EARTH + MILD STEEL DOWN LIGHTS" price="R1699" suffix="EX VAT" />
              <PriceRow name="PURE RAMMED EARTH PENDANT LIGHT" price="R1899" suffix="EX VAT" />
              <PriceRow name="METAL & RAMMED EARTH PENDANT LIGHT" price="R2199" suffix="EX VAT" />
              <PriceRow name="RAMMED EARTH TEALIGHT CANDLE HOLDER" price="R300" suffix="EX VAT EACH" />
            </ul>

            <div className="mt-8 bg-primary text-primary-foreground p-6">
              <p className="text-[11px] tracking-[0.35em]">CUSTOM ORDERS</p>
              <p className="mt-3 text-sm leading-relaxed">
                We offer custom sizes, colour blends, and finishes for architectural and
                commercial projects. Enquire for trade pricing.
              </p>
            </div>
          </div>

          <div className="bg-dark-panel text-dark-panel-foreground p-10 lg:p-12">
            <p className="text-[11px] tracking-[0.4em] text-primary">GET IN TOUCH</p>
            <ul className="mt-4 space-y-2 text-sm text-dark-panel-foreground/85">
              <li>www.strataearth.com</li>
              <li>hello@strataearth.com</li>
              <li>@strataearth</li>
            </ul>
            <div className="mt-6">
              <Link
                to="/"
                className="inline-block text-[11px] tracking-[0.3em] text-primary hover:text-primary/80 transition-colors"
              >
                ← BACK TO HOME
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function CollectionHeader({
  eyebrow,
  title,
  copy,
  features,
  image,
  tone,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  features: { Icon: React.ComponentType<{ className?: string }>; label: string }[];
  image: string;
  tone: "light" | "dark";
}) {
  const bg = tone === "dark" ? "bg-dark-panel text-dark-panel-foreground" : "bg-card text-foreground";
  const sub = tone === "dark" ? "text-dark-panel-foreground/80" : "text-foreground/75";
  return (
    <section className={`${bg}`}>
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 lg:grid-cols-[1fr_1fr] gap-10 lg:gap-14 px-10 lg:px-14 py-14 lg:py-20 items-center">
        <div>
          <p className="text-[11px] tracking-[0.4em] text-primary">{eyebrow}</p>
          <h2 className="mt-4 font-serif text-3xl sm:text-4xl lg:text-5xl leading-tight">{title}</h2>
          <p className={`mt-6 text-sm leading-relaxed max-w-md ${sub}`}>{copy}</p>
          <div className="mt-10 grid grid-cols-4 gap-4 max-w-md">
            {features.map(({ Icon, label }) => (
              <div key={label} className="flex flex-col items-center text-center gap-2">
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/40 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <span className={`whitespace-pre text-[9px] tracking-[0.18em] leading-snug ${sub}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-center">
          <img src={image} alt={title} className="max-h-[420px] w-auto object-contain" />
        </div>
      </div>
    </section>
  );
}

function ProductRow({
  items,
  tone,
  eyebrow,
}: {
  items: {
    no: string;
    name: string;
    material: string;
    lamp: string;
    finish: string;
    price: string;
    image: string;
    slug: string;
  }[];
  tone: "light" | "dark";
  eyebrow?: string;
}) {
  const bg = tone === "dark" ? "bg-dark-panel text-dark-panel-foreground" : "bg-card text-foreground";
  const labelColor = tone === "dark" ? "text-dark-panel-foreground/60" : "text-foreground/60";
  const valueColor = tone === "dark" ? "text-dark-panel-foreground/90" : "text-foreground/85";
  const cols =
    items.length === 2
      ? "md:grid-cols-2"
      : items.length === 1
        ? "md:grid-cols-1"
        : "md:grid-cols-3";
  return (
    <section className={bg}>
      <div className={`mx-auto grid max-w-[1400px] grid-cols-1 ${cols} gap-0`}>
        {items.map((item, i) => (
          <Link
            key={item.no}
            to="/products/$slug"
            params={{ slug: item.slug }}
            className={`group p-8 lg:p-10 flex flex-col transition-colors ${
              tone === "dark" ? "hover:bg-white/[0.02]" : "hover:bg-foreground/[0.02]"
            } ${
              i > 0 ? (tone === "dark" ? "md:border-l md:border-white/10" : "md:border-l md:border-border") : ""
            }`}
          >
            {eyebrow && i === 0 && (
              <p className="text-[11px] tracking-[0.4em] text-primary mb-3">{eyebrow}</p>
            )}
            {eyebrow && i > 0 && (
              <p className="text-[11px] tracking-[0.4em] text-primary mb-3 opacity-0 select-none">.</p>
            )}
            {!eyebrow && (
              <p className="text-[11px] tracking-[0.4em] text-primary mb-3">SIGNATURE COLLECTION</p>
            )}
            <h3 className="font-serif text-xl lg:text-2xl whitespace-pre-line leading-tight">
              {item.name}
            </h3>
            <div className="my-6 flex flex-1 items-center justify-center">
              <img src={item.image} alt={item.name} className="max-h-[260px] w-auto object-contain transition-transform duration-500 group-hover:scale-[1.03]" />
            </div>
            <div className="grid grid-cols-4 gap-3 text-[10px] tracking-[0.2em]">
              <div>
                <p className={labelColor}>MATERIAL</p>
                <p className={`mt-1 whitespace-pre-line text-[11px] tracking-normal ${valueColor}`}>
                  {item.material}
                </p>
              </div>
              <div>
                <p className={labelColor}>LAMP</p>
                <p className={`mt-1 text-[11px] tracking-normal ${valueColor}`}>{item.lamp}</p>
              </div>
              <div>
                <p className={labelColor}>FINISH</p>
                <p className={`mt-1 whitespace-pre-line text-[11px] tracking-normal ${valueColor}`}>
                  {item.finish}
                </p>
              </div>
              <div>
                <p className="text-primary">PRICE</p>
                <p className="mt-1 font-serif text-xl text-primary leading-none">{item.price}</p>
                <p className={`mt-1 text-[9px] tracking-[0.2em] ${labelColor}`}>EX VAT</p>
              </div>
            </div>
            <p className={`mt-6 text-[10px] tracking-[0.3em] ${labelColor}`}>{item.no}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function PriceRow({ name, price, suffix }: { name: string; price: string; suffix: string }) {
  return (
    <li className="flex items-start justify-between gap-6 py-4">
      <span className="text-[11px] tracking-[0.25em] text-foreground/85 max-w-[70%]">{name}</span>
      <span className="text-right">
        <span className="block font-serif text-lg text-primary leading-none">{price}</span>
        <span className="mt-1 block text-[9px] tracking-[0.25em] text-foreground/55">{suffix}</span>
      </span>
    </li>
  );
}
