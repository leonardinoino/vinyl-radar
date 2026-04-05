"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { mockUsers, type MockUserKey, type Release } from "@/data/mockData";
import { supabase } from "@/lib/supabase";
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

type DbFeedback = {
  id: number;
  user_key: string;
  release_id: number;
  feedback_type: "like" | "ignore";
};

type DbUserProfile = {
  id: string;
  email: string | null;
  username: string | null;
};

type DbFavoriteArtist = {
  id: string;
  user_id: string;
  artist_name: string;
  weight: number;
};

type DbUserConnection = {
  id: string;
  user_id: string;
  provider: string | null;
  external_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
};

type DiscogsRunResponse = {
  success?: boolean;
  mode?: string;
  query?: string;
  insertedAlbums?: number;
  insertedVariants?: number;
  skippedNonVinyl?: number;
  skippedVariantDuplicate?: number;
  skippedMalformed?: number;
  skippedInsertError?: number;
  error?: string;
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

function getArtistBoost(
  releaseArtist: string,
  favorites: DbFavoriteArtist[]
): number {
  const releaseArtistNorm = normalizeText(releaseArtist);

  for (const favorite of favorites) {
    const favoriteNorm = normalizeText(favorite.artist_name);

    if (
      releaseArtistNorm === favoriteNorm ||
      releaseArtistNorm.includes(favoriteNorm) ||
      favoriteNorm.includes(releaseArtistNorm)
    ) {
      return favorite.weight * 5;
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

function ReleaseCard({
  release,
  isLiked,
  isIgnored,
  onLike,
  onIgnore,
  onOpen,
}: {
  release: ReleaseWithUi;
  isLiked: boolean;
  isIgnored: boolean;
  onLike: () => void;
  onIgnore: () => void;
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

          <p className="text-[11px] text-yellow-200/90 font-mono">
            € {release.price} · Score {release.personalScore}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-3 mb-3">
        {release.reasons.slice(0, 2).map((reason, index) => (
          <span
            key={index}
            className="text-[10px] px-2 py-1 rounded-full bg-black text-zinc-400 border border-zinc-800"
          >
            {reason}
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onLike();
          }}
          className={`flex-1 px-3 py-2 rounded-lg text-xs border font-mono ${
            isLiked
              ? "bg-yellow-300 text-black border-yellow-200"
              : "bg-zinc-900 border-zinc-700 text-zinc-200 hover:border-yellow-300/40 hover:text-yellow-200"
          }`}
        >
          ON CRATE
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onIgnore();
          }}
          className={`flex-1 px-3 py-2 rounded-lg text-xs border font-mono ${
            isIgnored
              ? "bg-zinc-200 text-black border-zinc-100"
              : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          }`}
        >
          PASS
        </button>
      </div>
    </div>
  );
}

function SectionColumn({
  title,
  subtitle,
  releases,
  liked,
  ignored,
  onLike,
  onIgnore,
  onOpen,
}: {
  title: string;
  subtitle: string;
  releases: ReleaseWithUi[];
  liked: number[];
  ignored: number[];
  onLike: (releaseId: number) => void;
  onIgnore: (releaseId: number) => void;
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
              isLiked={liked.includes(release.id)}
              isIgnored={ignored.includes(release.id)}
              onLike={() => onLike(release.id)}
              onIgnore={() => onIgnore(release.id)}
              onOpen={() => onOpen(release)}
            />
          ))
        )}
      </div>
    </section>
  );
}

