import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Box,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

/** Renders assistant Markdown (incl. GFM tables) with MUI styling. */
export default function Markdown({ children }) {
  return (
    <Box sx={{ "& > :first-of-type": { mt: 0 }, "& > :last-child": { mb: 0 } }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <Typography variant="body2" sx={{ my: 0.75, lineHeight: 1.6 }}>
              {children}
            </Typography>
          ),
          a: ({ href, children }) => (
            <Link href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </Link>
          ),
          ul: ({ children }) => (
            <Box component="ul" sx={{ my: 0.75, pl: 3 }}>
              {children}
            </Box>
          ),
          ol: ({ children }) => (
            <Box component="ol" sx={{ my: 0.75, pl: 3 }}>
              {children}
            </Box>
          ),
          li: ({ children }) => (
            <Typography component="li" variant="body2" sx={{ my: 0.25, lineHeight: 1.6 }}>
              {children}
            </Typography>
          ),
          // react-markdown v9 dropped the `inline` prop; detect block code by
          // a language class or a newline in the content.
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children }) => {
            const text = String(children ?? "");
            const isBlock = /language-/.test(className || "") || text.includes("\n");
            return isBlock ? (
              <Box
                component="pre"
                sx={{
                  p: 1.5,
                  my: 1,
                  borderRadius: 2,
                  bgcolor: "action.hover",
                  overflowX: "auto",
                  fontFamily: "ui-monospace, Menlo, monospace",
                  fontSize: "0.82em",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                <code>{children}</code>
              </Box>
            ) : (
              <Box
                component="code"
                sx={{
                  px: 0.6,
                  py: 0.2,
                  borderRadius: 1,
                  bgcolor: "action.hover",
                  fontFamily: "ui-monospace, Menlo, monospace",
                  fontSize: "0.85em",
                }}
              >
                {children}
              </Box>
            );
          },
          table: ({ children }) => (
            <TableContainer sx={{ my: 1, border: 1, borderColor: "divider", borderRadius: 2 }}>
              <Table size="small">{children}</Table>
            </TableContainer>
          ),
          thead: ({ children }) => <TableHead>{children}</TableHead>,
          tbody: ({ children }) => <TableBody>{children}</TableBody>,
          tr: ({ children }) => <TableRow>{children}</TableRow>,
          th: ({ children }) => (
            <TableCell sx={{ fontWeight: 700, bgcolor: "action.hover" }}>{children}</TableCell>
          ),
          td: ({ children }) => <TableCell>{children}</TableCell>,
        }}
      >
        {children}
      </ReactMarkdown>
    </Box>
  );
}
