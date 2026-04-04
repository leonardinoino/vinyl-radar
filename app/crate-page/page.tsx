"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type DbRelease = {
  id: number;
  artist: string;
  title: string;
  genre: string;
  type: string;
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

type CrateRelease = DbRelease & {
  imageUrl?: string | null;
};

function mapRelease(row: DbRelease): CrateRelease {
  return {
    ...row,
    imageUrl: row.image_url ?? null,
  };
}

export default function CratePage() {
  const [releases, setReleases] = useState<CrateRelease[]>([]);
  const [likedIds, setLikedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadCrate() {
    setLoading(true);
    setError("");

    const { data: feedbackData, error: feedbackError } = await supabase
      .from("user_feedback")
      .select("*")
      .eq("user_key", "user1")
      .eq("feedback_type", "like");

    if (feedbackError) {
      setError(feedbackError.message);
      setLoading(false);
      return;
    }

    const likes = ((feedbackData as DbFeedback[]) || []).map((r) => r.release_id);
    setLikedIds(likes);

    if (likes.length === 0) {
      setReleases([]);
      setLoading(false);
      return;
    }

    const { data: releasesData, error: releasesError } = await supabase
      .from("releases")
      .select("*")
      .in("id", likes)
      .order("id", { ascending: false });

    if (releasesError) {
      setError(releasesError.message);
      setLoading(false);
      return;
    }

    setReleases(((releasesData as DbRelease[]) || []).map(mapRelease));
    setLoading(false);
  }

  async function removeFromCrate(releaseId: number) {
    const { error: deleteError } = await supabase
      .from("user_feedback")
      .delete()
      .eq("user_key", "user1")
      .eq("release_id", releaseId)
      .eq("feedback_type", "like");

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    await loadCrate();
  }

  useEffect(() => {
    loadCrate();
  }, []);

  const totalValue = useMemo(() => {
    return releases.reduce((sum, release) => sum + (release.price || 0), 0);
  }, [releases]);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-10">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-zinc-500 mb-3">
              Saved picks
            </p>
            <h1 className="text-4xl md:text-5xl font-bold mb-3">Crate</h1>
            <p className="text-zinc-400">
              Le release che hai messo da parte con On Crate.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-zinc-700 px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            ← Home
          </Link>
        </header>

        <section className="grid gap-4 md:grid-cols-3 mb-10">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-500 mb-2">On Crate</p>
            <p className="text-3xl font-bold">{likedIds.length}</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-500 mb-2">Valore totale</p>
            <p className="text-3xl font-bold">€ {totalValue}</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-500 mb-2">Stato</p>
            <p className="text-sm text-zinc-300">
              {likedIds.length > 0 ? "Crate attiva" : "Crate vuota"}
            </p>
          </div>
        </section>

        {loading && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 mb-6">
            Caricamento crate...
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-800 bg-red-950/40 p-5 mb-6 text-red-300">
            Errore: {error}
          </div>
        )}

        {!loading && !error && releases.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-zinc-400">
            Non hai ancora messo nulla in crate.
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {releases.map((release) => (
            <div
              key={release.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"
            >
              <div className="flex gap-3">
                {release.imageUrl ? (
                  <img
                    src={release.imageUrl}
                    alt={release.title}
                    className="h-24 w-24 shrink-0 rounded-lg border border-zinc-800 object-cover"
                  />
                ) : (
                  <div className="h-24 w-24 shrink-0 rounded-lg border border-zinc-800 bg-zinc-950" />
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-[10px] px-2.5 py-1 rounded-full border border-zinc-700 text-zinc-300">
                      {release.genre}
                    </span>
                    <span className="text-[10px] px-2.5 py-1 rounded-full border border-zinc-700 text-zinc-300">
                      {release.type}
                    </span>
                  </div>

                  <h2 className="text-sm font-semibold leading-tight mb-1 line-clamp-2">
                    {release.artist}
                  </h2>
                  <p className="text-xs text-zinc-300 mb-2 line-clamp-2">
                    {release.title}
                  </p>
                  <p className="text-[11px] text-zinc-500">€ {release.price}</p>
                </div>
              </div>

              <button
                onClick={() => removeFromCrate(release.id)}
                className="mt-4 w-full rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800"
              >
                Remove from Crate
              </button>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}