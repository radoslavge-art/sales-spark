import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Mail, Brain, Copy, RefreshCw, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const sampleEmailOutput = `Subject: Exploring Partnership Opportunities with TechCorp

Hi Sarah,

I hope this message finds you well. I recently came across TechCorp's impressive growth in the cloud infrastructure space, and I believe there's a strong alignment between our solutions and your team's goals.

We've helped similar companies in the tech sector streamline their operations and achieve 30% faster deployment cycles. I'd love to share some insights and explore how we might support TechCorp's next phase of growth.

Would you be open to a brief 15-minute call this week? I'm flexible on timing and happy to work around your schedule.

Looking forward to connecting!

Best regards,
John Doe
Sales Representative`;

const leadInsights = [
  {
    name: "Sarah Chen",
    company: "TechCorp",
    priority: "High",
    score: 87,
    insights: [
      "High engagement — opened last 3 emails",
      "Company recently secured Series B funding",
      "Decision maker with budget authority",
    ],
    nextAction: "Schedule a product demo call this week",
  },
  {
    name: "Mike Ross",
    company: "FinServe",
    priority: "Medium",
    score: 62,
    insights: [
      "Moderate response rate to outreach",
      "Currently evaluating 2 competing solutions",
      "Budget cycle renews in Q2",
    ],
    nextAction: "Send competitive comparison document",
  },
  {
    name: "Lisa Wang",
    company: "DataFlow",
    priority: "High",
    score: 91,
    insights: [
      "Actively looking for solutions — submitted inquiry",
      "Fast-growing company (200% YoY)",
      "Strong fit with our enterprise tier",
    ],
    nextAction: "Fast-track to proposal stage",
  },
];

const priorityColors: Record<string, string> = {
  High: "text-destructive bg-destructive/10",
  Medium: "text-warning bg-warning/10",
  Low: "text-muted-foreground bg-muted",
};

export default function AIAssistant() {
  const [emailGenerated, setEmailGenerated] = useState(false);
  const { t } = useLanguage();

  const priorityKeys: Record<string, string> = {
    High: "priority.high",
    Medium: "priority.medium",
    Low: "priority.low",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("ai.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("ai.subtitle")}</p>
      </div>

      <Tabs defaultValue="email" className="space-y-4">
        <TabsList>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" /> {t("ai.emailGenerator")}
          </TabsTrigger>
          <TabsTrigger value="analysis" className="gap-2">
            <Brain className="h-4 w-4" /> {t("ai.leadAnalysis")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {t("ai.generateEmail")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("deals.lead")}</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder={t("ai.selectLead")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Sarah Chen - TechCorp</SelectItem>
                      <SelectItem value="2">Mike Ross - FinServe</SelectItem>
                      <SelectItem value="3">Lisa Wang - DataFlow</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("ai.tone")}</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder={t("ai.selectTone")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="formal">{t("ai.formal")}</SelectItem>
                      <SelectItem value="friendly">{t("ai.friendly")}</SelectItem>
                      <SelectItem value="persuasive">{t("ai.persuasive")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("ai.additionalContext")}</Label>
                  <Textarea placeholder={t("ai.contextPlaceholder")} rows={4} />
                </div>
                <Button className="w-full" onClick={() => setEmailGenerated(true)}>
                  <Sparkles className="mr-2 h-4 w-4" /> {t("ai.generateEmail")}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">{t("ai.generatedEmail")}</CardTitle>
              </CardHeader>
              <CardContent>
                {emailGenerated ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border bg-secondary/30 p-4">
                      <pre className="whitespace-pre-wrap text-sm text-foreground font-sans">
                        {sampleEmailOutput}
                      </pre>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Copy className="mr-2 h-3 w-3" /> {t("ai.copy")}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setEmailGenerated(false)}>
                        <RefreshCw className="mr-2 h-3 w-3" /> {t("ai.regenerate")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <Mail className="h-10 w-10 mb-3 opacity-30" />
                    <p className="text-sm">{t("ai.emptyState")}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <div className="grid gap-4">
            {leadInsights.map((lead) => (
              <Card key={lead.name} className="transition-shadow hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-medium text-foreground">{lead.name}</h3>
                      <p className="text-sm text-muted-foreground">{lead.company}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`status-badge ${priorityColors[lead.priority]}`}>
                        {t(priorityKeys[lead.priority])}
                      </span>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-primary">{lead.score}</p>
                        <p className="text-xs text-muted-foreground">{t("ai.aiScore")}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t("ai.keyInsights")}
                    </p>
                    {lead.insights.map((insight, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <Brain className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                        <span>{insight}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 rounded-lg bg-primary/5 p-3">
                    <ArrowRight className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-primary">{t("ai.suggestedAction")}</p>
                      <p className="text-sm text-foreground">{lead.nextAction}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
