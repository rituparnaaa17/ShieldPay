"use client";

import Link from "next/link";
import { 
  ArrowRight,
  Bell,
  ShieldCheck, 
  Search,
  MapPin, 
  FileText, 
  RefreshCw, 
  LifeBuoy, 
  Clock, 
  CheckCircle2,
  TrendingDown,
  CloudRainWind,
  AlertTriangle,
  History,
  Activity,
  MapPinned,
  MessageCircle,
  Wallet,
  Sparkles,
  Gauge,
  CircleDashed,
  ArrowUpRight,
  Zap,
  ShieldAlert,
  BarChart3,
  SlidersHorizontal,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FadeUp, StaggeredFadeUp, HoverLift } from "@/components/animated/FadeUp";
import { HeroBackground } from "@/components/animated/HeroBackground";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip, CartesianGrid } from "recharts";
import { useState, useEffect } from "react";
import { earningsChartData } from "@/data/mock";
import { apiUrl } from "@/lib/api";

const sidebarLinks = [
  { href: "/dashboard", label: "Home", icon: Activity, active: true },
  { href: "/plans", label: "My Policy", icon: ShieldCheck },
  { href: "/claims", label: "Payouts", icon: Wallet },
  { href: "/zone-map", label: "Zone Map", icon: MapPinned },
  { href: "/settings", label: "Settings", icon: SlidersHorizontal },
];



const platformCards = [
  { name: "Swiggy", amount: "₹2,100", last: "Last: 2:30 PM", tone: "from-sky-50 to-sky-100/70" },
  { name: "Zomato", amount: "₹1,680", last: "Last: 1:20 PM", tone: "from-indigo-50 to-blue-100/70" },
  { name: "Zepto", amount: "₹840", last: "Last: 7:10 Weds", tone: "from-cyan-50 to-blue-50/70" },
];

const weeklyEarnings = earningsChartData.map((item, index) => ({
  day: item.day,
  income: item.earnings,
  protection: index === 4 || index === 5 || index === 6 ? 0 : item.earnings,
}));

const TIER_TO_NAME: Record<string, string> = {
  basic: "Basic Protection",
  standard: "Shield Plus",
  premium: "Max Pro",
};

const fmtDate = (iso?: string) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso; }
};

