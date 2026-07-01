// services/authService.ts
import API from "./api";

export const authService = {
  async login(email: string, password: string) {
    try {
      const res = await API.post("/auth/login", { email, password });
      return res.data;
    } catch (err: any) {
      const timedOut = err?.code === "ECONNABORTED" || String(err?.message || "").includes("timeout");
      return {
        error:
          (timedOut
            ? "Backend is taking too long to respond. Render may be waking up; try again in a moment."
            : null) ||
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Login failed",
      };
    }
  },

  async signup(email: string, password: string, fullName: string, otpToken?: string) {
    try {
      const res = await API.post(
        "/auth/signup",
        { email, password, full_name: fullName, otpToken },
        { headers: otpToken ? { "x-otp-token": otpToken } : undefined }
      );
      return res.data;
    } catch (err: any) {
      const timedOut = err?.code === "ECONNABORTED" || String(err?.message || "").includes("timeout");
      return {
        error:
          (timedOut
            ? "Backend is taking too long to respond. Render may be waking up; try again in a moment."
            : null) ||
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.response?.data?.detail ||
          err?.message ||
          "Signup failed",
      };
    }
  },

  async requestPasswordReset(email: string) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    try {
      const res = await API.post("/auth/password/forgot", { email: cleanEmail });
      return { ok: true, mode: "reset_link" as const, ...res.data };
    } catch (err: any) {
      const status = Number(err?.response?.status || 0);
      if (status === 404 || status === 405) {
        try {
          await API.post("/auth/otp/send", { email: cleanEmail, purpose: "login" });
          return { ok: true, mode: "otp" as const };
        } catch (fallbackErr: any) {
          return {
            ok: false,
            error:
              fallbackErr?.response?.data?.message ||
              fallbackErr?.response?.data?.error ||
              fallbackErr?.message ||
              "Unable to start password recovery",
          };
        }
      }
      return {
        ok: false,
        error:
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Unable to start password recovery",
      };
    }
  },

  async completePasswordReset(email: string, code: string, password: string) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    try {
      const verifyRes = await API.post("/auth/otp/verify", {
        email: cleanEmail,
        code,
        purpose: "login",
      });
      const otpToken = verifyRes.data?.otpToken;
      if (!otpToken) {
        return { ok: false, error: "Password recovery verification did not return an approval token." };
      }
      try {
        const res = await API.post("/auth/password/reset", {
          email: cleanEmail,
          password,
          otpToken,
        });
        return { ok: true, ...res.data };
      } catch (resetErr: any) {
        const status = Number(resetErr?.response?.status || 0);
        if (status === 404 || status === 405) {
          return {
            ok: false,
            unsupported: true,
            error: "Password reset is not enabled on the backend yet. The recovery code was verified, but no reset endpoint is available.",
          };
        }
        return {
          ok: false,
          error:
            resetErr?.response?.data?.message ||
            resetErr?.response?.data?.error ||
            resetErr?.message ||
            "Unable to reset password",
        };
      }
    } catch (err: any) {
      return {
        ok: false,
        error:
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Unable to verify the recovery code",
      };
    }
  },
};
