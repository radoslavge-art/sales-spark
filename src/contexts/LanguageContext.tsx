import { createContext, useContext, useState } from "react";

export type Language = "en" | "bg";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Sidebar
    "nav.dashboard": "Dashboard",
    "nav.leads": "Leads",
    "nav.deals": "Deals",
    "nav.activities": "Activities",
    "nav.ai": "AI Assistant",
    "nav.settings": "Settings",
    "nav.main": "Main",
    "nav.tools": "Tools",
    "nav.signout": "Sign Out",
    "app.name": "SalesCRM",
    "app.subtitle": "Sales Platform",

    // Header
    "header.search": "Search leads, deals...",

    // Dashboard
    "dashboard.title": "Dashboard",
    "dashboard.subtitle": "Overview of your sales performance",
    "dashboard.newLeads": "New Leads",
    "dashboard.activeDeals": "Active Deals",
    "dashboard.conversionRate": "Conversion Rate",
    "dashboard.revenuePipeline": "Revenue Pipeline",
    "dashboard.vsLastMonth": "vs last month",
    "dashboard.leadPipeline": "Lead Pipeline",
    "dashboard.activityBreakdown": "Activity Breakdown",
    "dashboard.upcomingFollowups": "Upcoming Follow-ups",
    "dashboard.calls": "Calls",
    "dashboard.emails": "Emails",
    "dashboard.meetings": "Meetings",
    "dashboard.followUps": "Follow-ups",

    // Leads
    "leads.title": "Leads",
    "leads.totalLeads": "total leads",
    "leads.addLead": "Add Lead",
    "leads.searchPlaceholder": "Search by name, company, email...",
    "leads.allStatuses": "All Statuses",
    "leads.name": "Name",
    "leads.company": "Company",
    "leads.status": "Status",
    "leads.priority": "Priority",
    "leads.owner": "Owner",
    "leads.source": "Source",
    "leads.created": "Created",
    "leads.view": "View",
    "leads.edit": "Edit",
    "leads.delete": "Delete",
    "leads.createNew": "Create New Lead",
    "leads.firstName": "First Name",
    "leads.lastName": "Last Name",
    "leads.email": "Email",
    "leads.phone": "Phone",
    "leads.notes": "Notes",
    "leads.createLead": "Create Lead",
    "leads.contactHistory": "Contact History",
    "leads.noHistory": "No history recorded yet.",

    // Statuses
    "status.new": "New",
    "status.contacted": "Contacted",
    "status.qualified": "Qualified",
    "status.negotiation": "Negotiation",
    "status.won": "Won",
    "status.lost": "Lost",

    // Priority
    "priority.high": "High",
    "priority.medium": "Medium",
    "priority.low": "Low",

    // Deals
    "deals.title": "Deals",
    "deals.newDeal": "New Deal",
    "deals.searchPlaceholder": "Search deals...",
    "deals.deal": "Deal",
    "deals.lead": "Lead",
    "deals.value": "Value",
    "deals.expectedClose": "Expected Close",
    "deals.createNew": "Create New Deal",
    "deals.dealTitle": "Title",
    "deals.createDeal": "Create Deal",
    "deals.selectLead": "Select lead",
    "deals.pipeline": "Pipeline",
    "deals.won": "Won",

    // Activities
    "activities.title": "Activities",
    "activities.pending": "pending",
    "activities.completed": "completed",
    "activities.logActivity": "Log Activity",
    "activities.logNew": "Log New Activity",
    "activities.searchPlaceholder": "Search activities...",
    "activities.allTypes": "All Types",
    "activities.type": "Type",
    "activities.relatedLead": "Related Lead",
    "activities.dueDate": "Due Date & Time",
    "activities.description": "Description",
    "activities.describePlaceholder": "Describe the activity...",
    "activities.pendingSection": "Pending",
    "activities.completedSection": "Completed",
    "activities.call": "Call",
    "activities.email": "Email",
    "activities.meeting": "Meeting",
    "activities.followUp": "Follow-up",
    "activities.note": "Note",

    // AI Assistant
    "ai.title": "AI Assistant",
    "ai.subtitle": "AI-powered tools for email generation and lead analysis",
    "ai.emailGenerator": "Email Generator",
    "ai.leadAnalysis": "Lead Analysis",
    "ai.generateEmail": "Generate Email",
    "ai.generatedEmail": "Generated Email",
    "ai.selectLead": "Select lead",
    "ai.tone": "Tone",
    "ai.selectTone": "Select tone",
    "ai.formal": "Formal",
    "ai.friendly": "Friendly",
    "ai.persuasive": "Persuasive",
    "ai.additionalContext": "Additional Context",
    "ai.contextPlaceholder": "Add any specific talking points or context...",
    "ai.copy": "Copy",
    "ai.regenerate": "Regenerate",
    "ai.emptyState": "Select a lead and generate an email",
    "ai.keyInsights": "Key Insights",
    "ai.suggestedAction": "Suggested Next Action",
    "ai.aiScore": "AI Score",

    // Settings
    "settings.title": "Settings",
    "settings.subtitle": "Manage your account and preferences",
    "settings.profile": "Profile",
    "settings.changeAvatar": "Change Avatar",
    "settings.fullName": "Full Name",
    "settings.email": "Email",
    "settings.role": "Role",
    "settings.saveChanges": "Save Changes",
    "settings.teamMembers": "Team Members",

    // Login
    "login.managesPipeline": "Manage your sales pipeline",
    "login.signIn": "Sign In",
    "login.signUp": "Sign Up",
    "login.password": "Password",
    "login.forgotPassword": "Forgot password?",
    "login.fullName": "Full Name",
    "login.createAccount": "Create Account",

    // Sources
    "source.website": "Website",
    "source.referral": "Referral",
    "source.linkedin": "LinkedIn",
    "source.coldCall": "Cold Call",
    "source.event": "Event",

    // Roles
    "role.admin": "Admin",
    "role.manager": "Manager",
    "role.salesRep": "Sales Rep",
  },
  bg: {
    // Sidebar
    "nav.dashboard": "Табло",
    "nav.leads": "Потенциални клиенти",
    "nav.deals": "Сделки",
    "nav.activities": "Дейности",
    "nav.ai": "AI Асистент",
    "nav.settings": "Настройки",
    "nav.main": "Основни",
    "nav.tools": "Инструменти",
    "nav.signout": "Изход",
    "app.name": "SalesCRM",
    "app.subtitle": "Платформа за продажби",

    // Header
    "header.search": "Търсене на клиенти, сделки...",

    // Dashboard
    "dashboard.title": "Табло",
    "dashboard.subtitle": "Преглед на вашите продажби",
    "dashboard.newLeads": "Нови клиенти",
    "dashboard.activeDeals": "Активни сделки",
    "dashboard.conversionRate": "Процент конверсия",
    "dashboard.revenuePipeline": "Приходен поток",
    "dashboard.vsLastMonth": "спрямо миналия месец",
    "dashboard.leadPipeline": "Поток на клиенти",
    "dashboard.activityBreakdown": "Разпределение на дейности",
    "dashboard.upcomingFollowups": "Предстоящи последващи действия",
    "dashboard.calls": "Обаждания",
    "dashboard.emails": "Имейли",
    "dashboard.meetings": "Срещи",
    "dashboard.followUps": "Последващи",

    // Leads
    "leads.title": "Потенциални клиенти",
    "leads.totalLeads": "общо клиенти",
    "leads.addLead": "Добави клиент",
    "leads.searchPlaceholder": "Търсене по име, фирма, имейл...",
    "leads.allStatuses": "Всички статуси",
    "leads.name": "Име",
    "leads.company": "Фирма",
    "leads.status": "Статус",
    "leads.priority": "Приоритет",
    "leads.owner": "Отговорник",
    "leads.source": "Източник",
    "leads.created": "Създаден",
    "leads.view": "Преглед",
    "leads.edit": "Редактирай",
    "leads.delete": "Изтрий",
    "leads.createNew": "Създай нов клиент",
    "leads.firstName": "Име",
    "leads.lastName": "Фамилия",
    "leads.email": "Имейл",
    "leads.phone": "Телефон",
    "leads.notes": "Бележки",
    "leads.createLead": "Създай клиент",
    "leads.contactHistory": "История на контактите",
    "leads.noHistory": "Все още няма записана история.",

    // Statuses
    "status.new": "Нов",
    "status.contacted": "Контактуван",
    "status.qualified": "Квалифициран",
    "status.negotiation": "Преговори",
    "status.won": "Спечелен",
    "status.lost": "Загубен",

    // Priority
    "priority.high": "Висок",
    "priority.medium": "Среден",
    "priority.low": "Нисък",

    // Deals
    "deals.title": "Сделки",
    "deals.newDeal": "Нова сделка",
    "deals.searchPlaceholder": "Търсене на сделки...",
    "deals.deal": "Сделка",
    "deals.lead": "Клиент",
    "deals.value": "Стойност",
    "deals.expectedClose": "Очаквано приключване",
    "deals.createNew": "Създай нова сделка",
    "deals.dealTitle": "Заглавие",
    "deals.createDeal": "Създай сделка",
    "deals.selectLead": "Избери клиент",
    "deals.pipeline": "Поток",
    "deals.won": "Спечелени",

    // Activities
    "activities.title": "Дейности",
    "activities.pending": "предстоящи",
    "activities.completed": "завършени",
    "activities.logActivity": "Запиши дейност",
    "activities.logNew": "Запиши нова дейност",
    "activities.searchPlaceholder": "Търсене на дейности...",
    "activities.allTypes": "Всички типове",
    "activities.type": "Тип",
    "activities.relatedLead": "Свързан клиент",
    "activities.dueDate": "Дата и час",
    "activities.description": "Описание",
    "activities.describePlaceholder": "Опишете дейността...",
    "activities.pendingSection": "Предстоящи",
    "activities.completedSection": "Завършени",
    "activities.call": "Обаждане",
    "activities.email": "Имейл",
    "activities.meeting": "Среща",
    "activities.followUp": "Последващо",
    "activities.note": "Бележка",

    // AI Assistant
    "ai.title": "AI Асистент",
    "ai.subtitle": "Инструменти с AI за генериране на имейли и анализ на клиенти",
    "ai.emailGenerator": "Генератор на имейли",
    "ai.leadAnalysis": "Анализ на клиенти",
    "ai.generateEmail": "Генерирай имейл",
    "ai.generatedEmail": "Генериран имейл",
    "ai.selectLead": "Избери клиент",
    "ai.tone": "Тон",
    "ai.selectTone": "Избери тон",
    "ai.formal": "Формален",
    "ai.friendly": "Приятелски",
    "ai.persuasive": "Убеждаващ",
    "ai.additionalContext": "Допълнителен контекст",
    "ai.contextPlaceholder": "Добавете конкретни точки или контекст...",
    "ai.copy": "Копирай",
    "ai.regenerate": "Регенерирай",
    "ai.emptyState": "Изберете клиент и генерирайте имейл",
    "ai.keyInsights": "Ключови прозрения",
    "ai.suggestedAction": "Предложено следващо действие",
    "ai.aiScore": "AI Оценка",

    // Settings
    "settings.title": "Настройки",
    "settings.subtitle": "Управление на акаунта и предпочитанията",
    "settings.profile": "Профил",
    "settings.changeAvatar": "Смени аватар",
    "settings.fullName": "Пълно име",
    "settings.email": "Имейл",
    "settings.role": "Роля",
    "settings.saveChanges": "Запази промените",
    "settings.teamMembers": "Членове на екипа",

    // Login
    "login.managesPipeline": "Управлявайте вашите продажби",
    "login.signIn": "Вход",
    "login.signUp": "Регистрация",
    "login.password": "Парола",
    "login.forgotPassword": "Забравена парола?",
    "login.fullName": "Пълно име",
    "login.createAccount": "Създай акаунт",

    // Sources
    "source.website": "Уебсайт",
    "source.referral": "Препоръка",
    "source.linkedin": "LinkedIn",
    "source.coldCall": "Студено обаждане",
    "source.event": "Събитие",

    // Roles
    "role.admin": "Администратор",
    "role.manager": "Мениджър",
    "role.salesRep": "Търговски представител",
  },
};

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("crm-language");
    return (saved === "bg" ? "bg" : "en") as Language;
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("crm-language", lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
