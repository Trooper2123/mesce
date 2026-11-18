import Registry from "@/app/[section]/page";

type Query = Record<string, string | undefined>;

export const dynamic = "force-dynamic";
export default function Celebrations({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  return Registry({
    params: Promise.resolve({ section: "celebracoes" }),
    searchParams: searchParams.then((query) => ({
      ...query,
      returnTo: "/agenda/celebracoes",
    })),
  });
}
