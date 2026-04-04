import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEFAULT_SEED_ARTISTS = [
  "Radiohead",
  "Arctic Monkeys",
  "The Strokes",
  "Joy Division",
  "Burial",
  "The Beatles",
  "Pink Floyd",
  "Nirvana",
  "David Bowie",
  "Talking Heads",
  "Aphex Twin",
  "Massive Attack",
  "Portishead",
  "Tame Impala",
  "The Cure",
  "Daft Punk",
  "Boards of Canada",
  "New Order",
  "Fontaines D.C.",
  "Queens of the Stone Age",
];

const PARALLEL_BATCH_SIZE = 2;
const BACKFILL_ALL_BATCH_SIZE = 1;
const REQUEST_DELAY_MS = 1400;

type ImportResult = {
  success: boolean;
  query: string;
  error?: string;
  totalResults?: number;
  insertedAlbums: number;
  insertedVariants: number;
  skippedNonVinyl: number;
  skippedVariantDuplicate: number;
  skippedMalformed: number;
  skippedInsertError: number;
  skippedLowQuality: number;
};

type DiscogsResult = {
  id: number | string;
  title?: string;
  year?: number | string | null;
  format?: string[] | string | null;
  genre?: string[] | null;
  cover_image?: string | null;
  label?: string[] | string | null;
  country?: string | null;
  catno?: string[] | string | null;
  uri?: string | null;
};

type ExistingVariant = {
  id: number;
  discogs_id: string;
  artist: string;
  title: string;
};

