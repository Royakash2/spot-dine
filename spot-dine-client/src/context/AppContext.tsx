/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
    AUTH_EXPIRED_EVENT,
    authApi,
    getToken,
    setToken as persistToken,
} from "../lib/api.ts";
import type { Role, User } from "../types.ts";

interface AppContextType {
    user: User | null;
    token: string | null;
    loading: boolean;
    isAuthenticated: boolean;
    isAuthModalOpen: boolean;
    setAuthModalOpen: (open: boolean) => void;
    login: (email: string, password: string) => Promise<void>;
    register: (
        name: string,
        email: string,
        password: string,
        phone?: string,
        role?: Extract<Role, "user" | "owner">,
    ) => Promise<void>;
    logout: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

interface Props {
    children: React.ReactNode;
}

export const AppContextProvider = ({ children }: Props) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(getToken);
    const [loading, setLoading] = useState<boolean>(Boolean(getToken()));
    const [isAuthModalOpen, setAuthModalOpen] = useState<boolean>(false);

    const applySession = useCallback((nextToken: string, nextUser: User) => {
        persistToken(nextToken);
        setToken(nextToken);
        setUser(nextUser);
        setLoading(false);
    }, []);

    const clearSession = useCallback(() => {
        persistToken(null);
        setToken(null);
        setUser(null);
    }, []);

    // Rejections propagate to the caller (AuthModal) so the server's message
    // can be shown instead of a silent failure.
    const login = async (email: string, password: string) => {
        const session = await authApi.login(email, password);
        applySession(session.token, session.user);
    };

    const register = async (
        name: string,
        email: string,
        password: string,
        phone?: string,
        role: Extract<Role, "user" | "owner"> = "user",
    ) => {
        const session = await authApi.register({ name, email, password, phone, role });
        applySession(session.token, session.user);
    };

    const logout = () => {
        clearSession();
        window.location.href = "/";
    };

    // Restore the session once on load. Login/register set the user directly,
    // so this does not need to re-run when the token changes.
    useEffect(() => {
        const restoreSession = async () => {
            if (!getToken()) {
                setLoading(false);
                return;
            }

            try {
                setUser(await authApi.me());
            } catch {
                clearSession();
            } finally {
                setLoading(false);
            }
        };

        void restoreSession();
    }, [clearSession]);

    // A 401 from a normal request means the stored token is no longer valid.
    useEffect(() => {
        const handleExpired = () => {
            clearSession();
            setAuthModalOpen(true);
        };

        window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
        return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    }, [clearSession]);

    const value: AppContextType = {
        user,
        token,
        loading,
        isAuthenticated: !!user,
        isAuthModalOpen,
        setAuthModalOpen,
        login,
        register,
        logout,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error("useAppContext must be used within AppContextProvider");
    }
    return context;
};
