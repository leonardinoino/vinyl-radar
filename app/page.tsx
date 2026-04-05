"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { type Release } from "@/data/mockData";
import { supabase } from "@/lib/supabase";
import { getSignals } from "@/utils/signals";
import {
  calculateBaseScore,
  calculatePersonalScore,
  getRecommendationLabel,
  getScoreReasons,
} from "@/utils/scoring";

type DbRelease = {
  id: number;
  artist: string;
  title: string;
  genre: string;
  type: "Collector Pick" | "Mainstream Breakout";
  price: number;
  first_press: boolean;
  limited: boolean;
  numbered: boolean;
  signed: boolean;
  score: number;
  note: string;
  image_url?: string | null;
};

type VariantRow = {
  id: number;
  release_id: number;
  discogs_id: string;
  artist: string;
  title: string;
  year: string | null;
  format: string | null;
  genre: string | null;
  image_url: string | null;
  note: string | null;
  label?: string | null;
  country?: string | null;
  catalog_number?: string | null;
  discogs_url?: string | null;
  lowest_price?: number | null;
  median_price?: number | null;
  highest_price?: number | null;
  estimated_price?: number | null;
  hype_score?: number | null;
};

type ReleaseWithUi = Release & {
  imageUrl?: string | null;
  baseScore: number;
  personalScore: number;
  recommendation: string;
  reasons: string[];
  artistBoost: number;
  sectionType: "for_you" | "core" | "collector";
  cardSignals: string[];
};

type SortMode = "score" | "price_low" | "price_high" | "artist";

const baseUserView = {
  name: "Collector View",
  maxBudget: 80,
  favoriteArtists: [
    "Radiohead",
    "Arctic Monkeys",
    "Joy Division",
    "The Strokes",
    "Massive Attack",
    "Aphex Twin",
    "Burial",
    "New Order",
  ],
  favoriteGenres: [
    "Alternative Rock",
    "Post-Punk",
    "Indie Rock",
    "Electronic",
    "Experimental",
    "Ambient",
  ],
  likesFirstPress: true,
  likesLimitedEdition: true,
  likesSigned: false,
  collectorLevel: "medium",
};

function mapDbReleaseToAppRelease(
  row: DbRelease
): Release & { imageUrl?: string | null } {
  return {
    id: row.id,
    artist: row.artist,
    title: row.title,
    genre: row.genre,
    type: row.type,
    price: row.price,
    firstPress: row.first_press,
    limited: row.limited,
    numbered: row.numbered,
    signed: row.signed,
    score: row.score,
    note: row.note,
    imageUrl: row.image_url ?? null,
  };
}

function getBadgeStyle(type: string) {
  if (type === "Collector Pick") {
    return "bg-yellow-300/10 text-yellow-200 border border-yellow-300/20";
  }

  return "bg-zinc-800 text-zinc-300 border border-zinc-700";
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getArtistBoost(releaseArtist: string, favorites: string[]): number {
  const releaseArtistNorm = normalizeText(releaseArtist);

  for (const favorite of favorites) {
    const favoriteNorm = normalizeText(favorite);

    if (
      releaseArtistNorm === favoriteNorm ||
      releaseArtistNorm.includes(favoriteNorm) ||
      favoriteNorm.includes(releaseArtistNorm)
    ) {
      return 15;
    }
  }

  return 0;
}

function formatPrice(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }

  return `€ ${Number(value).toFixed(2)}`;
}

function formatCardPrice(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "€ —";
  }

  return `€ ${Number(value)}`;
}

function getHypeLabel(score?: number | null) {
  if (score === null || score === undefined || Number.isNaN(Number(score))) {
    return "Unknown";
  }

  const n = Number(score);
  if (n >= 75) return "High";
  if (n >= 45) return "Medium";
  return "Low";
}

function getHypeBadgeClass(score?: number | null) {
  if (score === null || score === undefined || Number.isNaN(Number(score))) {
    return "bg-zinc-800 text-zinc-300 border border-zinc-700";
  }

  const n = Number(score);
  if (n >= 75) return "bg-yellow-300/15 text-yellow-200 border border-yellow-300/30";
  if (n >= 45) return "bg-amber-400/15 text-amber-200 border border-amber-400/25";
  return "bg-zinc-800 text-zinc-300 border border-zinc-700";
}

