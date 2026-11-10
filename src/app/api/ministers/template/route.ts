import { coordinator } from "@/lib/auth";
import { csvTemplate } from "@/lib/minister-csv";
export async function GET() {
  await coordinator();
  return new Response("\uFEFF" + csvTemplate, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=mesce-ministros-modelo.csv",
      "Cache-Control": "no-store",
    },
  });
}
