import { apiFetch } from "@/src/api";

export type PetRarity = "common" | "rare" | string;
export type CareAction = "feed" | "play" | "groom";

export type PetGameState = {
  profile_id: string;
  xp: number;
  level: number;
  xp_in_level: number;
  xp_to_next: number;
  next_threshold: number;
  coins: number;
  pet: {
    claimed: boolean;
    claim_available: boolean;
    pet_code?: string | null;
    rarity?: PetRarity | null;
    level?: number | null;
    care: Record<CareAction, number>;
    claimed_at?: string | null;
  };
  benefits: {
    subscription_discount_percent: number;
    partner_discount_percent: number;
    partner_discount_requires_active_offer: boolean;
  };
  economy: {
    daily_journal_reward: number;
    care_costs: Record<CareAction, number>;
    rare_percent: number;
  };
};

async function request(path: string, init?: RequestInit): Promise<PetGameState> {
  const headers = new Headers(init?.headers || {});
  headers.set("Content-Type", "application/json");
  const response = await apiFetch(path, { ...init, headers });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${response.status}: ${text}`);
  }
  return response.json();
}

export const getPetGame = (profileId: string) =>
  request(`/game/${encodeURIComponent(profileId)}`);

export const spinPet = (profileId: string) =>
  request(`/game/${encodeURIComponent(profileId)}/spin`, { method: "POST" });

export const careForPet = (profileId: string, action: CareAction) =>
  request(`/game/${encodeURIComponent(profileId)}/care`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
