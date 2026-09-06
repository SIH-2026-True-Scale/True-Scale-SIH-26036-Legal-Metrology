export type Role = 'citizen' | 'lmo' | 'gatc' | 'admin'

export type ApplicationStatus = 'Pending' | 'Scheduled' | 'Verified' | 'Rejected'

export interface Application {
  id: string
  instrument_type: string
  business_details: Record<string, unknown>
  photos: string[]
  status: ApplicationStatus
  is_reverification: boolean
  parent_application_id: string | null
  assigned_lmo_id: string | null
  scheduled_date: string | null
  submitted_at: string
}

export interface ApplicationCreate {
  instrument_type: string
  business_details: Record<string, unknown>
  photo_paths: string[]
  is_reverification?: boolean
  parent_application_id?: string | null
}

export interface Certificate {
  id: string
  application_id: string
  verifying_lmo_id: string
  verified_at: string
  qr_payload: string
  pdf_url: string | null
}