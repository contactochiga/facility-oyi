// services/walletsService.ts
import API from "./api";

export type WalletDTO = {
  id: string;
  user_id?: string | null;
  balance?: number | string | null;
  currency?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function pickError(err: any, fallback: string) {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}

export const walletsService = {
  /**
   * GET /wallets  -> returns wallet row
   */
  async getMyWallet(): Promise<{ wallet?: WalletDTO; error?: string }> {
    try {
      const res = await API.get("/wallets");
      return { wallet: res.data as WalletDTO };
    } catch (err: any) {
      return { error: pickError(err, "Failed to load wallet") };
    }
  },

  /**
   * POST /wallets/debit -> { balance }
   * (useful for testing end-to-end signal + deductions)
   */
  async debit(amount: number, reason?: string): Promise<{ balance?: number; error?: string }> {
    try {
      const res = await API.post("/wallets/debit", { amount, reason });
      return { balance: res.data?.balance };
    } catch (err: any) {
      return { error: pickError(err, "Failed to debit wallet") };
    }
  },

  /**
   * POST /wallets/init -> paystack initialize
   * backend returns paystack response.data (usually contains authorization_url)
   */
  async initPayment(amount: number, email: string): Promise<{ data?: any; error?: string }> {
    try {
      const res = await API.post("/wallets/init", { amount, email });
      return { data: res.data };
    } catch (err: any) {
      return { error: pickError(err, "Failed to initialize payment") };
    }
  },
};
