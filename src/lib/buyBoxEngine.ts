// src/lib/buyBoxEngine.ts

import { createBrowserClient } from '@supabase/ssr';
import type { BuyBox, BuyBoxMatch, CriterionResult, MatchableProperty } from '@/types/buyBox';

// ─── Core evaluator ────────────────────────────────────────────────────────────

export function evaluateProperty(
  property: MatchableProperty,
  buyBox: BuyBox
): BuyBoxMatch {
  const results: CriterionResult[] = [];

  const effectivePrice = property.list_price ?? property.opening_bid ?? null;

  // ── Property type ──────────────────────────────────────────────────────────
  if (buyBox.property_types && buyBox.property_types.length > 0) {
    const passed =
      !!property.property_type &&
      buyBox.property_types.includes(property.property_type);
    results.push({
      label: 'Property Type',
      passed,
      explanation: passed
        ? `Type "${property.property_type}" is allowed`
        : `Type "${property.property_type ?? 'not set'}" not in [${buyBox.property_types.join(', ')}]`,
    });
  }

  // ── Price range ────────────────────────────────────────────────────────────
  if (buyBox.min_price !== null) {
    if (effectivePrice !== null) {
      const passed = effectivePrice >= buyBox.min_price;
      results.push({
        label: 'Min Price',
        passed,
        explanation: passed
          ? `Price $${fmt(effectivePrice)} >= min $${fmt(buyBox.min_price)}`
          : `Price $${fmt(effectivePrice)} is below min $${fmt(buyBox.min_price)}`,
      });
    } else {
      results.push({ label: 'Min Price', passed: false, explanation: 'No price on record' });
    }
  }

  if (buyBox.max_price !== null) {
    if (effectivePrice !== null) {
      const passed = effectivePrice <= buyBox.max_price;
      results.push({
        label: 'Max Price',
        passed,
        explanation: passed
          ? `Price $${fmt(effectivePrice)} <= max $${fmt(buyBox.max_price)}`
          : `Price $${fmt(effectivePrice)} exceeds max $${fmt(buyBox.max_price)}`,
      });
    } else {
      results.push({ label: 'Max Price', passed: false, explanation: 'No price on record' });
    }
  }

  // ── ARV range ──────────────────────────────────────────────────────────────
  if (buyBox.min_arv !== null) {
    if (property.arv !== null) {
      const passed = property.arv >= buyBox.min_arv;
      results.push({
        label: 'Min ARV',
        passed,
        explanation: passed
          ? `ARV $${fmt(property.arv)} >= min $${fmt(buyBox.min_arv)}`
          : `ARV $${fmt(property.arv)} is below min $${fmt(buyBox.min_arv)}`,
      });
    } else {
      results.push({ label: 'Min ARV', passed: false, explanation: 'ARV not set on property' });
    }
  }

  if (buyBox.max_arv !== null) {
    if (property.arv !== null) {
      const passed = property.arv <= buyBox.max_arv;
      results.push({
        label: 'Max ARV',
        passed,
        explanation: passed
          ? `ARV $${fmt(property.arv)} <= max $${fmt(buyBox.max_arv)}`
          : `ARV $${fmt(property.arv)} exceeds max $${fmt(buyBox.max_arv)}`,
      });
    } else {
      results.push({ label: 'Max ARV', passed: false, explanation: 'ARV not set on property' });
    }
  }

  // ── ARV ratio ──────────────────────────────────────────────────────────────
  if (buyBox.max_arv_ratio !== null) {
    if (effectivePrice !== null && property.arv !== null && property.arv > 0) {
      const ratio = effectivePrice / property.arv;
      const passed = ratio <= buyBox.max_arv_ratio;
      results.push({
        label: 'Price/ARV Ratio',
        passed,
        explanation: passed
          ? `${pct(ratio)} price-to-ARV <= max ${pct(buyBox.max_arv_ratio)}`
          : `${pct(ratio)} price-to-ARV exceeds max ${pct(buyBox.max_arv_ratio)}`,
      });
    } else {
      results.push({
        label: 'Price/ARV Ratio',
        passed: false,
        explanation: 'Need both price and ARV to evaluate ratio',
      });
    }
  }

  // ── Bedrooms ───────────────────────────────────────────────────────────────
  if (buyBox.min_bedrooms !== null) {
    if (property.bedrooms !== null) {
      const passed = property.bedrooms >= buyBox.min_bedrooms;
      results.push({
        label: 'Min Bedrooms',
        passed,
        explanation: passed
          ? `${property.bedrooms} bed >= min ${buyBox.min_bedrooms}`
          : `${property.bedrooms} bed is below min ${buyBox.min_bedrooms}`,
      });
    } else {
      results.push({ label: 'Min Bedrooms', passed: false, explanation: 'Bedrooms not set' });
    }
  }

  if (buyBox.max_bedrooms !== null) {
    if (property.bedrooms !== null) {
      const passed = property.bedrooms <= buyBox.max_bedrooms;
      results.push({
        label: 'Max Bedrooms',
        passed,
        explanation: passed
          ? `${property.bedrooms} bed <= max ${buyBox.max_bedrooms}`
          : `${property.bedrooms} bed exceeds max ${buyBox.max_bedrooms}`,
      });
    } else {
      results.push({ label: 'Max Bedrooms', passed: false, explanation: 'Bedrooms not set' });
    }
  }

  // ── Bathrooms ──────────────────────────────────────────────────────────────
  if (buyBox.min_bathrooms !== null) {
    if (property.bathrooms !== null) {
      const passed = property.bathrooms >= buyBox.min_bathrooms;
      results.push({
        label: 'Min Bathrooms',
        passed,
        explanation: passed
          ? `${property.bathrooms} bath >= min ${buyBox.min_bathrooms}`
          : `${property.bathrooms} bath is below min ${buyBox.min_bathrooms}`,
      });
    } else {
      results.push({ label: 'Min Bathrooms', passed: false, explanation: 'Bathrooms not set' });
    }
  }

  // ── Square footage ─────────────────────────────────────────────────────────
  if (buyBox.min_sqft !== null) {
    if (property.sqft !== null) {
      const passed = property.sqft >= buyBox.min_sqft;
      results.push({
        label: 'Min Sqft',
        passed,
        explanation: passed
          ? `${property.sqft.toLocaleString()} sqft >= min ${buyBox.min_sqft.toLocaleString()}`
          : `${property.sqft.toLocaleString()} sqft is below min ${buyBox.min_sqft.toLocaleString()}`,
      });
    } else {
      results.push({ label: 'Min Sqft', passed: false, explanation: 'Sqft not set' });
    }
  }

  if (buyBox.max_sqft !== null) {
    if (property.sqft !== null) {
      const passed = property.sqft <= buyBox.max_sqft;
      results.push({
        label: 'Max Sqft',
        passed,
        explanation: passed
          ? `${property.sqft.toLocaleString()} sqft <= max ${buyBox.max_sqft.toLocaleString()}`
          : `${property.sqft.toLocaleString()} sqft exceeds max ${buyBox.max_sqft.toLocaleString()}`,
      });
    } else {
      results.push({ label: 'Max Sqft', passed: false, explanation: 'Sqft not set' });
    }
  }

  // ── Year built ─────────────────────────────────────────────────────────────
  if (buyBox.min_year_built !== null) {
    if (property.year_built !== null) {
      const passed = property.year_built >= buyBox.min_year_built;
      results.push({
        label: 'Min Year Built',
        passed,
        explanation: passed
          ? `Built ${property.year_built} >= min ${buyBox.min_year_built}`
          : `Built ${property.year_built} -- older than min ${buyBox.min_year_built}`,
      });
    } else {
      results.push({ label: 'Min Year Built', passed: false, explanation: 'Year built not set' });
    }
  }

  // ── HOA ───────────────────────────────────────────────────────────────────
  if (buyBox.max_hoa !== null) {
    const hoa = property.hoa_monthly ?? 0;
    const passed = hoa <= buyBox.max_hoa;
    results.push({
      label: 'Max HOA',
      passed,
      explanation: passed
        ? `HOA $${hoa}/mo <= max $${buyBox.max_hoa}/mo`
        : `HOA $${hoa}/mo exceeds max $${buyBox.max_hoa}/mo`,
    });
  }

  // ── Occupancy status ───────────────────────────────────────────────────────
  if (buyBox.occupancy_statuses && buyBox.occupancy_statuses.length > 0) {
    const passed =
      !!property.occupancy_status &&
      buyBox.occupancy_statuses.includes(property.occupancy_status);
    results.push({
      label: 'Occupancy',
      passed,
      explanation: passed
        ? `"${property.occupancy_status}" is an allowed occupancy status`
        : `"${property.occupancy_status ?? 'not set'}" not in [${buyBox.occupancy_statuses.join(', ')}]`,
    });
  }

  // ── County ────────────────────────────────────────────────────────────────
  if (buyBox.counties && buyBox.counties.length > 0) {
    const passed =
      !!property.county &&
      buyBox.counties.map((c) => c.toLowerCase()).includes(property.county.toLowerCase());
    results.push({
      label: 'County',
      passed,
      explanation: passed
        ? `County "${property.county}" is in target list`
        : `County "${property.county ?? 'not set'}" not in [${buyBox.counties.join(', ')}]`,
    });
  }

  // ── Zip code ──────────────────────────────────────────────────────────────
  if (buyBox.zip_codes && buyBox.zip_codes.length > 0) {
    const passed = !!property.zip && buyBox.zip_codes.includes(property.zip);
    results.push({
      label: 'Zip Code',
      passed,
      explanation: passed
        ? `Zip ${property.zip} is in target list`
        : `Zip "${property.zip ?? 'not set'}" not in [${buyBox.zip_codes.join(', ')}]`,
    });
  }

  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  const score = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;
  const isMatch = totalCount > 0 && passedCount === totalCount;

  return { buyBox, isMatch, score, passedCount, totalCount, criteria: results };
}

// ─── DB-backed helper ──────────────────────────────────────────────────────────

export async function getPropertyMatches(
  property: MatchableProperty,
  workspaceId: string
): Promise<BuyBoxMatch[]> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: buyBoxes, error } = await supabase
    .from('buy_boxes')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true);

  if (error || !buyBoxes) return [];

  const matches = buyBoxes.map((bb: BuyBox) => evaluateProperty(property, bb));

  return matches.sort((a, b) => {
    if (a.isMatch !== b.isMatch) return a.isMatch ? -1 : 1;
    return b.score - a.score;
  });
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString();
}

function pct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}
