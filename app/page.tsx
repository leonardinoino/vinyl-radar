"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Release = {
  id: number;
  artist: string;
  title: string;
  image_url?: string;
  price?: number;
};

export default function HomePage() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [selected, setSelected] = useState<Release | null>(null);

  async function loadData() {
    const { data } = await supabase.from("releases").select("*").limit(20);
    setReleases(data || []);
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <h1 className="text-3xl font-bold mb-6">Vinyl Radar</h1>

      {/* GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {releases.map((r) => (
          <div
            key={r.id}
            onClick={() => setSelected(r)}
            className="cursor-pointer bg-zinc-900 p-3 rounded-xl border border-zinc-800 hover:bg-zinc-800"
          >
            {r.image_url && (
              <img
                src={r.image_url}
                className="rounded mb-2"
              />
            )}
            <p className="text-sm font-bold">{r.artist}</p>
            <p className="text-xs text-zinc-400">{r.title}</p>
          </div>
        ))}
      </div>

      {/* MODALE */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-900 p-6 rounded-2xl w-full max-w-md border border-zinc-700"
          >
            {selected.image_url && (
              <img src={selected.image_url} className="rounded mb-4" />
            )}

            <h2 className="text-xl font-bold mb-2">
              {selected.artist}
            </h2>

            <p className="text-zinc-400 mb-4">
              {selected.title}
            </p>

            <p className="text-sm">
              Prezzo stimato: € {selected.price || 0}
            </p>

            <button
              onClick={() => setSelected(null)}
              className="mt-6 w-full bg-white text-black py-2 rounded-xl"
            >
              Chiudi
            </button>
          </div>
        </div>
      )}
    </main>
  );
}