export default function Home() {
  const [selectedUser, setSelectedUser] = useState<MockUserKey>("user1");
  const [searchTerm, setSearchTerm] = useState("");
  const [discogsQuery, setDiscogsQuery] = useState("Arctic Monkeys");

  const [releases, setReleases] = useState<
    (Release & { imageUrl?: string | null })[]
  >([]);
  const [liked, setLiked] = useState<number[]>([]);
  const [ignored, setIgnored] = useState<number[]>([]);

  const [dbProfile, setDbProfile] = useState<DbUserProfile | null>(null);
  const [favoriteArtists, setFavoriteArtists] = useState<DbFavoriteArtist[]>([]);
  const [connections, setConnections] = useState<DbUserConnection[]>([]);

  const [loadingReleases, setLoadingReleases] = useState(true);
  const [loadingFeedback, setLoadingFeedback] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [releaseError, setReleaseError] = useState("");
  const [feedbackError, setFeedbackError] = useState("");
  const [profileError, setProfileError] = useState("");

  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [importError, setImportError] = useState("");

  const [selectedRelease, setSelectedRelease] = useState<ReleaseWithUi | null>(null);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);

  const currentUser = mockUsers[selectedUser];

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

  async function loadFeedback(userKey: MockUserKey) {
    setLoadingFeedback(true);
    setFeedbackError("");

    const { data, error } = await supabase
      .from("user_feedback")
      .select("*")
      .eq("user_key", userKey);

    if (error) {
      setFeedbackError(error.message);
      setLiked([]);
      setIgnored([]);
    } else {
      const rows = (data as DbFeedback[]) || [];
      setLiked(
        rows.filter((r) => r.feedback_type === "like").map((r) => r.release_id)
      );
      setIgnored(
        rows
          .filter((r) => r.feedback_type === "ignore")
          .map((r) => r.release_id)
      );
    }

    setLoadingFeedback(false);
  }

  async function loadProfileAndFavorites() {
    setLoadingProfile(true);
    setProfileError("");

    const { data: profileData, error: profileLoadError } = await supabase
      .from("user_profiles")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (profileLoadError) {
      setProfileError(profileLoadError.message);
      setDbProfile(null);
      setFavoriteArtists([]);
      setConnections([]);
      setLoadingProfile(false);
      return;
    }

    if (!profileData) {
      setDbProfile(null);
      setFavoriteArtists([]);
      setConnections([]);
      setLoadingProfile(false);
      return;
    }

    const profile = profileData as DbUserProfile;
    setDbProfile(profile);

    const { data: favoritesData, error: favoritesError } = await supabase
      .from("user_favorite_artists")
      .select("*")
      .eq("user_id", profile.id)
      .order("weight", { ascending: false });

    if (favoritesError) {
      setProfileError(favoritesError.message);
      setFavoriteArtists([]);
    } else {
      setFavoriteArtists((favoritesData as DbFavoriteArtist[]) || []);
    }

    const { data: connectionsData, error: connectionsError } = await supabase
      .from("user_connections")
      .select("*")
      .eq("user_id", profile.id);

    if (connectionsError) {
      setProfileError(connectionsError.message);
      setConnections([]);
    } else {
      setConnections((connectionsData as DbUserConnection[]) || []);
    }

    setLoadingProfile(false);
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
    loadProfileAndFavorites();
  }, []);

  useEffect(() => {
    loadFeedback(selectedUser);
  }, [selectedUser]);

  const personalizedReleases = useMemo<ReleaseWithUi[]>(() => {
    return releases
      .map((release) => {
        let personalScore = calculatePersonalScore(release, currentUser);

        const artistBoost = getArtistBoost(release.artist, favoriteArtists);
        personalScore += artistBoost;

        if (liked.includes(release.id)) personalScore += 15;
        if (ignored.includes(release.id)) personalScore -= 20;

        personalScore = Math.max(0, Math.min(100, personalScore));

        const baseScore = calculateBaseScore(release);
        const recommendation = getRecommendationLabel(personalScore);
        const reasons = getScoreReasons(release, currentUser);

        if (artistBoost > 0) reasons.unshift("Match con artista preferito");
        if (liked.includes(release.id)) reasons.unshift("Ti è piaciuta");
        if (ignored.includes(release.id)) reasons.unshift("L'hai ignorata");

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

        if (artistBoost > 0 || liked.includes(release.id)) {
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
        };
      })
      .sort((a, b) => b.personalScore - a.personalScore);
  }, [releases, currentUser, liked, ignored, favoriteArtists]);

  const filteredReleases = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    if (!q) return personalizedReleases;

    return personalizedReleases.filter((release) => {
      return (
        release.artist.toLowerCase().includes(q) ||
        release.title.toLowerCase().includes(q) ||
        release.genre.toLowerCase().includes(q) ||
        release.type.toLowerCase().includes(q) ||
        release.note.toLowerCase().includes(q)
      );
    });
  }, [personalizedReleases, searchTerm]);

  const forYouReleases = useMemo(
    () => filteredReleases.filter((r) => r.sectionType === "for_you").slice(0, 12),
    [filteredReleases]
  );

  const coreReleases = useMemo(
    () => filteredReleases.filter((r) => r.sectionType === "core").slice(0, 12),
    [filteredReleases]
  );

  const collectorReleases = useMemo(
    () =>
      filteredReleases.filter((r) => r.sectionType === "collector").slice(0, 12),
    [filteredReleases]
  );

  const topPersonalScore = Number.isFinite(filteredReleases[0]?.personalScore)
    ? filteredReleases[0].personalScore
    : 0;

  async function refreshFeedback() {
    await loadFeedback(selectedUser);
  }

  async function setFeedback(
    releaseId: number,
    feedbackType: "like" | "ignore"
  ) {
    setFeedbackError("");

    const oppositeType = feedbackType === "like" ? "ignore" : "like";

    const currentlyLiked = liked.includes(releaseId);
    const currentlyIgnored = ignored.includes(releaseId);

    const alreadySelected =
      (feedbackType === "like" && currentlyLiked) ||
      (feedbackType === "ignore" && currentlyIgnored);

    const { error: deleteOppositeError } = await supabase
      .from("user_feedback")
      .delete()
      .eq("user_key", selectedUser)
      .eq("release_id", releaseId)
      .eq("feedback_type", oppositeType);

    if (deleteOppositeError) {
      setFeedbackError(deleteOppositeError.message);
      return;
    }

    if (alreadySelected) {
      const { error } = await supabase
        .from("user_feedback")
        .delete()
        .eq("user_key", selectedUser)
        .eq("release_id", releaseId)
        .eq("feedback_type", feedbackType);

      if (error) {
        setFeedbackError(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("user_feedback").upsert(
        {
          user_key: selectedUser,
          release_id: releaseId,
          feedback_type: feedbackType,
        },
        {
          onConflict: "user_key,release_id",
        }
      );

      if (error) {
        setFeedbackError(error.message);
        return;
      }
    }

    await refreshFeedback();
  }

  async function resetFeedback() {
    setFeedbackError("");

    const { error } = await supabase
      .from("user_feedback")
      .delete()
      .eq("user_key", selectedUser);

    if (error) {
      setFeedbackError(error.message);
      return;
    }

    setLiked([]);
    setIgnored([]);
  }

  async function runDiscogsImport() {
    setImporting(true);
    setImportError("");
    setImportMessage("");

    try {
      const response = await fetch(
        `/api/test?mode=discogs-run&q=${encodeURIComponent(discogsQuery)}`,
        { cache: "no-store" }
      );

      const data = (await response.json()) as DiscogsRunResponse;

      if (!response.ok || data.error || !data.success) {
        setImportError(data.error || "Errore import Discogs");
        setImporting(false);
        return;
      }

      setImportMessage(
        `Album nuovi: ${data.insertedAlbums ?? 0} · Varianti nuove: ${data.insertedVariants ?? 0} · Scartate non-vinyl: ${data.skippedNonVinyl ?? 0}`
      );

      await loadReleases();
    } catch {
      setImportError("Errore di rete durante l'import");
    } finally {
      setImporting(false);
    }
  }

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
              Release da Supabase, feedback nel database, import Discogs e base pronta
              per connessioni future.
            </p>
          </div>

          <div className="flex gap-3 items-center">
            <Link
              href="/crate-page"
              className="rounded-xl border border-yellow-300/30 px-4 py-3 text-sm text-yellow-100 hover:bg-yellow-300 hover:text-black transition font-mono"
            >
              CRATE
            </Link>

            <div className="rounded-2xl border border-zinc-800 bg-[#0b0b0b] px-5 py-3 min-w-[280px]">
              <p className="text-sm text-zinc-500 mb-2">Utente attivo</p>

              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value as MockUserKey)}
                className="w-full rounded-lg bg-black border border-zinc-700 px-3 py-2 text-white font-mono"
              >
                <option value="user1">Mock User 1</option>
                <option value="user2">Mock User 2</option>
                <option value="user3">Mock User 3</option>
                <option value="user4">Mock User 4</option>
              </select>

              <div className="mt-3 text-sm text-zinc-500">
                <p className="text-zinc-200">{currentUser.name}</p>
                <p>Budget: € {currentUser.maxBudget}</p>
                <p>Collector level: {currentUser.collectorLevel}</p>
              </div>

              <button
                onClick={resetFeedback}
                className="mt-4 w-full rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-yellow-300/40 hover:text-yellow-200 font-mono transition"
              >
                RESET
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 mb-8">
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
            <label
              htmlFor="discogsQuery"
              className="block text-sm text-zinc-500 mb-2"
            >
              Importa da Discogs
            </label>

            <div className="flex gap-3">
              <input
                id="discogsQuery"
                type="text"
                value={discogsQuery}
                onChange={(e) => setDiscogsQuery(e.target.value)}
                placeholder="Es. Arctic Monkeys"
                className="flex-1 rounded-xl bg-black border border-zinc-700 px-4 py-3 text-white placeholder:text-zinc-600 outline-none focus:border-yellow-300/40 font-mono"
              />

              <button
                onClick={runDiscogsImport}
                disabled={importing || !discogsQuery.trim()}
                className="rounded-xl bg-yellow-300 text-black px-4 py-3 font-semibold disabled:opacity-50 font-mono"
              >
                {importing ? "IMPORT..." : "IMPORTA"}
              </button>
            </div>

            {importMessage && (
              <p className="text-sm text-yellow-200 mt-3 font-mono">{importMessage}</p>
            )}

            {importError && (
              <p className="text-sm text-red-400 mt-3 font-mono">{importError}</p>
            )}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4 mb-10">
          <div className="rounded-2xl border border-zinc-800 bg-[#0b0b0b] p-5">
            <p className="text-sm text-zinc-600 mb-2">Release visibili</p>
            <p className="text-3xl font-bold text-yellow-200">{filteredReleases.length}</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-[#0b0b0b] p-5">
            <p className="text-sm text-zinc-600 mb-2">Budget utente</p>
            <p className="text-3xl font-bold text-white">€ {currentUser.maxBudget}</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-[#0b0b0b] p-5">
            <p className="text-sm text-zinc-600 mb-2">Top personal score</p>
            <p className="text-3xl font-bold text-white">{topPersonalScore}</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-[#0b0b0b] p-5">
            <p className="text-sm text-zinc-600 mb-2">Feedback DB</p>
            <p className="text-sm text-zinc-300 font-mono">
              ON CRATE {liked.length} · PASS {ignored.length}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-[#0b0b0b] p-5 mb-6">
          <p className="text-sm text-zinc-600 mb-3">Profilo gusti dal database</p>

          {loadingProfile && <p className="text-zinc-400">Caricamento profilo...</p>}
          {profileError && <p className="text-red-400">{profileError}</p>}

          {!loadingProfile && !profileError && !dbProfile && (
            <p className="text-zinc-500">Nessun user profile trovato nel database.</p>
          )}

          {dbProfile && (
            <div className="space-y-3">
              <p className="text-zinc-300">
                Profilo attivo DB:{" "}
                <span className="font-semibold text-white">
                  {dbProfile.username || dbProfile.email || "utente senza nome"}
                </span>
              </p>

              <div className="flex flex-wrap gap-2">
                {favoriteArtists.length === 0 && (
                  <span className="text-zinc-600">
                    Nessun artista preferito salvato
                  </span>
                )}

                {favoriteArtists.map((artist) => (
                  <span
                    key={artist.id}
                    className="text-xs px-3 py-1 rounded-full bg-black text-yellow-200 border border-yellow-300/20 font-mono"
                  >
                    {artist.artist_name} · peso {artist.weight}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-[#0b0b0b] p-5 mb-10">
          <p className="text-sm text-zinc-600 mb-3">Connessioni account</p>

          {!loadingProfile && connections.length === 0 && (
            <p className="text-zinc-500">
              Nessun account collegato ancora. Qui compariranno Discogs e Spotify.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {connections.map((connection) => (
              <span
                key={connection.id}
                className="text-xs px-3 py-1 rounded-full bg-black text-zinc-300 border border-zinc-700 font-mono"
              >
                {connection.provider || "provider"} ·{" "}
                {connection.external_id || "senza external id"}
              </span>
            ))}
          </div>
        </section>

        {loadingReleases && (
          <div className="rounded-2xl border border-zinc-800 bg-[#0b0b0b] p-5 mb-6">
            Caricamento release dal database...
          </div>
        )}

        {loadingFeedback && (
          <div className="rounded-2xl border border-zinc-800 bg-[#0b0b0b] p-5 mb-6">
            Caricamento feedback utente...
          </div>
        )}

        {releaseError && (
          <div className="rounded-2xl border border-red-800 bg-red-950/40 p-5 mb-6 text-red-300">
            Errore release: {releaseError}
          </div>
        )}

        {feedbackError && (
          <div className="rounded-2xl border border-red-800 bg-red-950/40 p-5 mb-6 text-red-300">
            Errore feedback: {feedbackError}
          </div>
        )}

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          <SectionColumn
            title="FOR YOU"
            subtitle="Le release che combaciano di più con i tuoi gusti e il tuo comportamento."
            releases={forYouReleases}
            liked={liked}
            ignored={ignored}
            onLike={(id) => setFeedback(id, "like")}
            onIgnore={(id) => setFeedback(id, "ignore")}
            onOpen={openReleaseModal}
          />

          <SectionColumn
            title="CORE PICKS"
            subtitle="Le release più pulite e centrali da tenere d’occhio."
            releases={coreReleases}
            liked={liked}
            ignored={ignored}
            onLike={(id) => setFeedback(id, "like")}
            onIgnore={(id) => setFeedback(id, "ignore")}
            onOpen={openReleaseModal}
          />

          <SectionColumn
            title="COLLECTOR PICKS"
            subtitle="Edizioni più particolari, limitate o da collezionista."
            releases={collectorReleases}
            liked={liked}
            ignored={ignored}
            onLike={(id) => setFeedback(id, "like")}
            onIgnore={(id) => setFeedback(id, "ignore")}
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
            <div className="p-5 border-b border-zinc-800 flex justify-between items-start">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-yellow-200 font-mono mb-2">
                  RELEASE PANEL
                </p>
                <h2 className="text-xl font-bold italic text-white">{selectedRelease.artist}</h2>
                <p className="text-zinc-500">{selectedRelease.title}</p>
              </div>

              <button
                onClick={closeReleaseModal}
                className="text-zinc-500 hover:text-yellow-200 font-mono"
              >
                CLOSE
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[70vh] space-y-4">
              {loadingVariants && (
                <p className="text-zinc-400">Caricamento varianti...</p>
              )}

              {!loadingVariants && variants.length === 0 && (
                <p className="text-zinc-500">Nessuna variante trovata</p>
              )}

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