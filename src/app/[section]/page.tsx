import { preparationMonth } from "@/lib/calendar-navigation";
import { EventScopeFields } from "@/components/event-scope-fields";
import { seriesCandidates } from "@/lib/operational-changes";
import { RemoveRecord } from "@/components/remove-record";
import { locationCatalog } from "@/lib/locations";
import Link from "next/link";
import {
  eventClassOf,
  eventNameOptions,
  matchesEventName,
  matchesEventSearch,
  sortEvents,
  eventOverlapNotice,
} from "@/lib/event-agenda";
import { ServicePreferences } from "@/components/service-preferences";
import { EventFields } from "@/components/event-fields";
import { AbsenceFields, AbsenceBatch } from "@/components/absence-fields";
import { ActionForm } from "@/components/action-form";
import { missingMinisterFields } from "@/lib/profile";
import { changeEvents, withdrawAbsence } from "@/app/operations";
import { Calendar } from "@/components/calendar";
import { notFound } from "next/navigation";
import { actor } from "@/lib/auth";
import { readData, transaction, audit } from "@/lib/store";
import { save } from "@/app/actions";
import { Field, Check, Notice } from "@/components/fields";
import { impeded, Minister, Assisted, Event, Absence } from "@/lib/domain";
export const dynamic = "force-dynamic";
const sections = {
  ministros: [
    "Ministros",
    "Cuide de quem faz parte do ministério.",
    "minister",
  ],
  assistidos: [
    "Assistidos",
    "Contatos e informações para um acompanhamento cuidadoso.",
    "assisted",
  ],
  celebracoes: [
    "Celebrações e visitas",
    "Organize a agenda e a quantidade de ministros por encontro.",
    "event",
  ],
  impedimentos: [
    "Impedimentos",
    "Informe ausências até o dia 25 do mês anterior.",
    "absence",
  ],
} as const;
export default async function Registry({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{
    edit?: string;
    error?: string;
    saved?: string;
    q?: string;
    month?: string;
    type?: string;
    eventClass?: string;
    calendarView?: string;
    eventName?: string;
    new?: string;
    deleted?: string;
    showCancelled?: string;
  }>;
}) {
  const { section } = await params;
  if (!(section in sections)) notFound();
  const [title, subtitle, kind] = sections[section as keyof typeof sections];
  const user = await actor();
  if (!user.coordinator && kind !== "absence")
    return (
      <section className="panel">
        <h1>Acesso da coordenação</h1>
        <p>
          Seus compromissos estão disponíveis em{" "}
          <Link href="/minhas-escalas">Minhas escalas</Link>.
        </p>
      </section>
    );
  const query = await searchParams;
  const data = await readData();
  const ministers = user.coordinator
    ? data.ministers
    : data.ministers.filter(
        (m) => m.active && user.verified && m.id === user.ministerId,
      );
  const rows =
    kind === "minister"
      ? data.ministers
      : kind === "assisted"
        ? data.assisted
        : kind === "event"
          ? sortEvents(data.events)
          : data.absences.filter((a) =>
              ministers.some((m) => m.id === a.ministerId),
            );
  const editing = rows.find((r) => r.id === query.edit);
  if (query.edit && !editing) notFound();
  if (kind === "assisted")
    await transaction(async (client) =>
      audit(client, user.id, "assisted:read"),
    );
  const minister =
    kind === "minister" ? (editing as Minister | undefined) : undefined;
  const assisted =
    kind === "assisted" ? (editing as Assisted | undefined) : undefined;
  const event = kind === "event" ? (editing as Event | undefined) : undefined;
  const absence =
    kind === "absence" ? (editing as Absence | undefined) : undefined;
  const address = minister ?? assisted;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(query.month ?? "")
    ? query.month!
    : preparationMonth();
  const calendarView =
    query.calendarView === "SPLIT" || query.calendarView === "FULL"
      ? query.calendarView
      : "SUMMARY";
  const nameOptions = eventNameOptions(data.events);
  const filtered = rows.filter(
    (r) =>
      (!("cancelled" in r) || !r.cancelled || query.showCancelled === "1") &&
      (!("kind" in r) ||
        !["FIXED", "EXTRAORDINARY"].includes(query.eventClass ?? "") ||
        eventClassOf(r) === query.eventClass) &&
      (!("kind" in r) || matchesEventName(r, query.eventName)) &&
      ("kind" in r
        ? matchesEventSearch(r, query.q)
        : !query.q ||
          JSON.stringify("name" in r ? r.name : r)
            .toLowerCase()
            .includes(query.q.toLowerCase())),
  );
  return (
    <>
      <span className="eyebrow">Organização pastoral</span>
      <h1>{title}</h1>
      <p className="subtitle">
        {user.coordinator && kind === "absence"
          ? "Registre e corrija impedimentos de qualquer ministro, inclusive fora do prazo mensal."
          : subtitle}
      </p>
      {user.coordinator && kind === "minister" && (
        <p className="notice">
          A coordenação pode preencher e editar todo o cadastro. Para permitir
          que o ministro entre no aplicativo, autorize seu e-mail em{" "}
          <Link href="/pre-cadastros">Pré-cadastros</Link>. O cadastro pode
          participar das escalas sem depender do primeiro login.
        </p>
      )}
      <Notice error={query.error} saved={query.saved} />
      {query.deleted && (
        <p role="status" className="notice">
          Cadastro excluído com sucesso.
        </p>
      )}
      {kind === "event" && (
        <Link
          href={`/${section}?${new URLSearchParams({ month, showCancelled: query.showCancelled === "1" ? "0" : "1" })}`}
        >
          {query.showCancelled === "1"
            ? "Ocultar eventos cancelados"
            : "Mostrar eventos cancelados"}
        </Link>
      )}
      {(kind === "minister" || kind === "assisted") && user.coordinator && (
        <div className="toolbar">
          <Link
            className="button secondary"
            href={
              kind === "minister"
                ? "/ministros/importar"
                : "/assistidos/importar"
            }
          >
            Importar {kind === "minister" ? "ministros" : "assistidos"} por CSV
          </Link>
          <a
            className="button secondary"
            href={
              kind === "minister"
                ? "/api/ministers/template"
                : "/api/assisted/template"
            }
          >
            Baixar CSV de exemplo
          </a>
        </div>
      )}
      {!user.coordinator && !ministers.length ? (
        <p className="notice">
          Seu e-mail ainda não está vinculado a um ministro ativo. Procure a
          coordenação.
        </p>
      ) : (
        <section className="panel">
          <details
            id="cadastro"
            open={
              !!editing ||
              query.new === "1" ||
              query.type === "VISIT" ||
              rows.length === 0
            }
          >
            <summary>
              {editing
                ? "Editar cadastro"
                : `+ ${kind === "absence" ? "Informar impedimento" : kind === "event" ? "Cadastrar celebração ou visita" : "Adicionar cadastro"}`}
            </summary>
            <ActionForm key={editing?.id ?? "new"} action={save}>
              <input type="hidden" name="kind" value={kind} />
              <input type="hidden" name="id" value={editing?.id ?? ""} />
              <input type="hidden" name="returnMonth" value={month} />
              <div className="form-grid">
                {(kind === "minister" || kind === "assisted") && (
                  <>
                    <Field
                      name="name"
                      label="Nome completo"
                      value={(minister ?? assisted)?.name}
                      required
                    />
                    {kind === "minister" && (
                      <>
                        <Field
                          name="preferredName"
                          maxLength={80}
                          label="Nome de preferência nas escalas"
                          value={minister?.preferredName}
                        />
                        <p className="muted">
                          Nome usado nas escalas e PDFs. O nome completo
                          permanece no cadastro; sem preferência, usamos o nome
                          completo.
                        </p>
                        <Field
                          name="email"
                          label="E-mail de acesso"
                          type="email"
                          value={minister?.email}
                        />
                        <Field
                          name="birthDate"
                          label="Data de nascimento"
                          type="date"
                          value={minister?.birthDate}
                        />
                        <Field
                          name="phone"
                          label="Telefone de contato"
                          type="tel"
                          value={minister?.phone}
                        />
                        <Field
                          name="ministryStart"
                          label="Início no ministério"
                          type="date"
                          value={minister?.ministryStart}
                        />
                      </>
                    )}
                    <Field
                      name="address"
                      label="Endereço (logradouro, número e complemento)"
                      value={address?.address}
                    />
                    <Field
                      name="neighborhood"
                      label="Bairro"
                      value={address?.neighborhood}
                    />
                    <Field name="city" label="Cidade" value={address?.city} />
                    <Field name="state" label="UF" value={address?.state} />
                    <Field
                      name="postalCode"
                      label="CEP"
                      value={address?.postalCode}
                    />
                  </>
                )}
                {kind === "minister" && (
                  <>
                    <Field
                      name="spouseId"
                      label="Cônjuge ministro"
                      value={minister?.spouseId}
                      options={[
                        ["", "Sem vínculo"],
                        ...data.ministers
                          .filter((m) => m.id !== minister?.id)
                          .map((m) => [m.id, m.name] as const),
                      ]}
                    />
                    <Field
                      name="couplePreference"
                      label="Preferência do casal"
                      value={minister?.couplePreference ?? "NONE"}
                      options={[
                        ["NONE", "Sem preferência"],
                        ["TOGETHER", "Servir juntos (como unidade)"],
                        ["SEPARATE", "Servir separados"],
                      ]}
                    />
                    <ServicePreferences
                      minister={minister}
                      catalog={locationCatalog(data)}
                    />
                    <Field
                      name="participationStatus"
                      label="Situação no ministério"
                      value={
                        minister?.former
                          ? "FORMER"
                          : minister?.away
                            ? "AWAY"
                            : minister?.active === false
                              ? "INACTIVE"
                              : "ACTIVE"
                      }
                      options={[
                        ["ACTIVE", "Ativo"],
                        ["AWAY", "Afastado temporariamente"],
                        ["INACTIVE", "Inativo"],
                        ["FORMER", "Ex-ministro"],
                      ]}
                    />
                    <Field
                      name="registrationStatus"
                      label="Situação do cadastro"
                      value={
                        minister?.registrationStatus ??
                        (minister && !missingMinisterFields(minister).length
                          ? "COMPLETE"
                          : "DRAFT")
                      }
                      options={[
                        ["DRAFT", "Pendente — preencher dados depois"],
                        ["COMPLETE", "Concluído — validar dados obrigatórios"],
                      ]}
                    />
                    <p className="muted">
                      Para concluir: nome completo, nascimento, telefone, início
                      no ministério, endereço, bairro, cidade e UF. Cadastro
                      pendente não entra em novas escalas.
                    </p>
                    {minister && missingMinisterFields(minister).length > 0 && (
                      <p className="notice">
                        Dados faltantes:{" "}
                        {missingMinisterFields(minister).join(", ")}. Registros
                        antigos devem ser revisados pela coordenação.
                      </p>
                    )}
                    <details className="wide">
                      <summary>
                        Configuração avançada de participações (opcional)
                      </summary>
                      <Field
                        name="monthlyLimit"
                        label="Limite mensal (vazio = sem limite)"
                        type="number"
                        value={
                          minister?.monthlyLimit ??
                          (minister ? "" : (data.settings?.monthlyLimit ?? ""))
                        }
                      />
                      <p>
                        Conta celebrações e visitas juntas. Sem limite, a escala
                        continua equilibrando a participação pelo histórico.
                        Limites já existentes são preservados até alteração
                        explícita.
                      </p>
                    </details>
                  </>
                )}
                {kind === "assisted" && (
                  <>
                    <Field
                      name="landline"
                      label="Telefone fixo"
                      type="tel"
                      value={assisted?.landline}
                    />
                    <Field
                      name="mobile"
                      label="Telefone móvel"
                      type="tel"
                      value={assisted?.mobile}
                    />
                    <Field
                      name="familyName"
                      label="Familiar de referência"
                      value={assisted?.familyName}
                    />
                    <Field
                      name="familyPhone"
                      label="Telefone do familiar"
                      type="tel"
                      value={assisted?.familyPhone}
                    />
                    <Field
                      name="ministersRequired"
                      label="Quantidade de ministros indicados por visita"
                      type="number"
                      value={assisted?.ministersRequired ?? 1}
                      required
                    />
                    <p className="muted">
                      Padrão: 1 ministro. Para Altevita, indique 3; aumente
                      conforme a necessidade. O valor será usado nas novas
                      visitas e nas visitas editadas.
                    </p>
                    <Check
                      name="active"
                      label="Assistido ativo"
                      checked={assisted?.active ?? true}
                    />
                  </>
                )}
                {kind === "event" && (
                  <>
                    <Field
                      name="title"
                      label="Nome da celebração ou visita"
                      value={event?.title}
                      required
                    />
                    <EventFields
                      catalog={locationCatalog(data)}
                      event={event}
                      initialMonth={month}
                      visit={query.type === "VISIT"}
                      assisted={data.assisted
                        .filter((a) => a.active || a.id === event?.assistedId)
                        .map((a) => ({
                          id: a.id,
                          name: a.name,
                          ministersRequired: a.ministersRequired ?? 1,
                        }))}
                    />
                    <Field
                      name="time"
                      label="Horário"
                      type="time"
                      value={event?.time ?? "08:00"}
                      required
                    />
                    <Field
                      name="duration"
                      label="Duração em minutos"
                      type="number"
                      value={event?.duration ?? 60}
                      required
                    />
                  </>
                )}
                {kind === "absence" &&
                  (absence ? (
                    <>
                      <Field
                        name="ministerId"
                        label="Ministro"
                        value={absence.ministerId}
                        required
                        options={ministers.map((m) => [m.id, m.name] as const)}
                      />
                      <AbsenceFields
                        absence={absence}
                        events={data.events
                          .filter((e) => e.kind !== "VISIT" && !e.cancelled)
                          .map((e) => ({
                            id: e.id,
                            label: `${e.date} ${e.time} • ${e.title} • ${e.location}`,
                          }))}
                      />
                    </>
                  ) : (
                    <AbsenceBatch
                      ministers={ministers.map((m) => ({
                        id: m.id,
                        name: m.name,
                      }))}
                      events={data.events
                        .filter((e) => e.kind !== "VISIT" && !e.cancelled)
                        .map((e) => ({
                          id: e.id,
                          label: `${e.date} ${e.time} • ${e.title} • ${e.location}`,
                        }))}
                    />
                  ))}
                {kind !== "absence" && (
                  <Field
                    name="notes"
                    label="Observações"
                    type="textarea"
                    value={(minister ?? assisted ?? event)?.notes}
                  />
                )}
              </div>
              {(kind !== "absence" || (!!absence && !absence.revokedAt)) && (
                <div className="form-actions">
                  <button type="submit">
                    {editing ? "Salvar alterações" : "Salvar cadastro"}
                  </button>
                  {editing && (
                    <Link
                      href={`/${section}${kind === "event" ? `?month=${month}` : ""}`}
                    >
                      Cancelar edição
                    </Link>
                  )}
                </div>
              )}
            </ActionForm>
          </details>
          {absence && !absence.revokedAt && (
            <ActionForm action={withdrawAbsence}>
              <input type="hidden" name="id" value={absence.id} />
              <p>
                A retirada preserva o histórico e não altera escalas publicadas.
                Fora do prazo, procure a coordenação.
              </p>
              <Field name="reason" label="Justificativa da retirada" required />
              <button type="submit" className="secondary">
                Retirar este impedimento
              </button>
            </ActionForm>
          )}
          {editing && user.coordinator && (
            <RemoveRecord
              kind={kind}
              returnMonth={month}
              events={data.events}
              record={minister ?? assisted ?? event ?? absence!}
              label={
                minister?.name ??
                assisted?.name ??
                event?.title ??
                "Impedimento"
              }
            />
          )}
          {event && !event.cancelled && (
            <details>
              <summary>Remarcar ou cancelar ocorrência / série</summary>
              {data.absences.some(
                (a) =>
                  !a.revokedAt &&
                  a.scope === "CELEBRATION" &&
                  a.eventId === event.id,
              ) && (
                <p className="notice">
                  Esta ocorrência possui impedimentos específicos. Eles
                  continuam vinculados ao evento ao remarcar; confirme com os
                  ministros e revise a escala.
                </p>
              )}
              <ActionForm action={changeEvents}>
                <input type="hidden" name="id" value={event.id} />
                <input type="hidden" name="returnMonth" value={month} />
                <input type="hidden" name="expectedDate" value={event.date} />
                <input type="hidden" name="expectedTime" value={event.time} />
                <div className="form-grid">
                  <Field
                    name="operation"
                    label="Ação"
                    value="RESCHEDULE"
                    options={[
                      ["RESCHEDULE", "Remarcar"],
                      ["CANCEL", "Cancelar"],
                    ]}
                  />
                  <EventScopeFields
                    series={!!event.seriesId}
                    candidates={seriesCandidates(event, data.events).filter(
                      (e) => e.id !== event.id,
                    )}
                  />
                  <Field
                    name="date"
                    label="Nova data (remarcação)"
                    type="date"
                    value={event.date}
                  />
                  <Field
                    name="time"
                    label="Novo horário (remarcação)"
                    type="time"
                    value={event.time}
                  />
                  <Field name="reason" label="Justificativa" required />
                </div>
                <p>
                  A remarcação da série desloca as datas pelo mesmo número de
                  dias e aplica o novo horário. Ocorrências passadas, canceladas
                  e exceções individuais são preservadas. Publicações permanecem
                  no histórico; revise e publique uma nova versão.
                </p>
                <button type="submit">Confirmar alteração dos eventos</button>
              </ActionForm>
            </details>
          )}
        </section>
      )}
      {kind === "event" && (
        <>
          <form className="toolbar">
            <Field
              name="month"
              label="Mês do calendário"
              type="month"
              value={month}
            />
            <Field
              name="eventClass"
              label="Grupo de eventos"
              value={query.eventClass ?? "ALL"}
              options={[
                ["ALL", "Todos os eventos"],
                ["FIXED", "Fixos recorrentes"],
                ["EXTRAORDINARY", "Extraordinários"],
              ]}
            />
            <Field
              name="calendarView"
              label="Visualização do calendário"
              value={calendarView}
              options={[
                ["SUMMARY", "Resumido · todos os eventos"],
                ["SPLIT", "Separado · missas e visitas aos domingos"],
                ["FULL", "Completo · todos os detalhes"],
              ]}
            />
            <Field
              name="eventName"
              label="Evento cadastrado"
              value={query.eventName ?? ""}
              options={[["", "Todos os nomes de eventos"], ...nameOptions]}
            />
            {query.q && <input type="hidden" name="q" value={query.q} />}
            <button className="secondary">Ver calendário</button>
          </form>
          <Calendar
            eventName={query.eventName}
            view={calendarView}
            eventClass={query.eventClass ?? "ALL"}
            month={month}
            agendaEvents={data.events}
            impediments={Object.fromEntries(
              data.events.map((e) => [
                e.id,
                ministers
                  .filter((m) => impeded(m.id, e, data.absences))
                  .map((m) => m.name),
              ]),
            )}
            events={data.events.filter(
              (e) =>
                (!e.cancelled || query.showCancelled === "1") &&
                matchesEventName(e, query.eventName) &&
                e.date.startsWith(month) &&
                (!["FIXED", "EXTRAORDINARY"].includes(query.eventClass ?? "") ||
                  eventClassOf(e) === query.eventClass),
            )}
          />
        </>
      )}
      <section className="panel">
        <div className="panel-head">
          <h2>
            {kind === "absence"
              ? "Impedimentos registrados"
              : "Cadastros registrados"}
          </h2>
          <span className="tag">
            {filtered.length} de {rows.length} registros
          </span>
        </div>
        <form className="toolbar" role="search">
          {kind === "event" && (
            <>
              <input
                type="hidden"
                name="eventClass"
                value={query.eventClass ?? "ALL"}
              />
              <input type="hidden" name="month" value={month} />
              <input type="hidden" name="calendarView" value={calendarView} />
              <Field
                name="eventName"
                label="Evento cadastrado"
                value={query.eventName ?? ""}
                options={[["", "Todos os nomes de eventos"], ...nameOptions]}
              />
            </>
          )}
          <Field
            name="q"
            label={
              kind === "event"
                ? "Buscar por nome, data, horário ou local"
                : "Buscar"
            }
            value={query.q}
          />
          <button className="secondary" type="submit">
            Buscar
          </button>
        </form>
        {!filtered.length ? (
          <p className="empty">Nenhum registro encontrado.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">
                    {kind === "absence" ? "Ministro" : "Nome / encontro"}
                  </th>
                  <th scope="col">Informações</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {"name" in r
                        ? r.name
                        : "title" in r
                          ? r.title
                          : data.ministers.find((m) => m.id === r.ministerId)
                              ?.name}
                    </td>
                    <td>
                      {"phone" in r ? (
                        <>
                          {r.email}
                          <small>{r.phone}</small>
                          {r.preferredName && (
                            <small>Nas escalas: {r.preferredName}</small>
                          )}
                        </>
                      ) : "mobile" in r ? (
                        <>
                          {r.neighborhood}
                          <small>{r.mobile || r.landline}</small>
                          <small>ID para importação: {r.id}</small>
                          <small>
                            {r.ministersRequired ?? 1} ministro(s) por visita
                          </small>
                        </>
                      ) : "time" in r ? (
                        <>
                          {r.date} · {r.time}
                          {eventOverlapNotice(r, data.events) && (
                            <small className="event-overlap">
                              {eventOverlapNotice(r, data.events)}
                            </small>
                          )}
                          <small>
                            {eventClassOf(r) === "FIXED"
                              ? "Fixo recorrente"
                              : "Extraordinário"}
                          </small>
                          <small>
                            {r.location} · {r.required} ministros
                          </small>
                          {r.seriesException && (
                            <small>Exceção individual da série</small>
                          )}
                        </>
                      ) : (
                        <>
                          {r.scope === "CELEBRATION"
                            ? data.events.find((e) => e.id === r.eventId)?.title
                            : `${r.start} a ${r.end}`}
                          <small>
                            {r.scope === "CELEBRATION"
                              ? "Somente esta celebração"
                              : r.scope === "DAY"
                                ? "Dia inteiro"
                                : "Intervalo inclusivo"}
                          </small>
                        </>
                      )}
                    </td>
                    <td>
                      <span className="tag">
                        {"revokedAt" in r && r.revokedAt
                          ? "Retirado"
                          : "former" in r && r.former
                            ? "Ex-ministro"
                            : "registrationStatus" in r &&
                                r.registrationStatus === "DRAFT"
                              ? "Cadastro pendente"
                              : "cancelled" in r && r.cancelled
                                ? "Cancelado"
                                : "active" in r
                                  ? r.active
                                    ? "away" in r && r.away
                                      ? "Afastado"
                                      : "Ativo"
                                    : "Inativo"
                                  : "kind" in r
                                    ? r.kind === "VISIT"
                                      ? "Visita"
                                      : "Celebração"
                                    : "Registrado"}
                      </span>
                    </td>
                    <td>
                      {!("revokedAt" in r && r.revokedAt) && (
                        <Link
                          href={
                            kind === "event"
                              ? `/${section}?${new URLSearchParams({ edit: r.id, month, calendarView, eventClass: query.eventClass ?? "ALL", eventName: query.eventName ?? "", q: query.q ?? "" })}#cadastro`
                              : `/${section}?edit=${r.id}`
                          }
                        >
                          Editar
                        </Link>
                      )}
                      {user.coordinator && (
                        <RemoveRecord
                          kind={kind}
                          returnMonth={month}
                          events={data.events}
                          record={r}
                          label={
                            "name" in r
                              ? r.name
                              : "title" in r
                                ? `${r.title} · ${r.date} ${r.time}`
                                : "Impedimento"
                          }
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
