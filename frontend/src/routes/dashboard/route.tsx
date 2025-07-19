import { DashboardNav } from '@/components/DashboardNav';
import { ThemeProvider } from '@/components/theme-provider';
import { api } from '@/lib/api';
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    try {
      const response = await api.auth['user-data'].$get();
      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }
      return await response.json();
    } catch (error) {
      throw redirect({
        to: '/login',
        search: {
          redirect: '/dashboard',
        },
      });
    }
  },
  component: () => {
    return (
      <ThemeProvider >
        <div>
          <DashboardNav />
          <div className="flex">
            <div className="flex-1 p-3">
              <Outlet />
            </div>
          </div>
        </div>
      </ThemeProvider>
    );
  },
})