import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Filter, MoreHorizontal, Eye, Edit, Trash2, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LeadCreateDialog } from "@/components/leads/LeadCreateDialog";
import { LeadHistoryPanel } from "@/components/leads/LeadHistoryPanel";
import { useLanguage } from "@/contexts/LanguageContext";

type Lead = {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone: string;
  source: string;
  status: "New" | "Contacted" | "Qualified" | "Negotiation" | "Won" | "Lost";
  assignedTo: string;
  priority: "High" | "Medium" | "Low";
  createdAt: string;
};

const mockLeads: Lead[] = [
  { id: "1", firstName: "Sarah", lastName: "Chen", company: "TechCorp", email: "sarah@techcorp.com", phone: "+1 555-0101", source: "Website", status: "New", assignedTo: "John Doe", priority: "High", createdAt: "2024-01-15" },
  { id: "2", firstName: "Mike", lastName: "Ross", company: "FinServe", email: "mike@finserve.com", phone: "+1 555-0102", source: "Referral", status: "Contacted", assignedTo: "Jane Smith", priority: "Medium", createdAt: "2024-01-14" },
  { id: "3", firstName: "Lisa", lastName: "Wang", company: "DataFlow", email: "lisa@dataflow.io", phone: "+1 555-0103", source: "LinkedIn", status: "Qualified", assignedTo: "John Doe", priority: "High", createdAt: "2024-01-13" },
  { id: "4", firstName: "James", lastName: "Hart", company: "CloudBase", email: "james@cloudbase.co", phone: "+1 555-0104", source: "Cold Call", status: "Negotiation", assignedTo: "Jane Smith", priority: "Medium", createdAt: "2024-01-12" },
  { id: "5", firstName: "Emma", lastName: "Davis", company: "GrowthLab", email: "emma@growthlab.com", phone: "+1 555-0105", source: "Event", status: "Won", assignedTo: "John Doe", priority: "Low", createdAt: "2024-01-11" },
  { id: "6", firstName: "Alex", lastName: "Kim", company: "NovaTech", email: "alex@novatech.io", phone: "+1 555-0106", source: "Website", status: "Lost", assignedTo: "Jane Smith", priority: "Low", createdAt: "2024-01-10" },
  { id: "7", firstName: "Rachel", lastName: "Green", company: "MediaPro", email: "rachel@mediapro.com", phone: "+1 555-0107", source: "Referral", status: "New", assignedTo: "John Doe", priority: "High", createdAt: "2024-01-09" },
  { id: "8", firstName: "Tom", lastName: "Baker", company: "BuildRight", email: "tom@buildright.co", phone: "+1 555-0108", source: "LinkedIn", status: "Contacted", assignedTo: "Jane Smith", priority: "Medium", createdAt: "2024-01-08" },
];

const priorityClasses: Record<string, string> = {
  High: "text-destructive bg-destructive/10",
  Medium: "text-warning bg-warning/10",
  Low: "text-muted-foreground bg-muted",
};

export default function Leads() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const { t } = useLanguage();

  const filtered = mockLeads.filter((lead) => {
    const matchesSearch =
      `${lead.firstName} ${lead.lastName} ${lead.company} ${lead.email}`
        .toLowerCase()
        .includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const selectedLead = selectedLeadId
    ? mockLeads.find((l) => l.id === selectedLeadId)
    : null;

  const priorityKeys: Record<string, string> = {
    High: "priority.high",
    Medium: "priority.medium",
    Low: "priority.low",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("leads.title")}</h1>
          <p className="text-sm text-muted-foreground">{mockLeads.length} {t("leads.totalLeads")}</p>
        </div>
        <LeadCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("leads.searchPlaceholder")}
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder={t("leads.status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("leads.allStatuses")}</SelectItem>
                <SelectItem value="New">{t("status.new")}</SelectItem>
                <SelectItem value="Contacted">{t("status.contacted")}</SelectItem>
                <SelectItem value="Qualified">{t("status.qualified")}</SelectItem>
                <SelectItem value="Negotiation">{t("status.negotiation")}</SelectItem>
                <SelectItem value="Won">{t("status.won")}</SelectItem>
                <SelectItem value="Lost">{t("status.lost")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-6">
        <Card className={selectedLead ? "flex-1 min-w-0" : "w-full"}>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("leads.name")}</TableHead>
                  <TableHead>{t("leads.company")}</TableHead>
                  <TableHead>{t("leads.status")}</TableHead>
                  <TableHead>{t("leads.priority")}</TableHead>
                  <TableHead>{t("leads.owner")}</TableHead>
                  <TableHead>{t("leads.source")}</TableHead>
                  <TableHead>{t("leads.created")}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((lead) => (
                  <TableRow
                    key={lead.id}
                    className={`cursor-pointer hover:bg-secondary/50 ${selectedLeadId === lead.id ? "bg-secondary/70" : ""}`}
                    onClick={() => setSelectedLeadId(selectedLeadId === lead.id ? null : lead.id)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{lead.firstName} {lead.lastName}</p>
                        <p className="text-xs text-muted-foreground">{lead.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{lead.company}</TableCell>
                    <TableCell>
                      <StatusBadge status={lead.status} />
                    </TableCell>
                    <TableCell>
                      <span className={`status-badge ${priorityClasses[lead.priority]}`}>
                        {t(priorityKeys[lead.priority])}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{lead.assignedTo}</TableCell>
                    <TableCell className="text-muted-foreground">{lead.source}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{lead.createdAt}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem><Eye className="mr-2 h-4 w-4" /> {t("leads.view")}</DropdownMenuItem>
                          <DropdownMenuItem><Edit className="mr-2 h-4 w-4" /> {t("leads.edit")}</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> {t("leads.delete")}</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {selectedLead && (
          <Card className="w-[360px] shrink-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <StatusBadge status={selectedLead.status} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setSelectedLeadId(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <LeadHistoryPanel
                leadId={selectedLead.id}
                leadName={`${selectedLead.firstName} ${selectedLead.lastName}`}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
