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
      return { ok: true, mode: "otp" as const, ...res.data };
    } catch (err: any) {
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
      const verifyRes = await API.post("/auth/password/verify-reset", {
        email: cleanEmail,
        otp: code,
      });
      const resetToken = verifyRes.data?.resetToken;
      if (!resetToken) {
        return { ok: false, error: "Password recovery verification did not return a reset token." };
      }
      const res = await API.post("/auth/password/reset", {
        email: cleanEmail,
        password,
        resetToken,
      });
      return { ok: true, ...res.data };
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
