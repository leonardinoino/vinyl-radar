const releases = [
  {
    artist: "Fontaines D.C.",
    title: "Romance",
    type: "Mainstream Breakout",
    score: 78,
    note: "Retail exclusive + hype forte",
  },
  {
    artist: "Unknown Label",
    title: "First Press EP",
    type: "Collector Pick",
    score: 86,
    note: "300 copie, hand-numbered",
  },
  {
    artist: "Ambient Archive",
    title: "Live Session Vol. 1",
    type: "Collector Pick",
    score: 82,
    note: "Prima stampa, micro-label",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">Vinyl Radar</h1>

        <p className="text-zinc-400 mb-8">
          Beta privata — Scopri vinili con potenziale prima degli altri
        </p>

        <div className="grid gap-4">
          {releases.map((release, index) => (
            <div
              key={index}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">
                    {release.artist} — {release.title}
                  </h2>
                  <p className="text-sm text-zinc-400 mt-1">{release.note}</p>
                </div>

                <div className="text-right">
                  <p className="text-sm text-zinc-500">{release.type}</p>
                  <p className="text-2xl font-bold">{release.score}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}