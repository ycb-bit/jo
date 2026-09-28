import type { Metadata } from "next";
import ProductView from "./product-view";
import {
  SITE_URL,
  getProductForSeo,
  getStoreSettings,
  getPublishedSlugs,
  productJsonLd,
  priceForSchema,
} from "@/lib/catalog-server";

type Params = { params: Promise<{ slug: string }> };

/**
 * Pre-render every published product at build time so each one gets real
 * HTML + metadata instead of an empty client shell.
 */
export async function generateStaticParams() {
  const slugs = await getPublishedSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const [product, settings] = await Promise.all([getProductForSeo(slug), getStoreSettings()]);

  if (!product) {
    return {
      title: "Piece not found",
      description: "This piece may have sold out and been retired.",
      robots: { index: false, follow: false },
    };
  }

  const title = `${product.name}${product.colors?.length ? ` — ${product.colors.join(" / ")}` : ""}`;
  const desc = (product.description || "").slice(0, 300);
  const { value, currency } = priceForSchema(product, settings);
  const url = `${SITE_URL}/product/${product.slug}`;

  // Prefer a real photo for the social card; otherwise fall back to the
  // category so shares never render as a blank card.
  const ogImage = (product.images || []).find((i) => typeof i === "string" && i.startsWith("http"));

  return {
    title,
    description: desc,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      type: "website",
      siteName: "JO",
      url,
      title,
      description: desc,
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
    other: {
      "product:price:amount": value,
      "product:price:currency": currency,
    },
  };
}

export default async function Page({ params }: Params) {
  const { slug } = await params;
  const [product, settings] = await Promise.all([getProductForSeo(slug), getStoreSettings()]);
  const jsonLd = product ? productJsonLd(product, settings) : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          // JSON.stringify output is safe here: no user-controlled HTML context.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ProductView slug={slug} />
    </>
  );
}
