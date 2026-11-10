import { pool, transaction } from "../src/lib/store";
import { importLegacy } from "../src/lib/legacy";

// Explicit, one-off Preview operation. Never execute implicitly on app startup.
const expectedHost = process.argv[2];
try {
  if (process.env.VERCEL_ENV !== "preview")
    throw new Error("Importação automatizada permitida somente em Preview.");
  const connection = process.env.MESCE_DATABASE_URL;
  if (
    !connection ||
    !expectedHost ||
    new URL(connection).hostname !== expectedHost
  )
    throw new Error("Destino isolado não corresponde ao host confirmado.");
  const count = await transaction(async (client) => {
    const role = await client.query("SELECT current_user AS name");
    if (role.rows[0].name !== "mesce_mvp_runtime")
      throw new Error("Use o papel restrito de homologação.");
    return importLegacy(client, "migration:preview");
  });
  console.log("Importação legada confirmada:", JSON.stringify(count));
} catch (error) {
  // Do not log database errors, connection URLs or decrypted records.
  console.error(
    error instanceof Error && !("code" in error)
      ? error.message
      : "Importação falhou; transação revertida.",
  );
  process.exitCode = 1;
} finally {
  await pool().end();
}
