"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shield, Clock, TrendingUp, HandHeart, ArrowRight, Zap, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeUp, StaggeredFadeUp, HoverLift } from "@/components/animated/FadeUp";
import { apiUrl } from "@/lib/api";

export default function LandingPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const formData = new FormData(e.currentTarget);

    try {
      if (authMode === 'signup') {
        const payload = {
          name: formData.get('name'),
          phone: formData.get('phone'),
          city: formData.get('city'),
          zone: formData.get('zone'),
          platform: formData.get('platform'),
          type: formData.get('type'),
          hours: formData.get('hours'),
          income: formData.get('income'),
        };

        const res = await fetch(apiUrl('/api/auth/register'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (!res.ok) {
          setErrorMsg(data.error || 'Registration failed');
          setIsSubmitting(false);
          return;
        }

        // Persist user to localStorage with all form data
        localStorage.setItem('shieldpay_user', JSON.stringify(data.user));
        setSuccessMsg('Welcome to ShieldPay! Redirecting to plans...');
        setTimeout(() => router.push('/plans'), 1000);

      } else {
        const phone = formData.get('phone') as string;

        const res = await fetch(apiUrl('/api/auth/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone }),
        });

        const data = await res.json();

        if (!res.ok) {
          setErrorMsg(data.error || 'Login failed');
          setIsSubmitting(false);
          return;
        }

        // Merge stored extras with fresh DB user
        const stored = JSON.parse(localStorage.getItem('shieldpay_user') || '{}');
        localStorage.setItem('shieldpay_user', JSON.stringify({ ...stored, ...data.user }));
        setSuccessMsg('Login successful! Redirecting...');
        setTimeout(() => router.push('/dashboard'), 800);
      }
    } catch (err) {
      setErrorMsg('Cannot reach server. Please ensure the backend is running.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 flex flex-col">
      
      {/* Header */}
      <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-slate-200 z-50 transition-all">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo(0,0)}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-md shadow-blue-600/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900">ShieldPay</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">— Your Insurance Partner</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {authMode === 'signup' ? (
              <>
                <span className="hidden sm:inline text-sm font-medium text-slate-500">Already a member?</span>
                <Button variant="outline" className="h-10 px-5 rounded-full border-slate-200 hover:bg-slate-50 font-semibold" onClick={() => { setAuthMode('login'); setErrorMsg(null); }}>
                  Log In
                </Button>
              </>
            ) : (
              <>
                <span className="hidden sm:inline text-sm font-medium text-slate-500">New to ShieldPay?</span>
                <Button className="h-10 px-5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-600/20" onClick={() => { setAuthMode('signup'); setErrorMsg(null); }}>
                  Get Covered Now
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="pt-32 pb-24 flex-1">
        <div className="container mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          {/* Left: Value Prop */}
          <div className="max-w-xl relative z-10">
            <FadeUp>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100/50 border border-blue-200 text-blue-700 text-sm font-bold mb-6">
                <Zap className="w-4 h-4" /> <span>India&apos;s #1 Gig Worker Protection</span>
              </div>
              
              <h2 className="text-5xl md:text-6xl lg:text-[4rem] font-extrabold text-slate-900 leading-[1.1] tracking-tight mb-6">
                Protect your <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">weekly income.</span>
              </h2>
              <p className="text-xl text-slate-600 leading-relaxed mb-8 max-w-lg">
                Unpredictable weather or sudden zone disruptions shouldn&apos;t stop you from earning. ShieldPay guarantees payout coverage when you can&apos;t work.
              </p>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <div className="flex -space-x-3">
                  {[1,2,3,4].map(i => (
                    <div key={i} className={`w-10 h-10 rounded-full border-2 border-white bg-slate-200 shadow-sm z-[${5-i}] overflow-hidden`}>
                      <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${i}&backgroundColor=e2e8f0`} className="w-full h-full object-cover" alt="User" />
                    </div>
                  ))}
                  <div className="w-10 h-10 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shadow-sm z-0">
                    50k+
                  </div>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1 text-yellow-500 mb-0.5">
                    {[1,2,3,4,5].map(i => (
                      <svg key={i} className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                    ))}
                  </div>
                  <span className="text-sm font-semibold text-slate-700">Trusted by gig workers across India</span>
                </div>
              </div>


            </FadeUp>
          </div>

          {/* Right: Auth Form */}
          <div className="relative">
            <div className="absolute -inset-10 bg-gradient-to-tr from-blue-100 via-indigo-50 to-red-50 rounded-[3rem] blur-2xl opacity-60 -z-10"></div>
            
            <FadeUp delay={0.2} className="bg-white/80 backdrop-blur-xl p-8 sm:p-10 rounded-3xl subtle-card text-left border border-white shadow-2xl shadow-blue-900/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-100/40 to-red-100/40 blur-3xl rounded-full -mr-20 -mt-20 z-0 pointer-events-none"></div>
              
              <div className="mb-8 border-b border-slate-100 pb-6 relative z-10 transition-all">
                <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  {authMode === 'signup' ? 'Get Covered Now' : 'Welcome Back'}
                </h3>
                <p className="text-slate-500 mt-2 font-medium">
                  {authMode === 'signup' ? 'Fill in your details to see personalized plans.' : 'Log in to view your dashboard and active claims.'}
                </p>
              </div>

              {/* Error / Success Messages */}
              {errorMsg && (
                <div className="mb-5 flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 relative z-10">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold">{errorMsg}</p>
                    {errorMsg.includes('already exists') && (
                      <button onClick={() => { setAuthMode('login'); setErrorMsg(null); }} className="text-sm text-blue-600 font-bold underline mt-1">Switch to Log In →</button>
                    )}
                    {errorMsg.includes('not found') && (
                      <button onClick={() => { setAuthMode('signup'); setErrorMsg(null); }} className="text-sm text-blue-600 font-bold underline mt-1">Switch to Sign Up →</button>
                    )}
                  </div>
                </div>
              )}

              {successMsg && (
                <div className="mb-5 flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 relative z-10">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <p className="text-sm font-semibold">{successMsg}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
                {authMode === 'signup' ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700">Full Name</label>
                        <input name="name" required type="text" placeholder="Rahul Kumar" className="w-full h-12 px-4 bg-slate-50/50 border border-slate-200 shadow-sm rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-500 transition-all text-sm font-medium" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700">Phone Number</label>
                        <input name="phone" required type="tel" placeholder="+91 98765 43210" className="w-full h-12 px-4 bg-slate-50/50 border border-slate-200 shadow-sm rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-500 transition-all text-sm font-medium" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700">City</label>
                        <select name="city" required className="w-full h-12 px-4 bg-slate-50/50 border border-slate-200 shadow-sm rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-500 transition-all text-sm font-medium appearance-none">
                          <option value="">Select City</option>
                          <option value="Bengaluru">Bengaluru</option>
                          <option value="Mumbai">Mumbai</option>
                          <option value="Delhi NCR">Delhi NCR</option>
                          <option value="Chennai">Chennai</option>
                          <option value="Hyderabad">Hyderabad</option>
                          <option value="Pune">Pune</option>
                          <option value="Kolkata">Kolkata</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700">Primary Zone</label>
                        <input name="zone" required type="text" placeholder="e.g. Koramangala" className="w-full h-12 px-4 bg-slate-50/50 border border-slate-200 shadow-sm rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-500 transition-all text-sm font-medium" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700">Platform</label>
                        <select name="platform" required className="w-full h-12 px-4 bg-slate-50/50 border border-slate-200 shadow-sm rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-500 transition-all text-sm font-medium appearance-none">
                          <option value="">Select Platform</option>
                          <option value="Zomato">Zomato</option>
                          <option value="Swiggy">Swiggy</option>
                          <option value="Zepto">Zepto</option>
                          <option value="Blinkit">Blinkit</option>
                          <option value="Uber">Uber</option>
                          <option value="Rapido">Rapido</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700">Work Type</label>
                        <select name="type" required className="w-full h-12 px-4 bg-slate-50/50 border border-slate-200 shadow-sm rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-500 transition-all text-sm font-medium appearance-none">
                          <option value="">Select Type</option>
                          <option value="Food Delivery">Food Delivery</option>
                          <option value="Grocery/Quick Commerce">Grocery/Quick Commerce</option>
                          <option value="Ride Hailing (Bike)">Ride Hailing (Bike)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700">Avg. Weekly Hours</label>
                        <input name="hours" required type="number" placeholder="40" min="10" max="100" className="w-full h-12 px-4 bg-slate-50/50 border border-slate-200 shadow-sm rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-500 transition-all text-sm font-medium" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700">Avg. Weekly Income (₹)</label>
                        <input name="income" required type="number" placeholder="4500" min="500" className="w-full h-12 px-4 bg-slate-50/50 border border-slate-200 shadow-sm rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-500 transition-all text-sm font-medium" />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5 mt-4">
                      <label className="text-sm font-semibold text-slate-700">Phone Number</label>
                      <input name="phone" required type="tel" placeholder="+91 98765 43210" className="w-full h-14 px-4 bg-slate-50/50 border border-slate-200 shadow-sm rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-500 transition-all text-base font-medium" />
                    </div>
                    <p className="text-xs text-slate-400 -mt-2">We verify using your registered phone number.</p>
                  </>
                )}

                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full h-14 mt-6 rounded-xl text-base font-bold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/30 transition-all transform hover:-translate-y-0.5"
                >
                  {isSubmitting 
                    ? <><Loader2 className="w-5 h-5 mr-2 animate-spin inline" /> Processing...</>
                    : authMode === 'signup' ? <>Continue to Pricing <ArrowRight className="w-5 h-5 ml-2 inline" /></>
                    : <>Access Dashboard <ArrowRight className="w-5 h-5 ml-2 inline" /></>}
                </Button>
                
                <p className="text-center text-xs text-slate-400 mt-6 pt-4 border-t border-slate-100">
                  By {authMode === 'signup' ? 'continuing' : 'logging in'}, you agree to our Terms of Service &amp; Privacy Policy.
                </p>
              </form>
            </FadeUp>
          </div>
          
        </div>
      </main>

      {/* Why ShieldPay */}
      <section className="bg-white border-y border-slate-200 py-24 relative z-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Why workers choose ShieldPay</h2>
            <p className="text-slate-500 mt-3 text-lg font-medium">Reliable support when conditions turn bad.</p>
          </div>
          
          <StaggeredFadeUp delay={0.2} staggerDelay={0.1} className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <HoverLift>
              <div className="p-8 subtle-card bg-gradient-to-br from-white to-slate-50/50 h-full">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-6 border border-blue-100 shadow-sm">
                  <Clock className="w-7 h-7 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Weekly Protection</h3>
                <p className="text-slate-600 text-sm leading-relaxed font-medium">Pay affordable premiums on a weekly basis, perfectly synced with your earning cycle. No lock-ins.</p>
              </div>
            </HoverLift>
            
            <HoverLift>
              <div className="p-8 subtle-card bg-gradient-to-br from-white to-slate-50/50 h-full">
                <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-6 border border-red-100 shadow-sm">
                  <HandHeart className="w-7 h-7 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Fast Claim Support</h3>
                <p className="text-slate-600 text-sm leading-relaxed font-medium">No complicated paperwork. When disruptions are verified, payouts are initiated directly to your UPI.</p>
              </div>
            </HoverLift>
            
            <HoverLift>
              <div className="p-8 subtle-card bg-gradient-to-br from-white to-slate-50/50 h-full">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-6 border border-emerald-100 shadow-sm">
                  <TrendingUp className="w-7 h-7 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Income-Focused</h3>
                <p className="text-slate-600 text-sm leading-relaxed font-medium">Guarantees a base income level when you are unable to log into your platform due to severe weather.</p>
              </div>
            </HoverLift>
          </StaggeredFadeUp>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 py-12 relative z-20">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-md">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight text-white">ShieldPay</span>
            </div>
            
            <div className="flex gap-6 text-sm font-medium text-slate-400">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-white transition-colors">Contact Support</a>
            </div>
          </div>
          
          <div className="border-t border-slate-800 pt-8 flex flex-col items-center">
             <div className="inline-flex items-center gap-2 text-slate-500 text-sm font-medium">
               Built by <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 font-bold tracking-widest uppercase">Team Arcane</span>
             </div>
             <p className="text-slate-600 text-xs mt-3">© 2026 ShieldPay. All rights reserved.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
