import { useState } from "react";
import { Box, IconButton, TextField } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";

export default function MessageInput({ onSend, disabled }) {
  const [value, setValue] = useState("");

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <Box
      sx={{
        p: 1.5,
        borderTop: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        display: "flex",
        gap: 1,
        alignItems: "flex-end",
        // Respect iPhone home indicator safe area.
        pb: "calc(12px + env(safe-area-inset-bottom))",
      }}
    >
      <TextField
        fullWidth
        multiline
        maxRows={5}
        size="small"
        placeholder="Ask about your Salesforce data…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 3 } }}
      />
      <IconButton
        color="primary"
        onClick={submit}
        disabled={disabled || !value.trim()}
        sx={{
          bgcolor: "primary.main",
          color: "primary.contrastText",
          "&:hover": { bgcolor: "primary.dark" },
          "&.Mui-disabled": { bgcolor: "action.disabledBackground" },
        }}
      >
        <SendIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
