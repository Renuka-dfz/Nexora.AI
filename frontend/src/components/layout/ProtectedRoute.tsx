import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  onNavigate?: (path: string) => void;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  onNavigate,
}) => {
  const { isAuthenticated, hasCompany, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F7F5] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-[#AF5000] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#647078] font-medium">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (onNavigate) {
      onNavigate('/login');
    }
    return null;
  }

  if (!hasCompany) {
    if (onNavigate) {
      onNavigate('/onboarding');
    }
    return null;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return (
      <div className="min-h-screen bg-[#F8F7F5] flex items-center justify-center p-6">
        <div className="bg-white border border-[#DFDFDC] rounded-xl p-8 max-w-md w-full text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-[20px] font-semibold text-[#172126] mb-2">Access Restricted</h2>
          <p className="text-sm text-[#647078] mb-6">
            Your current role (<span className="font-semibold text-[#172126] uppercase tracking-wider text-xs">{role}</span>) does not have permission to access this section.
          </p>
          <button
            onClick={() => onNavigate && onNavigate('/overview')}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#AF5000] text-white text-sm font-medium hover:bg-[#934300] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Overview
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