export default function DashboardPage() {
  const [liveTrigger, setLiveTrigger] = useState<any>(null);
  const [user, setUser] = useState({
    id: "",
    name: "Rahul",
    city: "Bengaluru",
    zone: "Koramangala",
  });
  const [plan, setPlan] = useState({
    name: "Shield Plus",
    price: 85,
    cap: 4500,
    triggers: "Heavy Rain, Flood",
    renewalDate: "Dec 12, 2026",
  });
  const [searchValue, setSearchValue] = useState("");
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    let userZone = "Koramangala";
    let userId = "";

    try {
      const storedUser = localStorage.getItem('shieldpay_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        userId = parsed.id || "";
        userZone = parsed.zone || "Koramangala";
        setUser({
          id: userId,
          name: String(parsed.name || "Rahul").split(' ')[0],
          city: parsed.city || "Bengaluru",
          zone: parsed.zone || "Koramangala",
        });
      }

      // Load cached plan first for instant display
      const storedPlan = localStorage.getItem('shieldpay_plan');
      if (storedPlan) {
        const parsedPlan = JSON.parse(storedPlan);
        setPlan((current) => ({
          ...current,
          name: parsedPlan.name || current.name,
          price: Number(parsedPlan.price ?? current.price),
          cap: Number(parsedPlan.cap ?? current.cap),
          triggers: parsedPlan.triggers || current.triggers,
          renewalDate: parsedPlan.renewalDate || current.renewalDate,
        }));
      }
    } catch (e) { /* ignore */ }

    // Fetch live policy from backend and override
    if (userId) {
      fetch(apiUrl(`/api/policies/${userId}`))
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data && data.data.length > 0) {
            const p = data.data[0];
            const tier = p.planTier || "standard";
            const triggers = Array.isArray(p.coverageTriggers)
              ? p.coverageTriggers.join(", ")
              : typeof p.coverageTriggers === "string"
              ? p.coverageTriggers
              : "Heavy Rain, Flood";

            const livePolicy = {
              name: TIER_TO_NAME[tier] || "Shield Plus",
              price: Number(p.finalPremium ?? 85),
              cap: Number(p.coverageAmount ?? 4500),
              triggers,
              renewalDate: fmtDate(p.validUntil) || "Dec 12, 2026",
            };

            setPlan(livePolicy);

            // Sync to localStorage
            const existing = JSON.parse(localStorage.getItem('shieldpay_plan') || '{}');
            localStorage.setItem('shieldpay_plan', JSON.stringify({
              ...existing,
              ...livePolicy,
              planTier: tier,
              policyNumber: p.policyNumber || existing.policyNumber || "",
              validFrom: p.validFrom || existing.validFrom || "",
              validUntil: p.validUntil || existing.validUntil || "",
              city: p.city || existing.city || "",
              zone: p.zoneName || existing.zone || "",
            }));
          }
        })
        .catch((err) => console.error("Policy fetch error:", err));
    }

    // Fetch active live trigger for user's zone
    fetch(apiUrl("/api/triggers/active"))
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data && data.data.length > 0) {
          const zoneName = userZone || "Koramangala";
          const active = data.data.find((t: any) => t.zone_name === zoneName);
          if (active) {
            setLiveTrigger({
              id: active.trigger_id || active.id,
              type: active.trigger_type,
              city: active.city || zoneName,
              zone: active.zone_name || zoneName,
              severity: active.severity_score || active.severity,
              status: active.status,
            });
          } else {
            setLiveTrigger(null);
          }
        }
      })
      .catch((err) => console.error("Trigger fetch error:", err));
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(191,219,254,0.45),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(219,234,254,0.35),_transparent_26%),linear-gradient(180deg,_#eff6ff_0%,_#f8fbff_30%,_#f6f9ff_100%)] text-slate-900">
      <HeroBackground />

      <div className="mx-auto flex min-h-screen max-w-[1720px] gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <aside className="hidden xl:flex w-[280px] shrink-0 flex-col rounded-[2rem] border border-white/70 bg-white/80 p-5 shadow-[0_24px_70px_-24px_rgba(15,23,42,0.18)] backdrop-blur-xl">
          <div className="flex items-center gap-3 pb-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-600/25">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-lg font-black tracking-tight text-slate-900">ShieldPay</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Income protection</p>
            </div>
          </div>

          <div className="space-y-2">
            {sidebarLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all ${
                    item.active
                      ? "bg-slate-900 text-white shadow-lg shadow-slate-900/15"
                      : "text-slate-600 hover:bg-blue-50 hover:text-slate-900"
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                  {item.label}
                </Link>
              );
            })}
          </div>


        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-5 pb-8">
          <div className="xl:hidden flex items-center justify-between rounded-[1.6rem] border border-white/70 bg-white/80 px-4 py-3 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.18)] backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-600/25">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-black tracking-tight text-slate-900">ShieldPay</p>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Dashboard</p>
              </div>
            </div>
            <Link href="/settings" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
              {user.name.charAt(0)}
            </Link>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4 rounded-[2rem] border border-white/70 bg-white/80 px-5 py-5 shadow-[0_24px_70px_-26px_rgba(15,23,42,0.16)] backdrop-blur-xl sm:px-6">
            <FadeUp className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">
                <Zap className="h-4 w-4" /> Live coverage
              </div>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                Hello, {user.name}!
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-600 sm:text-base">
                Your policy and payout updates stay in one calm, readable workspace. Coverage is active for {user.city}, {user.zone}.
              </p>
            </FadeUp>

            <div className="flex w-full max-w-2xl flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 shadow-sm">
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Search payouts, zones, claims..."
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
              </div>
              <div className="flex items-center gap-3 self-end sm:self-auto">
                <button className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-600">
                  <Bell className="h-5 w-5" />
                  <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-white bg-rose-500" />
                </button>
                <Link href="/settings" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white shadow-lg shadow-slate-900/20">
                  {user.name.charAt(0)}
                </Link>
              </div>
            </div>
          </div>

          <div className="xl:hidden flex gap-2 overflow-x-auto pb-1">
            {sidebarLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all ${
                    item.active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="flex flex-col gap-5">
            <div className="space-y-5 min-w-0">
              <FadeUp>
                <div className="relative overflow-hidden rounded-[2rem] border border-blue-100/80 bg-gradient-to-br from-blue-200 via-indigo-200 to-slate-100 p-6 shadow-[0_28px_80px_-36px_rgba(37,99,235,0.45)] sm:p-7">
                  <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/30 blur-3xl" />
                  <div className="pointer-events-none absolute -bottom-16 right-8 h-56 w-56 rounded-full bg-blue-600/10 blur-3xl" />

                  <div className="relative z-10 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.9fr)]">
                    <div>
                      {liveTrigger ? (
                        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/65 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm backdrop-blur mb-5">
                          <CloudRainWind className="h-4 w-4" /> {liveTrigger.type} detected in {liveTrigger.city} ({liveTrigger.severity}/100)
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/65 px-3 py-1.5 text-xs font-semibold text-slate-500 shadow-sm backdrop-blur mb-5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Normal conditions in {user.zone}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-slate-600">Today&apos;s Earnings</p>
                        <div className="mt-1 text-5xl font-black tracking-tight text-slate-900 sm:text-6xl">₹480</div>
                        <p className="mt-2 text-sm font-semibold text-slate-600">Expected today: ₹740</p>
                      </div>

                      <div className="mt-6">
                        <div className="mb-2 flex items-center justify-between text-sm font-medium text-slate-700">
                          <span>Daily target progress</span>
                          <span className="font-bold text-blue-700">65% of daily target • ₹260 shortfall</span>
                        </div>
                        <Progress value={65} className="h-2.5 bg-white/60 [&>div]:bg-slate-900" />
                      </div>

                      <div className="mt-6 flex flex-wrap gap-3">
                        <button
                          onClick={() => setIsPaused(!isPaused)}
                          className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/60 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white"
                        >
                          <CircleDashed className={`h-4 w-4 ${isPaused ? 'text-amber-500' : 'text-blue-600'}`} />
                          {isPaused ? "Resume Plan" : "Pause Plan"}
                        </button>
                        <Link
                          href="/plans"
                          className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/60 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white"
                        >
                          <FileText className="h-4 w-4 text-blue-600" />
                          My Policy
                        </Link>
                      </div>
                    </div>

                    <div className="rounded-[1.75rem] border border-white/70 bg-white/75 p-5 shadow-lg shadow-blue-900/5 backdrop-blur-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-500">Policy status</p>
                          <p className={`mt-1 text-2xl font-black tracking-tight ${isPaused ? 'text-amber-600' : 'text-slate-900'}`}>
                            {isPaused ? 'Paused' : 'Active'}
                          </p>
                        </div>
                        <Badge className={`rounded-full px-3 py-1.5 ${isPaused ? 'bg-amber-100 text-amber-700 hover:bg-amber-100' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'}`}>
                          {isPaused ? 'Suspended' : 'Live'}
                        </Badge>
                      </div>

                      <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Weekly Premium</p>
                            <p className="mt-1 text-2xl font-black text-slate-900">₹{plan.price}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Payout Cap</p>
                            <p className="mt-1 text-2xl font-black text-slate-900">₹{plan.cap}</p>
                          </div>
                        </div>
                        <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Covered triggers</p>
                          <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{plan.triggers}</p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-blue-50 p-4 sm:col-span-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">Renewal</p>
                          <p className="mt-1 text-sm font-bold text-slate-900">{plan.renewalDate}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </FadeUp>

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              {liveTrigger && (
                <FadeUp delay={0.08}>
                  <div className="rounded-[1.9rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_60px_-28px_rgba(15,23,42,0.16)] backdrop-blur-xl">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">Live trigger</p>
                        <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">{liveTrigger.type} in {user.zone}</h2>
                      </div>
                      <Badge className="rounded-full bg-rose-100 px-3 py-1.5 text-rose-700 hover:bg-rose-100">LIVE</Badge>
                    </div>

                    <div className="mt-4 rounded-3xl border border-rose-100 bg-gradient-to-r from-rose-50 to-white p-5">
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-rose-500 shadow-sm">
                          <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-700">Disruption score {liveTrigger.severity}/100</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            Payout is being calculated automatically based on work hours and policy coverage.
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-500">
                        <span>Eligibility scan</span>
                        <span>Under review</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-rose-100">
                        <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-rose-400 to-blue-500" />
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {[
                        { label: "Eligible policies", value: "18", accent: "text-blue-600" },
                        { label: "Auto claims created", value: "4", accent: "text-slate-900" },
                        { label: "Fraud checks passed", value: "94%", accent: "text-emerald-600" },
                        { label: "Avg. payout delay", value: "< 2 min", accent: "text-indigo-600" },
                      ].map((item) => (
                        <div key={item.label} className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{item.label}</p>
                          <p className={`mt-2 text-2xl font-black ${item.accent}`}>{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </FadeUp>
              )}


              </div>

              <FadeUp delay={0.16}>
                <div className="rounded-[1.9rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_60px_-28px_rgba(15,23,42,0.16)] backdrop-blur-xl">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">Earnings protection</p>
                      <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">Weekly income overview</h3>
                    </div>
                    <Badge variant="outline" className="rounded-full border-slate-200 bg-white text-slate-500">
                      This week
                    </Badge>
                  </div>

                  <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                    <div className="rounded-[1.7rem] bg-slate-50 p-4">
                      <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={weeklyEarnings} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                            <RechartsTooltip
                              cursor={{ fill: '#eff6ff' }}
                              contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 16px 40px -20px rgb(15 23 42 / 0.35)' }}
                            />
                            <Bar dataKey="income" name="Actual earnings" fill="#cbd5e1" radius={[8, 8, 0, 0]} barSize={20} />
                            <Bar dataKey="protection" name="ShieldPay coverage" fill="#2563eb" radius={[8, 8, 0, 0]} barSize={20} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-[1.6rem] border border-blue-100 bg-blue-50/70 p-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
                            <Activity className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">Wednesday disrupted</p>
                            <p className="text-sm text-slate-600">Heavy rain in {user.zone} lowered earnings; ShieldPay topped up the gap automatically.</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[1.6rem] bg-slate-50 p-5">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-500">Protection ratio</p>
                          <p className="text-sm font-bold text-blue-600">{Math.round((840 / 4930) * 100)}%</p>
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-slate-200">
                          <div className="h-2 w-[72%] rounded-full bg-gradient-to-r from-blue-600 to-indigo-500" />
                        </div>
                        <p className="mt-3 text-xs leading-5 text-slate-500">Your protected baseline helps keep the payout experience predictable and easy to read.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </FadeUp>




            </div>

            <div className="space-y-5 min-w-0">



            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
