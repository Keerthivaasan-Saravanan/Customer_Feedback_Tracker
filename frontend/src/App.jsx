import { AppProvider, useApp } from "./context/AppContext.jsx";
import { useHashRoute } from "./hooks/useHashRoute.js";
import Toasts from "./components/Toasts.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import FeedbackPage from "./pages/FeedbackPage.jsx";
import SubmitPage from "./pages/SubmitPage.jsx";

const PAGES = {
  "/dashboard": DashboardPage,
  "/feedback": FeedbackPage,
  "/submit": SubmitPage,
};

function Shell() {
  const route = useHashRoute();
  const { toasts, dismiss } = useApp();
  const Page = PAGES[route] ?? DashboardPage;

  return (
    <>
      <Page key={route} />
      <Toasts toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <Shell />
      </AppProvider>
    </ErrorBoundary>
  );
}
