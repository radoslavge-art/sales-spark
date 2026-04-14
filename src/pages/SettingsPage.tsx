import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useLanguage } from "@/contexts/LanguageContext";

export default function SettingsPage() {
  const { t } = useLanguage();

  const members = [
    { name: "John Doe", email: "john@company.com", roleKey: "role.admin" },
    { name: "Jane Smith", email: "jane@company.com", roleKey: "role.manager" },
    { name: "Alex Johnson", email: "alex@company.com", roleKey: "role.salesRep" },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("settings.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("settings.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">{t("settings.profile")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary text-primary-foreground text-lg">JD</AvatarFallback>
            </Avatar>
            <Button variant="outline" size="sm">{t("settings.changeAvatar")}</Button>
          </div>
          <Separator />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("settings.fullName")}</Label>
              <Input defaultValue="John Doe" />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.email")}</Label>
              <Input defaultValue="john@company.com" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("settings.role")}</Label>
            <Input value={t("role.admin")} disabled className="bg-muted" />
          </div>
          <Button>{t("settings.saveChanges")}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">{t("settings.teamMembers")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.email} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                      {member.name.split(" ").map((n) => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-foreground">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                </div>
                <span className="status-badge bg-secondary text-secondary-foreground">{t(member.roleKey)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
