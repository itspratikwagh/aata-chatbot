import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Avatar,
  Box,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InsightsIcon from "@mui/icons-material/Insights";
import PersonIcon from "@mui/icons-material/Person";
import Markdown from "./Markdown.jsx";

/** A single chat message. `toolCalls` (assistant only) shows what was fetched. */
export default function MessageBubble({ role, content, toolCalls }) {
  const isUser = role === "user";

  return (
    <Stack
      direction="row"
      spacing={1.25}
      justifyContent={isUser ? "flex-end" : "flex-start"}
      sx={{ mb: 2 }}
    >
      {!isUser && (
        <Avatar
          sx={{
            width: 32,
            height: 32,
            background: "linear-gradient(135deg, #00AEEF, #6366f1)",
          }}
        >
          <InsightsIcon sx={{ fontSize: 18 }} />
        </Avatar>
      )}

      <Box sx={{ maxWidth: "86%" }}>
        <Paper
          elevation={0}
          sx={{
            px: 1.75,
            py: 1.25,
            borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
            color: isUser ? "primary.contrastText" : "text.primary",
            background: isUser
              ? "linear-gradient(135deg, #00AEEF, #1e90f5)"
              : (theme) => theme.palette.background.paper,
            border: isUser ? "none" : 1,
            borderColor: "divider",
          }}
        >
          {isUser ? (
            <Typography variant="body2" sx={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
              {content}
            </Typography>
          ) : (
            <Markdown>{content}</Markdown>
          )}
        </Paper>

        {!isUser && toolCalls?.length > 0 && (
          <Accordion
            disableGutters
            elevation={0}
            sx={{
              mt: 0.75,
              bgcolor: "transparent",
              "&:before": { display: "none" },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon fontSize="small" />}
              sx={{ minHeight: 0, p: 0, "& .MuiAccordionSummary-content": { my: 0.5 } }}
            >
              <Typography variant="caption" color="text.secondary">
                Data fetched · {toolCalls.length} step{toolCalls.length > 1 ? "s" : ""}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0, pb: 1 }}>
              <Stack spacing={0.75}>
                {toolCalls.map((call, i) => (
                  <Box key={i}>
                    <Chip
                      size="small"
                      label={call.name}
                      color={call.isError ? "error" : "default"}
                      sx={{ mr: 1, fontFamily: "ui-monospace, Menlo, monospace" }}
                    />
                    {(call.input?.query || call.input?.search || call.input?.objectName) && (
                      <Box
                        component="code"
                        sx={{
                          fontSize: "0.72rem",
                          color: "text.secondary",
                          wordBreak: "break-word",
                          fontFamily: "ui-monospace, Menlo, monospace",
                        }}
                      >
                        {call.input.query || call.input.search || call.input.objectName}
                      </Box>
                    )}
                  </Box>
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>
        )}
      </Box>

      {isUser && (
        <Avatar sx={{ width: 32, height: 32, bgcolor: "secondary.main" }}>
          <PersonIcon sx={{ fontSize: 18 }} />
        </Avatar>
      )}
    </Stack>
  );
}
