"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Release = {
  id: number;
  artist: string;
  title: string;
  image_url?: string;
  price?: number;
  label?: string;
  year?: number;
  country?: string;
};

export default function Home() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [selected, setSelected] = useState<Release | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data } = await supabase
      .from("releases")
      .select("*")
      .limit(30);

    setReleases(data || []);
  }

  function Column({ title, items }: { title: string; items: Release[] }) {
    return (
      <div className="flex flex-col h-[80vh] border border-zinc-800 bg-black overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 text-xs tracking-widest text-lime-400 font-mono">
          {title}
        </div>

        <div className="overflow-y-auto">
          {items.map((r) => (
            <div
              key={r.id}
              onClick={() => setSelected(r)}
              className="flex gap-3 p-3 border-b border-zinc-900 hover:bg-zinc-900 cursor-pointer"
            >
              {r.image_url ? (
                <img
                  src={r.image_url}
                  className="w-14 h-14 object-cover border border-zinc-800"
                />
              ) : (
                <div className="w-14 h-14 bg-zinc-900 border border-zinc-800" />
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {r.artist}
                </p>
                <p className="text-xs text-zinc-400 truncate">{r.title}</p>

                <div className="flex gap-2 mt-1 text-[10px] font-mono">
                  {r.year && (
                    <span className="text-zinc-500">{r.year}</span>
                  )}
                  {r.country && (
                    <span className="text-zinc-500">{r.country}</span>
                  )}
                </div>
              </div>

              <div className="text-xs font-mono text-lime-400">
                €{r.price || "-"}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <main className="bg-black text-white min-h-screen px-6 py-6 font-sans">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-wider">
          VINYL RADAR_
        </h1>
        <p className="text-xs text-zinc-500 font-mono">
          scan system // early signals // collector mode
        </p>
      </div>

      {/* GRID 3 COLONNE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Column title="FOR YOU" items={releases.slice(0, 10)} />
        <Column title="CORE PICKS" items={releases.slice(10, 20)} />
        <Column title="COLLECTOR PICKS" items={releases.slice(20, 30)} />
      </div>

      {/* MODAL */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-900 border border-zinc-700 p-6 w-full max-w-lg"
          >
            <div className="flex gap-4">
              {selected.image_url && (
                <img
                  src={selected.image_url}
                  className="w-32 h-32 object-cover border border-zinc-700"
                />
              )}

              <div>
                <h2 className="text-lg font-bold">
                  {selected.artist}
                </h2>
                <p className="text-sm text-zinc-400">
                  {selected.title}
                </p>

                <div className="mt-3 text-xs font-mono text-lime-400 space-y-1">
                  <p>YEAR: {selected.year || "-"}</p>
                  <p>LABEL: {selected.label || "-"}</p>
                  <p>COUNTRY: {selected.country || "-"}</p>
                  <p>PRICE: €{selected.price || "-"}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button className="flex-1 border border-lime-400 text-lime-400 py-2 text-sm font-mono hover:bg-lime-400 hover:text-black transition">
                ON CRATE
              </button>

              <button
                onClick={() => setSelected(null)}
                className="flex-1 border border-zinc-600 text-zinc-400 py-2 text-sm font-mono hover:bg-zinc-700"
              >
                PASS
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}