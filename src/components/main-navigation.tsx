"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
  Menu,
} from "lucide-react";

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

const ministerLinks = [
  "/",
  "/notificacoes",
  "/meus-dados",
  "/impedimentos",
  "/respostas",
  "/minhas-escalas",
];

export function MainNavigation({ minister }: { minister: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
        {links
          .filter(([href]) => !minister || ministerLinks.includes(href))
          .map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              aria-current={
                pathname === href ||
                (href !== "/" && pathname.startsWith(`${href}/`))
                  ? "page"
                  : undefined
              }
              onClick={() => setOpen(false)}
            >
              <Icon size={21} aria-hidden="true" />
              {label}
            </Link>
          ))}
      </nav>
    </>
  );
}
