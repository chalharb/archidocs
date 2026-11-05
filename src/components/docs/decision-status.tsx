import { Badge } from "@/components/ui/badge";
import type { DecisionStatus } from "@/domain/resources";

const VARIANT: Record<DecisionStatus, "default" | "secondary" | "outline" | "destructive"> = {
  proposed: "outline",
  accepted: "default",
  rejected: "destructive",
  deprecated: "secondary",
  superseded: "secondary",
};

export const STATUS_LABEL: Record<DecisionStatus, string> = {
  proposed: "Proposed",
  accepted: "Accepted",
  rejected: "Rejected",
  deprecated: "Deprecated",
  superseded: "Superseded",
};

/** Status badge for a decision (ADR-04, ADR-05). */
export function DecisionStatusBadge({ status }: { status: DecisionStatus }) {
  return <Badge variant={VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
