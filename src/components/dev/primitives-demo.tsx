"use client";

import { useState } from "react";
import { CopyButton } from "@/components/common/copy-button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { CodeBlock } from "@/components/common/code-block";
import { JsonViewer } from "@/components/common/json-viewer";
import { MethodBadge } from "@/components/common/method-badge";
import { RelativeCountdown } from "@/components/common/relative-countdown";
import { StatusBadge } from "@/components/common/status-badge";
import { TimeAgo } from "@/components/common/time-ago";
import { Button } from "@/components/ui/button";

const sample = {
  id: 42,
  name: "Ada Lovelace",
  active: true,
  roles: ["admin", "editor"],
  profile: { city: "London", timezone: "Europe/London" },
  score: null,
};

export function PrimitivesDemo() {
  const [countdownTarget] = useState(() => Date.now() + 5 * 60 * 1000);
  const [updatedAt] = useState(() => new Date(Date.now() - 90_000));

  return (
    <div className="space-y-10">
      <section className="space-y-3" aria-labelledby="badges">
        <h2 id="badges" className="text-lg font-semibold text-zinc-100">Badges</h2>
        <div className="flex flex-wrap items-center gap-2">
          <MethodBadge method="GET" />
          <MethodBadge method="POST" />
          <MethodBadge method="PUT" />
          <MethodBadge method="DELETE" />
          <StatusBadge status={200} />
          <StatusBadge status={201} />
          <StatusBadge status={404} />
          <StatusBadge status={500} injected />
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="time">
        <h2 id="time" className="text-lg font-semibold text-zinc-100">Time</h2>
        <p className="text-sm text-zinc-400">
          Updated <TimeAgo value={updatedAt} /> · Expires in{" "}
          <RelativeCountdown target={countdownTarget} />
        </p>
      </section>

      <section className="space-y-3" aria-labelledby="copy">
        <h2 id="copy" className="text-lg font-semibold text-zinc-100">Copy</h2>
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton value="https://mock.example.com/users" label="Copy mock URL" />
          <CopyButton value='{"ok":true}' label="Copy JSON" iconOnly />
        </div>
        <CodeBlock code={'curl "https://mock.example.com/users"'} language="bash" label="Request" />
      </section>

      <section className="space-y-3" aria-labelledby="json">
        <h2 id="json" className="text-lg font-semibold text-zinc-100">JSON viewer</h2>
        <JsonViewer value={sample} label="Response" maxHeight="20rem" />
      </section>

      <section className="space-y-3" aria-labelledby="dialogs">
        <h2 id="dialogs" className="text-lg font-semibold text-zinc-100">Dialogs</h2>
        <ConfirmDialog
          trigger={
            <Button type="button" variant="destructive">
              Open destructive confirmation
            </Button>
          }
          title="Delete this endpoint?"
          description="This cannot be undone. The mock URL will stop responding."
          confirmLabel="Delete endpoint"
          destructive
          onConfirm={() => undefined}
        />
      </section>
    </div>
  );
}
