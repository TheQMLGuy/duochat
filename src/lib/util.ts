export function shortId(id: string, n = 6): string {
  if (id.length <= n * 2) return id;
  return `${id.slice(0, n)}…${id.slice(-n)}`;
}

export function formatTime(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const t = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return t;
  return `${d.toLocaleDateString()} ${t}`;
}

export function initialsFor(id: string): string {
  return id.slice(0, 2).toUpperCase();
}

const PALETTE = [
  "#5865f2",
  "#57f287",
  "#fee75c",
  "#eb459e",
  "#ed4245",
  "#00bcd4",
  "#ff9800",
  "#9c27b0",
];

export function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
