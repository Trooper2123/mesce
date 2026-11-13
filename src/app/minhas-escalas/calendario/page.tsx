import Link from "next/link";
import { actor } from "@/lib/auth";
import { pool, readData } from "@/lib/store";
import { linkedMinister } from "@/lib/access";
import { PersonalCalendarSettings } from "@/components/personal-calendar-settings";

export const dynamic = "force-dynamic";

export default async function PersonalCalendarPage() {
  const user = await actor();
  const data = await readData();
  const minister = linkedMinister(user, data);
  const enabled = process.env.MESCE_CALENDAR_FEEDS_ENABLED === "true";
  let active = false;
  let migrationReady = false;
  if (enabled && minister) {
    try {
      const feed = await pool().query(
        `SELECT revoked_at FROM mesce_calendar_feeds
         WHERE minister_id=$1 AND auth0_sub=$2`,
        [minister.id, user.id],
      );
      migrationReady = true;
      active = feed.rows.length > 0 && !feed.rows[0].revoked_at;
    } catch {
      migrationReady = false;
    }
  }
  return (
    <>
      <Link href="/minhas-escalas" className="button secondary">
        Voltar às minhas escalas
      </Link>
      <h1>Agenda pessoal</h1>
      <p className="subtitle">
        Configure uma assinatura atualizada com as atividades publicadas para
        você.
      </p>
      {!minister ? (
        <p className="notice">
          A assinatura exige um cadastro ativo de ministro vinculado à sua
          conta.
        </p>
      ) : (
        <PersonalCalendarSettings
          enabled={enabled}
          active={active}
          migrationReady={migrationReady}
        />
      )}
    </>
  );
}
