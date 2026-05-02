import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { zhCN as muiZhCN, enUS as muiEnUS } from "@mui/material/locale";
import { useMemo } from "react";
import type { PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";

export function AppThemeProvider({ children }: PropsWithChildren): JSX.Element {
  const { i18n } = useTranslation();
  const muiLocale = i18n.language === "en-US" ? muiEnUS : muiZhCN;

  const theme = useMemo(
    () =>
      createTheme(
        {
          palette: {
            mode: "light",
            primary: {
              main: "#2454d6",
            },
            secondary: {
              main: "#008575",
            },
            background: {
              default: "#f7f8fb",
            },
          },
          shape: {
            borderRadius: 8,
          },
          typography: {
            fontFamily:
              'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          },
          components: {
            MuiButton: {
              defaultProps: {
                disableElevation: true,
              },
              styleOverrides: {
                root: {
                  textTransform: "none",
                },
              },
            },
          },
        },
        muiLocale,
      ),
    [muiLocale],
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
