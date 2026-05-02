import { Button, Stack } from "@mui/material";
import type { ReactNode } from "react";

interface BottomActionBarProps {
  primaryLabel: string;
  primaryTestId: string;
  onPrimary: () => void;
  disabled?: boolean;
  loading?: boolean;
  secondary?: ReactNode;
}

export function BottomActionBar({
  disabled = false,
  loading = false,
  onPrimary,
  primaryLabel,
  primaryTestId,
  secondary,
}: BottomActionBarProps): JSX.Element {
  return (
    <Stack direction="row" spacing={1.5}>
      {secondary}
      <Button
        data-testid={primaryTestId}
        disabled={disabled}
        fullWidth
        loading={loading}
        onClick={onPrimary}
        size="large"
        type="button"
        variant="contained"
      >
        {primaryLabel}
      </Button>
    </Stack>
  );
}
