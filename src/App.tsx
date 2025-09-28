import { AccumulationPage } from '@/pages/accumulation/page';
import { AssignmentPage } from '@/pages/assignment/page';
import { AttendancePage } from '@/pages/attendance/page';
import { HomePage } from '@/pages/page';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';

import { Footer } from '@/components/footer';
import { Header } from '@/components/header';
import { PWAPrompt } from '@/components/pwa-prompt';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';

export default function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="examtools-theme">
      <Router>
        <div className="bg-background min-h-screen">
          <Header />

          <main>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/assignment" element={<AssignmentPage />} />
              <Route path="/attendance" element={<AttendancePage />} />
              <Route path="/accumulation" element={<AccumulationPage />} />
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
