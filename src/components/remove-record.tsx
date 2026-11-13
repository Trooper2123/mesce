import type { Event } from "@/lib/domain";
import { removeRecord } from "@/app/removal-actions";
import {
  recordVersion,
  removalSeries,
  type RemovalKind,
} from "@/lib/record-removal";
import { ActionForm } from "./action-form";
import { Field } from "./fields";
export function RemoveRecord({
  kind,
  record,
  label,
  returnMonth,
  events,
}: {
  kind: RemovalKind;
  record: { id: string };
  label: string;
  returnMonth?: string;
  events?: Event[];
}) {
  return (
    <details className="removal-action">
      <summary>Excluir cadastro incorreto</summary>
      <p>
        Excluir “{label}” remove o registro da lista e do calendário. Se houver
        vínculos ou histórico, a exclusão será impedida. Para um evento que não
        vai acontecer, use Cancelar evento.
      </p>
      <ActionForm action={removeRecord}>
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="returnMonth" value={returnMonth ?? ""} />
        <input type="hidden" name="id" value={record.id} />
        <input
          type="hidden"
          name="expectedVersion"
          value={recordVersion(record)}
        />
        {kind === "event" &&
        events &&
        "seriesId" in record &&
        record.seriesId ? (
          <>
            <label className="field">
              Excluir quais registros?
              <select name="removalScope">
                <option value="ONE">Somente esta ocorrência</option>
                <option value="FOLLOWING">
                  Esta e as próximas da série, incluindo exceções
                </option>
              </select>
            </label>
            <input
              type="hidden"
              name="expectedSeries"
              value={recordVersion(removalSeries(record as Event, events))}
            />
            <p>
              Na série, se qualquer ocorrência tiver vínculos, nenhum registro
              será excluído.
            </p>
          </>
        ) : null}
        <Field name="reason" label="Motivo da exclusão" required />
        <label className="field check">
          <input type="checkbox" name="confirm" value="yes" required />
          Confirmo a exclusão de “{label}”.
        </label>
        <button className="secondary">Excluir definitivamente</button>
      </ActionForm>
    </details>
  );
}
