// src/types/propertyReview.ts

export type ReviewAction = 'Save' | 'Dismiss' | 'Snooze' | 'DismissUnlessChanged'

export interface PropertyReview {
  id: string
  workspace_id: string
  property_id: string
  action: ReviewAction
  snoozed_until: string | null
  dismissed_price: number | null
  is_favorite: boolean
  created_at: string
  updated_at: string
}