"use client";

import type { ReactNode } from "react";

export function OyiNotice({ title, children, tone = "neutral" }: { title?: string; children: ReactNode; tone?: "neutral" | "warning" | "success" }) {
  return <section className={`oyi-response-notice ${tone}`} role={tone === "warning" ? "alert" : "status"}>{title ? <h3>{title}</h3> : null}<div>{children}</div></section>;
}

export function OyiKeyValue({ rows }: { rows: Array<{ label: string; value: ReactNode }> }) {
  return <dl className="oyi-response-kv">{rows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>;
}

export function OyiTable({ columns, rows, caption }: { columns: Array<{ key: string; label: string }>; rows: Array<Record<string, ReactNode>>; caption?: string }) {
  return <div className="oyi-response-table-wrap"><table className="oyi-response-table">{caption ? <caption>{caption}</caption> : null}<thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id || index)}>{columns.map((column) => <td key={column.key}>{row[column.key]}</td>)}</tr>)}</tbody></table></div>;
}

export function OyiSuggestions({ items, onSelect }: { items: Array<{ id?: string; label: string; value?: string }>; onSelect: (value: string) => void }) {
  return <div className="oyi-response-suggestions">{items.map((item) => <button key={item.id || item.label} type="button" onClick={() => onSelect(item.value || item.label)}>{item.label}</button>)}</div>;
}

export function OyiGovernedProposal({ title, summary, confirmLabel = "Confirm", cancelLabel = "Cancel", onConfirm, onCancel, disabled }: { title: string; summary?: string; confirmLabel?: string; cancelLabel?: string; onConfirm: () => void; onCancel: () => void; disabled?: boolean }) {
  return <section className="oyi-response-proposal"><h3>{title}</h3>{summary ? <p>{summary}</p> : null}<div><button type="button" onClick={onCancel} disabled={disabled}>{cancelLabel}</button><button type="button" className="primary" onClick={onConfirm} disabled={disabled}>{confirmLabel}</button></div></section>;
}
