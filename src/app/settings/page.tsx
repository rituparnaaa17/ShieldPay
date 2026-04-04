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
  Pencil,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeUp, StaggeredFadeUp } from "@/components/animated/FadeUp";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { apiUrl } from "@/lib/api";

const ALERT_OPTIONS = ["SMS Only", "Email Only", "SMS & WhatsApp", "Push Notifications", "All Channels"];
const PAYOUT_FREQ_OPTIONS = ["Not set", "Instant via RTGS", "Daily", "Weekly"];
const AUTO_RENEWAL_OPTIONS = ["Enabled", "Disabled"];
const PLATFORM_OPTIONS = ["Not set", "Zomato", "Swiggy", "Zepto", "Blinkit", "Uber", "Rapido"];
const PLAN_OPTIONS = ["Basic Protection", "Shield Plus", "Max Pro"];

type UserState = {
  name: string;
  phone: string;
  email: string;
  platform: string;
  zone: string;
  city: string;
  activePlan: string;
  autoRenewal: string;
  upiId: string;
  backupBank: string;
  payoutFreq: string;
  weatherAlerts: string;
  claimAlerts: string;
  weeklySummary: string;
};

const DEFAULT_USER: UserState = {
  name: "",
  phone: "",
  email: "",
  platform: "",
  zone: "",
  city: "",
  activePlan: "—",
  autoRenewal: "Enabled",
  upiId: "",
  backupBank: "",
  payoutFreq: "Not set",
  weatherAlerts: "SMS Only",
  claimAlerts: "SMS Only",
  weeklySummary: "Email Only",
};

type DropdownKey = keyof UserState;

