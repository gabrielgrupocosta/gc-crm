"use client";

import { SidebarProvider } from '../contexts/SidebarContext';
import { ToastProvider } from '../components/UI/Toast';
import { AuthProvider } from '../contexts/AuthContext';

export function Providers({ children }) {
  return (
    <SidebarProvider>
      <ToastProvider>
        <AuthProvider>
          {children}
        </AuthProvider>
      </ToastProvider>
    </SidebarProvider>
  );
}
