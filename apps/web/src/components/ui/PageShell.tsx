import { Box, Container, Stack } from "@mui/material";
import type { PropsWithChildren, ReactNode } from "react";

interface PageShellProps extends PropsWithChildren {
  bottomAction?: ReactNode;
  testId?: string;
}

export function PageShell({ bottomAction, children, testId }: PageShellProps): JSX.Element {
  return (
    <Box
      data-testid={testId}
      sx={{
        height: "100dvh",
        minHeight: "100dvh",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        bgcolor: "background.default",
        pb: bottomAction ? "96px" : 3,
      }}
    >
      <Container maxWidth="sm" sx={{ px: 2, py: 2 }}>
        <Stack spacing={2.5}>{children}</Stack>
      </Container>
      {bottomAction ? (
        <Box
          sx={{
            position: "fixed",
            right: 0,
            bottom: 0,
            left: 0,
            borderTop: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
            px: 2,
            py: 1.5,
            pb: "calc(12px + env(safe-area-inset-bottom))",
          }}
        >
          <Container maxWidth="sm" sx={{ px: 0 }}>
            {bottomAction}
          </Container>
        </Box>
      ) : null}
    </Box>
  );
}
