import { cookies } from "next/headers";
import { PreviewProfileFields } from "@/components/preview-profile-fields";
import { MainNavigation } from "@/components/main-navigation";
import {
  previewEnabled,
  readPreviewSession,
  previewProfiles,
} from "@/lib/preview-session";
import { previewLogout, switchPreviewProfile } from "@/app/onboarding-actions";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";
export const metadata: Metadata = {
  title: "Paróquia Nossa Senhora do Rosário, Lago Sul • MESCE",
  description:
    "Gestão dos Ministros Extraordinários da Sagrada Comunhão Eucarística",
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const preview = previewEnabled()
    ? readPreviewSession((await cookies()).get("mesce_preview")?.value ?? "")
    : null;
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip" href="#conteudo">
          Ir para o conteúdo
        </a>
        <aside>
          <Link href="/" className="brand">
            <Image
              src="/mesce-brand.png"
              alt="MESCE — Gestão pastoral"
              width={297}
              height={137}
              priority
            />
          </Link>
          <p className="nav-label">ORGANIZAÇÃO DO MINISTÉRIO</p>
          <MainNavigation minister={preview?.previewRole === "MINISTER"} />
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
              Paróquia Nossa Senhora do Rosário, Lago Sul · Ministros
              Extraordinários da Sagrada Comunhão Eucarística
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
                As alterações usam o banco de testes. O perfil de coordenador
                também possui um cadastro de ministro para homologar escalas; os
                demais perfis não têm acesso administrativo.
              </p>
              <form action={switchPreviewProfile} className="toolbar">
                <PreviewProfileFields selected={preview.previewProfile} />
                <button className="secondary">Trocar visão</button>
              </form>
            </section>
          )}
          <main id="conteudo">{children}</main>
          <footer>Paróquia Nossa Senhora do Rosário · Lago Sul · MESCE</footer>
        </div>
      </body>
    </html>
  );
}
