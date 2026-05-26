import { Box, Chip, Stack, Typography } from "@mui/material";

const SUGGESTIONS = [
  "Which open opportunities close this month?",
  "List accounts with no activity in the last 90 days.",
  "How many new leads came in this week, by source?",
  "Show my top 5 open opportunities by amount.",
  "Which cases are still open and unassigned?",
];

export default function SuggestedChips({ onPick, disabled }) {
  return (
    <Box sx={{ px: 2, pb: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ pl: 0.5 }}>
        Try asking
      </Typography>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
        {SUGGESTIONS.map((q) => (
          <Chip
            key={q}
            label={q}
            variant="outlined"
            color="primary"
            clickable
            disabled={disabled}
            onClick={() => onPick(q)}
            sx={{ borderRadius: 4 }}
          />
        ))}
      </Stack>
    </Box>
  );
}