type ExistingReleaseArtist = {
  artist: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFormatString(formatValue: unknown) {
  if (Array.isArray(formatValue)) {
    return formatValue.join(" ").toLowerCase();
  }

  if (typeof formatValue === "string") {
    return formatValue.toLowerCase();
  }

  return "";
}

function parseDiscogsTitle(rawTitle: string, fallbackQuery: string) {
  if (!rawTitle) {
    return { artist: fallbackQuery, title: "Unknown" };
  }

  if (rawTitle.includes(" - ")) {
    const parts = rawTitle.split(" - ");
    return {
      artist: parts[0]?.trim() || fallbackQuery,
      title: parts.slice(1).join(" - ").trim() || rawTitle,
    };
  }

  return {
    artist: fallbackQuery,
    title: rawTitle.trim(),
  };
}

function looksBadResult(parsedArtist: string, parsedTitle: string, format: string) {
  const artist = parsedArtist.toLowerCase();
  const title = parsedTitle.toLowerCase();

  const bannedArtistWords = ["various", "unknown artist"];
  const bannedTitleWords = [
    "tribute",
    "revisited",
    "jazz",
    "karaoke",
    "cover versions",
    "greatest hits",
    "best of",
    "unreleased",
  ];
  const bannedFormatWords = ["cd", "cassette", "dvd", "blu-ray"];

  if (bannedArtistWords.some((word) => artist.includes(word))) return true;
  if (bannedTitleWords.some((word) => title.includes(word))) return true;
  if (bannedFormatWords.some((word) => format.includes(word))) return true;

  return false;
}

function toSingleString(value: unknown): string | null {
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" && first.trim() ? first.trim() : null;
  }

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function buildPricingAndHype(format: string, year: string | null, genre: string | null) {
  let base = 22;

  const currentYear = new Date().getFullYear();
  const numericYear = year ? Number(year) : NaN;
  const age = Number.isFinite(numericYear) ? currentYear - numericYear : 0;

  if (age >= 25) base += 16;
  else if (age >= 15) base += 10;
  else if (age >= 5) base += 5;

  if (format.includes("limited")) base += 14;
  if (format.includes("numbered")) base += 12;
  if (format.includes("mono")) base += 8;
  if (format.includes("misprint")) base += 10;
  if (format.includes("reissue")) base -= 2;
  if (format.includes("repress")) base -= 1;
  if (format.includes("unofficial")) base -= 10;

  const genreNorm = (genre || "").toLowerCase();
  if (genreNorm.includes("electronic")) base += 4;
  if (genreNorm.includes("rock")) base += 2;

  const lowest = clamp(Math.round(base * 0.8), 8, 500);
  const median = clamp(Math.round(base * 1.15), 10, 800);
  const highest = clamp(Math.round(base * 1.9), 14, 1500);
  const estimated = Math.round(median * 0.7 + lowest * 0.3);

  let hype = 35;
  if (format.includes("limited")) hype += 18;
  if (format.includes("numbered")) hype += 16;
  if (format.includes("mono")) hype += 8;
  if (age <= 3 && age >= 0) hype += 12;
  if (age >= 20) hype += 10;
  if (format.includes("unofficial")) hype -= 20;

  hype = clamp(hype, 5, 98);

  return {
    lowest_price: lowest,
    median_price: median,
    highest_price: highest,
    estimated_price: estimated,
    hype_score: hype,
  };
}

async function searchDiscogsReleases(q: string): Promise<DiscogsResult[]> {
  const res = await fetch(
    `https://api.discogs.com/database/search?q=${encodeURIComponent(
      q
    )}&type=release&per_page=30`,
    {
      headers: {
        Authorization: `Discogs token=${process.env.DISCOGS_TOKEN}`,
        "User-Agent": "VinylRadar/1.0",
      },
      cache: "no-store",
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.message || "Errore Discogs");
  }

  return Array.isArray(data.results) ? data.results : [];
}

async function importOneQuery(q: string): Promise<ImportResult> {
  const results = await searchDiscogsReleases(q);

  let insertedAlbums = 0;
  let insertedVariants = 0;
  let skippedNonVinyl = 0;
  let skippedVariantDuplicate = 0;
  let skippedMalformed = 0;
  let skippedInsertError = 0;
  let skippedLowQuality = 0;

  for (const r of results) {
    const rawTitle = String(r.title || "");
    const format = getFormatString(r.format);
    const parsed = parseDiscogsTitle(rawTitle, q);

    if (!format.includes("vinyl")) {
      skippedNonVinyl++;
      continue;
    }

    if (!parsed.artist || !parsed.title) {
      skippedMalformed++;
      continue;
    }

    if (looksBadResult(parsed.artist, parsed.title, format)) {
      skippedLowQuality++;
      continue;
    }

    const discogsId = String(r.id);

    const { data: existingVariant, error: existingVariantError } = await supabase
      .from("release_variants")
      .select("id")
      .eq("discogs_id", discogsId)
      .maybeSingle();

    if (existingVariantError) {
      skippedInsertError++;
      continue;
    }

    if (existingVariant) {
      skippedVariantDuplicate++;
      continue;
    }

    let releaseId: number | null = null;

    const { data: existingRelease, error: existingReleaseError } = await supabase
      .from("releases")
      .select("id")
      .eq("artist", parsed.artist)
      .eq("title", parsed.title)
      .maybeSingle();

    if (existingReleaseError) {
      skippedInsertError++;
      continue;
    }

    if (existingRelease) {
      releaseId = existingRelease.id;
    } else {
      const { data: insertedRelease, error: insertReleaseError } = await supabase
        .from("releases")
        .insert({
          artist: parsed.artist,
          title: parsed.title,
          genre: Array.isArray(r.genre) ? r.genre[0] || "Unknown" : "Unknown",
          type:
            format.includes("limited") || format.includes("numbered")
              ? "Collector Pick"
              : "Mainstream Breakout",
          price: Math.floor(Math.random() * 35) + 15,
          first_press: false,
          limited: format.includes("limited"),
          numbered: format.includes("numbered"),
          signed: false,
          score: Math.floor(Math.random() * 25) + 65,
          note: "Imported from Discogs seed",
          image_url: r.cover_image || null,
        })
        .select("id")
        .single();

      if (insertReleaseError || !insertedRelease) {
        skippedInsertError++;
        continue;
      }

      releaseId = insertedRelease.id;
      insertedAlbums++;
    }

    const yearValue = r.year ? String(r.year) : null;
    const genreValue = Array.isArray(r.genre) ? r.genre[0] || "Unknown" : "Unknown";
    const pricing = buildPricingAndHype(format, yearValue, genreValue);

    const { error: insertVariantError } = await supabase
      .from("release_variants")
      .insert({
        release_id: releaseId,
        discogs_id: discogsId,
        artist: parsed.artist,
        title: parsed.title,
        year: yearValue,
        format,
        genre: genreValue,
        image_url: r.cover_image || null,
        note: rawTitle,
        label: toSingleString(r.label),
        country: toSingleString(r.country),
        catalog_number: toSingleString(r.catno),
        discogs_url: toSingleString(r.uri),
        ...pricing,
      });

    if (insertVariantError) {
      skippedInsertError++;
      continue;
    }

    insertedVariants++;
  }

  return {
    success: true,
    query: q,
    totalResults: results.length,
    insertedAlbums,
    insertedVariants,
    skippedNonVinyl,
    skippedVariantDuplicate,
    skippedMalformed,
    skippedInsertError,
    skippedLowQuality,
  };
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function backfillVariantData(query: string) {
  const existingVariantsRes = await supabase
    .from("release_variants")
    .select("id, discogs_id, artist, title")
    .ilike("artist", `%${query}%`);

  if (existingVariantsRes.error) {
    throw new Error(existingVariantsRes.error.message);
  }

  const existingVariants = (existingVariantsRes.data || []) as ExistingVariant[];

  await sleep(REQUEST_DELAY_MS);
  const results = await searchDiscogsReleases(query);

  let updated = 0;
  let notFound = 0;
  let skippedNonVinyl = 0;

  for (const variant of existingVariants) {
    const match = results.find((r) => String(r.id) === String(variant.discogs_id));

    if (!match) {
      notFound++;
      continue;
    }

    const format = getFormatString(match.format);

    if (!format.includes("vinyl")) {
      skippedNonVinyl++;
      continue;
    }

    const yearValue = match.year ? String(match.year) : null;
    const genreValue = Array.isArray(match.genre)
      ? match.genre[0] || "Unknown"
      : "Unknown";

    const pricing = buildPricingAndHype(format, yearValue, genreValue);

    const { error } = await supabase
      .from("release_variants")
      .update({
        year: yearValue,
        format,
        genre: genreValue,
        image_url: match.cover_image || null,
        label: toSingleString(match.label),
        country: toSingleString(match.country),
        catalog_number: toSingleString(match.catno),
        discogs_url: toSingleString(match.uri),
        ...pricing,
      })
      .eq("id", variant.id);

    if (!error) {
      updated++;
    }
  }

  return {
    success: true,
    mode: "backfill-variant-data",
    query,
    variantsMatched: existingVariants.length,
    updated,
    notFound,
    skippedNonVinyl,
  };
}

async function backfillAllVariantData() {
  const releasesRes = await supabase
    .from("releases")
    .select("artist");

  if (releasesRes.error) {
    throw new Error(releasesRes.error.message);
  }

  const rawArtists = (releasesRes.data || []) as ExistingReleaseArtist[];
  const uniqueArtists = Array.from(
    new Set(
      rawArtists
        .map((row) => row.artist?.trim())
        .filter(Boolean)
    )
  ) as string[];

  const artistBatches = chunkArray(uniqueArtists, BACKFILL_ALL_BATCH_SIZE);

  const perArtist = [];
  let totalUpdated = 0;
  let totalNotFound = 0;
  let totalSkippedNonVinyl = 0;

  for (const batch of artistBatches) {
    const batchResults = [];

    for (const artist of batch) {
      const result = await backfillVariantData(artist);
      batchResults.push(result);
      await sleep(REQUEST_DELAY_MS);
    }

    for (const result of batchResults) {
      perArtist.push(result);
      totalUpdated += result.updated || 0;
      totalNotFound += result.notFound || 0;
      totalSkippedNonVinyl += result.skippedNonVinyl || 0;
    }
  }

  return {
    success: true,
    mode: "backfill-all",
    artistsProcessed: uniqueArtists.length,
    batchSize: BACKFILL_ALL_BATCH_SIZE,
    delayMs: REQUEST_DELAY_MS,
    totalUpdated,
    totalNotFound,
    totalSkippedNonVinyl,
    perArtist,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode");
  const q = searchParams.get("q") || "";

  if (mode === "ping") {
    return NextResponse.json({ success: true });
  }

  if (mode === "discogs-run") {
    try {
      const result = await importOneQuery(q);

      return NextResponse.json({
        success: true,
        mode: "discogs-run",
        ...result,
      });
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : "Errore Discogs import",
        },
        { status: 500 }
      );
    }
  }

  if (mode === "catalog-seed") {
    try {
      const artistListFromQuery = searchParams.get("artists");
      const artists = artistListFromQuery
        ? artistListFromQuery
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : DEFAULT_SEED_ARTISTS;

      const artistBatches = chunkArray(artists, PARALLEL_BATCH_SIZE);
      const perArtist: ImportResult[] = [];

      let totalInsertedAlbums = 0;
      let totalInsertedVariants = 0;
      let totalSkippedNonVinyl = 0;
      let totalSkippedVariantDuplicate = 0;
      let totalSkippedMalformed = 0;
      let totalSkippedInsertError = 0;
      let totalSkippedLowQuality = 0;

      for (const batch of artistBatches) {
        const batchResults = [];

        for (const artist of batch) {
          const result = await importOneQuery(artist);
          batchResults.push(result);
          await sleep(REQUEST_DELAY_MS);
        }

        for (const result of batchResults) {
          perArtist.push(result);
          totalInsertedAlbums += result.insertedAlbums || 0;
          totalInsertedVariants += result.insertedVariants || 0;
          totalSkippedNonVinyl += result.skippedNonVinyl || 0;
          totalSkippedVariantDuplicate += result.skippedVariantDuplicate || 0;
          totalSkippedMalformed += result.skippedMalformed || 0;
          totalSkippedInsertError += result.skippedInsertError || 0;
          totalSkippedLowQuality += result.skippedLowQuality || 0;
        }
      }

      return NextResponse.json({
        success: true,
        mode: "catalog-seed",
        artistsProcessed: artists.length,
        parallelBatchSize: PARALLEL_BATCH_SIZE,
        delayMs: REQUEST_DELAY_MS,
        totalInsertedAlbums,
        totalInsertedVariants,
        totalSkippedNonVinyl,
        totalSkippedVariantDuplicate,
        totalSkippedMalformed,
        totalSkippedInsertError,
        totalSkippedLowQuality,
        perArtist,
      });
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : "Errore seed catalogo",
        },
        { status: 500 }
      );
    }
  }

  if (mode === "backfill-variant-data") {
    try {
      if (!q.trim()) {
        return NextResponse.json(
          {
            success: false,
            error: "Manca il parametro q",
          },
          { status: 400 }
        );
      }

      const result = await backfillVariantData(q);

      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : "Errore backfill varianti",
        },
        { status: 500 }
      );
    }
  }

  if (mode === "backfill-all") {
    try {
      const result = await backfillAllVariantData();
      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : "Errore backfill completo",
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    success: false,
    error: `mode non supportata: ${mode}`,
  });
}