"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  Activity, 
  Search,
  Check
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FadeUp, StaggeredFadeUp } from "@/components/animated/FadeUp";
import { apiUrl } from "@/lib/api";

const TRACKER_STEPS = [
  { id: "trigger", title: "Trigger Detected", desc: "Heavy rain confirmed", status: "completed" },
  { id: "eligibility", title: "Eligibility Checked", desc: "Verified active coverage", status: "completed" },
  { id: "review", title: "Under Review", desc: "Calculating payout amount", status: "current" },
  { id: "payout", title: "Payout Initiated", desc: "Pending bank transfer", status: "upcoming" },
];

export default function ClaimsPage() {
  const [filter, setFilter] = useState("All");
  const [claims, setClaims] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [liveTrigger, setLiveTrigger] = useState<any>(null);
  const [userZone, setUserZone] = useState("Koramangala");

  useEffect(() => {
    let zone = "Koramangala";
    try {
      const stored = localStorage.getItem('shieldpay_user');
      if (stored) {
        zone = JSON.parse(stored).zone || "Koramangala";
        setUserZone(zone);
      }
    } catch(e) {}

    // Fetch active triggers to populate Active Claim Tracker
    fetch(apiUrl("/api/triggers/active"))
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data && data.data.length > 0) {
          const active = data.data.find((t: any) => t.zone_name === zone);
          if (active) {
            setLiveTrigger({
              type: active.trigger_type,
              severity: active.severity_score || active.severity,
              started: new Date(active.created_at).toLocaleDateString()
            });
          }
        }
      })
      .catch(err => console.error(err));

    fetch(apiUrl("/api/claims/all"))
      .then(res => res.json())
      .then(data => {
        if (data.success && data.claims) {
          const mapped = data.claims.map((c: any) => ({
            id: `CLM-${c.claim_id.substring(0, 4)}`,
            trigger: `Trigger: ${c.trigger_id.substring(0,6)}`,
            date: new Date(c.created_at).toLocaleDateString(),
            amount: c.payout_amount,
            status: c.status === 'paid' ? 'Paid' : c.status === 'review' ? 'Under Review' : c.status
          }));
          if (mapped.length > 0) setClaims(mapped);
        }
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Failed to load claims", err);
        setIsLoading(false);
      });
  }, []);

  const filteredClaims = filter === "All" 
    ? claims 
    : claims.filter(c => c.status === filter);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-10 px-6">
      <div className="container mx-auto max-w-4xl">
        <Link href="/dashboard" className="inline-flex items-center text-slate-500 hover:text-blue-600 mb-8 transition-colors text-sm font-medium">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
        </Link>
        
        <FadeUp>
           <h1 className="text-3xl font-extrabold mb-8 text-slate-900">Claims & Payouts</h1>
        </FadeUp>

        {/* Active Claim Tracker */}
        {liveTrigger && (
          <FadeUp delay={0.1}>
            <div className="subtle-card bg-white p-8 mb-12 relative overflow-hidden">
               
               <div className="flex flex-col sm:flex-row justify-between items-start mb-10 relative z-10 gap-4">
                 <div>
                    <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 mb-3 border-0 transition-colors hidden sm:inline-flex">
                      In Progress
                    </Badge>
                    <h2 className="text-xl font-bold text-slate-900">{liveTrigger.type} - {userZone}</h2>
                    <p className="text-slate-500 mt-1 text-sm font-medium">Auto-Trigger Score: {liveTrigger.severity}</p>
                 </div>
                 <div className="text-left sm:text-right">
                    <p className="text-sm font-semibold text-slate-900">Started</p>
                    <p className="text-sm text-slate-500 font-medium">{liveTrigger.started}</p>
                 </div>
               </div>
  
               {/* Horizontal Timeline for Desktop, Vertical for Mobile */}
               <div className="relative z-10 hidden sm:block">
                  <div className="relative flex items-start justify-between">
                    {/* Background Line */}
                    <div className="absolute top-4 left-0 w-full h-1 bg-slate-100 rounded-full z-0"></div>
                    {/* Progress Line */}
                    <div className="absolute top-4 left-0 w-[66%] h-1 bg-blue-600 rounded-full z-0"></div>
  
                    {TRACKER_STEPS.map((step, idx) => (
                      <div key={step.id} className="relative z-10 flex flex-col items-center flex-1 text-center">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-4 border-[3px] transition-colors ${
                          step.status === 'completed' ? 'bg-blue-600 border-white text-white shadow-sm' :
                          step.status === 'current' ? 'bg-white border-blue-600 shadow-sm' :
                          'bg-white border-slate-200 text-slate-400'
                        }`}>
                           {step.status === 'completed' && <Check className="w-5 h-5 text-white" />}
                           {step.status === 'current' && <div className="w-3 h-3 bg-blue-600 rounded-full animate-pulse"></div>}
                           {step.status === 'upcoming' && <span className="text-sm font-bold">{idx + 1}</span>}
                        </div>
                        <h4 className={`text-sm font-bold mb-1 ${step.status === 'upcoming' ? 'text-slate-400' : 'text-slate-900'}`}>{step.title}</h4>
                        <p className={`text-xs ${step.status === 'upcoming' ? 'text-slate-300' : 'text-slate-500'} max-w-[120px]`}>{step.desc}</p>
                      </div>
                    ))}
                  </div>
               </div>
               
               {/* Mobile Timeline */}
               <div className="relative z-10 sm:hidden pl-4 border-l-2 border-slate-100 space-y-6">
                  {TRACKER_STEPS.map((step, idx) => (
                    <div key={step.id} className="relative">
                      <div className={`absolute -left-[25px] top-0 w-5 h-5 rounded-full border-2 bg-white flex items-center justify-center ${
                         step.status === 'completed' ? 'border-blue-600 bg-blue-600 text-white' :
                         step.status === 'current' ? 'border-blue-600' : 'border-slate-200 text-slate-400'
                      }`}>
                         {step.status === 'completed' && <Check className="w-3 h-3" />}
                         {step.status === 'current' && <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>}
                      </div>
                      <div>
                        <h4 className={`text-sm font-bold ${step.status === 'upcoming' ? 'text-slate-400' : 'text-slate-900'}`}>{step.title}</h4>
                        <p className={`text-xs mt-0.5 ${step.status === 'upcoming' ? 'text-slate-300' : 'text-slate-500'}`}>{step.desc}</p>
                      </div>
                    </div>
                  ))}
               </div>
            </div>
          </FadeUp>
        )}

        {/* Payout History */}
        <FadeUp delay={0.2} className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           <h3 className="text-xl font-bold text-slate-900">Payout History</h3>
           <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 sm:pb-0">
             {["All", "Paid", "Under Review", "Declined"].map(f => (
               <Button 
                 key={f} 
                 variant={filter === f ? "default" : "outline"} 
                 size="sm"
                 className={`h-9 px-4 rounded-xl font-medium transition-colors ${
                   filter === f ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                 }`}
                 onClick={() => setFilter(f)}
               >
                 {f}
               </Button>
             ))}
           </div>
        </FadeUp>

        <StaggeredFadeUp delay={0.3} staggerDelay={0.1} className="space-y-4">
          {filteredClaims.length === 0 ? (
             <div className="bg-white border border-slate-200 border-dashed rounded-3xl p-16 text-center shadow-sm flex flex-col items-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-slate-300" />
                </div>
                <h4 className="text-lg font-bold text-slate-900 mb-2">No claims found</h4>
                <p className="text-sm text-slate-500 max-w-sm mx-auto">There are no historical claims matching your current filter criteria.</p>
             </div>
          ) : (
            filteredClaims.map((claim) => (
              <div key={claim.id} className="subtle-card bg-white p-5 flex flex-col sm:flex-row gap-4 sm:items-center justify-between hover:border-slate-300 cursor-pointer">
                <div className="flex gap-4 items-center">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                    claim.status === 'Paid' ? 'bg-green-50 text-green-600' :
                    claim.status === 'Under Review' ? 'bg-orange-50 text-orange-600' :
                    'bg-slate-50 text-slate-500'
                  }`}>
                    {claim.status === 'Paid' ? <CheckCircle2 className="w-6 h-6" /> : 
                     claim.status === 'Under Review' ? <Clock className="w-6 h-6" /> : 
                     <Activity className="w-6 h-6" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 mb-0.5">{claim.trigger}</h4>
                    <p className="text-xs text-slate-500 font-medium tracking-wide">
                      {claim.id} • {claim.date}
                    </p>
                  </div>
                </div>
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto pl-16 sm:pl-0">
                  <div className="text-xl font-bold text-slate-900">₹{claim.amount}</div>
                  <Badge className={`mt-0 sm:mt-1 border-0 ${
                    claim.status === 'Paid' ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                    claim.status === 'Under Review' ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' :
                    'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>
                    {claim.status}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </StaggeredFadeUp>
        
      </div>
    </div>
  );
}
