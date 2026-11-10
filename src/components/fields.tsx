type Props = {
  name: string;
  label: string;
  type?: string;
  value?: string | number;
  required?: boolean;
  options?: readonly (readonly [string, string])[];
};
export function Field({
  name,
  label,
  type = "text",
  value = "",
  required = false,
  options,
}: Props) {
  return (
    <label className="field">
      {label}
      {options ? (
        <select name={name} defaultValue={value} required={required}>
          {options.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea name={name} defaultValue={value} maxLength={2000} />
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={value}
          required={required}
          maxLength={type === "number" ? undefined : 2000}
          min={type === "number" ? 1 : undefined}
        />
      )}
    </label>
  );
}
export function Check({
  name,
  label,
  checked = false,
}: {
  name: string;
  label: string;
  checked?: boolean;
}) {
  return (
    <label className="field check">
      <input type="checkbox" name={name} defaultChecked={checked} />
      {label}
    </label>
  );
}
export function Notice({ error, saved }: { error?: string; saved?: string }) {
  return (
    <>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="notice" role="status">
          Informações salvas com sucesso.
        </p>
      )}
    </>
  );
}
