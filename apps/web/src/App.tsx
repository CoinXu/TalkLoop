import { Snackbar } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "./api/client";
import { getHome, getLearningUnit } from "./api/learningApi";
import { AdminContentPage } from "./features/admin/AdminContentPage";
import { HomePage } from "./features/home/HomePage";
import { LearningPage } from "./features/learning/LearningPage";
import { LoginDialog } from "./features/learning/LoginDialog";
import { loadSession } from "./session/sessionStore";
import type { HomeResponse, LearningUnitResponse, Session } from "./types";

type AdminSection = "create" | "import" | "operations";

type ViewState = { name: "home" } | { name: "learning"; unitId: string } | { name: "admin"; section: AdminSection };

const emptyHome: HomeResponse = {
  continueLearning: null,
  units: [],
};

export function App(): JSX.Element {
  const { t } = useTranslation(["common", "errors"]);
  const [view, setView] = useState<ViewState>(() => parseRoute());
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [home, setHome] = useState<HomeResponse>(emptyHome);
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeError, setHomeError] = useState<string | null>(null);
  const [learningUnit, setLearningUnit] = useState<LearningUnitResponse | null>(null);
  const [learningLoading, setLearningLoading] = useState(false);
  const [learningError, setLearningError] = useState<string | null>(null);
  const [loginState, setLoginState] = useState<{ open: boolean; reason: string; afterLogin?: () => void }>({
    open: false,
    reason: "",
  });
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const resolveError = useCallback(
    (caught: unknown): string => {
      if (caught instanceof ApiError) {
        if (caught.code === "authRequired") {
          return t("authRequired", { ns: "errors" });
        }
        if (caught.code === "requestFailed") {
          return t("requestFailed", { ns: "errors" });
        }
        return caught.message;
      }
      return caught instanceof Error ? caught.message : t("requestFailed", { ns: "errors" });
    },
    [t],
  );

  const loadHome = useCallback(async () => {
    setHomeLoading(true);
    setHomeError(null);
    try {
      setHome(await getHome());
    } catch (caught) {
      setHomeError(resolveError(caught));
    } finally {
      setHomeLoading(false);
    }
  }, [resolveError]);

  const loadLearningUnit = useCallback(
    async (unitId: string) => {
      setLearningLoading(true);
      setLearningError(null);
      try {
        setLearningUnit(await getLearningUnit(unitId));
      } catch (caught) {
        setLearningError(resolveError(caught));
      } finally {
        setLearningLoading(false);
      }
    },
    [resolveError],
  );

  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  useEffect(() => {
    const handleHashChange = (): void => setView(parseRoute());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (view.name === "learning") {
      void loadLearningUnit(view.unitId);
    }
  }, [loadLearningUnit, view]);

  function navigate(nextView: ViewState): void {
    setView(nextView);
    const nextHash = toHash(nextView);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }

  function openUnit(unitId: string): void {
    navigate({ name: "learning", unitId });
  }

  function openLogin(reason = t("authRequired", { ns: "errors" }), afterLogin?: () => void): void {
    setLoginState(afterLogin ? { afterLogin, open: true, reason } : { open: true, reason });
  }

  function handleLoggedIn(nextSession: Session): void {
    setSession(nextSession);
    setLoginState((current) => {
      current.afterLogin?.();
      return { open: false, reason: "" };
    });
    void loadHome();
  }

  return (
    <>
      {view.name === "home" ? (
        <HomePage
          error={homeError}
          home={home}
          loading={homeLoading}
          onLogin={() => openLogin()}
          onOpenAdmin={() => navigate({ name: "admin", section: "create" })}
          onOpenUnit={openUnit}
          onRefresh={() => void loadHome()}
          session={session}
        />
      ) : null}
      {view.name === "learning" ? (
        <LearningPage
          error={learningError}
          loading={learningLoading}
          onBack={() => {
            navigate({ name: "home" });
            void loadHome();
          }}
          onLoginRequired={openLogin}
          onReload={() => void loadLearningUnit(view.unitId)}
          session={session}
          unit={learningUnit}
          unitId={view.unitId}
        />
      ) : null}
      {view.name === "admin" ? (
        <AdminContentPage
          onBack={() => {
            navigate({ name: "home" });
            void loadHome();
          }}
          onLoginRequired={openLogin}
          onSectionChange={(section) => navigate({ name: "admin", section })}
          section={view.section}
          session={session}
        />
      ) : null}
      <LoginDialog
        onCancel={() => setLoginState({ open: false, reason: "" })}
        onLoggedIn={handleLoggedIn}
        open={loginState.open}
        reason={loginState.reason}
      />
      <Snackbar
        autoHideDuration={3000}
        message={snackbar}
        onClose={() => setSnackbar(null)}
        open={Boolean(snackbar)}
      />
    </>
  );
}

function parseRoute(): ViewState {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [area, idOrSection] = hash.split("/");
  if (area === "learning" && idOrSection) {
    return { name: "learning", unitId: idOrSection };
  }
  if (area === "admin") {
    return { name: "admin", section: parseAdminSection(idOrSection) };
  }
  return { name: "home" };
}

function parseAdminSection(value: string | undefined): AdminSection {
  return value === "import" || value === "operations" ? value : "create";
}

function toHash(view: ViewState): string {
  if (view.name === "learning") {
    return `#/learning/${view.unitId}`;
  }
  if (view.name === "admin") {
    return `#/admin/${view.section}`;
  }
  return "#/";
}
