import Link from "next/link";
import { cancelEvent } from "@/app/operations";
import { Calendar } from "@/components/calendar";
import { notFound } from "next/navigation";
import { actor } from "@/lib/auth";
import { readData, transaction, audit } from "@/lib/store";
import { save } from "@/app/actions";
import { Field, Check, Notice } from "@/components/fields";
import { Minister, Assisted, Event, Absence } from "@/lib/domain";
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
const locations = [
  ["Matriz", "Matriz"],
  ["Carmelo Nossa Senhora do Carmo", "Carmelo Nossa Senhora do Carmo"],
  ["Capela Nossa Senhora Aparecida", "Capela Nossa Senhora Aparecida"],
  ["Eventos Externos", "Eventos Externos"],
] as const;
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
    new?: string;
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
          ? data.events
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
    : new Date().toISOString().slice(0, 7);
  const filtered = rows.filter(
    (r) =>
      !query.q ||
      JSON.stringify("name" in r ? r.name : "title" in r ? r.title : r)
        .toLowerCase()
        .includes(query.q.toLowerCase()),
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
      {!user.coordinator && !ministers.length ? (
        <p className="notice">
          Seu e-mail ainda não está vinculado a um ministro ativo. Procure a
          coordenação.
        </p>
      ) : (
        <section className="panel">
          <details open={!!editing || query.new === "1" || rows.length === 0}>
            <summary>
              {editing
                ? "Editar cadastro"
                : `+ ${kind === "absence" ? "Informar impedimento" : kind === "event" ? "Cadastrar celebração ou visita" : "Adicionar cadastro"}`}
            </summary>
            <form action={save}>
              <input type="hidden" name="kind" value={kind} />
              <input type="hidden" name="id" value={editing?.id ?? ""} />
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
                        <Field
                          name="monthlyLimit"
                          label="Limite mensal de participações"
                          type="number"
                          value={
                            minister?.monthlyLimit ??
                            data.settings?.monthlyLimit ??
                            6
                          }
                          required
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
                    <Field
                      name="location"
                      label="Local de preferência"
                      value={minister?.location ?? "Matriz"}
                      options={locations}
                    />
                    <Field
                      name="locationPreference"
                      label="Tipo de preferência"
                      value={minister?.locationPreference ?? "ACCEPT"}
                      options={[
                        ["ACCEPT", "Aceita outros locais"],
                        ["PREFER", "Preferencial"],
                        ["EXCLUSIVE", "Exclusiva"],
                      ]}
                    />
                    <Check
                      name="active"
                      label="Ministro ativo"
                      checked={minister?.active ?? true}
                    />
                    <Check
                      name="away"
                      label="Afastado do ministério"
                      checked={minister?.away}
                    />
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
                    <Field
                      name="kind"
                      label="Tipo"
                      value={
                        event?.kind ??
                        (query.type === "VISIT" ? "VISIT" : "MASS")
                      }
                      options={[
                        ["MASS", "Missa"],
                        ["ADORATION", "Adoração"],
                        ["WEDDING", "Casamento"],
                        ["SPECIAL", "Evento especial"],
                        ["VISIT", "Visita dominical"],
                      ]}
                    />
                    <Field
                      name="date"
                      label="Data (visitas somente aos domingos)"
                      type="date"
                      value={event?.date}
                      required
                    />
                    <Field
                      name="time"
                      label="Horário"
                      type="time"
                      value={event?.time ?? "08:00"}
                      required
                    />
                    {!event && (
                      <Field
                        name="occurrences"
                        label="Repetir semanalmente (número de ocorrências)"
                        type="number"
                        value={1}
                        required
                      />
                    )}
                    <Field
                      name="duration"
                      label="Duração em minutos"
                      type="number"
                      value={event?.duration ?? 60}
                      required
                    />
                    <Field
                      name="required"
                      label="Quantidade de ministros"
                      type="number"
                      value={event?.required ?? 2}
                      required
                    />
                    <Field
                      name="location"
                      label="Local"
                      value={event?.location ?? "Matriz"}
                      required
                    />
                    <Field
                      name="assistedId"
                      label="Assistido (obrigatório para visitas)"
                      value={event?.assistedId}
                      options={[
                        ["", "Não se aplica"],
                        ...data.assisted
                          .filter((a) => a.active || a.id === event?.assistedId)
                          .map((a) => [a.id, a.name] as const),
                      ]}
                    />
                  </>
                )}
                {kind === "absence" && (
                  <>
                    <Field
                      name="ministerId"
                      label="Ministro"
                      value={absence?.ministerId ?? ministers[0]?.id}
                      required
                      options={ministers.map((m) => [m.id, m.name])}
                    />
                    <Field
                      name="scope"
                      label="Abrangência do impedimento"
                      value={absence?.scope ?? "DAY"}
                      options={[
                        ["DAY", "Dia inteiro"],
                        ["PERIOD", "Período de datas"],
                        ["CELEBRATION", "Celebração específica"],
                      ]}
                    />
                    <Field
                      name="start"
                      label="Data inicial (dia ou período)"
                      type="date"
                      value={absence?.start}
                    />
                    <Field
                      name="end"
                      label="Data final (repita a data para dia inteiro)"
                      type="date"
                      value={absence?.end}
                    />
                    <Field
                      name="eventId"
                      label="Celebração (apenas para impedimento específico)"
                      value={absence?.eventId}
                      options={[
                        ["", "Não se aplica"],
                        ...data.events
                          .filter((e) => e.kind !== "VISIT")
                          .map(
                            (e) =>
                              [
                                e.id,
                                `${e.date} ${e.time} • ${e.title}`,
                              ] as const,
                          ),
                      ]}
                    />
                    <Field
                      name="reason"
                      label="Motivo opcional (restrito à coordenação)"
                      type="textarea"
                      value={absence?.reason}
                    />
                  </>
                )}
                {kind !== "absence" && (
                  <Field
                    name="notes"
                    label="Observações"
                    type="textarea"
                    value={(minister ?? assisted ?? event)?.notes}
                  />
                )}
              </div>
              <div className="form-actions">
                <button type="submit">
                  {editing ? "Salvar alterações" : "Salvar cadastro"}
                </button>
                {editing && <Link href={`/${section}`}>Cancelar edição</Link>}
              </div>
            </form>
          </details>
          {event && !event.cancelled && (
            <form action={cancelEvent} className="toolbar">
              <input type="hidden" name="id" value={event.id} />
              <Field
                name="reason"
                label="Justificativa do cancelamento"
                required
              />
              <button className="secondary">Cancelar este agendamento</button>
            </form>
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
            <button className="secondary">Ver mês</button>
          </form>
          <Calendar
            month={month}
            events={data.events.filter((e) => e.date.startsWith(month))}
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
          <span className="tag">{rows.length} registros</span>
        </div>
        <form className="toolbar" role="search">
          <Field name="q" label="Buscar" value={query.q} />
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
                        </>
                      ) : "mobile" in r ? (
                        <>
                          {r.neighborhood}
                          <small>{r.mobile || r.landline}</small>
                        </>
                      ) : "time" in r ? (
                        <>
                          {r.date} · {r.time}
                          <small>
                            {r.location} · {r.required} ministros
                          </small>
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
                        {"cancelled" in r && r.cancelled
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
                      <Link href={`/${section}?edit=${r.id}`}>Editar</Link>
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
