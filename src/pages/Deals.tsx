import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Search, MoreHorizontal, Eye, Edit, Trash2 } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/contexts/LanguageContext";

type Deal = {
  id: string;
  title: string;
  leadName: string;
  value: number;
  status: "New" | "Qualified" | "Negotiation" | "Won" | "Lost";
  expectedClose: string;
  assignedTo: string;
};

const mockDeals: Deal[] = [
  { id: "1", title: "TechCorp Enterprise License", leadName: "Sarah Chen", value: 45000, status: "Negotiation", expectedClose: "2024-02-28", assignedTo: "John Doe" },
  { id: "2", title: "FinServe Platform Migration", leadName: "Mike Ross", value: 78000, status: "Qualified", expectedClose: "2024-03-15", assignedTo: "Jane Smith" },
  { id: "3", title: "DataFlow Analytics Suite", leadName: "Lisa Wang", value: 32000, status: "New", expectedClose: "2024-04-01", assignedTo: "John Doe" },
  { id: "4", title: "CloudBase Infrastructure", leadName: "James Hart", value: 120000, status: "Won", expectedClose: "2024-01-30", assignedTo: "Jane Smith" },
  { id: "5", title: "GrowthLab Marketing Tools", leadName: "Emma Davis", value: 15000, status: "Lost", expectedClose: "2024-02-10", assignedTo: "John Doe" },
];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

export default function Deals() {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const { t } = useLanguage();

  const filtered = mockDeals.filter((d) =>
    `${d.title} ${d.leadName}`.toLowerCase().includes(search.toLowerCase())
  );

  const totalPipeline = mockDeals
    .filter((d) => !["Won", "Lost"].includes(d.status))
    .reduce((s, d) => s + d.value, 0);

  const totalWon = mockDeals.filter((d) => d.status === "Won").reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("deals.title")}</h1>
          <p className="text-sm text-muted-foreground">{mockDeals.length} {t("deals.title").toLowerCase()} · {t("deals.pipeline")}: {formatCurrency(totalPipeline)} · {t("deals.won")}: {formatCurrency(totalWon)}</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> {t("deals.newDeal")}</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>{t("deals.createNew")}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2"><Label>{t("deals.dealTitle")}</Label><Input placeholder={t("deals.dealTitle")} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>{t("deals.value")}</Label><Input type="number" placeholder="0" /></div>
                <div className="space-y-2">
                  <Label>{t("deals.expectedClose")}</Label>
                  <Input type="date" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("deals.lead")}</Label>
                <Select><SelectTrigger><SelectValue placeholder={t("deals.selectLead")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Sarah Chen - TechCorp</SelectItem>
                    <SelectItem value="2">Mike Ross - FinServe</SelectItem>
                    <SelectItem value="3">Lisa Wang - DataFlow</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => setCreateOpen(false)}>{t("deals.createDeal")}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t("deals.searchPlaceholder")} className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("deals.deal")}</TableHead>
                <TableHead>{t("deals.lead")}</TableHead>
                <TableHead>{t("deals.value")}</TableHead>
                <TableHead>{t("leads.status")}</TableHead>
                <TableHead>{t("deals.expectedClose")}</TableHead>
                <TableHead>{t("leads.owner")}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((deal) => (
                <TableRow key={deal.id} className="cursor-pointer hover:bg-secondary/50">
                  <TableCell className="font-medium text-foreground">{deal.title}</TableCell>
                  <TableCell className="text-muted-foreground">{deal.leadName}</TableCell>
                  <TableCell className="font-medium text-foreground">{formatCurrency(deal.value)}</TableCell>
                  <TableCell><StatusBadge status={deal.status} /></TableCell>
                  <TableCell className="text-muted-foreground">{deal.expectedClose}</TableCell>
                  <TableCell className="text-muted-foreground">{deal.assignedTo}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
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
    </div>
  );
}
