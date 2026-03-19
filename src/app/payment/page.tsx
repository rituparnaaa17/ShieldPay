"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, ShieldCheck, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeUp } from "@/components/animated/FadeUp";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const PLANS = {
  basic: { name: "Basic Protection", price: 45, cap: 2000, triggers: "Heavy Rain Coverage, Zone Shutdowns", features: ["Heavy Rain Coverage", "Zone Shutdowns", "24/7 Support"] },
  plus: { name: "Shield Plus", price: 85, cap: 4500, triggers: "Heavy Rain, Flood, AQI, Zone Shutdown", features: ["Heavy Rain & Floods", "Severe AQI Drops", "Zone Shutdowns", "Priority Support"] },
  pro: { name: "Max Pro", price: 150, cap: 8000, triggers: "All Weather Coverage, Heatwave, Zone Shutdowns", features: ["All Weather Coverage", "Heatwave Protection", "Zone & City Shutdowns", "Instant UPI Payouts"] }
};

function PaymentContent() {
  const searchParams = useSearchParams();
  const planId = searchParams.get('plan') || 'plus';
  const selectedPlan = PLANS[planId as keyof typeof PLANS] || PLANS.plus;

  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [user, setUser] = useState({ name: "Rahul Kumar", phone: "+91 98765 43210", platform: "Zomato", type: "Food Delivery", zone: "Koramangala", city: "Bengaluru" });

  useEffect(() => {
    try {
      const stored = localStorage.getItem('shieldpay_user');
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch(e) {}
  }, []);

  const handlePayment = () => {
    setIsProcessing(true);
    setTimeout(() => {
      localStorage.setItem('shieldpay_plan', JSON.stringify(selectedPlan));
      setIsProcessing(false);
      setSuccess(true);
    }, 2000);
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-tr from-green-400/10 via-blue-400/5 to-transparent rounded-full blur-[100px] pointer-events-none"></div>
        <FadeUp className="text-center subtle-card bg-white p-10 max-w-md w-full border-slate-100 shadow-2xl shadow-slate-200/50">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-50 to-green-100/50 text-green-600 flex items-center justify-center mx-auto mb-6 shadow-inner border border-green-200/50">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold mb-2 text-slate-900">You're protected with ShieldPay</h1>
          <p className="text-slate-500 mb-8">Your weekly coverage is now active.</p>
          
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 mb-8 text-left space-y-4">
            <div>
               <div className="text-xs text-slate-500 font-medium mb-1 uppercase tracking-wider">Plan</div>
               <div className="font-semibold text-slate-900">{selectedPlan.name} (₹{selectedPlan.price}/week)</div>
            </div>
            <div>
               <div className="text-xs text-slate-500 font-medium mb-1 uppercase tracking-wider">Renewal Date</div>
               <div className="font-semibold text-slate-900">Dec 28, 2026</div>
            </div>
          </div>
          
          <Link href="/dashboard" className="w-full block">
            <Button size="lg" className="w-full h-14 rounded-xl text-base font-bold bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 text-white">
              Go to Dashboard <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </FadeUp>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-6 bg-slate-50 text-slate-900">
      <div className="container mx-auto max-w-4xl">
        <Link href="/plans" className="inline-flex items-center text-slate-500 hover:text-blue-600 mb-8 transition-colors text-sm font-medium">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Plans
        </Link>
        
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          
          <div className="lg:col-span-3">
            <FadeUp>
              <h1 className="text-3xl font-bold mb-6">Payment Summary</h1>
              
              <div className="subtle-card bg-white p-8 mb-6">
                <h3 className="text-lg font-bold mb-4 border-b border-slate-100 pb-4">{selectedPlan.name}</h3>
                
                <div className="flex justify-between items-center mb-4">
                  <span className="text-slate-600">Weekly Premium</span>
                  <span className="font-bold text-xl">₹{selectedPlan.price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-slate-600">Platform Convenience Fee</span>
                  <span className="font-bold">₹0.00</span>
                </div>
                
                <div className="border-t border-slate-100 pt-4 mt-4 flex justify-between items-center">
                  <span className="font-bold text-slate-900">Total to Pay</span>
                  <span className="font-extrabold text-2xl text-blue-600">₹{selectedPlan.price.toFixed(2)}</span>
                </div>
              </div>

              <div className="subtle-card bg-white p-8">
                <h3 className="text-lg font-bold mb-4 border-b border-slate-100 pb-4">Worker Details</h3>
                <div className="p-4 bg-slate-50/50 rounded-xl space-y-3 mb-6 border border-slate-100">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Name & Phone</span>
                    <span className="font-bold text-slate-900">{user.name} ({user.phone})</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Platform</span>
                    <span className="font-bold text-slate-900">{user.platform} • {user.type}</span>
                  </div>
                </div>

                <h3 className="text-lg font-bold mb-4 border-b border-slate-100 pb-4">Coverage Details</h3>
                <div className="grid grid-cols-2 gap-y-4 text-sm">
                  <div className="text-slate-500">Max Payout Cap</div>
                  <div className="font-bold text-slate-900 text-right">₹{selectedPlan.cap} / week</div>
                  
                  <div className="text-slate-500">City & Zone</div>
                  <div className="font-bold text-slate-900 text-right">{user.city}, {user.zone}</div>
                  
                  <div className="text-slate-500">Deductible</div>
                  <div className="font-bold text-slate-900 text-right">None</div>
                  
                  <div className="text-slate-500">Covered Triggers</div>
                  <div className="font-bold text-slate-900 text-right">{selectedPlan.triggers}</div>
                </div>
              </div>
            </FadeUp>
          </div>

          <div className="lg:col-span-2">
            <FadeUp delay={0.1} className="subtle-card bg-white p-8 sticky top-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Secure Payment</h3>
                  <p className="text-xs text-slate-500">Encrypted checkout</p>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-1.5">UPI ID</label>
                  <input type="text" defaultValue="rahul.k@paytm" className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all text-sm" />
                </div>
                 <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-1.5">Auto-renewal</label>
                  <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <input type="checkbox" defaultChecked className="w-4 h-4 text-blue-600 rounded border-slate-300" />
                    <span className="text-sm text-slate-700">Deduct ₹{selectedPlan.price} automatically every week</span>
                  </div>
                </div>
              </div>

              <Button 
                onClick={handlePayment} 
                disabled={isProcessing}
                className="w-full h-14 rounded-xl text-base font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 transition-all"
              >
                {isProcessing ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing UPI Request...</>
                ) : (
                  `Pay ₹${selectedPlan.price} & Activate`
                )}
              </Button>
              <p className="text-xs text-center text-slate-500 mt-4 leading-relaxed">
                By purchasing, you accept the ShieldPay Terms & Conditions. Payouts are entirely data-driven and automated.
              </p>
            </FadeUp>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}>
      <PaymentContent />
    </Suspense>
  );
}
