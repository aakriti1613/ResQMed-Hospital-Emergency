
import { createHashRouter, Navigate } from 'react-router-dom';
import { LandingPage } from './screens/public/LandingPage';
import { LoginPage } from './screens/public/LoginPage';
import { SignupPage } from './screens/public/SignupPage';
import { AppShell } from './shell/AppShell';
import { DashboardPage } from './screens/app/DashboardPage';
import { HelpPage } from './screens/app/HelpPage';
import { ProfilePage } from './screens/app/ProfilePage';
import { SosPage } from './screens/app/SosPage';
import { AppointmentsPage } from './screens/app/AppointmentsPage';
import { VaultPage } from './screens/app/VaultPage';
import { MedicalIdPage } from './screens/app/MedicalIdPage';
import { SafetyCirclePage } from './screens/app/SafetyCirclePage';
import { TripsPage } from './screens/app/TripsPage';
import { SafetyHubPage } from './screens/app/SafetyHubPage';
import { CareSpecialtiesPage } from './screens/app/care/CareSpecialtiesPage';
import { CareDoctorsPage } from './screens/app/care/CareDoctorsPage';
import { CareHospitalsPage } from './screens/app/care/CareHospitalsPage';
import { CareBookPage } from './screens/app/care/CareBookPage';
import { DoctorPortalPage } from './screens/portals/DoctorPortalPage';
import { HospitalPortalPage } from './screens/portals/HospitalPortalPage';
import { AdminPanel } from './screens/admin/AdminPanel';
import { NotFoundPage } from './screens/NotFoundPage';
import { RootLayout } from './shell/RootLayout';
import { RouteErrorFallback } from './components/RouteErrorFallback';
import { AnalyticsDashboardPage } from './screens/app/AnalyticsDashboardPage';
import { HealthChallengesPage } from './screens/app/HealthChallengesPage';
import { ChallengeEventPage } from './screens/app/ChallengeEventPage';
import { ChallengeQuizPage } from './screens/app/ChallengeQuizPage';
import { ChallengeScenarioPage } from './screens/app/ChallengeScenarioPage';
import { CoinsPage } from './screens/app/CoinsPage';
import { RequireAuth } from './auth/RequireAuth';

export const router = createHashRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteErrorFallback />,
    children: [
      // ── Public / auth
      { index: true, element: <LandingPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'signup', element: <SignupPage /> },

      // ── Full-screen emergency (no shell, no nav)
      { path: 'app/sos', element: <RequireAuth><SosPage /></RequireAuth> },
      { path: 'admin', element: <AdminPanel /> },

      // ── Main app with bottom nav
      {
        path: 'app',
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },       // 🏠 Home tab
          { path: 'help', element: <HelpPage /> },            // 🤝 Help tab
          { path: 'profile', element: <ProfilePage /> },      // 👤 Profile tab

          // ── Hospital / Care flow
          //   /app/care                       → Department picker (home)
          //   /app/care/department/:deptId    → Nearby hospitals for that dept
          //   /app/care/hospital/:hospitalId  → Hospital details + doctors
          //   /app/care/book?doctor=&hospital=&dept=  → Booking screen
          { path: 'care', element: <CareSpecialtiesPage /> },
          { path: 'care/department/:deptId', element: <CareHospitalsPage /> },
          { path: 'care/hospital/:hospitalId', element: <CareDoctorsPage /> },
          { path: 'care/book', element: <CareBookPage /> },
          // Legacy shortcuts kept working
          { path: 'care/hospitals', element: <CareHospitalsPage /> },
          { path: 'care/doctors', element: <CareDoctorsPage /> },
          { path: 'appointments', element: <AppointmentsPage /> },
          { path: 'vault', element: <VaultPage /> },

          // ── Trips (demo)
          { path: 'trips', element: <TripsPage /> },
          { path: 'safety', element: <SafetyHubPage /> },
          { path: 'travel-safety', element: <Navigate to="/app/safety" replace /> },

          // ── Safety
          { path: 'medical-id', element: <MedicalIdPage /> },
          { path: 'safety-circle', element: <SafetyCirclePage /> },

          // ── Analytics
          { path: 'analytics', element: <AnalyticsDashboardPage /> },

          // ── Health challenges & readiness (specific routes before :eventId)
          { path: 'challenges', element: <HealthChallengesPage /> },
          { path: 'challenges/:eventId/quiz', element: <ChallengeQuizPage /> },
          { path: 'challenges/:eventId/scenario/:scenarioId', element: <ChallengeScenarioPage /> },
          { path: 'challenges/:eventId', element: <ChallengeEventPage /> },
          { path: 'points', element: <CoinsPage /> },

          // legacy redirects so old links don't 404
          { path: 'settings', element: <Navigate to="/app/profile" replace /> },
          { path: 'helper', element: <Navigate to="/app/help" replace /> },
        ],
      },

      // ── Portals
      { path: 'doctor', element: <DoctorPortalPage /> },
      { path: 'hospital', element: <HospitalPortalPage /> },

      // ── Fallback
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