function getVariantReason(v: VariantRow) {
  const reasons: string[] = [];

  if ((v.hype_score || 0) >= 75) reasons.push("high hype");
  if ((v.estimated_price || 0) >= 60) reasons.push("strong estimated price");
  if ((v.format || "").toLowerCase().includes("limited")) reasons.push("limited edition");
  if ((v.format || "").toLowerCase().includes("numbered")) reasons.push("numbered copy");
  if ((v.format || "").toLowerCase().includes("mono")) reasons.push("mono variant");
  if (v.catalog_number) reasons.push("clear catalog reference");

  if (reasons.length === 0) {
    return "Questa variante emerge come la più interessante in base a hype e prezzo stimato.";
  }

  return `Questa variante emerge per ${reasons.slice(0, 3).join(", ")}.`;
}

function getBestVariant(variants: VariantRow[]) {
  if (!variants.length) return null;

  return [...variants].sort((a, b) => {
    const hypeA = a.hype_score || 0;
    const hypeB = b.hype_score || 0;

    if (hypeB !== hypeA) return hypeB - hypeA;

    const priceA = a.estimated_price || 0;
    const priceB = b.estimated_price || 0;

    if (priceB !== priceA) return priceB - priceA;

    return (b.year ? Number(b.year) : 0) - (a.year ? Number(a.year) : 0);
  })[0];
}

