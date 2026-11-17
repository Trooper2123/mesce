"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bell,
  CalendarDays,
  CalendarOff,
  Church,
  ClipboardList,
  HeartHandshake,
  LayoutDashboard,
  Menu,
  UserRound,
  UsersRound,
} from "lucide-react";

const coordinatorGroups = [
  { href: "/", label: "Visão geral", icon: LayoutDashboard },
  { href: "/meus-dados", label: "Meus dados", icon: UserRound },
  {
    href: "/ministros",
    label: "Ministros",
    icon: UsersRound,
    children: [
      ["/pre-cadastros", "Pré-cadastros"],
      ["/impedimentos", "Impedimentos"],
      ["/respostas", "Respostas mensais"],
    ],
  },
  {
    href: "/visitas",
    label: "Visitas dominicais",
    icon: HeartHandshake,
    children: [
      ["/assistidos", "Assistidos"],
      ["/visitas/agendar", "Agendar visita"],
    ],
  },
  { href: "/locais", label: "Locais e comunidades", icon: Church },
  {
    href: "/agenda",
    label: "Agenda",
    icon: CalendarDays,
    children: [
      ["/agenda/celebracoes", "Gerenciar celebrações"],
      ["/agenda/ajustes", "Eventos com ajustes"],
    ],
  },
  {
    href: "/escalas",
    label: "Escalas",
    icon: ClipboardList,
    children: [
      ["/escalas/anteriores", "Escalas anteriores"],
      ["/escalas/nova", "Nova escala"],
      ["/escalas/downloads", "Baixar escalas"],
    ],
  },
  { href: "/relatorios", label: "Relatórios e histórico", icon: ClipboardList },
  { href: "/notificacoes", label: "Lembretes e avisos", icon: Bell },
  { href: "/configuracao", label: "Configurações", icon: Church },
] as const;

const ministerGroups = [
  { href: "/", label: "Visão geral", icon: LayoutDashboard },
  { href: "/notificacoes", label: "Lembretes e avisos", icon: Bell },
  { href: "/meus-dados", label: "Meus dados", icon: UserRound },
  { href: "/impedimentos", label: "Impedimentos", icon: CalendarOff },
  { href: "/respostas", label: "Respostas mensais", icon: ClipboardList },
  { href: "/minhas-escalas", label: "Minhas escalas", icon: UserRound },
] as const;

const current = (pathname: string, href: string) =>
  pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

export function MainNavigation({ minister }: { minister: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const groups = minister ? ministerGroups : coordinatorGroups;
  return (
    <>
      <button
        type="button"
        className="nav-toggle secondary"
        aria-controls="main-navigation"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Menu size={20} aria-hidden="true" /> Menu
      </button>
      <nav id="main-navigation" aria-label="Principal" data-open={open}>
        {groups.map(({ href, label, icon: Icon, ...group }) => {
          const active = current(pathname, href);
          return (
            <div className="nav-group" data-active={active} key={href}>
              <Link
                href={href}
                aria-current={
                  pathname === href ? "page" : active ? "location" : undefined
                }
                onClick={() => setOpen(false)}
              >
                <Icon size={21} aria-hidden="true" />
                {label}
              </Link>
              {"children" in group && group.children && (
                <div className="nav-children">
                  {group.children.map(([childHref, childLabel]) => (
                    <Link
                      key={childHref}
                      href={childHref}
                      aria-current={
                        current(pathname, childHref) ? "page" : undefined
                      }
                      onClick={() => setOpen(false)}
                    >
                      {childLabel}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </>
  );
}
