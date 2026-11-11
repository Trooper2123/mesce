import { coordinator } from "@/lib/auth";
import { assistedCsvTemplate } from "@/lib/assisted-csv";
export async function GET() {
  await coordinator();
  return new Response("\uFEFF" + assistedCsvTemplate, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        "attachment; filename=mesce-assistidos-exemplo.csv",
      "Cache-Control": "no-store",
    },
  });
}
