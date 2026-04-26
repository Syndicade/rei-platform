// src/types/buyBox.ts

export interface BuyBox {
  id: string;
  workspace_id: string;
  name: string;
  is_active: boolean;

  property_types: string[] | null;

  min_price: number | null;
  max_price: number | null;

  min_arv: number | null;
  max_arv: number | null;
  max_arv_ratio: number | null; // e.g. 0.70 = 70% rule

  min_bedrooms: number | null;
  max_bedrooms: number | null;
  min_bathrooms: number | null;
  min_sqft: number | null;
  max_sqft: number | null;
  min_year_built: number | null;

  max_hoa: number | null;

  occupancy_statuses: string[] | null;
  counties: string[] | null;
  zip_codes: string[] | null;

  created_at: string;
}

export type BuyBoxInsert = Omit<BuyBox, 'id' | 'created_at'>;

// Minimal property shape needed by the engine
export interface MatchableProperty {
  id: string;
  address: string;
  property_type: string | null;
  list_price: number | null;
  opening_bid: number | null;
  arv: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  year_built: number | null;
  hoa_monthly: number | null;
  occupancy_status: string | null;
  county: string | null;
  zip: string | null;
}

export interface CriterionResult {
  label: string;
  passed: boolean;
  explanation: string;
}

export interface BuyBoxMatch {
  buyBox: BuyBox;
  isMatch: boolean;       // true only if ALL active criteria pass
  score: number;          // 0–100 percentage of criteria passed
  passedCount: number;
  totalCount: number;
  criteria: CriterionResult[];
}
