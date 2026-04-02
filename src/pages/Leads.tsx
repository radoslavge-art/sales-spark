import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Filter, MoreHorizontal, Eye, Edit, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

  const filtered = mockLeads.filter((lead) => {
    const matchesSearch =
      `${lead.firstName} ${lead.lastName} ${lead.company} ${lead.email}`
        .toLowerCase()
        .includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground">{mockLeads.length} total leads</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Lead</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input placeholder="First name" />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input placeholder="Last name" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Company</Label>
                <Input placeholder="Company name" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" placeholder="email@company.com" />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input placeholder="+1 555-0100" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Source</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="website">Website</SelectItem>
                      <SelectItem value="referral">Referral</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                      <SelectItem value="cold-call">Cold Call</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea placeholder="Add any initial notes..." />
              </div>
              <Button className="w-full" onClick={() => setCreateOpen(false)}>
                Create Lead
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, company, email..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="New">New</SelectItem>
                <SelectItem value="Contacted">Contacted</SelectItem>
                <SelectItem value="Qualified">Qualified</SelectItem>
                <SelectItem value="Negotiation">Negotiation</SelectItem>
                <SelectItem value="Won">Won</SelectItem>
                <SelectItem value="Lost">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((lead) => (
                <TableRow key={lead.id} className="cursor-pointer hover:bg-secondary/50">
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
                      {lead.priority}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{lead.assignedTo}</TableCell>
                  <TableCell className="text-muted-foreground">{lead.source}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{lead.createdAt}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem><Eye className="mr-2 h-4 w-4" /> View</DropdownMenuItem>
                        <DropdownMenuItem><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
