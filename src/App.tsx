import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';

import { Footer } from '@/components/footer';
import { Header } from '@/components/header';
import { PWAPrompt } from '@/components/pwa-prompt';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';

import { AssignmentPage } from '@/pages/assignment/page';
import { AttendancePage } from '@/pages/attendance/page';
import { EditPage } from '@/pages/edit/page';
import { HomePage } from '@/pages/page';
import { RenumerationPage } from '@/pages/renumeration/page';

export default function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="examtools-theme">
      <Router>
        <div className="bg-background flex min-h-screen flex-col">
          <Header />

          <main className="flex-1">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/assignment" element={<AssignmentPage />} />
              <Route path="/attendance" element={<AttendancePage />} />
              <Route path="/renumeration" element={<RenumerationPage />} />
              <Route path="/edit" element={<EditPage />} />
            </Routes>
          </main>

          <Footer />

          <Toaster />
          <PWAPrompt />
        </div>
      </Router>
    </ThemeProvider>
  );
}
