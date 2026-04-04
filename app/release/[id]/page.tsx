"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Variant = {
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
};

type ReleaseRow = {
  id: number;
  artist: string;
  title: string;
  image_url?: string | null;
  genre?: string | null;
  note?: string | null;
};

export default function ReleaseVariantsPage() {
  const params = useParams();
  const releaseId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [variants, setVariants] = useState<Variant[]>([]);
  const [release, setRelease] = useState<ReleaseRow | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadData(currentReleaseId: string) {
    setLoading(true);

    const { data: releaseData } = await supabase
      .from("releases")
      .select("*")
      .eq("id", currentReleaseId)
      .maybeSingle();

    const { data: variantsData } = await supabase
      .from("release_variants")
      .select("*")
      .eq("release_id", currentReleaseId)
      .order("year", { ascending: false });

    setRelease((releaseData as ReleaseRow) || null);
    setVariants((variantsData as Variant[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!releaseId) return;
    loadData(String(releaseId));
  }, [releaseId]);

  return (
    <main className="min-h-screen bg-black text-white px-6 py-10">
      <div className="max-w-6xl mx-auto">
        <Link
          href="/"
          className="text-sm text-zinc-400 hover:text-white mb-6 inline-block"
        >
          ← Torna alla home
        </Link>

        {release && (
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              {release.artist}
            </h1>
            <p className="text-zinc-300 text-lg">{release.title}</p>
          </div>
        )}

        {loading && <p className="text-zinc-400">Caricamento varianti...</p>}

        {!loading && variants.length === 0 && (
          <p className="text-zinc-400">Nessuna variante trovata.</p>
        )}

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {variants.map((v) => (
            <div
              key={v.id}
              className="border border-zinc-800 rounded-2xl p-4 bg-zinc-900"
            >
              <div className="flex gap-3">
                {v.image_url ? (
                  <img
                    src={v.image_url}
                    alt={v.title}
                    className="w-20 h-20 object-cover rounded-lg border border-zinc-800"
                  />
                ) : (
                  <div className="w-20 h-20 bg-zinc-800 rounded-lg" />
                )}

                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm line-clamp-2">{v.artist}</p>
                  <p className="text-sm text-zinc-300 line-clamp-2">{v.title}</p>

                  <p className="text-xs text-zinc-500 mt-2">
                    {v.year || "Anno sconosciuto"}
                  </p>

                  <p className="text-xs text-zinc-500 line-clamp-3">
                    {v.format || "Formato sconosciuto"}
                  </p>
                </div>
              </div>

              {v.note && (
                <p className="text-xs text-zinc-600 mt-3 line-clamp-2">
                  {v.note}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}