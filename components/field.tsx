import type { ReactNode } from "react";

export function Field({ label, error, helper, children }: {
  label: ReactNode;
  error?: string;
  helper?: string;
  children: ReactNode;
}) {
  return <label className="form-field"><span className="field-label">{label}</span>{children}{error ? <small className="field-error">{error}</small> : helper ? <small className="field-helper">{helper}</small> : null}</label>;
}
