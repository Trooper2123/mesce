import Link from "next/link";
export default function Setup() {
  return (
    <section className="welcome panel">
      <span className="eyebrow">Bem-vindo ao MESCE</span>
      <h1>Organização a serviço da comunhão.</h1>
      <p>
        Um espaço para cuidar dos cadastros, organizar celebrações e visitas e
        preparar as escalas do ministério.
      </p>
      <h2>Concluir a configuração</h2>
      <ol className="steps">
        <li>
          Configure o PostgreSQL e aplique a migração com{" "}
          <code>npm run db:migrate</code>.
        </li>
        <li>
          Preencha as variáveis Auth0, a chave de proteção dos dados e os
          e-mails da coordenação no ambiente do servidor.
        </li>
        <li>
          No Auth0, autorize o callback <code>/auth/callback</code> e a URL de
          logout do aplicativo.
        </li>
        <li>Entre com um e-mail verificado cadastrado como coordenador.</li>
      </ol>
      <p>
        Os cadastros ficam protegidos até a configuração do acesso. Consulte o
        README do repositório para as instruções completas.
      </p>
      <Link className="button" href="/auth/login">
        Entrar no aplicativo
      </Link>
    </section>
  );
}
