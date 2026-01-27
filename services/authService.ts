// services/authService.ts
import API from "./api";

export const authService = {
  async login(email: string, password: string) {
    try {
      const res = await API.post("/auth/login", { email, password });
      return res.data;
    } catch (err: any) {
      return {
        error:
          err?.response?.data?.error ||
          err?.response?.data?.message ||
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
      return {
        error:
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.response?.data?.detail ||
          err?.message ||
          "Signup failed",
      };
    }
  },
};
