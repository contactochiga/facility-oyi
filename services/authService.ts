// services/authService.ts
import API from "./api";

export const authService = {
  async login(email: string, password: string) {
    try {
      const res = await API.post("/auth/login", { email, password });
      return res.data;
    } catch (err: any) {
      return { error: err?.response?.data?.error || "Login failed" };
    }
  },

  // ✅ otpToken is required for signup gate
  async signup(email: string, password: string, fullName: string, otpToken?: string) {
    try {
      const res = await API.post(
        "/auth/signup",
        {
          email,
          password,
          full_name: fullName, // ✅ backend expects full_name
          otpToken,            // ✅ body fallback
        },
        {
          headers: otpToken ? { "x-otp-token": otpToken } : undefined, // ✅ main gate header
        }
      );

      return res.data;
    } catch (err: any) {
      return { error: err?.response?.data?.error || "Signup failed" };
    }
  },
};
