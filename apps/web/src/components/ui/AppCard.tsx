import { Card, CardContent } from "@mui/material";
import type { CardProps } from "@mui/material";
import type { PropsWithChildren } from "react";

interface AppCardProps extends PropsWithChildren, Pick<CardProps, "sx"> {
  testId?: string;
}

export function AppCard({ children, sx, testId }: AppCardProps): JSX.Element {
  return (
    <Card
      data-testid={testId}
      sx={{
        borderRadius: 2,
        boxShadow: "0 10px 32px rgba(15, 23, 42, 0.08)",
        ...sx,
      }}
    >
      <CardContent>{children}</CardContent>
    </Card>
  );
}
