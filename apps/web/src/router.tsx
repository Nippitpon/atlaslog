import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell.js'
import { DashboardPage } from './features/dashboard/DashboardPage.js'
import { ProgramsPage } from './features/programs/ProgramsPage.js'
import { ProgramOverviewPage } from './features/programs/ProgramOverviewPage.js'
import { CreateProgramPage } from './features/programs/CreateProgramPage.js'
import { WeekDetailPage } from './features/programs/WeekDetailPage.js'
import { LoggerPage } from './features/logger/LoggerPage.js'
import { HistoryPage } from './features/history/HistoryPage.js'
import { LibraryPage } from './features/library/LibraryPage.js'
import { ExerciseDetailPage } from './features/library/ExerciseDetailPage.js'
import { ProfilePage } from './features/profile/ProfilePage.js'
import { RunsPage } from './features/runs/RunsPage.js'
import { AdminPage } from './features/admin/AdminPage.js'
import { CoachPage } from './features/coach/CoachPage.js'
import { AthleteDetailPage } from './features/coach/AthleteDetailPage.js'
import { AuthPage } from './features/auth/AuthPage.js'

export const router = createBrowserRouter([
  { path: '/login', element: <AuthPage /> },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true,                                         element: <DashboardPage /> },
      { path: 'programs',                                    element: <ProgramsPage /> },
      { path: 'programs/new',                                element: <CreateProgramPage /> },
      { path: 'programs/:programId',                         element: <ProgramOverviewPage /> },
      { path: 'programs/:programId/week/:weekId',            element: <WeekDetailPage /> },
      { path: 'workout',                                     element: <LoggerPage /> },
      { path: 'history',                                     element: <HistoryPage /> },
      { path: 'runs',                                        element: <RunsPage /> },
      { path: 'library',                                     element: <LibraryPage /> },
      { path: 'library/:exerciseId',                         element: <ExerciseDetailPage /> },
      { path: 'profile',                                     element: <ProfilePage /> },
      { path: 'admin',                                       element: <AdminPage /> },
      { path: 'coach',                                       element: <CoachPage /> },
      { path: 'coach/:athleteId',                            element: <AthleteDetailPage /> },
    ],
  },
])
