import { decrypt } from "@/lib/crypto";
import {
  personalCalendarIcs,
  calendarTokenHash,
  type LiveEventState,
} from "@/lib/personal-calendar";
import { pool } from "@/lib/store";
import type { Minister, Schedule } from "@/lib/domain";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const unavailable = () =>
  new Response("Calendário indisponível.", {
    status: 404,
    headers: {
      "Cache-Control":
        "private, no-store, no-cache, max-age=0, must-revalidate",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Referrer-Policy": "no-referrer",
    },
  });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  if (process.env.MESCE_CALENDAR_FEEDS_ENABLED !== "true") return unavailable();
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return unavailable();

  try {
    const database = pool();
    const owner = await database.query(
      `SELECT f.minister_id, f.auth0_sub
       FROM mesce_calendar_feeds f
       JOIN mesce_access a
         ON a.auth0_sub=f.auth0_sub
        AND a.minister_id=f.minister_id
        AND a.email_hmac=f.owner_email_hmac
        AND a.status='ACTIVE'
       WHERE f.token_hash=$1 AND f.revoked_at IS NULL`,
      [calendarTokenHash(token)],
    );
    if (!owner.rows[0]) return unavailable();

    const ministerId = String(owner.rows[0].minister_id);
    const auth0Sub = String(owner.rows[0].auth0_sub);
    const legacy = await database.query(
      "SELECT to_regclass('mesce_dev.actors') AS table_name",
    );
    if (legacy.rows[0]?.table_name) {
      const actor = await database.query(
        "SELECT active FROM mesce_dev.actors WHERE auth0_sub=$1",
        [auth0Sub],
      );
      if (actor.rows[0] && actor.rows[0].active !== true) return unavailable();
    }

    const [ministerRow, scheduleRows, eventRows] = await Promise.all([
      database.query(
        "SELECT payload FROM mesce_records WHERE id=$1 AND kind='minister'",
        [ministerId],
      ),
      database.query(
        "SELECT payload,updated_at FROM mesce_records WHERE kind='schedule'",
      ),
      database.query(
        "SELECT id,payload,updated_at FROM mesce_records WHERE kind='event'",
      ),
    ]);
    if (!ministerRow.rows[0]) return unavailable();
    const minister = decrypt(ministerRow.rows[0].payload) as Minister;
    if (!minister.active || minister.former) return unavailable();

    const schedules = scheduleRows.rows.map((row) => ({
      schedule: decrypt(row.payload) as Schedule,
      updatedAt: new Date(row.updated_at).toISOString(),
    }));
    const liveEvents = new Map<string, LiveEventState>(
      eventRows.rows.map((row) => {
        const event = decrypt(row.payload) as { cancelled?: boolean };
        return [
          String(row.id),
          {
            cancelled: event.cancelled === true,
            updatedAt: new Date(row.updated_at).toISOString(),
          },
        ];
      }),
    );
    const calendar = personalCalendarIcs(
      schedules,
      ministerId,
      new URL(_request.url).origin,
      new Date(),
      liveEvents,
    );
    return new Response(calendar, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8; method=PUBLISH",
        "Content-Disposition": 'inline; filename="mesce-pessoal.ics"',
        "Cache-Control":
          "private, no-store, no-cache, max-age=0, must-revalidate",
        "CDN-Cache-Control": "no-store",
        "Vercel-CDN-Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return unavailable();
  }
}
