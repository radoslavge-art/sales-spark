import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Phone, Mail, Calendar, MessageSquare, RotateCcw } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

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

const typeTranslationKeys: Record<string, string> = {
  Call: "activities.call",
  Email: "activities.email",
  Meeting: "activities.meeting",
  "Follow-up": "activities.followUp",
  Note: "activities.note",
};

export default function Activities() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const { t } = useLanguage();

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
          <h1 className="text-2xl font-semibold text-foreground">{t("activities.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {pending.length} {t("activities.pending")} · {completed.length} {t("activities.completed")}
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> {t("activities.logActivity")}</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>{t("activities.logNew")}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>{t("activities.type")}</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder={t("activities.type")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">{t("activities.call")}</SelectItem>
                    <SelectItem value="email">{t("activities.email")}</SelectItem>
                    <SelectItem value="meeting">{t("activities.meeting")}</SelectItem>
                    <SelectItem value="follow-up">{t("activities.followUp")}</SelectItem>
                    <SelectItem value="note">{t("activities.note")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("activities.relatedLead")}</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder={t("ai.selectLead")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Sarah Chen</SelectItem>
                    <SelectItem value="2">Mike Ross</SelectItem>
                    <SelectItem value="3">Lisa Wang</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("activities.dueDate")}</Label>
                <Input type="datetime-local" />
              </div>
              <div className="space-y-2">
                <Label>{t("activities.description")}</Label>
                <Textarea placeholder={t("activities.describePlaceholder")} />
              </div>
              <Button className="w-full" onClick={() => setCreateOpen(false)}>{t("activities.logActivity")}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t("activities.searchPlaceholder")} className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder={t("activities.type")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("activities.allTypes")}</SelectItem>
                <SelectItem value="Call">{t("activities.call")}</SelectItem>
                <SelectItem value="Email">{t("activities.email")}</SelectItem>
                <SelectItem value="Meeting">{t("activities.meeting")}</SelectItem>
                <SelectItem value="Follow-up">{t("activities.followUp")}</SelectItem>
                <SelectItem value="Note">{t("activities.note")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t("activities.pendingSection")}</h2>
          {pending.map((activity) => (
            <Card key={activity.id} className="transition-shadow hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Checkbox className="mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${typeColors[activity.type]}`}>
                        {typeIcons[activity.type]}
                        {t(typeTranslationKeys[activity.type])}
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

      {completed.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t("activities.completedSection")}</h2>
          {completed.map((activity) => (
            <Card key={activity.id} className="opacity-60">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Checkbox className="mt-1" checked />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${typeColors[activity.type]}`}>
                        {typeIcons[activity.type]}
                        {t(typeTranslationKeys[activity.type])}
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
