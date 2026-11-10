"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <section className="panel">
      <h1>Não foi possível carregar os dados</h1>
      <p>
        Verifique a conexão, as variáveis de ambiente e a aplicação da migração
        do banco.
      </p>
      <button onClick={reset}>Tentar novamente</button>
    </section>
  );
}
