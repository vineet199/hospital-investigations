import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Investigation } from "@/store/types";
import { STATUS_ORDER, statusIndex, fullTime } from "@/lib/format";

interface Props {
  investigation: Investigation;
  compact?: boolean;
}

export function StatusStepper({ investigation, compact = false }: Props) {
  const currentIdx = statusIndex(investigation.status);
  const stageTimestamps = new Map(
    investigation.timeline.map((e) => [e.stage, e.timestamp]),
  );

  return (
    <div className={cn("flex items-stretch w-full", compact ? "gap-1" : "gap-2")}>
      {STATUS_ORDER.map((stage, idx) => {
        const reached = idx <= currentIdx;
        const isCurrent = idx === currentIdx;
        const ts = stageTimestamps.get(stage);
        return (
          <div
            key={stage}
            className={cn(
              "flex-1 flex flex-col gap-1.5",
            )}
          >
            <div className="flex items-center gap-1">
              <div
                className={cn(
                  "h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-semibold border-2 shrink-0 transition-colors",
                  reached
                    ? isCurrent
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-primary/15 text-primary border-primary/40"
                    : "bg-muted text-muted-foreground border-border",
                )}
              >
                {reached && !isCurrent ? <Check className="h-3 w-3" /> : idx + 1}
              </div>
              {idx < STATUS_ORDER.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 rounded transition-colors",
                    idx < currentIdx ? "bg-primary/40" : "bg-border",
                  )}
                />
              )}
            </div>
            {!compact && (
              <div className="flex flex-col gap-0.5 pr-1">
                <span
                  className={cn(
                    "text-[11px] font-medium leading-tight",
                    reached ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {stage}
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight tabular-nums">
                  {ts ? fullTime(ts) : "—"}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
