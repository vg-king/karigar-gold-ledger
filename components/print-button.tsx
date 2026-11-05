"use client";

export function PrintButton() {
  return <button className="button button-primary print-button" type="button" onClick={() => window.print()}>Print slip</button>;
}
