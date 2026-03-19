"use client";

import Link from "next/link";
import { 
  ShieldCheck, 
  MapPin, 
  FileText, 
  RefreshCw, 
  LifeBuoy, 
  Clock, 
  CheckCircle2,
  TrendingDown,
  CloudLightning,
  AlertTriangle,
  History,
  Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FadeUp, StaggeredFadeUp } from "@/components/animated/FadeUp";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip, CartesianGrid } from "recharts";
import { useState, useEffect } from "react";

const WEAKLY_EARNINGS = [
  { day: "Mon", income: 800, protection: 800 },
  { day: "Tue", income: 1100, protection: 1100 },
  { day: "Wed", income: 400, protection: 800 }, // Disruption day
  { day: "Thu", income: 950, protection: 950 },
  { day: "Fri", income: 1200, protection: 1200 },
  { day: "Sat", income: 1500, protection: 1500 },
  { day: "Sun", income: 0, protection: 0 },
];

export default function DashboardPage() {
  const [user, setUser] = useState({ name: "Rahul", city: "Bengaluru", zone: "Koramangala" });
  const [plan, setPlan] = useState({ name: "Shield Plus", price: 85, cap: 4500, triggers: "Heavy Rain, Flood, AQI, Zone Shutdown" });

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('shieldpay_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        setUser({ 
          name: parsed.name.split(' ')[0],
          city: parsed.city,
          zone: parsed.zone
        });
      }
      const storedPlan = localStorage.getItem('shieldpay_plan');
      if (storedPlan) {
        setPlan(JSON.parse(storedPlan));
      }
    } catch(e) {}
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900">ShieldPay</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/claims" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">Claims</Link>
            <Link href="/settings" className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-700">
              {user.name.charAt(0)}
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 mt-8">
        
        {/* Welcome Section */}
        <FadeUp className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">Welcome back, {user.name}</h1>
            <p className="text-slate-500 mt-1 flex items-center gap-1.5 font-medium">
              <MapPin className="w-4 h-4" /> {user.city}, {user.zone}
            </p>
          </div>
          <div className="flex gap-3">
             <Button variant="outline" className="bg-white border-slate-200 text-slate-700 shadow-sm rounded-xl h-10 px-4">
               <RefreshCw className="w-4 h-4 mr-2" /> Renew Plan
             </Button>
             <Link href="/claims">
               <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-600/20 rounded-xl h-10 px-4">
                 File Claim
               </Button>
             </Link>
          </div>
        </FadeUp>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Content Area (Left 2 columns) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Active Plan Card */}
            <FadeUp delay={0.1}>
              <div className="subtle-card bg-white p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6">
                  <Badge className="bg-green-100 text-green-700 border-0 hover:bg-green-200 text-sm px-3 py-1 font-bold">Active</Badge>
                </div>
                
                <h2 className="text-xl font-bold text-slate-900 mb-1">{plan.name}</h2>
                <div className="text-sm text-slate-500 font-medium mb-6">₹{plan.price}/week • Renews Dec 28, 2026</div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 border border-blue-100 p-4 rounded-xl shadow-sm">
                    <div className="text-xs text-blue-600 font-semibold mb-1 uppercase tracking-wider">Weekly Premium</div>
                    <div className="font-bold text-slate-900 text-lg">₹{plan.price}</div>
                  </div>
                  <div className="bg-gradient-to-br from-slate-50 to-emerald-50/30 border border-emerald-100 p-4 rounded-xl shadow-sm">
                    <div className="text-xs text-emerald-600 font-semibold mb-1 uppercase tracking-wider">Max Payout Cap</div>
                    <div className="font-bold text-slate-900 text-lg">₹{plan.cap}</div>
                  </div>
                  <div className="bg-slate-50/80 border border-slate-200 p-4 rounded-xl sm:col-span-2 shadow-sm flex flex-col justify-center">
                    <div className="text-xs text-slate-600 font-semibold mb-1 uppercase tracking-wider">Covered Triggers</div>
                    <div className="font-semibold text-slate-900 text-sm leading-tight mt-1 truncate">
                      {plan.triggers}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-2 font-medium">
                    <span className="text-slate-700">Protected Earnings this Week</span>
                    <span className="text-blue-600 font-bold">₹{plan.cap} / ₹{plan.cap}</span>
                  </div>
                  <Progress value={100} className="h-2 bg-slate-100 [&>div]:bg-blue-600" />
                </div>
              </div>
            </FadeUp>

            {/* Income Protection Chart */}
            <FadeUp delay={0.2}>
              <div className="subtle-card bg-white p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-lg text-slate-900">Income Protection Overview</h3>
                  <Badge variant="outline" className="text-slate-500 border-slate-200 font-medium">This Week</Badge>
                </div>
                
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={WEAKLY_EARNINGS} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                      <RechartsTooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="income" name="Actual Earnings" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={24} />
                      <Bar dataKey="protection" name="ShieldPay Top-up" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="mt-4 flex items-start gap-3 bg-blue-50 border border-blue-100 p-4 rounded-xl">
                  <Activity className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-slate-700">
                    <span className="font-bold text-blue-900">Wednesday disrupted:</span> Your earnings dipped due to heavy rain in {user.zone}. ShieldPay automatically calculated a ₹400 top-up to match your protected baseline.
                  </p>
                </div>
              </div>
            </FadeUp>

          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            
            {/* Quick Actions */}
            <FadeUp delay={0.3}>
              <div className="subtle-card bg-white p-6">
                <h3 className="font-bold text-slate-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" className="h-auto py-3 flex flex-col items-center justify-center gap-2 bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span className="text-xs transition-none font-semibold">View Policy</span>
                  </Button>
                  <Button variant="outline" className="h-auto py-3 flex flex-col items-center justify-center gap-2 bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700">
                    <History className="w-5 h-5 text-blue-600" />
                    <span className="text-xs font-semibold">History</span>
                  </Button>
                  <Link href="/claims">
                    <Button variant="outline" className="w-full h-auto py-3 flex flex-col items-center justify-center gap-2 bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700">
                      <TrendingDown className="w-5 h-5 text-red-500" />
                      <span className="text-xs font-semibold">Claims</span>
                    </Button>
                  </Link>
                  <Link href="/settings">
                    <Button variant="outline" className="w-full h-auto py-3 flex flex-col items-center justify-center gap-2 bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700">
                      <LifeBuoy className="w-5 h-5 text-slate-500" />
                      <span className="text-xs font-semibold">Support</span>
                    </Button>
                  </Link>
                </div>
              </div>
            </FadeUp>

            {/* Claim Status Timeline */}
            <FadeUp delay={0.4}>
              <div className="subtle-card bg-white p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-slate-900">Active Claim</h3>
                  <Link href="/claims" className="text-xs font-bold text-blue-600 hover:underline">View All</Link>
                </div>

                <div className="mb-4">
                  <div className="font-bold text-slate-900 text-sm">Heavy Rain - {user.zone}</div>
                  <div className="text-xs text-slate-500 font-medium">CLM-98201 • Wed, 4:30 PM</div>
                </div>

                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                   
                   <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active hover:scale-[1.02] transition-transform">
                     <div className="flex items-center justify-center w-6 h-6 rounded-full border border-white bg-blue-100 text-blue-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10 ms-0 md:ms-auto">
                        <CheckCircle2 className="w-4 h-4" />
                     </div>
                     <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] px-4 py-3 border border-slate-200 shadow-sm rounded-xl bg-white text-sm">
                       <div className="font-bold text-slate-900">Trigger Detected</div>
                     </div>
                   </div>
                   
                   <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active hover:scale-[1.02] transition-transform">
                     <div className="flex items-center justify-center w-6 h-6 rounded-full border border-white bg-blue-600 text-white shadow-md shadow-blue-600/30 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10 ms-0 md:ms-auto">
                        <Clock className="w-3 h-3 animate-spin-slow" />
                     </div>
                     <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] px-4 py-3 border border-blue-200 shadow-sm shadow-blue-100 rounded-xl bg-blue-50 text-sm">
                       <div className="font-bold text-blue-900">Under Review</div>
                       <div className="text-xs text-blue-700 font-medium mt-0.5">Assessing severity...</div>
                     </div>
                   </div>

                   <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                     <div className="flex items-center justify-center w-6 h-6 rounded-full border border-white bg-slate-100 text-slate-400 shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10 ms-0 md:ms-auto">
                        <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                     </div>
                     <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] px-4 py-3 border border-slate-100 opacity-60 rounded-xl bg-slate-50 text-sm">
                       <div className="font-bold text-slate-500">Payout Initiated</div>
                     </div>
                   </div>

                </div>
              </div>
            </FadeUp>

          </div>
        </div>
      </main>
    </div>
  );
}
