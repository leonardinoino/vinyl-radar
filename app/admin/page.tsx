"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { mockUsers, type MockUserKey } from "@/data/mockData";
import { supabase } from "@/lib/supabase";

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

export default function AdminPage() {
  const [selectedUser, setSelectedUser] = useState<MockUserKey>("user1");
  const [discogsQuery, setDiscogsQuery] = useState("Arctic Monkeys");

  const [likedCount, setLikedCount] = useState(0);
  const [ignoredCount, setIgnoredCount] = useState(0);

  const [dbProfile, setDbProfile] = useState<DbUserProfile | null>(null);
  const [favoriteArtists, setFavoriteArtists] = useState<DbFavoriteArtist[]>([]);
  const [connections, setConnections] = useState<DbUserConnection[]>([]);

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingFeedback, setLoadingFeedback] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [feedbackError, setFeedbackError] = useState("");

  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [importError, setImportError] = useState("");

  const currentUser = mockUsers[selectedUser];

  async function loadFeedback(userKey: MockUserKey) {
    setLoadingFeedback(true);
    setFeedbackError("");

    const { data, error } = await supabase
      .from("user_feedback")
      .select("*")
      .eq("user_key", userKey);

    if (error) {
      setFeedbackError(error.message);
      setLikedCount(0);
      setIgnoredCount(0);
    } else {
      const rows = (data as DbFeedback[]) || [];
      setLikedCount(rows.filter((r) => r.feedback_type === "like").length);
      setIgnoredCount(rows.filter((r) => r.feedback_type === "ignore").length);
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

    await loadFeedback(selectedUser);
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
    } catch {
      setImportError("Errore di rete durante l'import");
    } finally {
      setImporting(false);
    }
  }

  useEffect(() => {
    loadProfileAndFavorites();
  }, []);

  useEffect(() => {
    loadFeedback(selectedUser);
  }, [selectedUser]);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-[1100px] mx-auto px-6 py-10">
        <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-10">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-yellow-200 font-mono mb-3">
              admin // internal tools
            </p>
            <h1 className="text-4xl md:text-5xl font-bold italic tracking-tight mb-3 text-white">
              VINYL RADAR_ADMIN
            </h1>
            <p className="text-zinc-500 max-w-2xl">
              Import, test, feedback e dati di supporto.
            </p>
          </div>

          <div className="flex gap-3 items-center">
            <Link
              href="/"
              className="rounded-xl border border-yellow-300/30 px-4 py-3 text-sm text-yellow-100 hover:bg-yellow-300 hover:text-black transition font-mono"
            >
              BACK TO APP
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 mb-8">
          <div className="rounded-2xl border border-zinc-800 bg-[#0b0b0b] p-5">
            <p className="text-[11px] uppercase tracking-[0.2em] text-yellow-200 font-mono mb-4">
              DISCOGS IMPORT
            </p>

            <div className="flex gap-3">
              <input
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

          <div className="rounded-2xl border border-zinc-800 bg-[#0b0b0b] p-5">
            <p className="text-[11px] uppercase tracking-[0.2em] text-yellow-200 font-mono mb-4">
              MOCK USER CONTROL
            </p>

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

            <div className="mt-4 text-sm text-zinc-500">
              <p className="text-zinc-200">{currentUser.name}</p>
              <p>Budget: € {currentUser.maxBudget}</p>
              <p>Collector level: {currentUser.collectorLevel}</p>
            </div>

            <button
              onClick={resetFeedback}
              className="mt-4 w-full rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-yellow-300/40 hover:text-yellow-200 font-mono transition"
            >
              RESET FEEDBACK
            </button>

            {feedbackError && (
              <p className="text-sm text-red-400 mt-3 font-mono">{feedbackError}</p>
            )}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3 mb-8">
          <div className="rounded-2xl border border-zinc-800 bg-[#0b0b0b] p-5">
            <p className="text-sm text-zinc-600 mb-2">Feedback likes</p>
            <p className="text-3xl font-bold text-yellow-200">
              {loadingFeedback ? "…" : likedCount}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-[#0b0b0b] p-5">
            <p className="text-sm text-zinc-600 mb-2">Feedback pass</p>
            <p className="text-3xl font-bold text-white">
              {loadingFeedback ? "…" : ignoredCount}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-[#0b0b0b] p-5">
            <p className="text-sm text-zinc-600 mb-2">DB profile</p>
            <p className="text-sm text-zinc-300 font-mono">
              {loadingProfile
                ? "loading..."
                : dbProfile?.username || dbProfile?.email || "none"}
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-zinc-800 bg-[#0b0b0b] p-5">
            <p className="text-[11px] uppercase tracking-[0.2em] text-yellow-200 font-mono mb-4">
              DB FAVORITE ARTISTS
            </p>

            {profileError && <p className="text-red-400 mb-3">{profileError}</p>}

            <div className="flex flex-wrap gap-2">
              {favoriteArtists.length === 0 ? (
                <span className="text-zinc-500">Nessun artista preferito salvato</span>
              ) : (
                favoriteArtists.map((artist) => (
                  <span
                    key={artist.id}
                    className="text-xs px-3 py-1 rounded-full bg-black text-yellow-200 border border-yellow-300/20 font-mono"
                  >
                    {artist.artist_name} · peso {artist.weight}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-[#0b0b0b] p-5">
            <p className="text-[11px] uppercase tracking-[0.2em] text-yellow-200 font-mono mb-4">
              DB CONNECTIONS
            </p>

            <div className="flex flex-wrap gap-2">
              {connections.length === 0 ? (
                <span className="text-zinc-500">Nessuna connessione salvata</span>
              ) : (
                connections.map((connection) => (
                  <span
                    key={connection.id}
                    className="text-xs px-3 py-1 rounded-full bg-black text-zinc-300 border border-zinc-700 font-mono"
                  >
                    {connection.provider || "provider"} ·{" "}
                    {connection.external_id || "senza external id"}
                  </span>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}