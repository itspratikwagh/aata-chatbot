import { useEffect, useMemo, useRef, useState } from "react";
import {
  AppBar,
  Box,
  Container,
  CssBaseline,
  IconButton,
  Stack,
  ThemeProvider,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import InsightsIcon from "@mui/icons-material/Insights";
import { buildTheme } from "./theme.js";
import { sendChat } from "./api.js";
import MessageBubble from "./components/MessageBubble.jsx";
import TypingIndicator from "./components/TypingIndicator.jsx";
import SuggestedChips from "./components/SuggestedChips.jsx";
import MessageInput from "./components/MessageInput.jsx";

const WELCOME = {
  role: "assistant",
  content:
    "Hi! I'm your **read-only Salesforce assistant**. Ask me anything about your data — accounts, contacts, opportunities, leads, cases — in plain English, and I'll fetch live answers from your org.\n\nI can only read, never change, your data.",
};

const THEME_KEY = "aata_sf_theme";

export default function App() {
  const [mode, setMode] = useState(
    () => localStorage.getItem(THEME_KEY) || "light"
  );
  const [messages, setMessages] = useState([WELCOME]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  const theme = useMemo(() => buildTheme(mode), [mode]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, mode);
  }, [mode]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  const onSend = async (text) => {
    if (loading) return;
    const userMsg = { role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);

    // History = prior text turns only (drop the synthetic welcome message).
    const history = nextMessages
      .filter((m) => m !== WELCOME)
      .slice(0, -1)
      .map(({ role, content }) => ({ role, content }));

    try {
      const { answer, toolCalls } = await sendChat(text, history);
      setMessages((prev) => [...prev, { role: "assistant", content: answer, toolCalls }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ ${err.message || "Something went wrong. Please try again."}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const showSuggestions = messages.length <= 1 && !loading;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          height: "100dvh",
          display: "flex",
          flexDirection: "column",
          bgcolor: "background.default",
        }}
      >
        <AppBar
          position="static"
          elevation={0}
          sx={{
            background: "linear-gradient(135deg, #0f172a 0%, #0b3a5e 100%)",
            borderBottom: "2px solid",
            borderImage: "linear-gradient(90deg, #00AEEF, #6366f1) 1",
          }}
        >
          <Toolbar variant="dense" sx={{ pt: "env(safe-area-inset-top)" }}>
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: 2,
                mr: 1.5,
                display: "grid",
                placeItems: "center",
                background: "linear-gradient(135deg, #00AEEF, #6366f1)",
              }}
            >
              <InsightsIcon sx={{ fontSize: 20, color: "#fff" }} />
            </Box>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
                Salesforce Assistant
              </Typography>
              <Typography variant="caption" sx={{ color: "#94a3b8" }}>
                Read-only · live data
              </Typography>
            </Box>
            <Tooltip title={mode === "dark" ? "Light mode" : "Dark mode"}>
              <IconButton
                color="inherit"
                onClick={() => setMode((m) => (m === "dark" ? "light" : "dark"))}
              >
                {mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>

        <Box ref={scrollRef} sx={{ flex: 1, overflowY: "auto" }}>
          <Container maxWidth="md" sx={{ py: 2 }}>
            {messages.map((m, i) => (
              <MessageBubble key={i} role={m.role} content={m.content} toolCalls={m.toolCalls} />
            ))}
            {loading && <TypingIndicator />}
          </Container>
        </Box>

        <Box sx={{ bgcolor: "background.paper" }}>
          <Container maxWidth="md" disableGutters>
            {showSuggestions && (
              <SuggestedChips onPick={onSend} disabled={loading} />
            )}
            <MessageInput onSend={onSend} disabled={loading} />
          </Container>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
