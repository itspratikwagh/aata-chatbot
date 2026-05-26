import { createTheme } from "@mui/material/styles";

// Brand palette mirrored from the existing AATA chatbot:
//   cyan #00AEEF, indigo #6366f1, ink #0f172a.
export function buildTheme(mode = "light") {
  const isDark = mode === "dark";
  return createTheme({
    palette: {
      mode,
      primary: { main: "#00AEEF", contrastText: "#ffffff" },
      secondary: { main: "#6366f1" },
      background: {
        default: isDark ? "#0b1220" : "#f1f7fb",
        paper: isDark ? "#111a2c" : "#ffffff",
      },
      text: {
        primary: isDark ? "#e2e8f0" : "#0f172a",
        secondary: isDark ? "#94a3b8" : "#475569",
      },
    },
    shape: { borderRadius: 14 },
    typography: {
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    components: {
      MuiButton: { styleOverrides: { root: { textTransform: "none", fontWeight: 600 } } },
      MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
    },
  });
}
