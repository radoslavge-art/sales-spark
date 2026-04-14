import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Handshake, TrendingUp, Phone, Mail, Calendar, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";

const PIE_COLORS = [
  "hsl(217, 91%, 50%)",
  "hsl(262, 83%, 58%)",
  "hsl(142, 71%, 45%)",
  "hsl(45, 93%, 47%)",
];

export default function Dashboard() {
  const { t } = useLanguage();

  const kpis = [
    { title: t("dashboard.newLeads"), value: "127", change: "+12%", up: true, icon: Users },
    { title: t("dashboard.activeDeals"), value: "43", change: "+8%", up: true, icon: Handshake },
    { title: t("dashboard.conversionRate"), value: "24%", change: "+3%", up: true, icon: TrendingUp },
    { title: t("dashboard.revenuePipeline"), value: "$284K", change: "-2%", up: false, icon: TrendingUp },
  ];

  const pipelineData = [
    { name: t("status.new"), count: 42 },
    { name: t("status.contacted"), count: 31 },
    { name: t("status.qualified"), count: 24 },
    { name: t("status.negotiation"), count: 18 },
    { name: t("status.won"), count: 12 },
  ];

  const pieData = [
    { name: t("dashboard.calls"), value: 45 },
    { name: t("dashboard.emails"), value: 32 },
    { name: t("dashboard.meetings"), value: 15 },
    { name: t("dashboard.followUps"), value: 28 },
  ];

  const upcomingFollowups = [
    { name: "Sarah Chen", company: "TechCorp", date: "Today, 2:00 PM", type: "Call" },
    { name: "Mike Ross", company: "FinServe", date: "Today, 4:30 PM", type: "Meeting" },
    { name: "Lisa Wang", company: "DataFlow", date: "Tomorrow, 10:00 AM", type: "Email" },
    { name: "James Hart", company: "CloudBase", date: "Tomorrow, 1:00 PM", type: "Follow-up" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("dashboard.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="kpi-card">
            <CardContent className="p-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{kpi.title}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{kpi.value}</p>
                  <div className="flex items-center mt-1 gap-1">
                    {kpi.up ? (
                      <ArrowUpRight className="h-3 w-3 text-success" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 text-destructive" />
                    )}
                    <span className={`text-xs font-medium ${kpi.up ? "text-success" : "text-destructive"}`}>
                      {kpi.change}
                    </span>
                    <span className="text-xs text-muted-foreground">{t("dashboard.vsLastMonth")}</span>
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <kpi.icon className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-medium">{t("dashboard.leadPipeline")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={pipelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="count" fill="hsl(217, 91%, 50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">{t("dashboard.activityBreakdown")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((_, index) => (
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {pieData.map((item, i) => (
                <div key={item.name} className="flex items-center gap-2 text-xs">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: PIE_COLORS[i] }}
                  />
                  <span className="text-muted-foreground">{item.name}</span>
                  <span className="font-medium text-foreground ml-auto">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">{t("dashboard.upcomingFollowups")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {upcomingFollowups.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-secondary/50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                    {item.type === "Call" && <Phone className="h-4 w-4 text-primary" />}
                    {item.type === "Email" && <Mail className="h-4 w-4 text-primary" />}
                    {item.type === "Meeting" && <Calendar className="h-4 w-4 text-primary" />}
                    {item.type === "Follow-up" && <TrendingUp className="h-4 w-4 text-primary" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.company}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-foreground">{item.date}</p>
                  <p className="text-xs text-muted-foreground">{item.type}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