// Which keys use dropdowns and what their options are
const DROPDOWN_KEYS: Partial<Record<DropdownKey, string[]>> = {
  platform: PLATFORM_OPTIONS,
  activePlan: PLAN_OPTIONS,
  autoRenewal: AUTO_RENEWAL_OPTIONS,
  payoutFreq: PAYOUT_FREQ_OPTIONS,
  weatherAlerts: ALERT_OPTIONS,
  claimAlerts: ALERT_OPTIONS,
  weeklySummary: ALERT_OPTIONS,
};

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserState>(DEFAULT_USER);
  const [userId, setUserId] = useState("");
  const [isSavingField, setIsSavingField] = useState<keyof UserState | null>(null);
  const [editingField, setEditingField] = useState<keyof UserState | null>(null);
  const [fieldDraft, setFieldDraft] = useState<string>("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ name: "", city: "" });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        let resolvedUserId = "";

        const stored = localStorage.getItem("shieldpay_user");
        if (stored) {
          const parsed = JSON.parse(stored);
          resolvedUserId = parsed.id || "";
          setUserId(resolvedUserId);
          setUser((prev) => ({ ...prev, ...parsed }));
        }

        const storedSettings = localStorage.getItem("shieldpay_settings");
        if (storedSettings) {
          const parsedSettings = JSON.parse(storedSettings);
          setUser((prev) => ({ ...prev, ...parsedSettings }));
        }

        const storedPlan = localStorage.getItem("shieldpay_plan");
        if (storedPlan) {
          const plan = JSON.parse(storedPlan);
          setUser((prev) => ({ ...prev, activePlan: plan.name || prev.activePlan }));
        }

        if (resolvedUserId) {
          const response = await fetch(apiUrl(`/api/auth/settings/${resolvedUserId}`));
          if (response.ok) {
            const payload = await response.json();
            if (payload?.success && payload?.user) {
              setUser((prev) => ({ ...prev, ...payload.user }));
              localStorage.setItem("shieldpay_settings", JSON.stringify(payload.user));
            }
          }
        }
      } catch (error) {
        console.error("Failed to load settings", error);
      }
    };
    bootstrap();
  }, []);

  const persistToDb = useCallback(
    async (updatedUser: UserState) => {
      const id = userId || JSON.parse(localStorage.getItem("shieldpay_user") || "{}").id;
      if (!id) return;
      try {
        await fetch(apiUrl(`/api/auth/settings/${id}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedUser),
        });
      } catch (err) {
        console.error("DB persist error", err);
      }
    },
    [userId]
  );

  const applyFieldChange = useCallback(
    async (key: keyof UserState, value: string) => {
      const updated = { ...user, [key]: value };
      setUser(updated);

      // Update localStorage
      const existing = JSON.parse(localStorage.getItem("shieldpay_user") || "{}");
      localStorage.setItem("shieldpay_user", JSON.stringify({ ...existing, ...updated }));
      localStorage.setItem("shieldpay_settings", JSON.stringify(updated));

      // Update plan info in localStorage if relevant
      if (key === "autoRenewal" || key === "payoutFreq" || key === "activePlan") {
        const existingPlan = JSON.parse(localStorage.getItem("shieldpay_plan") || "{}");
        localStorage.setItem(
          "shieldpay_plan",
          JSON.stringify({
            ...existingPlan,
            ...(key === "activePlan" && { name: value }),
            ...(key === "autoRenewal" && { autoRenewal: value }),
            ...(key === "payoutFreq" && { payoutFrequency: value }),
            updatedAt: new Date().toISOString(),
          })
        );
      }

      setIsSavingField(key);
      await persistToDb(updated);
      setIsSavingField(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    },
    [user, persistToDb]
  );

  const startEditField = (key: keyof UserState) => {
    setEditingField(key);
    setFieldDraft(user[key]);
  };

  const commitFieldEdit = async () => {
    if (!editingField) return;
    await applyFieldChange(editingField, fieldDraft);
    setEditingField(null);
  };

  const cancelFieldEdit = () => setEditingField(null);

  const handleDropdownChange = async (key: keyof UserState, value: string) => {
    await applyFieldChange(key, value);
  };

  const saveProfile = async () => {
    setIsSavingProfile(true);
    await applyFieldChange("name", profileDraft.name);
    await applyFieldChange("city", profileDraft.city);
    setIsSavingProfile(false);
    setIsEditingProfile(false);
  };

  const renderDisplayValue = (value: string) => {
    if (!value || value.trim().length === 0 || value === "—") return "Not set";
    return value;
  };

  // Render a row value — dropdown inline if it's a dropdown key
  const renderRowValue = (key: keyof UserState) => {
    const isDropdown = !!DROPDOWN_KEYS[key];
    const options = DROPDOWN_KEYS[key] || [];
    const isSaving = isSavingField === key;
    const isEditing = editingField === key;
    const isText = !isDropdown;

    if (isDropdown) {
      return (
        <div className="flex items-center gap-2">
          {isSaving && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
          <select
            value={user[key]}
            onChange={(e) => handleDropdownChange(key, e.target.value)}
            disabled={isSaving}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-900 bg-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-w-[140px] text-right disabled:opacity-60"
          >
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (isText && isEditing) {
      return (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            type="text"
            value={fieldDraft}
            onChange={(e) => setFieldDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitFieldEdit();
              if (e.key === "Escape") cancelFieldEdit();
            }}
            className="px-3 py-1.5 border border-blue-400 rounded-lg text-sm font-semibold text-slate-900 bg-white focus:outline-none w-48"
          />
          <button
            onClick={commitFieldEdit}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 transition"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={cancelFieldEdit}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 group/row">
        {isSaving ? (
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
        ) : null}
        <span className="font-semibold text-sm text-right text-slate-900">
          {renderDisplayValue(user[key])}
        </span>
        <button
          onClick={() => startEditField(key)}
          className="opacity-0 group-hover/row:opacity-100 w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 hover:bg-blue-100 transition ml-1"
        >
          <Pencil className="w-3 h-3 text-slate-500 hover:text-blue-600" />
        </button>
      </div>
    );
  };

  const SETTING_GROUPS = [
    {
      title: "Account Information",
      icon: <User className="w-5 h-5 text-blue-600" />,
      items: [
        { label: "Phone Number", key: "phone" as keyof UserState },
        { label: "Email Address", key: "email" as keyof UserState },
        { label: "Connected Platform", key: "platform" as keyof UserState },
      ],
    },
    {
      title: "Coverage Settings",
      icon: <ShieldCheck className="w-5 h-5 text-blue-600" />,
      items: [
        { label: "Active Plan", key: "activePlan" as keyof UserState },
        { label: "Primary Zone", key: "zone" as keyof UserState },
        { label: "Auto-Renewal", key: "autoRenewal" as keyof UserState },
      ],
    },
    {
      title: "Payout Preferences",
      icon: <Wallet className="w-5 h-5 text-blue-600" />,
      items: [
        { label: "Primary UPI ID", key: "upiId" as keyof UserState },
        { label: "Backup Bank Account", key: "backupBank" as keyof UserState },
        { label: "Payout Frequency", key: "payoutFreq" as keyof UserState },
      ],
    },
    {
      title: "Alerts & Notifications",
      icon: <Bell className="w-5 h-5 text-blue-600" />,
      items: [
        { label: "Weather Warnings", key: "weatherAlerts" as keyof UserState },
        { label: "Claim Updates", key: "claimAlerts" as keyof UserState },
        { label: "Weekly Summary", key: "weeklySummary" as keyof UserState },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-10 px-6 pb-20">
      <div className="container mx-auto max-w-3xl">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-slate-500 hover:text-blue-600 mb-8 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
        </Link>

        <FadeUp className="mb-8">
          <h1 className="text-3xl font-extrabold mb-2 text-slate-900">Profile &amp; Settings</h1>
          <p className="text-slate-500 text-sm">
            Dropdowns save instantly. Text fields: hover the row and click the pencil to edit.
          </p>
        </FadeUp>

        {/* Save Success Banner */}
        {saveSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-2xl text-green-700 text-sm font-semibold flex items-center gap-2 animate-pulse">
            <ShieldCheck className="w-4 h-4" /> Saved to database!
          </div>
        )}

        {/* Profile Header Card */}
        <FadeUp delay={0.1}>
          <div className="subtle-card bg-white p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-8 border border-slate-200">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center shrink-0 border border-slate-200">
              <span className="font-bold text-2xl text-blue-600">
                {user.name ? user.name.charAt(0).toUpperCase() : "?"}
              </span>
            </div>

            <div className="text-center sm:text-left flex-1">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex-1">
                  {isEditingProfile ? (
                    <div className="flex flex-col gap-2 mb-2 max-w-sm">
                      <input
                        type="text"
                        value={profileDraft.name}
                        onChange={(e) => setProfileDraft((p) => ({ ...p, name: e.target.value }))}
                        className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-blue-600 font-bold"
                        placeholder="Full Name"
                      />
                      <input
                        type="text"
                        value={profileDraft.city}
                        onChange={(e) => setProfileDraft((p) => ({ ...p, city: e.target.value }))}
                        className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-blue-600"
                        placeholder="City"
                      />
                    </div>
                  ) : (
                    <>
                      <h2 className="text-2xl font-bold text-slate-900">{user.name || "Your Name"}</h2>
                      <p className="text-slate-500 font-medium">
                        {user.city || "City not set"} · Joined January 2026
                      </p>
                      {user.phone && <p className="text-slate-400 text-sm mt-1">{user.phone}</p>}
                    </>
                  )}
                </div>
                {isEditingProfile ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-white border-slate-200 text-slate-600"
                      onClick={() => setIsEditingProfile(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                      onClick={saveProfile}
                      disabled={isSavingProfile}
                    >
                      {isSavingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white border-slate-200 text-slate-700 shadow-sm self-center sm:self-start"
                    onClick={() => {
                      setProfileDraft({ name: user.name, city: user.city });
                      setIsEditingProfile(true);
                    }}
                  >
                    Edit Profile
                  </Button>
                )}
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
                  <div
                    key={i}
                    className="px-6 py-4 flex justify-between items-center bg-white hover:bg-slate-50/60 transition-colors group"
                  >
                    <span className="text-slate-600 font-medium">{item.label}</span>
                    <div className="flex items-center gap-2">{renderRowValue(item.key)}</div>
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
            <h4 className="font-bold text-slate-900 mb-1">Help &amp; Support</h4>
            <p className="text-xs text-slate-500 mb-4">Contact our team for claim assistance</p>
            <Button variant="outline" className="w-full bg-white shadow-sm border-slate-200 text-slate-800">
              Contact Us
            </Button>
          </div>

          <div className="flex-1 subtle-card bg-white p-6 flex flex-col items-center text-center justify-center cursor-pointer group hover:border-red-100">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4 group-hover:bg-red-100 transition-colors">
              <LogOut className="w-6 h-6 text-red-600" />
            </div>
            <h4 className="font-bold text-slate-900 mb-1">Sign Out</h4>
            <p className="text-xs text-slate-500 mb-4">Securely log out of ShieldPay</p>
            <Button
              variant="outline"
              className="w-full bg-white shadow-sm border-slate-200 text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => {
                localStorage.removeItem("shieldpay_user");
                localStorage.removeItem("shieldpay_plan");
                localStorage.removeItem("shieldpay_settings");
                router.push("/");
              }}
            >
              Log Out
            </Button>
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
