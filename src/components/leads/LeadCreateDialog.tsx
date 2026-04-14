import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface LeadCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeadCreateDialog({ open, onOpenChange }: LeadCreateDialogProps) {
  const { t } = useLanguage();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t("leads.addLead")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("leads.createNew")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("leads.firstName")}</Label>
              <Input placeholder={t("leads.firstName")} />
            </div>
            <div className="space-y-2">
              <Label>{t("leads.lastName")}</Label>
              <Input placeholder={t("leads.lastName")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("leads.company")}</Label>
            <Input placeholder={t("leads.company")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("leads.email")}</Label>
              <Input type="email" placeholder="email@company.com" />
            </div>
            <div className="space-y-2">
              <Label>{t("leads.phone")}</Label>
              <Input placeholder="+1 555-0100" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("leads.source")}</Label>
              <Select>
                <SelectTrigger><SelectValue placeholder={t("leads.source")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="website">{t("source.website")}</SelectItem>
                  <SelectItem value="referral">{t("source.referral")}</SelectItem>
                  <SelectItem value="linkedin">{t("source.linkedin")}</SelectItem>
                  <SelectItem value="cold-call">{t("source.coldCall")}</SelectItem>
                  <SelectItem value="event">{t("source.event")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("leads.priority")}</Label>
              <Select>
                <SelectTrigger><SelectValue placeholder={t("leads.priority")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">{t("priority.high")}</SelectItem>
                  <SelectItem value="medium">{t("priority.medium")}</SelectItem>
                  <SelectItem value="low">{t("priority.low")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("leads.notes")}</Label>
            <Textarea placeholder={t("leads.notes")} />
          </div>
          <Button className="w-full" onClick={() => onOpenChange(false)}>
            {t("leads.createLead")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
