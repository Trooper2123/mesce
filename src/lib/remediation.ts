export type RemediationLink = {
  href: string;
  label: string;
};

export class RemediationError extends Error {
  remediation: RemediationLink[];

  constructor(message: string, remediation: RemediationLink[] = []) {
    super(message);
    this.name = "RemediationError";
    this.remediation = remediation;
  }
}
