"use client";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { previewCsv, importCsv } from "@/app/csv-actions";
import {
  previewAssistedCsv,
  importAssistedCsv,
} from "@/app/assisted-csv-actions";
type Preview = Awaited<ReturnType<typeof previewCsv>>;
export function CsvImport({
  entity = "ministers",
}: {
  entity?: "ministers" | "assisted";
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const isAssisted = entity === "assisted";
  const previewAction = isAssisted ? previewAssistedCsv : previewCsv;
  const importAction = isAssisted ? importAssistedCsv : importCsv;
  const [source, setSource] = useState("");
  const [preview, setPreview] = useState<Preview>();
  const [update, setUpdate] = useState(false),
    [authorize, setAuthorize] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState(""),
    [pending, startTransition] = useTransition();
  function payload() {
    const f = new FormData();
    f.set("source", source);
    f.set("update", String(update));
    return f;
  }
  return (
    <section className="panel">
      <label className="field">
        Arquivo CSV (até 500 KB e 500 registros)
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          disabled={pending}
          onChange={async (e) => {
            setPreview(undefined);
            setConfirmed(false);
            setMessage("");
            setSource("");
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 500000) {
              setMessage("Arquivo excede 500 KB.");
              return;
            }
            try {
              const text = await file.text();
              setSource(text);
            } catch {
              setMessage("Não foi possível ler o arquivo.");
            }
          }}
        />
      </label>
      <label className="field check">
        <input
          type="checkbox"
          checked={update}
          disabled={pending}
          onChange={(e) => {
            setUpdate(e.target.checked);
            setPreview(undefined);
            setConfirmed(false);
          }}
        />
        {isAssisted
          ? "Atualizar assistidos pelo ID informado (desmarcado = ignorar existentes)"
          : "Atualizar cadastros com o mesmo e-mail (desmarcado = ignorar existentes)"}
      </label>
      <button
        disabled={!source || pending}
        onClick={() =>
          startTransition(async () => {
            setMessage("");
            setPreview(await previewAction(payload()));
            setConfirmed(false);
          })
        }
      >
        Validar e mostrar prévia
      </button>
      {preview?.error && (
        <p role="alert" className="notice error">
          {preview.error}
        </p>
      )}
      {preview?.summary.length ? (
        <>
          <p>
            Colunas são reconhecidas pelos cabeçalhos do modelo. Nenhum dado foi
            gravado.{" "}
            {isAssisted
              ? "Confira os IDs, nomes e operações antes de confirmar."
              : "Cadastros incompletos serão pendentes e não participarão de novas escalas."}
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Linha</th>
                  <th>Nome</th>
                  <th>{isAssisted ? "ID" : "E-mail"}</th>
                  <th>Operação</th>
                  {isAssisted && <th>Ministros por visita</th>}
                  {!isAssisted && <th>Dados faltantes</th>}
                </tr>
              </thead>
              <tbody>
                {preview.summary.map((r) => (
                  <tr key={r.line}>
                    <td>{r.line}</td>
                    <td>{r.name}</td>
                    <td>{r.email}</td>
                    <td>{r.operation}</td>
                    {isAssisted && <td>{r.ministersRequired}</td>}
                    {!isAssisted && (
                      <td>{r.missing.join(", ") || "Cadastro completo"}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!isAssisted && (
            <>
              <label className="field check">
                <input
                  type="checkbox"
                  disabled={pending}
                  checked={authorize}
                  onChange={(e) => setAuthorize(e.target.checked)}
                />
                Também autorizar na allowlist os e-mails de ministros ativos
                importados (não envia convites nem restaura acessos revogados)
              </label>
            </>
          )}
          <label className="field check">
            <input
              type="checkbox"
              disabled={pending}
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            Revisei a prévia e confirmo as alterações indicadas
          </label>
          <button
            disabled={!confirmed || pending}
            onClick={() =>
              startTransition(async () => {
                const f = payload();
                f.set("expectedState", preview.expectedState);
                f.set("authorize", String(authorize));
                f.set("confirmed", String(confirmed));
                const result = await importAction(f);
                setMessage(
                  result.error ||
                    `${result.written} cadastro(s) gravado(s); ${result.skipped} existente(s) ignorado(s).`,
                );
                if (!result.error) {
                  setPreview(undefined);
                  setConfirmed(false);
                  setSource("");
                  if (fileInput.current) fileInput.current.value = "";
                }
              })
            }
          >
            Confirmar importação
          </button>
        </>
      ) : null}
      {pending && <p role="status">Processando…</p>}
      <div className="form-actions">
        <button
          type="button"
          className="secondary"
          disabled={pending}
          onClick={() => {
            setSource("");
            setPreview(undefined);
            setUpdate(false);
            setAuthorize(false);
            setConfirmed(false);
            setMessage("");
            if (fileInput.current) fileInput.current.value = "";
          }}
        >
          Cancelar importação
        </button>
        <Link className="button secondary" href="/ministros">
          Sair
        </Link>
      </div>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <p className="muted">
        O arquivo fica na memória desta tela; não é enviado a armazenamento de
        arquivos nem incluído em logs. Não feche a tela durante a confirmação.
      </p>
    </section>
  );
}
