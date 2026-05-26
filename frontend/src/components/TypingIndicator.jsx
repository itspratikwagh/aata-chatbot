import { Avatar, Box, Paper, Stack, keyframes } from "@mui/material";
import InsightsIcon from "@mui/icons-material/Insights";

const bounce = keyframes`
  0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
  30% { transform: translateY(-6px); opacity: 1; }
`;

export default function TypingIndicator() {
  return (
    <Stack direction="row" spacing={1.25} sx={{ mb: 2 }}>
      <Avatar
        sx={{ width: 32, height: 32, background: "linear-gradient(135deg, #00AEEF, #6366f1)" }}
      >
        <InsightsIcon sx={{ fontSize: 18 }} />
      </Avatar>
      <Paper
        elevation={0}
        sx={{
          px: 2,
          py: 1.5,
          borderRadius: "16px 16px 16px 4px",
          border: 1,
          borderColor: "divider",
        }}
      >
        <Stack direction="row" spacing={0.75}>
          {[0, 0.2, 0.4].map((delay) => (
            <Box
              key={delay}
              sx={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                bgcolor: "text.secondary",
                animation: `${bounce} 1.4s infinite`,
                animationDelay: `${delay}s`,
              }}
            />
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
}
