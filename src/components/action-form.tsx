"use client";
import { unstable_rethrow } from "next/navigation";
import { useState, useTransition, type ReactNode, type FormEvent } from "react";
export type SaveResult = { error: string } | void;
export function ActionForm({
  action,
  children,
}: {
  action: (form: FormData) => Promise<SaveResult>;
  children: ReactNode;
}) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const form = new FormData(event.currentTarget, submitter);
    startTransition(async () => {
      setError("");
      try {
        const result = await action(form);
        if (result) setError(result.error);
      } catch (error) {
        unstable_rethrow(error);
        setError(
          "Não foi possível salvar. Seus dados foram mantidos; tente novamente.",
        );
      }
    });
  }
  return (
    <form method="post" onSubmit={submit} aria-busy={pending}>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
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
