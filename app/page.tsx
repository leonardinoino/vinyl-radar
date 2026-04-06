import { getAllReleases } from '@/lib/data/releases';
import HomeColumnsClient from '@/components/home/HomeColumnsClient';

export default async function HomePage() {
  const releases = await getAllReleases();

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Vinyl Radar</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Discover records with collector potential before everyone else.
          </p>
        </div>

        <HomeColumnsClient releases={releases} />
      </div>
    </main>
  );
}