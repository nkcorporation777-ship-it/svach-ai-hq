/**
 * Generated from the live Supabase project (fsfzenkycnoxearenpdp) via the
 * Supabase MCP `generate_typescript_types` tool. Regenerate after any migration —
 * do not hand-edit; DATABASE_SCHEMA.md is the source of truth for the schema
 * itself, this file just mirrors it in TypeScript.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          content: string | null
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
          type: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json
          type: string
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_reminders: {
        Row: {
          appointment_id: string
          channel: string
          created_at: string
          error: string | null
          id: string
          kind: string
          send_at: string
          sent_at: string | null
          status: string
        }
        Insert: {
          appointment_id: string
          channel: string
          created_at?: string
          error?: string | null
          id?: string
          kind: string
          send_at: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          appointment_id?: string
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          send_at?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_reminders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          attendee_email: string | null
          attendee_name: string | null
          attendee_phone: string | null
          call_id: string | null
          client_id: string | null
          created_at: string
          ends_at: string | null
          id: string
          is_demo: boolean
          lead_id: string | null
          meeting_url: string | null
          provider: string
          provider_booking_uid: string
          starts_at: string
          status: string
          timezone: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          attendee_email?: string | null
          attendee_name?: string | null
          attendee_phone?: string | null
          call_id?: string | null
          client_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          is_demo?: boolean
          lead_id?: string | null
          meeting_url?: string | null
          provider?: string
          provider_booking_uid: string
          starts_at: string
          status?: string
          timezone?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          attendee_email?: string | null
          attendee_name?: string | null
          attendee_phone?: string | null
          call_id?: string | null
          client_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          is_demo?: boolean
          lead_id?: string | null
          meeting_url?: string | null
          provider?: string
          provider_booking_uid?: string
          starts_at?: string
          status?: string
          timezone?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "voice_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contact_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_settings: {
        Row: {
          gst_percent: number | null
          hourly_rate_max: number | null
          hourly_rate_min: number | null
          id: string
          invoice_from: string | null
          payment_instructions: string | null
          premium_rate_max: number | null
          premium_rate_min: number | null
          updated_at: string
        }
        Insert: {
          gst_percent?: number | null
          hourly_rate_max?: number | null
          hourly_rate_min?: number | null
          id?: string
          invoice_from?: string | null
          payment_instructions?: string | null
          premium_rate_max?: number | null
          premium_rate_min?: number | null
          updated_at?: string
        }
        Update: {
          gst_percent?: number | null
          hourly_rate_max?: number | null
          hourly_rate_min?: number | null
          id?: string
          invoice_from?: string | null
          payment_instructions?: string | null
          premium_rate_max?: number | null
          premium_rate_min?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      client_email_templates: {
        Row: {
          body: string
          id: string
          step_key: string
          step_order_index: number
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          id?: string
          step_key: string
          step_order_index: number
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          id?: string
          step_key?: string
          step_order_index?: number
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_intake_submissions: {
        Row: {
          billing_contact_email: string | null
          billing_contact_name: string | null
          brand_assets_note: string | null
          client_id: string
          created_at: string
          crm_name: string | null
          database_name: string | null
          dba: string | null
          dns_manager: string | null
          has_phi: boolean
          hosting_provider: string | null
          hours: string | null
          id: string
          legal_name: string
          location: string
          other_software: string | null
          secondary_contact_email: string | null
          secondary_contact_name: string | null
          secondary_contact_phone: string | null
          services: string
          submitted_at: string
          uses_crm: boolean
          uses_database: boolean
          website_urls: string | null
        }
        Insert: {
          billing_contact_email?: string | null
          billing_contact_name?: string | null
          brand_assets_note?: string | null
          client_id: string
          created_at?: string
          crm_name?: string | null
          database_name?: string | null
          dba?: string | null
          dns_manager?: string | null
          has_phi: boolean
          hosting_provider?: string | null
          hours?: string | null
          id?: string
          legal_name: string
          location: string
          other_software?: string | null
          secondary_contact_email?: string | null
          secondary_contact_name?: string | null
          secondary_contact_phone?: string | null
          services: string
          submitted_at?: string
          uses_crm?: boolean
          uses_database?: boolean
          website_urls?: string | null
        }
        Update: {
          billing_contact_email?: string | null
          billing_contact_name?: string | null
          brand_assets_note?: string | null
          client_id?: string
          created_at?: string
          crm_name?: string | null
          database_name?: string | null
          dba?: string | null
          dns_manager?: string | null
          has_phi?: boolean
          hosting_provider?: string | null
          hours?: string | null
          id?: string
          legal_name?: string
          location?: string
          other_software?: string | null
          secondary_contact_email?: string | null
          secondary_contact_name?: string | null
          secondary_contact_phone?: string | null
          services?: string
          submitted_at?: string
          uses_crm?: boolean
          uses_database?: boolean
          website_urls?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_intake_submissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "client_contact_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_intake_submissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_onboarding_steps: {
        Row: {
          client_id: string
          completed_at: string | null
          id: string
          is_complete: boolean
          order_index: number
          step_name: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          id?: string
          is_complete?: boolean
          order_index: number
          step_name: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          id?: string
          is_complete?: boolean
          order_index?: number
          step_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_onboarding_steps_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contact_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_onboarding_steps_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          intake_token: string
          metadata: Json
          practice_name: string
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          source_lead_id: string | null
          specialty_id: string | null
          updated_at: string
          value: number | null
          voice_opt_out: boolean
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          intake_token?: string
          metadata?: Json
          practice_name: string
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          source_lead_id?: string | null
          specialty_id?: string | null
          updated_at?: string
          value?: number | null
          voice_opt_out?: boolean
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          intake_token?: string
          metadata?: Json
          practice_name?: string
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          source_lead_id?: string | null
          specialty_id?: string | null
          updated_at?: string
          value?: number | null
          voice_opt_out?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "clients_source_lead_id_fkey"
            columns: ["source_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          id: string
          name: string
          slug: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          notes: string | null
          spent_on: string
          vendor: string | null
        }
        Insert: {
          amount: number
          category?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          spent_on?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          spent_on?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contact_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "expenses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_ups: {
        Row: {
          client_id: string
          completed_at: string | null
          created_at: string
          due_at: string
          id: string
          note: string | null
          outcome_notes: string | null
          status: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          created_at?: string
          due_at: string
          id?: string
          note?: string | null
          outcome_notes?: string | null
          status?: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          created_at?: string
          due_at?: string
          id?: string
          note?: string | null
          outcome_notes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contact_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "follow_ups_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          amount: number
          description: string
          id: string
          invoice_id: string
          order_index: number
          quantity: number
          unit_price: number
        }
        Insert: {
          amount?: number
          description: string
          id?: string
          invoice_id: string
          order_index?: number
          quantity?: number
          unit_price?: number
        }
        Update: {
          amount?: number
          description?: string
          id?: string
          invoice_id?: string
          order_index?: number
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          bill_to_address: string | null
          bill_to_email: string | null
          bill_to_gstin: string | null
          bill_to_name: string
          client_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          due_date: string
          gst_amount: number
          gst_percent: number
          id: string
          invoice_number: string
          issue_date: string
          kind: string
          notes: string | null
          paid_at: string | null
          proposal_id: string | null
          sent_at: string | null
          sent_to_email: string | null
          status: string
          subtotal: number
          token: string
          total: number
          updated_at: string
          viewed_at: string | null
          voided_at: string | null
        }
        Insert: {
          amount_paid?: number
          bill_to_address?: string | null
          bill_to_email?: string | null
          bill_to_gstin?: string | null
          bill_to_name: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date: string
          gst_amount?: number
          gst_percent?: number
          id?: string
          invoice_number?: string
          issue_date?: string
          kind?: string
          notes?: string | null
          paid_at?: string | null
          proposal_id?: string | null
          sent_at?: string | null
          sent_to_email?: string | null
          status?: string
          subtotal?: number
          token?: string
          total?: number
          updated_at?: string
          viewed_at?: string | null
          voided_at?: string | null
        }
        Update: {
          amount_paid?: number
          bill_to_address?: string | null
          bill_to_email?: string | null
          bill_to_gstin?: string | null
          bill_to_name?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string
          gst_amount?: number
          gst_percent?: number
          id?: string
          invoice_number?: string
          issue_date?: string
          kind?: string
          notes?: string | null
          paid_at?: string | null
          proposal_id?: string | null
          sent_at?: string | null
          sent_to_email?: string | null
          status?: string
          subtotal?: number
          token?: string
          total?: number
          updated_at?: string
          viewed_at?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contact_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_categories: {
        Row: {
          id: string
          name: string
          slug: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      knowledge_document_attachments: {
        Row: {
          attachment_type: string
          created_at: string
          document_id: string
          file_name: string
          file_path: string | null
          id: string
          uploaded_by: string | null
          url: string | null
        }
        Insert: {
          attachment_type?: string
          created_at?: string
          document_id: string
          file_name: string
          file_path?: string | null
          id?: string
          uploaded_by?: string | null
          url?: string | null
        }
        Update: {
          attachment_type?: string
          created_at?: string
          document_id?: string
          file_name?: string
          file_path?: string | null
          id?: string
          uploaded_by?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_document_attachments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_document_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_document_versions: {
        Row: {
          content: string | null
          created_at: string
          created_by: string | null
          document_id: string
          id: string
          version_number: number
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          document_id: string
          id?: string
          version_number: number
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string
          id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_document_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_documents: {
        Row: {
          category_id: string | null
          content: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          search_vector: unknown
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          search_vector?: unknown
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          search_vector?: unknown
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_documents_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "knowledge_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          deleted_at: string | null
          id: string
          lost_reason_category: string | null
          lost_reason_detail: string | null
          metadata: Json
          owner_id: string | null
          practice_name: string
          source: string | null
          specialty_id: string | null
          stage: string
          updated_at: string
          value: number | null
          voice_opt_out: boolean
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          lost_reason_category?: string | null
          lost_reason_detail?: string | null
          metadata?: Json
          owner_id?: string | null
          practice_name: string
          source?: string | null
          specialty_id?: string | null
          stage?: string
          updated_at?: string
          value?: number | null
          voice_opt_out?: boolean
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          lost_reason_category?: string | null
          lost_reason_detail?: string | null
          metadata?: Json
          owner_id?: string | null
          practice_name?: string
          source?: string | null
          specialty_id?: string | null
          stage?: string
          updated_at?: string
          value?: number | null
          voice_opt_out?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "leads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_settings: {
        Row: {
          id: boolean
          n8n_publish_webhook_url: string | null
          updated_at: string
        }
        Insert: {
          id?: boolean
          n8n_publish_webhook_url?: string | null
          updated_at?: string
        }
        Update: {
          id?: boolean
          n8n_publish_webhook_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ooa_recommendations: {
        Row: {
          created_at: string
          description: string | null
          hermes_reference_id: string | null
          id: string
          lens: string
          related_entity_id: string | null
          related_entity_type: string | null
          resolved_at: string | null
          resolved_by: string | null
          source: string | null
          status: string
          suggested_action: Json
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          hermes_reference_id?: string | null
          id?: string
          lens: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string | null
          status?: string
          suggested_action?: Json
          title: string
          type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          hermes_reference_id?: string | null
          id?: string
          lens?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string | null
          status?: string
          suggested_action?: Json
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ooa_recommendations_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ooa_system_health_events: {
        Row: {
          created_at: string
          detail: Json
          event_type: string
          id: string
          resolved_at: string | null
          severity: string
          source: string
        }
        Insert: {
          created_at?: string
          detail?: Json
          event_type: string
          id?: string
          resolved_at?: string | null
          severity: string
          source: string
        }
        Update: {
          created_at?: string
          detail?: Json
          event_type?: string
          id?: string
          resolved_at?: string | null
          severity?: string
          source?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          method: string
          notes: string | null
          paid_on: string
          provider: string | null
          provider_ref: string | null
          recorded_by: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          method?: string
          notes?: string | null
          paid_on?: string
          provider?: string | null
          provider_ref?: string | null
          recorded_by?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          method?: string
          notes?: string | null
          paid_on?: string
          provider?: string | null
          provider_ref?: string | null
          recorded_by?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_tiers: {
        Row: {
          best_for: string | null
          delivery_terms: string | null
          description: string | null
          features: string | null
          id: string
          is_featured: boolean
          name: string
          order_index: number
          price: number | null
          price_max: number | null
          updated_at: string
        }
        Insert: {
          best_for?: string | null
          delivery_terms?: string | null
          description?: string | null
          features?: string | null
          id?: string
          is_featured?: boolean
          name: string
          order_index: number
          price?: number | null
          price_max?: number | null
          updated_at?: string
        }
        Update: {
          best_for?: string | null
          delivery_terms?: string | null
          description?: string | null
          features?: string | null
          id?: string
          is_featured?: boolean
          name?: string
          order_index?: number
          price?: number | null
          price_max?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      profile_departments: {
        Row: {
          department_id: string
          profile_id: string
        }
        Insert: {
          department_id: string
          profile_id: string
        }
        Update: {
          department_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_departments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          permission_role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          permission_role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          permission_role?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          is_complete: boolean
          order_index: number
          project_id: string
          stage: string
          title: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_complete?: boolean
          order_index?: number
          project_id: string
          stage: string
          title: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_complete?: boolean
          order_index?: number
          project_id?: string
          stage?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_id: string
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          id: string
          metadata: Json
          name: string
          stage: string
          updated_at: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          metadata?: Json
          name: string
          stage?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          metadata?: Json
          name?: string
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contact_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          deposit_percent: number
          gst_percent: number | null
          id: string
          lead_id: string
          price: number
          pricing_path: string
          sent_at: string
          sent_to_email: string
          signature_image: string | null
          signed_at: string | null
          signer_ip: string | null
          signer_name: string | null
          status: string
          token: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          deposit_percent?: number
          gst_percent?: number | null
          id?: string
          lead_id: string
          price: number
          pricing_path: string
          sent_at?: string
          sent_to_email: string
          signature_image?: string | null
          signed_at?: string | null
          signer_ip?: string | null
          signer_name?: string | null
          status?: string
          token?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          deposit_percent?: number
          gst_percent?: number | null
          id?: string
          lead_id?: string
          price?: number
          pricing_path?: string
          sent_at?: string
          sent_to_email?: string
          signature_image?: string | null
          signed_at?: string | null
          signer_ip?: string | null
          signer_name?: string | null
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      social_post_metrics: {
        Row: {
          clicks: number | null
          comments: number | null
          id: string
          impressions: number | null
          platform: string
          post_id: string
          reactions: number | null
          recorded_at: string
          shares: number | null
        }
        Insert: {
          clicks?: number | null
          comments?: number | null
          id?: string
          impressions?: number | null
          platform: string
          post_id: string
          reactions?: number | null
          recorded_at?: string
          shares?: number | null
        }
        Update: {
          clicks?: number | null
          comments?: number | null
          id?: string
          impressions?: number | null
          platform?: string
          post_id?: string
          reactions?: number | null
          recorded_at?: string
          shares?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "social_post_metrics_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          attempts: number
          body: string
          campaign: string | null
          created_at: string
          created_by: string | null
          handed_off_at: string | null
          id: string
          last_error: string | null
          link_url: string | null
          media_urls: string[]
          platforms: string[]
          published_at: string | null
          published_url: string | null
          scheduled_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          body?: string
          campaign?: string | null
          created_at?: string
          created_by?: string | null
          handed_off_at?: string | null
          id?: string
          last_error?: string | null
          link_url?: string | null
          media_urls?: string[]
          platforms?: string[]
          published_at?: string | null
          published_url?: string | null
          scheduled_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          body?: string
          campaign?: string | null
          created_at?: string
          created_by?: string | null
          handed_off_at?: string | null
          id?: string
          last_error?: string | null
          link_url?: string | null
          media_urls?: string[]
          platforms?: string[]
          published_at?: string | null
          published_url?: string | null
          scheduled_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      specialties: {
        Row: {
          id: string
          name: string
          slug: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      support_sla_targets: {
        Row: {
          first_response_hours: number
          order_index: number
          priority: string
          resolution_hours: number
          updated_at: string
        }
        Insert: {
          first_response_hours: number
          order_index: number
          priority: string
          resolution_hours: number
          updated_at?: string
        }
        Update: {
          first_response_hours?: number
          order_index?: number
          priority?: string
          resolution_hours?: number
          updated_at?: string
        }
        Relationships: []
      }
      support_ticket_updates: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          ticket_id: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          ticket_id: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_updates_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          channel: string
          client_id: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          environment: string | null
          first_responded_at: string | null
          first_response_due_at: string | null
          fixed_in: string | null
          id: string
          kind: string
          opened_at: string
          priority: string
          project_id: string | null
          resolution_due_at: string | null
          resolved_at: string | null
          severity: string | null
          status: string
          steps_to_reproduce: string | null
          subject: string
          ticket_number: string
          updated_at: string
        }
        Insert: {
          channel?: string
          client_id?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          environment?: string | null
          first_responded_at?: string | null
          first_response_due_at?: string | null
          fixed_in?: string | null
          id?: string
          kind?: string
          opened_at?: string
          priority?: string
          project_id?: string | null
          resolution_due_at?: string | null
          resolved_at?: string | null
          severity?: string | null
          status?: string
          steps_to_reproduce?: string | null
          subject: string
          ticket_number?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          client_id?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          environment?: string | null
          first_responded_at?: string | null
          first_response_due_at?: string | null
          fixed_in?: string | null
          id?: string
          kind?: string
          opened_at?: string
          priority?: string
          project_id?: string | null
          resolution_due_at?: string | null
          resolved_at?: string | null
          severity?: string | null
          status?: string
          steps_to_reproduce?: string | null
          subject?: string
          ticket_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contact_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "support_tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_agents: {
        Row: {
          audience: string
          channel: string | null
          client_id: string | null
          created_at: string
          id: string
          last_modified_at: string | null
          name: string
          retell_agent_id: string
          synced_at: string | null
          tracked: boolean
        }
        Insert: {
          audience?: string
          channel?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          last_modified_at?: string | null
          name: string
          retell_agent_id: string
          synced_at?: string | null
          tracked?: boolean
        }
        Update: {
          audience?: string
          channel?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          last_modified_at?: string | null
          name?: string
          retell_agent_id?: string
          synced_at?: string | null
          tracked?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "voice_agents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contact_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "voice_agents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_call_requests: {
        Row: {
          appointment_id: string | null
          campaign_key: string
          client_id: string | null
          created_at: string
          error: string | null
          id: string
          lead_id: string | null
          requested_by: string | null
          retell_call_id: string | null
          status: string
          to_number: string | null
        }
        Insert: {
          appointment_id?: string | null
          campaign_key: string
          client_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          lead_id?: string | null
          requested_by?: string | null
          retell_call_id?: string | null
          status?: string
          to_number?: string | null
        }
        Update: {
          appointment_id?: string | null
          campaign_key?: string
          client_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          lead_id?: string | null
          requested_by?: string | null
          retell_call_id?: string | null
          status?: string
          to_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_call_requests_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_call_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contact_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "voice_call_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_call_requests_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_calls: {
        Row: {
          activity_id: string | null
          agent_id: string | null
          analysis: Json
          call_status: string | null
          call_successful: boolean | null
          call_type: string | null
          client_id: string | null
          cost_cents: number | null
          created_at: string
          direction: string | null
          disconnection_reason: string | null
          duration_ms: number | null
          ended_at: string | null
          from_number: string | null
          id: string
          is_demo: boolean
          lead_id: string | null
          metadata: Json
          needs_review: boolean
          recording_url: string | null
          retell_call_id: string
          review_candidates: Json | null
          review_reason: string | null
          sentiment: string | null
          started_at: string | null
          summary: string | null
          to_number: string | null
          transcript: string | null
          updated_at: string
        }
        Insert: {
          activity_id?: string | null
          agent_id?: string | null
          analysis?: Json
          call_status?: string | null
          call_successful?: boolean | null
          call_type?: string | null
          client_id?: string | null
          cost_cents?: number | null
          created_at?: string
          direction?: string | null
          disconnection_reason?: string | null
          duration_ms?: number | null
          ended_at?: string | null
          from_number?: string | null
          id?: string
          is_demo?: boolean
          lead_id?: string | null
          metadata?: Json
          needs_review?: boolean
          recording_url?: string | null
          retell_call_id: string
          review_candidates?: Json | null
          review_reason?: string | null
          sentiment?: string | null
          started_at?: string | null
          summary?: string | null
          to_number?: string | null
          transcript?: string | null
          updated_at?: string
        }
        Update: {
          activity_id?: string | null
          agent_id?: string | null
          analysis?: Json
          call_status?: string | null
          call_successful?: boolean | null
          call_type?: string | null
          client_id?: string | null
          cost_cents?: number | null
          created_at?: string
          direction?: string | null
          disconnection_reason?: string | null
          duration_ms?: number | null
          ended_at?: string | null
          from_number?: string | null
          id?: string
          is_demo?: boolean
          lead_id?: string | null
          metadata?: Json
          needs_review?: boolean
          recording_url?: string | null
          retell_call_id?: string
          review_candidates?: Json | null
          review_reason?: string | null
          sentiment?: string | null
          started_at?: string | null
          summary?: string | null
          to_number?: string | null
          transcript?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_calls_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_calls_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "voice_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_calls_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contact_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "voice_calls_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_campaigns: {
        Row: {
          agent_id: string | null
          daily_cap: number
          default_country_code: string
          enabled: boolean
          from_number: string | null
          key: string
          label: string
          timezone: string
          updated_at: string
          window_end_hour: number
          window_start_hour: number
        }
        Insert: {
          agent_id?: string | null
          daily_cap?: number
          default_country_code?: string
          enabled?: boolean
          from_number?: string | null
          key: string
          label: string
          timezone?: string
          updated_at?: string
          window_end_hour?: number
          window_start_hour?: number
        }
        Update: {
          agent_id?: string | null
          daily_cap?: number
          default_country_code?: string
          enabled?: boolean
          from_number?: string | null
          key?: string
          label?: string
          timezone?: string
          updated_at?: string
          window_end_hour?: number
          window_start_hour?: number
        }
        Relationships: [
          {
            foreignKeyName: "voice_campaigns_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "voice_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_demo_link_uses: {
        Row: {
          created_at: string
          id: string
          ip: string | null
          link_id: string
          retell_call_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip?: string | null
          link_id: string
          retell_call_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip?: string | null
          link_id?: string
          retell_call_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_demo_link_uses_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "voice_demo_links"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_demo_links: {
        Row: {
          agent_id: string | null
          created_at: string
          daily_cap: number
          enabled: boolean
          id: string
          label: string
          per_ip_daily_cap: number
          token: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          daily_cap?: number
          enabled?: boolean
          id?: string
          label?: string
          per_ip_daily_cap?: number
          token?: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          daily_cap?: number
          enabled?: boolean
          id?: string
          label?: string
          per_ip_daily_cap?: number
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_demo_links_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "voice_agents"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      client_contact_status: {
        Row: {
          client_id: string | null
          is_flagged: boolean | null
          last_contacted_at: string | null
        }
        Relationships: []
      }
      voice_usage_daily: {
        Row: {
          agent_id: string | null
          calls: number | null
          cost_cents: number | null
          day: string | null
          is_demo: boolean | null
          minutes: number | null
          successful_calls: number | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_calls_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "voice_agents"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      client_health_threshold_days: { Args: never; Returns: number }
      convert_lead_to_client: { Args: { p_lead_id: string }; Returns: string }
      find_contact_by_email: {
        Args: { p_email: string }
        Returns: {
          entity_id: string
          entity_type: string
        }[]
      }
      find_contact_by_org: {
        Args: { p_demo?: boolean; p_org: string }
        Returns: {
          entity_id: string
          entity_type: string
        }[]
      }
      find_contact_by_phone: {
        Args: { p_phone: string }
        Returns: {
          entity_id: string
          entity_type: string
        }[]
      }
      find_org_candidates: {
        Args: { p_demo?: boolean; p_org: string }
        Returns: {
          entity_id: string
          entity_type: string
          practice_name: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      normalize_org: { Args: { p_org: string }; Returns: string }
      record_client_intake_submission: {
        Args: { p_client_id: string; p_submission: Json }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
