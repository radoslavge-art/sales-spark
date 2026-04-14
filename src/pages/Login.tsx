import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Handshake, Globe, Moon, Sun } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Login() {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    navigate("/");
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    navigate("/");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative">
      <div className="absolute top-4 right-4 flex items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <Globe className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setLanguage("en")} className={language === "en" ? "bg-secondary" : ""}>
              🇬🇧 English
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLanguage("bg")} className={language === "bg" ? "bg-secondary" : ""}>
              🇧🇬 Български
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={toggleTheme}>
          {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>
      </div>

      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary mb-4">
            <Handshake className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">SalesCRM</h1>
          <p className="text-sm text-muted-foreground">{t("login.managesPipeline")}</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Tabs defaultValue="login">
              <TabsList className="w-full mb-6">
                <TabsTrigger value="login" className="flex-1">{t("login.signIn")}</TabsTrigger>
                <TabsTrigger value="register" className="flex-1">{t("login.signUp")}</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t("settings.email")}</Label>
                    <Input type="email" placeholder="you@company.com" required />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("login.password")}</Label>
                    <Input type="password" placeholder="••••••••" required />
                  </div>
                  <Button type="submit" className="w-full">{t("login.signIn")}</Button>
                  <p className="text-center text-xs text-muted-foreground">
                    <a href="#" className="text-primary hover:underline">{t("login.forgotPassword")}</a>
                  </p>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t("login.fullName")}</Label>
                    <Input placeholder="John Doe" required />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("settings.email")}</Label>
                    <Input type="email" placeholder="you@company.com" required />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("login.password")}</Label>
                    <Input type="password" placeholder="••••••••" required />
                  </div>
                  <Button type="submit" className="w-full">{t("login.createAccount")}</Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
