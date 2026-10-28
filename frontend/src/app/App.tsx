import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { ConfirmProvider } from './providers/ConfirmProvider';
import { DashboardProvider } from './providers/DashboardProvider';
import { ToastProvider } from './providers/ToastProvider';
import { DevicePage } from '../pages/DevicePage';
import { HistoryPage } from '../pages/HistoryPage';
import { LogsPage } from '../pages/LogsPage';
import { OverviewPage } from '../pages/OverviewPage';
import { SettingsPage } from '../pages/SettingsPage';

export function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <ConfirmProvider>
          <DashboardProvider>
            <AppShell>
              <Routes>
                <Route path="/" element={<Navigate to="/overview" replace />} />
                <Route path="/overview" element={<OverviewPage />} />
                <Route path="/device" element={<DevicePage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/logs" element={<LogsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/overview" replace />} />
              </Routes>
            </AppShell>
          </DashboardProvider>
        </ConfirmProvider>
      </ToastProvider>
    </HashRouter>
  );
}
