import { cookies } from "next/headers";
import { PreviewProfileFields } from "@/components/preview-profile-fields";
import {
  previewEnabled,
  readPreviewSession,
  previewProfiles,
} from "@/lib/preview-session";
import { previewLogout, switchPreviewProfile } from "@/app/onboarding-actions";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Bell,
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
  ["/notificacoes", "Notificações", Bell],
  ["/meus-dados", "Meus dados", UserRound],
  ["/pre-cadastros", "Pré-cadastros", UsersRound],
  ["/ministros", "Ministros", UsersRound],
  ["/assistidos", "Assistidos", HeartHandshake],
  ["/locais", "Locais e comunidades", Church],
  ["/celebracoes", "Celebrações e visitas", CalendarDays],
  ["/impedimentos", "Impedimentos", CalendarOff],
  ["/visitas", "Visitas dominicais", HeartHandshake],
  ["/configuracao", "Configurações", Church],
  ["/escalas", "Escalas", ClipboardList],
  ["/minhas-escalas", "Minhas escalas", UserRound],
  ["/relatorios", "Relatórios e histórico", ClipboardList],
] as const;
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const preview = previewEnabled()
    ? readPreviewSession((await cookies()).get("mesce_preview")?.value ?? "")
    : null;
  const ministerLinks = [
    "/",
    "/notificacoes",
    "/meus-dados",
    "/impedimentos",
    "/respostas",
    "/minhas-escalas",
  ];
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
            {links
              .filter(
                ([href]) =>
                  preview?.previewRole !== "MINISTER" ||
                  ministerLinks.includes(href),
              )
              .map(([href, label, Icon]) => (
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
          {preview && (
            <section
              className="preview-role-banner"
              aria-label="Perfil de homologação"
            >
              <strong>
                Homologação · {previewProfiles[preview.previewProfile].label}
              </strong>
              <p>
                As alterações usam o banco de testes. Perfil de ministro sem
                acesso administrativo.
              </p>
              <form action={switchPreviewProfile} className="toolbar">
                <PreviewProfileFields selected={preview.previewProfile} />
                <button className="secondary">Trocar visão</button>
              </form>
            </section>
          )}
          <main id="conteudo">{children}</main>
          <footer>MESCE · Organização a serviço da comunhão</footer>
        </div>
      </body>
    </html>
  );
}
