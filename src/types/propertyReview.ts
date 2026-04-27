// src/types/propertyReview.ts

export type ReviewAction = 'Save' | 'Dismiss' | 'Snooze' | 'DismissUnlessChanged'

export interface PropertyReview {
  id: string
  workspace_id: string
  property_id: string
  action: ReviewAction
  snoozed_until: string | null   // ISO date string
  dismissed_price: number | null
  created_at: string
  updated_at: string
}