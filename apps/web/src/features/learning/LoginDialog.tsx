import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from "@mui/material";
import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { login } from "../../api/learningApi";
import { saveSession } from "../../session/sessionStore";
import type { Session } from "../../types";

interface LoginDialogProps {
  open: boolean;
  reason: string;
  onCancel: () => void;
  onLoggedIn: (session: Session) => void;
}

export function LoginDialog({ onCancel, onLoggedIn, open, reason }: LoginDialogProps): JSX.Element {
  const { t } = useTranslation(["auth", "common"]);
  const [destination, setDestination] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const session = await login(destination, otpCode);
      saveSession(session);
      onLoggedIn(session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("loginFailed", { ns: "auth" }));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="xs" data-testid="login-dialog">
      <form onSubmit={handleSubmit}>
        <DialogTitle>{t("loginAndSave", { ns: "auth" })}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              autoFocus
              error={Boolean(error)}
              helperText={error ?? reason}
              label={t("destination", { ns: "auth" })}
              onChange={(event) => setDestination(event.target.value)}
              required
              value={destination}
            />
            <TextField
              slotProps={{ htmlInput: { maxLength: 12, minLength: 4 } }}
              label={t("otpCode", { ns: "auth" })}
              onChange={(event) => setOtpCode(event.target.value)}
              required
              value={otpCode}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={onCancel}>
            {t("actions.cancel", { ns: "common" })}
          </Button>
          <Button type="submit" variant="contained" loading={submitting}>
            {submitting ? t("submitting", { ns: "auth" }) : t("loginAndSave", { ns: "auth" })}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
