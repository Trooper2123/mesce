type Environment = Record<string, string | undefined>;
/** Preview must use its isolated override, never an inherited production integration URL. */
export function databaseUrl(
  env: Environment = process.env,
  direct = false,
): string {
  if (env.VERCEL_ENV === "preview") {
    if (!env.MESCE_DATABASE_URL)
      throw new Error(
        "Configure MESCE_DATABASE_URL com o banco isolado de Preview.",
      );
    return env.MESCE_DATABASE_URL;
  }
  const value =
    env.MESCE_DATABASE_URL ||
    (direct &&
      (env.DATABASE_URL_UNPOOLED ||
        env.NEON_MESCE_DATABASE_URL_UNPOOLED ||
        env.POSTGRES_URL_NON_POOLING ||
        env.NEON_MESCE_POSTGRES_URL_NON_POOLING)) ||
    env.DATABASE_URL ||
    env.NEON_MESCE_DATABASE_URL ||
    env.POSTGRES_URL ||
    env.NEON_MESCE_POSTGRES_URL;
  if (!value)
    throw new Error(
      "Configure DATABASE_URL ou uma conexão PostgreSQL MESCE/Neon.",
    );
  return value;
}
