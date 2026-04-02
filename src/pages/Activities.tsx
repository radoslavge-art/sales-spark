import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Phone, Mail, Calendar, MessageSquare, RotateCcw } from "lucide-react";

type ActivityItem = {
  id: string;
  type: "Call" | "Email" | "Meeting" | "Follow-up" | "Note";
  description: string;
  leadName: string;
  userName: string;
  dueDate: string;
  completed: boolean;
};

const mockActivities: ActivityItem[] = [
  { id: "1", type: "Call", description: "Initial discovery call with Sarah about TechCorp needs", leadName: "Sarah Chen", userName: "John Doe", dueDate: "2024-01-20 14:00", completed: false },
  { id: "2", type: "Email", description: "Send proposal follow-up to Mike at FinServe", leadName: "Mike Ross", userName: "Jane Smith", dueDate: "2024-01-20 16:00", completed: false },
  { id: "3", type: "Meeting", description: "Product demo with Lisa and her team", leadName: "Lisa Wang", userName: "John Doe", dueDate: "2024-01-21 10:00", completed: false },
  { id: "4", type: "Follow-up", description: "Check in on contract status with James", leadName: "James Hart", userName: "Jane Smith", dueDate: "2024-01-21 13:00", completed: true },
  { id: "5", type: "Note", description: "Emma expressed interest in premium tier during event", leadName: "Emma Davis", userName: "John Doe", dueDate: "2024-01-19 09:00", completed: true },
  { id: "6", type: "Call", description: "Discuss pricing options with Rachel", leadName: "Rachel Green", userName: "John Doe", dueDate: "2024-01-22 11:00", completed: false },
  { id: "7", type: "Email", description: "Send case study to Tom at BuildRight", leadName: "Tom Baker", userName: "Jane Smith", dueDate: "2024-01-22 15:00", completed: false },
];

const typeIcons: Record<string, React.ReactNode> = {
  Call: <Phone className="h-4 w-4" />,
  Email: <Mail className="h-4 w-4" />,
  Meeting: <Calendar className="h-4 w-4" />,
  "Follow-up": <RotateCcw className="h-4 w-4" />,
  Note: <MessageSquare className="h-4 w-4" />,
};

const typeColors: Record<string, string> = {
  Call: "bg-primary/10 text-primary",
  Email: "text-[hsl(262,83%,58%)] bg-[hsl(262,83%,58%)]/10",
  Meeting: "text-success bg-success/10",
  "Follow-up": "text-warning bg-warning/10",
  Note: "text-muted-foreground bg-muted",
};

export default function Activities() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = mockActivities.filter((a) => {
    const matchesSearch = `${a.description} ${a.leadName}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || a.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const pending = filtered.filter((a) => !a.completed);
  const completed = filtered.filter((a) => a.completed);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Activities</h1>
          <p className="text-sm text-muted-foreground">
            {pending.length} pending · {completed.length} completed
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Log Activity</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>Log New Activity</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="follow-up">Follow-up</SelectItem>
                    <SelectItem value="note">Note</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Related Lead</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Select lead" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Sarah Chen</SelectItem>
                    <SelectItem value="2">Mike Ross</SelectItem>
                    <SelectItem value="3">Lisa Wang</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due Date & Time</Label>
                <Input type="datetime-local" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea placeholder="Describe the activity..." />
              </div>
              <Button className="w-full" onClick={() => setCreateOpen(false)}>Log Activity</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search activities..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Call">Call</SelectItem>
                <SelectItem value="Email">Email</SelectItem>
                <SelectItem value="Meeting">Meeting</SelectItem>
                <SelectItem value="Follow-up">Follow-up</SelectItem>
                <SelectItem value="Note">Note</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Pending */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Pending</h2>
          {pending.map((activity) => (
            <Card key={activity.id} className="transition-shadow hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Checkbox className="mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${typeColors[activity.type]}`}>
                        {typeIcons[activity.type]}
                        {activity.type}
                      </span>
                      <span className="text-xs text-muted-foreground">· {activity.leadName}</span>
                    </div>
                    <p className="text-sm text-foreground">{activity.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>{activity.dueDate}</span>
                      <span>·</span>
                      <span>{activity.userName}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Completed</h2>
          {completed.map((activity) => (
            <Card key={activity.id} className="opacity-60">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Checkbox className="mt-1" checked />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${typeColors[activity.type]}`}>
                        {typeIcons[activity.type]}
                        {activity.type}
                      </span>
                      <span className="text-xs text-muted-foreground">· {activity.leadName}</span>
                    </div>
                    <p className="text-sm text-foreground line-through">{activity.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>{activity.dueDate}</span>
                      <span>·</span>
                      <span>{activity.userName}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
