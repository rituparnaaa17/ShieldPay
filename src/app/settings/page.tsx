"use client";

import Link from "next/link";
import { 
  ArrowLeft, 
  User, 
  ShieldCheck, 
  Wallet, 
  Bell, 
  LifeBuoy,
  LogOut,
  ChevronRight,
  Settings,
  Mail
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeUp, StaggeredFadeUp } from "@/components/animated/FadeUp";
import { currentUser } from "@/data/mock";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState({ name: "Rahul Kumar", phone: "+91 98765 43210", platform: "Zomato", zone: "Koramangala" });

  useEffect(() => {
    try {
      const stored = localStorage.getItem('shieldpay_user');
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch(e) {}
  }, []);

  const SETTING_GROUPS = [
    {
      title: "Account Information",
      icon: <User className="w-5 h-5 text-blue-600" />,
      items: [
        { label: "Phone Number", value: user.phone },
        { label: "Email Address", value: "rahul.kumar@gmail.com" },
        { label: "Connected Platform", value: user.platform },
      ]
    },
    {
      title: "Coverage Settings",
      icon: <ShieldCheck className="w-5 h-5 text-blue-600" />,
      items: [
        { label: "Active Plan", value: "Shield Plus" },
        { label: "Primary Zone", value: user.zone },
        { label: "Auto-Renewal", value: "Enabled" },
      ]
    },
    {
      title: "Payout Preferences",
      icon: <Wallet className="w-5 h-5 text-blue-600" />,
      items: [
        { label: "Primary UPI ID", value: "rahul.k@paytm" },
        { label: "Backup Bank Account", value: "HDFC ****1942" },
        { label: "Payout Frequency", value: "Instant via RTGS" },
      ]
    },
    {
      title: "Alerts & Notifications",
      icon: <Bell className="w-5 h-5 text-blue-600" />,
      items: [
        { label: "Weather Warnings", value: "SMS & WhatsApp" },
        { label: "Claim Updates", value: "SMS Only" },
        { label: "Weekly Summary", value: "Email" },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-10 px-6 pb-20">
      <div className="container mx-auto max-w-3xl">
        <Link href="/dashboard" className="inline-flex items-center text-slate-500 hover:text-blue-600 mb-8 transition-colors text-sm font-medium">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
        </Link>
        
        <FadeUp className="mb-8">
           <h1 className="text-3xl font-extrabold mb-8 text-slate-900">Profile & Settings</h1>
        </FadeUp>

        {/* Profile Header Card */}
        <FadeUp delay={0.1}>
           <div className="subtle-card bg-white p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-8 border border-slate-200">
             
             <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                 <span className="font-bold text-2xl text-slate-500">{user.name.charAt(0)}</span>
             </div>
             
             <div className="text-center sm:text-left flex-1">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                 <div>
                   <h2 className="text-2xl font-bold text-slate-900">{user.name}</h2>
                   <p className="text-slate-500 font-medium">Joined {new Date(currentUser.joinedDate).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
                 </div>
                 <Button variant="outline" size="sm" className="bg-white border-slate-200 text-slate-700 shadow-sm self-center sm:self-start">
                    Edit Profile
                 </Button>
               </div>
             </div>
           </div>
        </FadeUp>

        {/* Settings List */}
        <StaggeredFadeUp delay={0.2} staggerDelay={0.05} className="space-y-6 mb-12">
          {SETTING_GROUPS.map((group, idx) => (
             <div key={idx} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
               <div className="bg-slate-50 px-6 py-4 flex items-center gap-3 border-b border-slate-200">
                 <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm border border-slate-100">
                    {group.icon}
                 </div>
                 <h3 className="font-bold text-slate-900">{group.title}</h3>
               </div>
               <div className="divide-y divide-slate-100">
                 {group.items.map((item, i) => (
                   <div key={i} className="px-6 py-4 flex justify-between items-center bg-white hover:bg-slate-50 transition-colors cursor-pointer group">
                     <span className="text-slate-600 font-medium">{item.label}</span>
                     <div className="flex items-center gap-2">
                       <span className="font-semibold text-sm text-slate-900 text-right">{item.value}</span>
                       <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
                     </div>
                   </div>
                 ))}
               </div>
             </div>
          ))}
        </StaggeredFadeUp>
        
        {/* Support & Logout */}
        <FadeUp delay={0.4} className="flex flex-col sm:flex-row gap-4">
           <div className="flex-1 subtle-card bg-white p-6 flex flex-col items-center text-center justify-center cursor-pointer group hover:border-blue-200">
             <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
               <LifeBuoy className="w-6 h-6 text-blue-600" />
             </div>
             <h4 className="font-bold text-slate-900 mb-1">Help & Support</h4>
             <p className="text-xs text-slate-500 mb-4">Contact our team for claim assistance</p>
             <Button variant="outline" className="w-full bg-white shadow-sm border-slate-200 text-slate-800">Contact Us</Button>
           </div>
           
           <div className="flex-1 subtle-card bg-white p-6 flex flex-col items-center text-center justify-center cursor-pointer group hover:border-red-100">
             <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4 group-hover:bg-red-100 transition-colors">
               <LogOut className="w-6 h-6 text-red-600" />
             </div>
             <h4 className="font-bold text-slate-900 mb-1">Sign Out</h4>
             <p className="text-xs text-slate-500 mb-4">Securely log out of ShieldPay</p>
             <Button variant="outline" className="w-full bg-white shadow-sm border-slate-200 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => router.push("/")}>Log Out</Button>
           </div>
        </FadeUp>

        <div className="mt-12 text-center pb-8 border-t border-slate-200 pt-8">
           <div className="flex items-center justify-center gap-2 text-slate-400 font-medium text-xs mb-2">
             <ShieldCheck className="w-4 h-4" /> ShieldPay — Your Insurance Partner
           </div>
           <p className="text-xs text-slate-400">Version 1.0.0</p>
        </div>

      </div>
    </div>
  );
}
