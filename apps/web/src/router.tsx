import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell.js'
import { DashboardPage } from './features/dashboard/DashboardPage.js'
import { ProgramsPage } from './features/programs/ProgramsPage.js'
import { ProgramOverviewPage } from './features/programs/ProgramOverviewPage.js'
import { WeekDetailPage } from './features/programs/WeekDetailPage.js'
import { LoggerPage } from './features/logger/LoggerPage.js'
import { HistoryPage } from './features/history/HistoryPage.js'
import { LibraryPage } from './features/library/LibraryPage.js'
import { ProfilePage } from './features/profile/ProfilePage.js'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true,                                         element: <DashboardPage /> },
      { path: 'programs',                                    element: <ProgramsPage /> },
      { path: 'programs/:programId',                         element: <ProgramOverviewPage /> },
      { path: 'programs/:programId/week/:weekId',            element: <WeekDetailPage /> },
      { path: 'workout',                                     element: <LoggerPage /> },
      { path: 'history',                                     element: <HistoryPage /> },
      { path: 'library',                                     element: <LibraryPage /> },
      { path: 'profile',                                     element: <ProfilePage /> },
    ],
  },
])