function getHomeSignals(release: Release, maxBudget: number) {
  const signals: string[] = [];

  if (release.limited || release.numbered) {
    signals.push("COLLECTOR");
  }

  if ((release.price || 0) <= maxBudget * 0.5) {
    signals.push("GOOD PRICE");
  }

  return signals.slice(0, 2);
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs border font-mono transition ${
        active
          ? "bg-yellow-300 text-black border-yellow-200"
          : "bg-black text-zinc-300 border-zinc-700 hover:border-yellow-300/40 hover:text-yellow-200"
      }`}
    >
      {label}
    </button>
  );
}

function ReleaseCard({
  release,
  onOpen,
}: {
  release: ReleaseWithUi;
  onOpen: () => void;
}) {
  return (
    <div
      onClick={onOpen}
      className="rounded-2xl border border-zinc-800 bg-[#0b0b0b] p-4 hover:border-yellow-300/30 transition cursor-pointer"
    >
      <div className="flex gap-3">
        {release.imageUrl ? (
          <img
            src={release.imageUrl}
            alt={release.title}
            className="h-24 w-24 shrink-0 rounded-lg border border-zinc-800 object-cover"
          />
        ) : (
          <div className="h-24 w-24 shrink-0 rounded-lg border border-zinc-800 bg-black" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span
              className={`text-[10px] px-2.5 py-1 rounded-full ${getBadgeStyle(
                release.type
              )}`}
            >
              {release.type}
            </span>

            <span className="text-[10px] px-2.5 py-1 rounded-full border border-zinc-700 text-zinc-400">
              {release.genre}
            </span>
          </div>

          <h3 className="text-sm font-semibold leading-tight mb-1 line-clamp-2 text-white">
            {release.artist}
          </h3>

          <p className="text-xs text-zinc-400 mb-2 line-clamp-2">
            {release.title}
          </p>

          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-[11px] text-yellow-200/90 font-mono">
              {formatCardPrice(release.price)}
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">
              SCORE {release.personalScore}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 mb-2">
            {release.limited && (
              <span className="text-[10px] px-2 py-1 rounded-full bg-black text-yellow-200 border border-yellow-300/20 font-mono">
                LIMITED
              </span>
            )}
            {release.numbered && (
              <span className="text-[10px] px-2 py-1 rounded-full bg-black text-zinc-300 border border-zinc-700 font-mono">
                NUMBERED
              </span>
            )}
          </div>

          {release.cardSignals.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {release.cardSignals.map((signal) => (
                <span
                  key={signal}
                  className="text-[10px] px-2 py-1 rounded-full bg-black text-yellow-200 border border-yellow-300/20 font-mono"
                >
                  {signal}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {release.reasons.slice(0, 2).map((reason, index) => (
          <span
            key={index}
            className="text-[10px] px-2 py-1 rounded-full bg-black text-zinc-400 border border-zinc-800"
          >
            {reason}
          </span>
        ))}
      </div>
    </div>
  );
}

function SectionColumn({
  title,
  subtitle,
  releases,
  onOpen,
}: {
  title: string;
  subtitle: string;
  releases: ReleaseWithUi[];
  onOpen: (release: ReleaseWithUi) => void;
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-black/70 p-4 min-h-0">
      <div className="mb-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-yellow-200 font-mono mb-2">
          {title}
        </p>
        <p className="text-sm text-zinc-500">{subtitle}</p>
      </div>

      <div className="h-[68vh] overflow-y-auto pr-1 space-y-3">
        {releases.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-[#0b0b0b] p-4 text-sm text-zinc-500">
            Nessuna release in questa sezione.
          </div>
        ) : (
          releases.map((release) => (
            <ReleaseCard
              key={release.id}
              release={release}
              onOpen={() => onOpen(release)}
            />
          ))
        )}
      </div>
    </section>
  );
}

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("score");
  const [onlyCollector, setOnlyCollector] = useState(false);
  const [followedArtists, setFollowedArtists] = useState<string[]>([]);

  const [releases, setReleases] = useState<
    (Release & { imageUrl?: string | null })[]
  >([]);

  const [loadingReleases, setLoadingReleases] = useState(true);
  const [releaseError, setReleaseError] = useState("");

  const [selectedRelease, setSelectedRelease] = useState<ReleaseWithUi | null>(null);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("vinylRadar_followedArtists");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setFollowedArtists(parsed);
        }
      } catch {}
    }
  }, []);

  function persistFollowedArtists(nextArtists: string[]) {
    setFollowedArtists(nextArtists);
    window.localStorage.setItem(
      "vinylRadar_followedArtists",
      JSON.stringify(nextArtists)
    );
  }

  function toggleFollowArtist(artist: string) {
    const exists = followedArtists.some(
      (a) => normalizeText(a) === normalizeText(artist)
    );

    if (exists) {
      persistFollowedArtists(
        followedArtists.filter((a) => normalizeText(a) !== normalizeText(artist))
      );
    } else {
      persistFollowedArtists([...followedArtists, artist]);
    }
  }

  function isArtistFollowed(artist: string) {
    return followedArtists.some(
      (a) => normalizeText(a) === normalizeText(artist)
    );
  }

  const userView = useMemo(
    () => ({
      ...baseUserView,
      favoriteArtists: Array.from(
        new Set([...baseUserView.favoriteArtists, ...followedArtists])
      ),
    }),
    [followedArtists]
  );

  async function loadReleases() {
    setLoadingReleases(true);
    setReleaseError("");

    const { data, error } = await supabase
      .from("releases")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      setReleaseError(error.message);
      setReleases([]);
    } else {
      setReleases(((data as DbRelease[]) || []).map(mapDbReleaseToAppRelease));
    }

    setLoadingReleases(false);
  }

  async function openReleaseModal(release: ReleaseWithUi) {
    setSelectedRelease(release);
    setLoadingVariants(true);
    setVariants([]);

    const { data } = await supabase
      .from("release_variants")
      .select("*")
      .eq("release_id", release.id)
      .order("year", { ascending: false });

    setVariants((data as VariantRow[]) || []);
    setLoadingVariants(false);
  }

  function closeReleaseModal() {
    setSelectedRelease(null);
    setVariants([]);
    setLoadingVariants(false);
  }

  useEffect(() => {
    loadReleases();
  }, []);

  const personalizedReleases = useMemo<ReleaseWithUi[]>(() => {
    const mapped = releases.map((release) => {
      let personalScore = calculatePersonalScore(release, userView as any);

      const artistBoost = getArtistBoost(release.artist, userView.favoriteArtists);
      personalScore += artistBoost;
      personalScore = Math.max(0, Math.min(100, personalScore));

      const baseScore = calculateBaseScore(release);
      const recommendation = getRecommendationLabel(personalScore);
      const reasons = getScoreReasons(release, userView as any);

      if (artistBoost > 0) reasons.unshift("Match con artista seguito");

      let sectionType: "for_you" | "core" | "collector" = "core";

      const noteNorm = normalizeText(release.note || "");
      const titleNorm = normalizeText(release.title || "");

      const looksCollector =
        release.type === "Collector Pick" ||
        release.limited ||
        release.numbered ||
        noteNorm.includes("collector") ||
        noteNorm.includes("limited") ||
        titleNorm.includes("edition") ||
        titleNorm.includes("deluxe") ||
        titleNorm.includes("oknotok");

      if (artistBoost > 0) {
        sectionType = "for_you";
      } else if (looksCollector) {
        sectionType = "collector";
      } else {
        sectionType = "core";
      }

      return {
        ...release,
        baseScore,
        personalScore,
        recommendation,
        reasons: reasons.slice(0, 4),
        artistBoost,
        sectionType,
        cardSignals: getHomeSignals(release, userView.maxBudget),
      };
    });

    const filtered = mapped.filter((release) => {
      const q = searchTerm.trim().toLowerCase();

      if (q) {
        const matches =
          release.artist.toLowerCase().includes(q) ||
          release.title.toLowerCase().includes(q) ||
          release.genre.toLowerCase().includes(q) ||
          release.type.toLowerCase().includes(q) ||
          release.note.toLowerCase().includes(q);

        if (!matches) return false;
      }

      if (onlyCollector && release.sectionType !== "collector") return false;

      return true;
    });

    return filtered.sort((a, b) => {
      if (sortMode === "price_low") return (a.price || 0) - (b.price || 0);
      if (sortMode === "price_high") return (b.price || 0) - (a.price || 0);
      if (sortMode === "artist") return a.artist.localeCompare(b.artist);
      return b.personalScore - a.personalScore;
    });
  }, [releases, searchTerm, onlyCollector, sortMode, userView]);

  const forYouReleases = useMemo(
    () => personalizedReleases.filter((r) => r.sectionType === "for_you").slice(0, 12),
    [personalizedReleases]
  );

  const coreReleases = useMemo(
    () => personalizedReleases.filter((r) => r.sectionType === "core").slice(0, 12),
    [personalizedReleases]
  );

  const collectorReleases = useMemo(
    () => personalizedReleases.filter((r) => r.sectionType === "collector").slice(0, 12),
    [personalizedReleases]
  );

  const topPersonalScore = Number.isFinite(personalizedReleases[0]?.personalScore)
    ? personalizedReleases[0].personalScore
    : 0;

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-[1500px] mx-auto px-6 py-10">
        <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-10">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-yellow-200 font-mono mb-3">
              scan system // collector mode
            </p>
            <h1 className="text-4xl md:text-5xl font-bold italic tracking-tight mb-3 text-white">
              VINYL RADAR_
            </h1>
            <p className="text-zinc-500 max-w-2xl">
              Scopri release interessanti, segnali utili e varianti con più potenziale.
            </p>
          </div>

          <div className="flex gap-3 items-center">
            <Link
              href="/crate-page"
              className="rounded-xl border border-yellow-300/30 px-4 py-3 text-sm text-yellow-100 hover:bg-yellow-300 hover:text-black transition font-mono"
            >
              CRATE
            </Link>

            <Link
              href="/admin"
              className="rounded-xl border border-zinc-700 px-4 py-3 text-sm text-zinc-300 hover:border-yellow-300/40 hover:text-yellow-200 transition font-mono"
            >
              ADMIN
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 mb-6">
          <div className="rounded-2xl border border-zinc-800 bg-[#0b0b0b] p-4">
            <label htmlFor="search" className="block text-sm text-zinc-500 mb-2">
              Cerca nelle release
            </label>
            <input
              id="search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Artista, titolo, genere..."
              className="w-full rounded-xl bg-black border border-zinc-700 px-4 py-3 text-white placeholder:text-zinc-600 outline-none focus:border-yellow-300/40 font-mono"
            />
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-[#0b0b0b] p-4">
            <p className="block text-sm text-zinc-500 mb-2">Vista utente</p>
            <div className="flex flex-wrap gap-2">
              <FilterChip
                active={sortMode === "score"}
                label="SORT: SCORE"
                onClick={() => setSortMode("score")}
              />
              <FilterChip
                active={sortMode === "price_low"}
                label="PRICE ↑"
                onClick={() => setSortMode("price_low")}
              />
              <FilterChip
                active={sortMode === "price_high"}
                label="PRICE ↓"
                onClick={() => setSortMode("price_high")}
              />
              <FilterChip
                active={sortMode === "artist"}
                label="ARTIST A-Z"
                onClick={() => setSortMode("artist")}
              />
              <FilterChip
                active={onlyCollector}
                label="ONLY COLLECTOR"
                onClick={() => setOnlyCollector((v) => !v)}
              />
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4 mb-10">
          <div className="rounded-2xl border border-zinc-800 bg-[#0b0b0b] p-5">
            <p className="text-sm text-zinc-600 mb-2">Release visibili</p>
            <p className="text-3xl font-bold text-yellow-200">{personalizedReleases.length}</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-[#0b0b0b] p-5">
            <p className="text-sm text-zinc-600 mb-2">Budget target</p>
            <p className="text-3xl font-bold text-white">€ {userView.maxBudget}</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-[#0b0b0b] p-5">
            <p className="text-sm text-zinc-600 mb-2">Top personal score</p>
            <p className="text-3xl font-bold text-white">{topPersonalScore}</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-[#0b0b0b] p-5">
            <p className="text-sm text-zinc-600 mb-2">Artisti seguiti</p>
            <p className="text-sm text-zinc-300 font-mono">
              {followedArtists.length}
            </p>
          </div>
        </section>

        {loadingReleases && (
          <div className="rounded-2xl border border-zinc-800 bg-[#0b0b0b] p-5 mb-6">
            Caricamento release dal database...
          </div>
        )}

        {releaseError && (
          <div className="rounded-2xl border border-red-800 bg-red-950/40 p-5 mb-6 text-red-300">
            Errore release: {releaseError}
          </div>
        )}

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          <SectionColumn
            title="FOR YOU"
            subtitle="Le release che combaciano di più con i gusti seguiti."
            releases={forYouReleases}
            onOpen={openReleaseModal}
          />

          <SectionColumn
            title="CORE PICKS"
            subtitle="Le release più pulite e centrali da tenere d’occhio."
            releases={coreReleases}
            onOpen={openReleaseModal}
          />

          <SectionColumn
            title="COLLECTOR PICKS"
            subtitle="Edizioni più particolari, limitate o da collezionista."
            releases={collectorReleases}
            onOpen={openReleaseModal}
          />
        </section>
      </div>

      {selectedRelease && (
        <div
          onClick={closeReleaseModal}
          className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center px-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0b0b0b] border border-zinc-800 rounded-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden"
          >
            <div className="p-5 border-b border-zinc-800 flex justify-between items-start gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-yellow-200 font-mono mb-2">
                  RELEASE PANEL
                </p>
                <h2 className="text-xl font-bold italic text-white">{selectedRelease.artist}</h2>
                <p className="text-zinc-500">{selectedRelease.title}</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleFollowArtist(selectedRelease.artist)}
                  className={`rounded-lg px-3 py-2 text-sm font-mono border ${
                    isArtistFollowed(selectedRelease.artist)
                      ? "bg-yellow-300 text-black border-yellow-200"
                      : "bg-black text-yellow-200 border-yellow-300/30 hover:bg-yellow-300 hover:text-black"
                  }`}
                >
                  {isArtistFollowed(selectedRelease.artist)
                    ? "FOLLOWING"
                    : "FOLLOW ARTIST"}
                </button>

                <button
                  onClick={closeReleaseModal}
                  className="text-zinc-500 hover:text-yellow-200 font-mono"
                >
                  CLOSE
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto max-h-[70vh] space-y-4">
              {loadingVariants && (
                <p className="text-zinc-400">Caricamento varianti...</p>
              )}

              {!loadingVariants && variants.length === 0 && (
                <p className="text-zinc-500">Nessuna variante trovata</p>
              )}

              {!loadingVariants && variants.length > 0 && (() => {
                const bestVariant = getBestVariant(variants);

                if (!bestVariant) return null;

                return (
                  <div className="border border-yellow-300/30 rounded-xl p-4 bg-black">
                    <p className="text-xs uppercase tracking-[0.2em] text-yellow-200 font-mono mb-2">
                      BEST VARIANT
                    </p>

                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div>
                        <p className="text-white font-semibold text-base">
                          {bestVariant.title}
                        </p>
                        <p className="text-sm text-zinc-500 mt-1">
                          {bestVariant.label || "Unknown label"} ·{" "}
                          {bestVariant.country || "Unknown country"} ·{" "}
                          {bestVariant.year || "Unknown year"}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`text-xs px-3 py-1 rounded-full ${getHypeBadgeClass(
                            bestVariant.hype_score
                          )}`}
                        >
                          {getHypeLabel(bestVariant.hype_score)}
                        </span>

                        <span className="text-xs px-3 py-1 rounded-full bg-black text-yellow-200 border border-yellow-300/20 font-mono">
                          {formatPrice(bestVariant.estimated_price)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-zinc-600">Catalog #</p>
                        <p className="text-zinc-200">
                          {bestVariant.catalog_number || "—"}
                        </p>
                      </div>

                      <div>
                        <p className="text-zinc-600">Format</p>
                        <p className="text-zinc-200">
                          {bestVariant.format || "—"}
                        </p>
                      </div>

                      <div>
                        <p className="text-zinc-600">Estimated Price</p>
                        <p className="text-yellow-200 font-semibold">
                          {formatPrice(bestVariant.estimated_price)}
                        </p>
                      </div>

                      <div>
                        <p className="text-zinc-600">Hype Score</p>
                        <p className="text-zinc-200">
                          {bestVariant.hype_score === null ||
                          bestVariant.hype_score === undefined
                            ? "—"
                            : `${Number(bestVariant.hype_score).toFixed(0)}/100`}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-yellow-200 font-mono mb-2">
                        WHY IT MATTERS
                      </p>
                      <p className="text-sm text-zinc-400">
                        {getVariantReason(bestVariant)}
                      </p>
                    </div>

                    <div className="mt-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-yellow-200 font-mono mb-2">
                        SIGNALS
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {getSignals(bestVariant).length > 0 ? (
                          getSignals(bestVariant).map((signal) => (
                            <span
                              key={signal}
                              className="text-xs px-3 py-1 rounded-full bg-black text-yellow-200 border border-yellow-300/20 font-mono"
                            >
                              {signal}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-zinc-500">No clear signals yet</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {!loadingVariants &&
                variants.map((v) => (
                  <div
                    key={v.id}
                    className="border border-zinc-800 rounded-xl p-4 bg-black"
                  >
                    <div className="flex gap-4">
                      {v.image_url ? (
                        <img
                          src={v.image_url}
                          alt={v.title}
                          className="w-28 h-28 object-cover rounded-lg border border-zinc-800"
                        />
                      ) : (
                        <div className="w-28 h-28 bg-zinc-900 rounded-lg border border-zinc-800" />
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold text-white">{v.title}</p>
                        <p className="text-sm text-zinc-500 mt-1">
                          {v.year || "Unknown year"}
                        </p>

                        <div className="mt-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-yellow-200 font-mono mb-3">
                            EDITION DETAILS
                          </p>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-zinc-600">Label</p>
                              <p className="text-zinc-200">{v.label || "—"}</p>
                            </div>

                            <div>
                              <p className="text-zinc-600">Country</p>
                              <p className="text-zinc-200">{v.country || "—"}</p>
                            </div>

                            <div>
                              <p className="text-zinc-600">Format</p>
                              <p className="text-zinc-200">{v.format || "—"}</p>
                            </div>

                            <div>
                              <p className="text-zinc-600">Catalog Number</p>
                              <p className="text-zinc-200">{v.catalog_number || "—"}</p>
                            </div>

                            <div>
                              <p className="text-zinc-600">Genre</p>
                              <p className="text-zinc-200">{v.genre || "—"}</p>
                            </div>

                            <div>
                              <p className="text-zinc-600">Release Year</p>
                              <p className="text-zinc-200">{v.year || "—"}</p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-5">
                          <p className="text-xs uppercase tracking-[0.18em] text-yellow-200 font-mono mb-3">
                            MARKET DATA
                          </p>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-zinc-600">Lowest Price</p>
                              <p className="text-zinc-200">{formatPrice(v.lowest_price)}</p>
                            </div>

                            <div>
                              <p className="text-zinc-600">Median Price</p>
                              <p className="text-zinc-200">{formatPrice(v.median_price)}</p>
                            </div>

                            <div>
                              <p className="text-zinc-600">Highest Price</p>
                              <p className="text-zinc-200">{formatPrice(v.highest_price)}</p>
                            </div>

                            <div>
                              <p className="text-zinc-600">Estimated Price</p>
                              <p className="text-yellow-200 font-semibold">
                                {formatPrice(v.estimated_price)}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-5">
                          <p className="text-xs uppercase tracking-[0.18em] text-yellow-200 font-mono mb-3">
                            HYPE / FOMO
                          </p>

                          <div className="flex items-center gap-3">
                            <span
                              className={`text-xs px-3 py-1 rounded-full ${getHypeBadgeClass(
                                v.hype_score
                              )}`}
                            >
                              {getHypeLabel(v.hype_score)}
                            </span>

                            <span className="text-sm text-zinc-300 font-mono">
                              Score:{" "}
                              {v.hype_score === null || v.hype_score === undefined
                                ? "—"
                                : Number(v.hype_score).toFixed(0)}
                              /100
                            </span>
                          </div>
                        </div>

                        {v.discogs_url && (
                          <div className="mt-4">
                            <a
                              href={`https://www.discogs.com${v.discogs_url}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center rounded-lg border border-yellow-300/30 px-3 py-2 text-sm text-yellow-100 hover:bg-yellow-300 hover:text-black transition font-mono"
                            >
                              VIEW ON DISCOGS
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}