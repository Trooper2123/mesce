"use client";
import { unstable_rethrow, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition, type ReactNode, type FormEvent } from "react";
import type { RemediationLink } from "@/lib/remediation";
export type SaveResult =
  | { error: string; remediation?: RemediationLink[] }
  | { redirectTo: string }
  | void;
export function ActionForm({
  action,
  children,
}: {
  action: (form: FormData) => Promise<SaveResult>;
  children: ReactNode;
}) {
  const router = useRouter();
  const [failure, setFailure] = useState<{
    message: string;
    remediation?: RemediationLink[];
  } | null>(null);
  const [pending, startTransition] = useTransition();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const form = new FormData(event.currentTarget, submitter);
    startTransition(async () => {
      setFailure(null);
      try {
        const result = await action(form);
        if (result && "error" in result)
          setFailure({
            message: result.error,
            remediation: result.remediation,
          });
        else if (result && "redirectTo" in result) {
          router.push(result.redirectTo);
          router.refresh();
        }
      } catch (error) {
        unstable_rethrow(error);
        setFailure({
          message:
            "Não foi possível concluir a operação. Nenhuma alteração foi confirmada. Verifique sua conexão e tente novamente. Se o problema continuar, informe à coordenação o horário e a tela em que ocorreu.",
        });
      }
    });
  }
  return (
    <form
      method="post"
      onSubmit={submit}
      onReset={() => setFailure(null)}
      aria-busy={pending}
    >
      {failure && (
        <div role="alert" className="notice error">
          <p>{failure.message}</p>
          {!!failure.remediation?.length && (
            <ul className="error-remediation">
              {failure.remediation.map((item) => (
                <li key={`${item.href}:${item.label}`}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <fieldset
        disabled={pending}
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
      >
        {children}
      </fieldset>
      {pending && <p role="status">Salvando…</p>}
    </form>
  );
}
