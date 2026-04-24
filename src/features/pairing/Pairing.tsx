import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { useDuochat } from "../../lib/store";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";

export function Pairing() {
  const { createSpace, joinSpace, identity } = useDuochat();
  const [mode, setMode] = useState<"idle" | "hosting" | "joining">("idle");
  const [ticket, setTicket] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate() {
    setBusy(true);
    setError(null);
    try {
      const res = await createSpace();
      setTicket(res.ticket);
      setMode("hosting");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onJoin() {
    if (!joinInput.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await joinSpace(joinInput.trim());
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }

  return (
    <div className="h-full w-full flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-duo-surface border border-duo-border rounded-2xl p-8 shadow-2xl">
        <div className="mb-6">
          <div className="text-2xl font-semibold">Welcome to duochat</div>
          <div className="text-duo-muted mt-1 text-sm">
            Peer-to-peer collaboration for two.
          </div>
          {identity && (
            <div className="mt-3 text-xs text-duo-muted font-mono break-all">
              you: {identity.node_id.slice(0, 16)}…
            </div>
          )}
        </div>

        {mode === "idle" && (
          <div className="space-y-3">
            <button
              onClick={onCreate}
              disabled={busy}
              className="w-full py-3 rounded-lg bg-duo-accent hover:bg-duo-accenthover disabled:opacity-50 text-white font-medium"
            >
              Start a new space
            </button>
            <button
              onClick={() => setMode("joining")}
              disabled={busy}
              className="w-full py-3 rounded-lg border border-duo-border hover:bg-duo-border/40 text-duo-text"
            >
              Join with a ticket
            </button>
          </div>
        )}

        {mode === "hosting" && (
          <div className="space-y-4">
            <div className="text-sm text-duo-muted">
              Share this ticket with your partner to invite them.
            </div>
            <div className="bg-white rounded-lg p-4 flex items-center justify-center">
              <QRCodeCanvas value={ticket} size={224} />
            </div>
            <textarea
              readOnly
              value={ticket}
              rows={4}
              className="w-full bg-duo-bg border border-duo-border rounded-lg p-2 font-mono text-xs text-duo-text"
            />
            <div className="flex gap-2">
              <button
                onClick={() => writeText(ticket)}
                className="flex-1 py-2 rounded-lg border border-duo-border hover:bg-duo-border/40 text-sm"
              >
                Copy ticket
              </button>
              <button
                onClick={() => setMode("idle")}
                className="flex-1 py-2 rounded-lg border border-duo-border hover:bg-duo-border/40 text-sm"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {mode === "joining" && (
          <div className="space-y-3">
            <textarea
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value)}
              placeholder="Paste the doc ticket here…"
              rows={4}
              className="w-full bg-duo-bg border border-duo-border rounded-lg p-3 font-mono text-xs"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setMode("idle")}
                className="flex-1 py-2 rounded-lg border border-duo-border hover:bg-duo-border/40 text-sm"
              >
                Back
              </button>
              <button
                onClick={onJoin}
                disabled={busy || !joinInput.trim()}
                className="flex-1 py-2 rounded-lg bg-duo-accent hover:bg-duo-accenthover disabled:opacity-50 text-white text-sm"
              >
                {busy ? "Joining…" : "Join"}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 text-sm text-duo-danger break-all">{error}</div>
        )}
      </div>
    </div>
  );
}
