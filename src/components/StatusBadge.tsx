type LeadStatus = "New" | "Contacted" | "Qualified" | "Negotiation" | "Won" | "Lost";

const statusClasses: Record<LeadStatus, string> = {
  New: "status-new",
  Contacted: "status-contacted",
  Qualified: "status-qualified",
  Negotiation: "status-negotiation",
  Won: "status-won",
  Lost: "status-lost",
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span className={`status-badge ${statusClasses[status]}`}>
      {status}
    </span>
  );
}
