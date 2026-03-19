"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, ShieldAlert, Sparkles, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FadeUp, StaggeredFadeUp } from "@/components/animated/FadeUp";

const PLANS = [
  {
    id: "basic",
    name: "Basic Protection",
    price: 45,
    cap: 2000,
    idealFor: "Part-time workers (10-20 hrs/week)",
    features: ["Heavy Rain Coverage", "Zone Shutdowns", "24/7 Support"],
    recommended: false
  },
  {
    id: "plus",
    name: "Shield Plus",
    price: 85,
    cap: 4500,
    idealFor: "Full-time riders (30-50 hrs/week)",
    features: ["Heavy Rain & Floods", "Severe AQI Drops", "Zone Shutdowns", "Priority Support"],
    recommended: true
  },
  {
    id: "pro",
    name: "Max Pro",
    price: 150,
    cap: 8000,
    idealFor: "High-earning delivery partners",
    features: ["All Weather Coverage", "Heatwave Protection", "Zone & City Shutdowns", "Instant UPI Payouts"],
    recommended: false
  }
];

export default function PlansPage() {
  const [user, setUser] = useState({ city: "Bengaluru", risk: "High", probability: "12%" });

  useEffect(() => {
    try {
      const stored = localStorage.getItem('shieldpay_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        
        let risk = "High";
        let probability = "12%";
        
        if (parsed.city === "Mumbai") {
          risk = "Extreme";
          probability = "18%";
        } else if (parsed.city === "Delhi NCR") {
          risk = "Medium";
          probability = "8%";
        }
        
        setUser({ city: parsed.city, risk, probability });
      }
    } catch(e) {}
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-12 px-6">
      <div className="container mx-auto max-w-5xl">
        <Link href="/" className="inline-flex items-center text-slate-500 hover:text-blue-600 mb-8 transition-colors text-sm font-medium">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Link>
        
        <div className="text-center mb-16">
          <FadeUp>
             <h1 className="text-4xl font-extrabold mb-4 text-slate-900">Personalized Coverage Plans</h1>
             <p className="text-lg text-slate-600 max-w-xl mx-auto mb-8">
               Based on your location risk profile and working hours, we’ve calculated the optimal weekly premium to protect your earnings.
             </p>
             
             {/* Dynamic calculation summary */}
             <div className="inline-flex items-center gap-6 bg-white border border-slate-200 shadow-sm rounded-2xl px-6 py-4 text-sm text-left">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                   <MapPin className="w-5 h-5 text-blue-600" />
                 </div>
                 <div>
                   <div className="text-slate-500 font-medium">City Risk Level</div>
                   <div className="font-bold text-slate-900">{user.risk} ({user.city})</div>
                 </div>
               </div>
               <div className="w-px h-10 bg-slate-200"></div>
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                   <ShieldAlert className="w-5 h-5 text-red-600" />
                 </div>
                 <div>
                   <div className="text-slate-500 font-medium">Weather Disruptions</div>
                   <div className="font-bold text-slate-900">{user.probability} Probability</div>
                 </div>
               </div>
             </div>
          </FadeUp>
        </div>

        <StaggeredFadeUp staggerDelay={0.1} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start mt-8">
          {PLANS.map((plan) => (
            <div key={plan.id} className={`subtle-card bg-white p-8 relative flex flex-col h-full transform transition-all duration-300 ${
              plan.recommended ? 'border-none p-[1px] shadow-2xl md:-translate-y-4 scale-100 relative z-10 bg-gradient-to-br from-blue-400 via-indigo-500 to-red-400' : ''
            }`}>
              
              <div className={`w-full h-full flex flex-col ${plan.recommended ? 'bg-white rounded-[1.4rem] p-8' : ''}`}>
                
                {plan.recommended && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-red-500 to-red-600 text-white font-bold tracking-wide uppercase px-4 py-1.5 shadow-lg shadow-red-500/30 border-0">
                      <Sparkles className="w-3.5 h-3.5 mr-1" /> Recommended
                    </Badge>
                  </div>
                )}
              
              <h3 className="text-2xl font-bold text-slate-900 mb-1">{plan.name}</h3>
              <p className="text-sm text-slate-500 mb-6 pb-6 border-b border-slate-100">Ideal for: <span className="font-medium text-slate-700">{plan.idealFor}</span></p>
              
              <div className="flex items-end gap-1 mb-2">
                <span className="text-5xl font-extrabold text-blue-600">₹{plan.price}</span>
                <span className="text-slate-500 mb-1 font-medium">/ week</span>
              </div>
              
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 mb-8 mt-4">
                 <div className="text-sm text-slate-500 flex justify-between items-center">
                    <span>Max Payout Cap</span>
                    <span className="text-lg font-bold text-slate-900">₹{plan.cap}</span>
                 </div>
              </div>

              <div className="flex-1 space-y-4 mb-8">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 className={`w-5 h-5 shrink-0 ${plan.recommended ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className="text-sm font-medium text-slate-700">{feature}</span>
                  </div>
                ))}
              </div>

              <Link href={`/payment?plan=${plan.id}`} className="block w-full mt-auto">
                <Button 
                  size="lg" 
                  className={`w-full h-14 rounded-xl text-base font-bold transition-all ${
                    plan.recommended 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20' 
                      : 'bg-white border-2 border-slate-200 text-slate-700 hover:border-blue-600 hover:text-blue-600 shadow-sm'
                  }`}
                >
                  Select Plan
                </Button>
              </Link>
             </div>
            </div>
          ))}
        </StaggeredFadeUp>
        
        <div className="mt-16 text-center text-sm text-slate-500 flex flex-col items-center">
           <p className="max-w-xl">
             By selecting a plan, you agree to the ShieldPay Terms of Service. Payouts are directly credited to your UPI ID based on the automated trigger limits.
           </p>
        </div>
      </div>
    </div>
  );
}
