import { useState } from "react";
import { X, User as UserIcon, Lock, CheckCircle2, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { useAppContext } from "../../context/AppContext.tsx";
import { authApi } from "../../lib/api.ts";

interface ProfileSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ProfileSettingsModal({ isOpen, onClose }: ProfileSettingsModalProps) {
    const { user, updateUser } = useAppContext();

    const [activeTab, setActiveTab] = useState<"profile" | "password">("profile");

    // Profile state
    const [name, setName] = useState(user?.name ?? "");
    const [phone, setPhone] = useState(user?.phone ?? "");
    const [savingProfile, setSavingProfile] = useState(false);

    // Password state
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [changingPassword, setChangingPassword] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);

    if (!isOpen || !user) return null;

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = name.trim();
        const trimmedPhone = phone.trim();

        if (!trimmedName) {
            toast.error("Name cannot be empty.");
            return;
        }

        if (trimmedPhone && trimmedPhone.length < 6) {
            toast.error("Phone number must be at least 6 characters.");
            return;
        }

        setSavingProfile(true);
        try {
            const updatedUser = await authApi.updateProfile({
                name: trimmedName,
                phone: trimmedPhone,
            });
            updateUser(updatedUser);
            toast.success("Profile updated successfully!");
            onClose();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to update profile.");
        } finally {
            setSavingProfile(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError(null);

        if (!currentPassword) {
            setPasswordError("Please enter your current password.");
            return;
        }

        if (newPassword.length < 6) {
            setPasswordError("New password must be at least 6 characters.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError("New passwords do not match.");
            return;
        }

        if (currentPassword === newPassword) {
            setPasswordError("New password cannot be the same as your current password.");
            return;
        }

        setChangingPassword(true);
        try {
            const res = await authApi.changePassword({
                currentPassword,
                newPassword,
            });
            toast.success(res.message || "Password changed successfully!");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            onClose();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to change password.";
            setPasswordError(msg);
            toast.error(msg);
        } finally {
            setChangingPassword(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div
                className="fixed inset-0"
                onClick={onClose}
                aria-hidden="true"
            />

            <div className="relative w-full max-w-lg bg-white border border-outline-variant/30 rounded-lg shadow-2xl overflow-hidden z-10 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant/15 bg-surface/50">
                    <div>
                        <h2 className="font-display text-xl text-primary font-medium">Account Settings</h2>
                        <p className="text-[11px] text-black/55 mt-0.5">Manage your profile details and security credentials.</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-black/40 hover:text-primary hover:bg-surface rounded-full transition-colors cursor-pointer"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-outline-variant/15 px-6 pt-2 bg-surface/30">
                    <button
                        type="button"
                        onClick={() => setActiveTab("profile")}
                        className={`flex items-center gap-2 pb-3 pt-2 text-xs font-medium uppercase tracking-wider border-b-2 transition-colors cursor-pointer mr-6 ${
                            activeTab === "profile"
                                ? "border-secondary text-secondary"
                                : "border-transparent text-black/50 hover:text-primary"
                        }`}
                    >
                        <UserIcon size={14} />
                        Personal Info
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("password")}
                        className={`flex items-center gap-2 pb-3 pt-2 text-xs font-medium uppercase tracking-wider border-b-2 transition-colors cursor-pointer ${
                            activeTab === "password"
                                ? "border-secondary text-secondary"
                                : "border-transparent text-black/50 hover:text-primary"
                        }`}
                    >
                        <Lock size={14} />
                        Password & Security
                    </button>
                </div>

                {/* Tab 1: Profile Form */}
                {activeTab === "profile" && (
                    <form onSubmit={handleSaveProfile} className="p-6 space-y-5">
                        <div className="space-y-1.5">
                            <label className="block text-[11px] font-medium uppercase tracking-wider text-black/70">
                                Full Name
                            </label>
                            <input
                                type="text"
                                required
                                maxLength={80}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-3.5 py-2.5 text-xs bg-surface border border-outline-variant/40 focus:border-primary focus:bg-white rounded-xs outline-hidden transition-colors"
                                placeholder="Your full name"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                                <label className="block text-[11px] font-medium uppercase tracking-wider text-black/70">
                                    Email Address
                                </label>
                                <span className="text-[9px] uppercase tracking-wider text-black/40 bg-surface px-1.5 py-0.5 rounded-xs">
                                    Read-only
                                </span>
                            </div>
                            <input
                                type="email"
                                disabled
                                value={user.email}
                                className="w-full px-3.5 py-2.5 text-xs bg-black/5 text-black/60 border border-outline-variant/20 rounded-xs cursor-not-allowed"
                            />
                            <p className="text-[10px] text-black/45">Email address cannot be changed once registered.</p>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-[11px] font-medium uppercase tracking-wider text-black/70">
                                Phone Number (Optional)
                            </label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full px-3.5 py-2.5 text-xs bg-surface border border-outline-variant/40 focus:border-primary focus:bg-white rounded-xs outline-hidden transition-colors"
                                placeholder="+1 (555) 000-0000"
                            />
                        </div>

                        <div className="pt-2 flex justify-end gap-3 border-t border-outline-variant/15">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-black/60 hover:text-primary transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={savingProfile}
                                className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-secondary text-white text-[11px] font-medium uppercase tracking-widest transition-colors rounded-xs cursor-pointer disabled:opacity-50"
                            >
                                {savingProfile ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={13} />
                                        Save Changes
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}

                {/* Tab 2: Password Form */}
                {activeTab === "password" && (
                    <form onSubmit={handleChangePassword} className="p-6 space-y-4">
                        {passwordError && (
                            <div className="flex items-center gap-2 p-3 bg-error-container text-on-error-container text-xs rounded-xs">
                                <AlertCircle size={14} className="shrink-0" />
                                <span>{passwordError}</span>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="block text-[11px] font-medium uppercase tracking-wider text-black/70">
                                Current Password
                            </label>
                            <input
                                type="password"
                                required
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="w-full px-3.5 py-2.5 text-xs bg-surface border border-outline-variant/40 focus:border-primary focus:bg-white rounded-xs outline-hidden transition-colors"
                                placeholder="••••••••"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-[11px] font-medium uppercase tracking-wider text-black/70">
                                New Password
                            </label>
                            <input
                                type="password"
                                required
                                minLength={6}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-3.5 py-2.5 text-xs bg-surface border border-outline-variant/40 focus:border-primary focus:bg-white rounded-xs outline-hidden transition-colors"
                                placeholder="At least 6 characters"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-[11px] font-medium uppercase tracking-wider text-black/70">
                                Confirm New Password
                            </label>
                            <input
                                type="password"
                                required
                                minLength={6}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-3.5 py-2.5 text-xs bg-surface border border-outline-variant/40 focus:border-primary focus:bg-white rounded-xs outline-hidden transition-colors"
                                placeholder="Repeat new password"
                            />
                        </div>

                        <div className="pt-2 flex justify-end gap-3 border-t border-outline-variant/15">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-black/60 hover:text-primary transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={changingPassword}
                                className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-secondary text-white text-[11px] font-medium uppercase tracking-widest transition-colors rounded-xs cursor-pointer disabled:opacity-50"
                            >
                                {changingPassword ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Updating...
                                    </>
                                ) : (
                                    <>
                                        <Lock size={13} />
                                        Update Password
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
