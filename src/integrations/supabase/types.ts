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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          action: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id: string
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      board_activities: {
        Row: {
          action: string
          board_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          board_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          board_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_activities_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      board_columns: {
        Row: {
          board_id: string
          color: string
          column_type: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          label: string
          max_cards: number | null
          sort_order: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          board_id: string
          color?: string
          column_type?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          label: string
          max_cards?: number | null
          sort_order?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          board_id?: string
          color?: string
          column_type?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          label?: string
          max_cards?: number | null
          sort_order?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "board_columns_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      board_members: {
        Row: {
          board_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          updated_by: string | null
          user_id: string
        }
        Insert: {
          board_id: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          updated_by?: string | null
          user_id: string
        }
        Update: {
          board_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_members_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      board_tasks: {
        Row: {
          assigned_to: string
          board_id: string
          candidate_id: string | null
          card_type: string
          column_id: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          due_date: string | null
          id: string
          notes: string
          priority: string | null
          sort_order: number
          title: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          assigned_to?: string
          board_id: string
          candidate_id?: string | null
          card_type?: string
          column_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          due_date?: string | null
          id?: string
          notes?: string
          priority?: string | null
          sort_order?: number
          title: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          assigned_to?: string
          board_id?: string
          candidate_id?: string | null
          card_type?: string
          column_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          due_date?: string | null
          id?: string
          notes?: string
          priority?: string | null
          sort_order?: number
          title?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "board_tasks_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_tasks_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_tasks_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "board_columns"
            referencedColumns: ["id"]
          },
        ]
      }
      boards: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_shared: boolean
          name: string
          owner_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_shared?: boolean
          name: string
          owner_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_shared?: boolean
          name?: string
          owner_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      candidate_attachments: {
        Row: {
          candidate_id: string
          created_at: string
          cv_text: string | null
          deleted_at: string | null
          deleted_by: string | null
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          upload_status: string
          user_id: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          cv_text?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          mime_type?: string
          upload_status?: string
          user_id: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          cv_text?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          upload_status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_attachments_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_comments: {
        Row: {
          candidate_id: string
          content: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          updated_at: string | null
          updated_by: string | null
          user_id: string
        }
        Insert: {
          candidate_id: string
          content?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
          user_id: string
        }
        Update: {
          candidate_id?: string
          content?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_comments_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_emails: {
        Row: {
          candidate_id: string
          content: string
          created_at: string
          id: string
          subject: string
          user_id: string
        }
        Insert: {
          candidate_id: string
          content?: string
          created_at?: string
          id?: string
          subject?: string
          user_id: string
        }
        Update: {
          candidate_id?: string
          content?: string
          created_at?: string
          id?: string
          subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_emails_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          ai_summary: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string
          expected_salary: string
          id: string
          is_rejected: boolean
          name: string
          notes: string
          notice_period: string
          owner_id: string | null
          phone: string
          position_id: string
          previous_stage_id: string | null
          rejected_at: string | null
          stage_id: string | null
          tags: string[]
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          ai_summary?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string
          expected_salary?: string
          id?: string
          is_rejected?: boolean
          name: string
          notes?: string
          notice_period?: string
          owner_id?: string | null
          phone?: string
          position_id: string
          previous_stage_id?: string | null
          rejected_at?: string | null
          stage_id?: string | null
          tags?: string[]
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          ai_summary?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string
          expected_salary?: string
          id?: string
          is_rejected?: boolean
          name?: string
          notes?: string
          notice_period?: string
          owner_id?: string | null
          phone?: string
          position_id?: string
          previous_stage_id?: string | null
          rejected_at?: string | null
          stage_id?: string | null
          tags?: string[]
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_previous_stage_id_fkey"
            columns: ["previous_stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          name: string
          notes: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          name: string
          notes?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          name?: string
          notes?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      google_calendar_tokens: {
        Row: {
          created_at: string
          token: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          token: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          token?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      interviews: {
        Row: {
          candidate_id: string
          created_at: string
          google_event_id: string | null
          id: string
          notes: string
          scheduled_at: string
          status: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          google_event_id?: string | null
          id?: string
          notes?: string
          scheduled_at?: string
          status?: string
          title?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          google_event_id?: string | null
          id?: string
          notes?: string
          scheduled_at?: string
          status?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interviews_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          content: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          read?: boolean
          type?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      owners: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          name: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          name: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      personal_columns: {
        Row: {
          color: string
          column_type: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          label: string
          max_cards: number | null
          sort_order: number
          updated_at: string | null
          updated_by: string | null
          user_id: string
        }
        Insert: {
          color?: string
          column_type?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          label: string
          max_cards?: number | null
          sort_order?: number
          updated_at?: string | null
          updated_by?: string | null
          user_id: string
        }
        Update: {
          color?: string
          column_type?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          label?: string
          max_cards?: number | null
          sort_order?: number
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      personal_tasks: {
        Row: {
          assigned_to: string
          candidate_id: string | null
          card_type: string
          column_id: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          due_date: string | null
          id: string
          notes: string
          priority: string | null
          sort_order: number
          title: string
          updated_at: string | null
          updated_by: string | null
          user_id: string
        }
        Insert: {
          assigned_to?: string
          candidate_id?: string | null
          card_type?: string
          column_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          due_date?: string | null
          id?: string
          notes?: string
          priority?: string | null
          sort_order?: number
          title: string
          updated_at?: string | null
          updated_by?: string | null
          user_id: string
        }
        Update: {
          assigned_to?: string
          candidate_id?: string | null
          card_type?: string
          column_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          due_date?: string | null
          id?: string
          notes?: string
          priority?: string | null
          sort_order?: number
          title?: string
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_tasks_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_tasks_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "personal_columns"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          company_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          notes: string
          title: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          notes?: string
          title: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          notes?: string
          title?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "positions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          google_calendar_token: Json | null
          id: string
          name: string
          reminder_settings: Json
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          email?: string
          google_calendar_token?: Json | null
          id: string
          name?: string
          reminder_settings?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          google_calendar_token?: Json | null
          id?: string
          name?: string
          reminder_settings?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sales_leads: {
        Row: {
          answer: string
          business_category: string
          comments: string
          company: string
          company_address: string
          company_size: string
          contact_date_1: string
          contact_date_2: string
          contact_date_3: string
          contact_name: string
          country: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string
          hq_country: string
          id: string
          jobs_bg_url: string
          language: string
          linkedin_contact: string
          linkedin_url: string
          notes: string
          offer: string
          offer_comment: string
          phone: string
          position: string
          salary: string
          sheet_id: string
          sort_order: number
          special_conditions: string
          updated_at: string | null
          updated_by: string | null
          website_url: string
        }
        Insert: {
          answer?: string
          business_category?: string
          comments?: string
          company?: string
          company_address?: string
          company_size?: string
          contact_date_1?: string
          contact_date_2?: string
          contact_date_3?: string
          contact_name?: string
          country?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string
          hq_country?: string
          id?: string
          jobs_bg_url?: string
          language?: string
          linkedin_contact?: string
          linkedin_url?: string
          notes?: string
          offer?: string
          offer_comment?: string
          phone?: string
          position?: string
          salary?: string
          sheet_id: string
          sort_order?: number
          special_conditions?: string
          updated_at?: string | null
          updated_by?: string | null
          website_url?: string
        }
        Update: {
          answer?: string
          business_category?: string
          comments?: string
          company?: string
          company_address?: string
          company_size?: string
          contact_date_1?: string
          contact_date_2?: string
          contact_date_3?: string
          contact_name?: string
          country?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string
          hq_country?: string
          id?: string
          jobs_bg_url?: string
          language?: string
          linkedin_contact?: string
          linkedin_url?: string
          notes?: string
          offer?: string
          offer_comment?: string
          phone?: string
          position?: string
          salary?: string
          sheet_id?: string
          sort_order?: number
          special_conditions?: string
          updated_at?: string | null
          updated_by?: string | null
          website_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_leads_sheet_id_fkey"
            columns: ["sheet_id"]
            isOneToOne: false
            referencedRelation: "sales_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_sheets: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      security_alerts: {
        Row: {
          alert_type: string
          created_at: string
          description: string
          id: string
          metadata: Json
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          title: string
          user_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          description?: string
          id?: string
          metadata?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          title: string
          user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          description?: string
          id?: string
          metadata?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      stages: {
        Row: {
          color: string
          company_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          label: string
          sort_order: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          color?: string
          company_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          label: string
          sort_order?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          color?: string
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_config: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          id: string
          last_active_at: string
          login_at: string
          logout_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          last_active_at?: string
          login_at?: string
          logout_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          last_active_at?: string
          login_at?: string
          logout_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      weekly_report_rows: {
        Row: {
          accepted: number
          company_name: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          fb_applicants: number
          hires: number
          id: string
          interviews: number
          job_post: number
          linkedin: number
          notes: string
          offers: number
          phone_screens: number
          position_name: string
          recruiter: string
          rejections: number
          report_id: string
          row_status: string | null
          sent_to_client: number
          sort_order: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          accepted?: number
          company_name?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          fb_applicants?: number
          hires?: number
          id?: string
          interviews?: number
          job_post?: number
          linkedin?: number
          notes?: string
          offers?: number
          phone_screens?: number
          position_name?: string
          recruiter?: string
          rejections?: number
          report_id: string
          row_status?: string | null
          sent_to_client?: number
          sort_order?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          accepted?: number
          company_name?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          fb_applicants?: number
          hires?: number
          id?: string
          interviews?: number
          job_post?: number
          linkedin?: number
          notes?: string
          offers?: number
          phone_screens?: number
          position_name?: string
          recruiter?: string
          rejections?: number
          report_id?: string
          row_status?: string | null
          sent_to_client?: number
          sort_order?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_report_rows_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "weekly_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_reports: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          sort_order: number
          updated_at: string | null
          updated_by: string | null
          week_end_date: string
          week_start_date: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          sort_order?: number
          updated_at?: string | null
          updated_by?: string | null
          week_end_date: string
          week_start_date: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          sort_order?: number
          updated_at?: string | null
          updated_by?: string | null
          week_end_date?: string
          week_start_date?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_board_role: {
        Args: { _board_id: string; _user_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_board_member: {
        Args: { _board_id: string; _user_id: string }
        Returns: boolean
      }
      is_board_owner: {
        Args: { _board_id: string; _user_id: string }
        Returns: boolean
      }
      is_board_participant: {
        Args: { _board_id: string; _user_id: string }
        Returns: boolean
      }
      trigger_full_sync: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user" | "sales"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "sales"],
    },
  },
} as const
