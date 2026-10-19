import { createBrowserRouter, Navigate } from "react-router-dom";
import AppShell from "./AppShell";
import { AuthLayout } from "./AuthLayout";
import { PublicLayout } from "./PublicLayout";
import { PrivateRoute } from "./PrivateRoute";
import { RoleRoute } from "./RoleRoute";

// Pages
import { DashboardPage } from "@/features/dashboard/pages/DashboardPage";
import { ListPage, CalendarPage, DetailPage, NewPage, EditPage } from "@/features/events/pages";
import { PublicRequestDetailPage, PublicRequestsListPage } from "@/features/publicRequests/pages";
import { SpacesPage, DepartmentsPage } from "@/features/catalogs";
import { UsersPage } from "@/features/admin/users/pages/UsersPage";
import { ProfilePage } from "@/features/users/pages/ProfilePage";
import {
  PublicCalendarPage,
  RequestFormPage,
  TrackingPage,
  RequestConfirmationPage,
  UnauthorizedPage,
  LoginPage,
} from "@/features/public/pages";

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [{ path: "/login", element: <LoginPage /> }],
  },

  // ========================
  // Public routes
  // ========================
  {
    element: <PublicLayout />,
    children: [
      { path: "/public/calendar", element: <PublicCalendarPage /> },
      { path: "/solicitud", element: <RequestFormPage /> },
      { path: "/solicitud/confirmacion/:trackingUuid", element: <RequestConfirmationPage /> },
      { path: "/track/:uuid", element: <TrackingPage /> },
    ],
  },

  // Unauthorized page
  { path: "/unauthorized", element: <UnauthorizedPage /> },

  // ========================
  // Protected routes (require auth)
  // ========================
  {
    element: <PrivateRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/", element: <Navigate to="/dashboard" replace /> },
          { path: "/dashboard", element: <DashboardPage /> },
          { path: "/profile", element: <ProfilePage /> },

          // Events (read)
          {
            element: <RoleRoute action="read" subject="Event" />,
            children: [
              { path: "/events", element: <ListPage /> },
              { path: "/events/:id", element: <DetailPage /> },
              { path: "/calendar", element: <CalendarPage /> },
            ],
          },

          // Public Requests (read)
          {
            element: <RoleRoute action="read" subject="PublicRequest" />,
            children: [
              { path: "/solicitudes", element: <PublicRequestsListPage /> },
              { path: "/solicitudes/:id", element: <PublicRequestDetailPage /> },
            ],
          },

          // Create event (create)
          {
            element: <RoleRoute action="create" subject="Event" />,
            children: [{ path: "/events/new", element: <NewPage /> }],
          },

          // Edit event (update)
          {
            element: <RoleRoute action="update" subject="Event" />,
            children: [{ path: "/events/:id/edit", element: <EditPage /> }],
          },

          // Catalogs (manageCatalogs)
          {
            element: <RoleRoute action="manageCatalogs" subject="Space" />,
            children: [
              { path: "/catalog/spaces", element: <SpacesPage /> },
              { path: "/catalog/departments", element: <DepartmentsPage /> },
            ],
          },

          // Admin users (manage all)
          {
            element: <RoleRoute action="manage" subject="User" />,
            children: [{ path: "/admin/users", element: <UsersPage /> }],
          },
        ],
      },
    ],
  },

  // Fallback
  { path: "*", element: <Navigate to="/dashboard" replace /> },
]);
