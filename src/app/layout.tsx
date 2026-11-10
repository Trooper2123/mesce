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
  ["/ministros", "Ministros", UsersRound],
  ["/assistidos", "Assistidos", HeartHandshake],
  ["/celebracoes", "Celebrações e visitas", CalendarDays],
  ["/impedimentos", "Impedimentos", CalendarOff],
  ["/escalas", "Escalas", ClipboardList],
  ["/minhas-escalas", "Minhas escalas", UserRound],
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
            <a href="/auth/logout">Sair da conta</a>
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
