import { Phone, Mail, MessageSquare, Calendar, UserCheck, ArrowRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "@/components/StatusBadge";

type HistoryEntry = {
  id: string;
  type: "call" | "email" | "meeting" | "note" | "status_change";
  description: string;
  date: string;
  user: string;
  fromStatus?: string;
  toStatus?: string;
};

const iconMap = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  note: MessageSquare,
  status_change: ArrowRight,
};

const iconColorMap = {
  call: "text-chart-1 bg-chart-1/10",
  email: "text-chart-2 bg-chart-2/10",
  meeting: "text-chart-3 bg-chart-3/10",
  note: "text-chart-4 bg-chart-4/10",
  status_change: "text-chart-5 bg-chart-5/10",
};

// Mock history data keyed by lead id
const mockHistory: Record<string, HistoryEntry[]> = {
  "1": [
    { id: "h1", type: "status_change", description: "Lead created", date: "2024-01-15 09:00", user: "System", fromStatus: "", toStatus: "New" },
  ],
  "2": [
    { id: "h1", type: "status_change", description: "Lead created", date: "2024-01-14 10:00", user: "System", fromStatus: "", toStatus: "New" },
    { id: "h2", type: "email", description: "Sent intro email about FinServe partnership options", date: "2024-01-15 11:30", user: "Jane Smith" },
    { id: "h3", type: "status_change", description: "Status updated", date: "2024-01-15 11:35", user: "Jane Smith", fromStatus: "New", toStatus: "Contacted" },
  ],
  "3": [
    { id: "h1", type: "status_change", description: "Lead created", date: "2024-01-13 08:00", user: "System", fromStatus: "", toStatus: "New" },
    { id: "h2", type: "call", description: "Initial discovery call — discussed data pipeline needs", date: "2024-01-14 14:00", user: "John Doe" },
    { id: "h3", type: "status_change", description: "Status updated", date: "2024-01-14 14:30", user: "John Doe", fromStatus: "New", toStatus: "Contacted" },
    { id: "h4", type: "email", description: "Sent proposal document for DataFlow integration", date: "2024-01-15 09:00", user: "John Doe" },
    { id: "h5", type: "meeting", description: "Demo meeting with Lisa and CTO", date: "2024-01-16 10:00", user: "John Doe" },
    { id: "h6", type: "status_change", description: "Status updated", date: "2024-01-16 11:00", user: "John Doe", fromStatus: "Contacted", toStatus: "Qualified" },
  ],
  "4": [
    { id: "h1", type: "status_change", description: "Lead created", date: "2024-01-12 09:00", user: "System", fromStatus: "", toStatus: "New" },
    { id: "h2", type: "call", description: "Cold call — James expressed interest in cloud migration", date: "2024-01-13 10:00", user: "Jane Smith" },
    { id: "h3", type: "status_change", description: "Status updated", date: "2024-01-13 10:15", user: "Jane Smith", fromStatus: "New", toStatus: "Contacted" },
    { id: "h4", type: "meeting", description: "Technical requirements gathering session", date: "2024-01-14 14:00", user: "Jane Smith" },
    { id: "h5", type: "status_change", description: "Status updated", date: "2024-01-14 15:00", user: "Jane Smith", fromStatus: "Contacted", toStatus: "Qualified" },
    { id: "h6", type: "email", description: "Sent pricing proposal for CloudBase tier", date: "2024-01-15 09:00", user: "Jane Smith" },
    { id: "h7", type: "status_change", description: "Status updated", date: "2024-01-15 16:00", user: "Jane Smith", fromStatus: "Qualified", toStatus: "Negotiation" },
  ],
  "5": [
    { id: "h1", type: "status_change", description: "Lead created", date: "2024-01-11 08:00", user: "System", fromStatus: "", toStatus: "New" },
    { id: "h2", type: "email", description: "Outreach email about growth consulting", date: "2024-01-12 09:00", user: "John Doe" },
    { id: "h3", type: "call", description: "Follow-up call — Emma ready to proceed", date: "2024-01-13 11:00", user: "John Doe" },
    { id: "h4", type: "status_change", description: "Status updated", date: "2024-01-14 09:00", user: "John Doe", fromStatus: "Contacted", toStatus: "Won" },
  ],
  "6": [
    { id: "h1", type: "status_change", description: "Lead created", date: "2024-01-10 10:00", user: "System", fromStatus: "", toStatus: "New" },
    { id: "h2", type: "call", description: "Initial call — budget constraints mentioned", date: "2024-01-11 14:00", user: "Jane Smith" },
    { id: "h3", type: "note", description: "Alex mentioned they are evaluating competitors", date: "2024-01-12 09:00", user: "Jane Smith" },
    { id: "h4", type: "status_change", description: "Status updated — went with competitor", date: "2024-01-13 16:00", user: "Jane Smith", fromStatus: "Contacted", toStatus: "Lost" },
  ],
  "7": [
    { id: "h1", type: "status_change", description: "Lead created", date: "2024-01-09 09:00", user: "System", fromStatus: "", toStatus: "New" },
  ],
  "8": [
    { id: "h1", type: "status_change", description: "Lead created", date: "2024-01-08 10:00", user: "System", fromStatus: "", toStatus: "New" },
    { id: "h2", type: "email", description: "Sent company overview and case studies", date: "2024-01-09 11:00", user: "Jane Smith" },
    { id: "h3", type: "status_change", description: "Status updated", date: "2024-01-09 11:05", user: "Jane Smith", fromStatus: "New", toStatus: "Contacted" },
  ],
};

interface LeadHistoryPanelProps {
  leadId: string;
  leadName: string;
}

export function LeadHistoryPanel({ leadId, leadName }: LeadHistoryPanelProps) {
  const history = (mockHistory[leadId] || []).slice().reverse();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">
        Contact History — {leadName}
      </h3>
      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No history recorded yet.</p>
      ) : (
        <ScrollArea className="h-[320px] pr-3">
          <div className="relative pl-6 space-y-4">
            {/* Timeline line */}
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

            {history.map((entry) => {
              const Icon = iconMap[entry.type];
              const colorClass = iconColorMap[entry.type];
              return (
                <div key={entry.id} className="relative flex gap-3">
                  <div className={`absolute -left-6 top-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full ${colorClass}`}>
                    <Icon className="h-3 w-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug">{entry.description}</p>
                    {entry.type === "status_change" && entry.toStatus && (
                      <div className="flex items-center gap-1.5 mt-1">
                        {entry.fromStatus && (
                          <>
                            <StatusBadge status={entry.fromStatus as any} />
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          </>
                        )}
                        <StatusBadge status={entry.toStatus as any} />
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{entry.date}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <UserCheck className="h-3 w-3" />
                        {entry.user}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
