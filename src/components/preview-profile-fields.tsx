import { previewProfiles, type PreviewProfile } from "@/lib/preview-session";
export function PreviewProfileFields({
  selected = "COORDINATOR",
}: {
  selected?: PreviewProfile;
}) {
  return (
    <label className="field">
      Perfil para homologar
      <select name="profile" defaultValue={selected} required>
        {Object.entries(previewProfiles).map(([value, profile]) => (
          <option value={value} key={value}>
            {profile.label}
          </option>
        ))}
      </select>
    </label>
  );
}
