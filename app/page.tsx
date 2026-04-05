"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getSignals } from "@/utils/signals";

export default function Home() {
  const [releases, setReleases] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [variants, setVariants] = useState<any[]>([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase.from("releases").select("*");
    setReleases(data || []);
  }

  async function openRelease(r: any) {
    setSelected(r);

    const { data } = await supabase
      .from("release_variants")
      .select("*")
      .eq("release_id", r.id);

    setVariants(data || []);
  }

  function close() {
    setSelected(null);
    setVariants([]);
  }

  function getBestVariant(list: any[]) {
    if (!list.length) return null;

    return [...list].sort((a, b) => {
      const hypeA = a.hype_score || 0;
      const hypeB = b.hype_score || 0;

      if (hypeB !== hypeA) return hypeB - hypeA;

      const priceA = a.estimated_price || 0;
      const priceB = b.estimated_price || 0;

      return priceB - priceA;
    })[0];
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <h1 className="text-3xl mb-6 text-yellow-200 font-mono">
        VINYL RADAR_
      </h1>

      <div className="grid grid-cols-3 gap-4">
        {releases.map((r) => (
          <div
            key={r.id}
            onClick={() => openRelease(r)}
            className="border border-zinc-800 p-4 cursor-pointer hover:border-yellow-300"
          >
            <p className="text-white">{r.artist}</p>
            <p className="text-zinc-500 text-sm">{r.title}</p>
          </div>
        ))}
      </div>

      {selected && (
        <div
          onClick={close}
          className="fixed inset-0 bg-black/80 flex items-center justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-black border border-zinc-800 p-6 w-[800px]"
          >
            <h2 className="text-xl text-white">{selected.artist}</h2>
            <p className="text-zinc-500 mb-4">{selected.title}</p>

            {(() => {
              const best = getBestVariant(variants);
              if (!best) return null;

              return (
                <div className="border border-yellow-300 p-4 mb-4">
                  <p className="text-yellow-200 font-mono mb-2">
                    BEST VARIANT
                  </p>

                  <p>{best.title}</p>

                  <div className="mt-4">
                    <p className="text-zinc-400 text-sm">
                      {best.label} · {best.country} · {best.year}
                    </p>
                  </div>

                  <div className="mt-4">
                    <p className="text-yellow-200 font-mono text-xs mb-2">
                      SIGNALS
                    </p>

                    <div className="flex gap-2 flex-wrap">
                      {getSignals(best).map((s) => (
                        <span
                          key={s}
                          className="text-xs px-3 py-1 border border-yellow-300 text-yellow-200"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </main>
  );
}