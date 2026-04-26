import React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Status, Priority } from "@/store/types";
import { AlertCircle, Clock, CheckCircle2, PlayCircle, Send } from "lucide-react";

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        priority === "Routine" && "bg-green-50 text-green-700 border-green-200",
        priority === "Urgent" && "bg-orange-50 text-orange-700 border-orange-200",
        priority === "Stat" && "bg-red-50 text-red-700 border-red-200 font-semibold shadow-sm",
        className
      )}
    >
      {priority}
    </Badge>
  );
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "font-medium gap-1.5 whitespace-nowrap",
        status === "Ordered" && "bg-gray-100 text-gray-700 hover:bg-gray-100",
        status === "Sent to Department" && "bg-blue-50 text-blue-700 hover:bg-blue-50 border border-blue-100",
        status === "In Progress" && "bg-amber-50 text-amber-700 hover:bg-amber-50 border border-amber-100",
        status === "Result Ready" && "bg-teal-50 text-teal-700 hover:bg-teal-50 border border-teal-100",
        status === "Reviewed by Doctor" && "bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border border-emerald-100",
        className
      )}
    >
      {status === "Ordered" && <Clock className="w-3 h-3" />}
      {status === "Sent to Department" && <Send className="w-3 h-3" />}
      {status === "In Progress" && <PlayCircle className="w-3 h-3" />}
      {status === "Result Ready" && <AlertCircle className="w-3 h-3" />}
      {status === "Reviewed by Doctor" && <CheckCircle2 className="w-3 h-3" />}
      {status}
    </Badge>
  );
}
