import { previewEnabled } from "@/lib/preview-session";
import { previewLogout } from "@/app/onboarding-actions";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Church,
  LayoutDashboard,
  UsersRound,
  HeartHandshake,
  CalendarDays,
  CalendarOff,
  ClipboardList,
  UserRound,
} from "lucide-react";
import "./globals.css";
export const metadata: Metadata = {
  title: "MESCE • Gestão pastoral",
  description:
    "Gestão dos Ministros Extraordinários da Sagrada Comunhão Eucarística",
};
const links = [
  ["/", "Visão geral", LayoutDashboard],
  ["/meus-dados", "Meus dados", UserRound],
  ["/pre-cadastros", "Pré-cadastros", UsersRound],
  ["/ministros", "Ministros", UsersRound],
  ["/assistidos", "Assistidos", HeartHandshake],
  ["/celebracoes", "Celebrações e visitas", CalendarDays],
  ["/impedimentos", "Impedimentos", CalendarOff],
  ["/visitas", "Visitas dominicais", HeartHandshake],
  ["/respostas", "Respostas do mês", CalendarOff],
  ["/configuracao", "Configuração", Church],
  ["/escalas", "Escalas", ClipboardList],
  ["/minhas-escalas", "Minhas escalas", UserRound],
  ["/relatorios", "Relatórios e histórico", ClipboardList],
] as const;
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip" href="#conteudo">
          Ir para o conteúdo
        </a>
        <aside>
          <Link href="/" className="brand">
            <span className="brand-icon">
              <Church size={28} />
            </span>
            <span>
              MESCE<small>Gestão pastoral</small>
            </span>
          </Link>
          <p className="nav-label">ORGANIZAÇÃO DO MINISTÉRIO</p>
          <nav aria-label="Principal">
            {links.map(([href, label, Icon]) => (
              <Link key={href} href={href}>
                <Icon size={21} />
                {label}
              </Link>
            ))}
          </nav>
          <div className="aside-bottom">
            <span className="dot" /> Um ministério, muitas mãos.
            <p>Servir com cuidado e organização.</p>
            {previewEnabled() ? (
              <form action={previewLogout}>
                <button className="secondary">Sair do Preview</button>
              </form>
            ) : (
              <a href="/auth/logout">Sair da conta</a>
            )}
          </div>
        </aside>
        <div className="workspace">
          <header>
            <span>
              Ministros Extraordinários da Sagrada Comunhão Eucarística
            </span>
            <Link href="/">MESCE</Link>
          </header>
          <main id="conteudo">{children}</main>
          <footer>MESCE · Organização a serviço da comunhão</footer>
        </div>
      </body>
    </html>
  );
}
