


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."activate_enrollment"("p_enrollment_id" "uuid", "p_activated_on" "date", "p_group_id" "uuid" DEFAULT NULL::"uuid", "p_classes_start_on" "date" DEFAULT NULL::"date", "p_reason" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
    select
        app_private.activate_enrollment_internal(
            p_enrollment_id,
            p_activated_on,
            p_group_id,
            p_classes_start_on,
            p_reason
        );
$$;


ALTER FUNCTION "public"."activate_enrollment"("p_enrollment_id" "uuid", "p_activated_on" "date", "p_group_id" "uuid", "p_classes_start_on" "date", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."adjust_charge"("p_charge_id" "uuid", "p_target_amount" numeric, "p_adjustment_type" "text", "p_reason" "text") RETURNS "uuid"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
    select
        app_private.adjust_charge_internal(
            p_charge_id,
            p_target_amount,
            p_adjustment_type,
            p_reason
        );
$$;


ALTER FUNCTION "public"."adjust_charge"("p_charge_id" "uuid", "p_target_amount" numeric, "p_adjustment_type" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_credit"("p_credit_id" "uuid", "p_charge_id" "uuid", "p_amount" numeric) RETURNS "uuid"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
    select app_private.apply_credit_internal(
        p_credit_id,
        p_charge_id,
        p_amount
    );
$$;


ALTER FUNCTION "public"."apply_credit"("p_credit_id" "uuid", "p_charge_id" "uuid", "p_amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_create_and_activate_enrollments"("p_items" "jsonb") RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    select app_private.bulk_create_and_activate_enrollments_internal(
        p_items
    );
$$;


ALTER FUNCTION "public"."bulk_create_and_activate_enrollments"("p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."change_enrollment_classification"("p_enrollment_id" "uuid", "p_classification_id" "uuid", "p_effective_on" "date", "p_reason" "text") RETURNS "uuid"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
    select
        app_private.change_enrollment_classification_internal(
            p_enrollment_id,
            p_classification_id,
            p_effective_on,
            p_reason
        );
$$;


ALTER FUNCTION "public"."change_enrollment_classification"("p_enrollment_id" "uuid", "p_classification_id" "uuid", "p_effective_on" "date", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."change_enrollment_financial_plan"("p_enrollment_id" "uuid", "p_target_financial_plan_id" "uuid", "p_effective_on" "date", "p_reason" "text") RETURNS "uuid"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
    select
        app_private.change_enrollment_financial_plan_internal(
            p_enrollment_id,
            p_target_financial_plan_id,
            p_effective_on,
            p_reason
        );
$$;


ALTER FUNCTION "public"."change_enrollment_financial_plan"("p_enrollment_id" "uuid", "p_target_financial_plan_id" "uuid", "p_effective_on" "date", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."change_enrollment_group"("p_enrollment_id" "uuid", "p_group_id" "uuid", "p_effective_on" "date", "p_reason" "text") RETURNS "uuid"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
    select
        app_private.change_enrollment_group_internal(
            p_enrollment_id,
            p_group_id,
            p_effective_on,
            p_reason
        );
$$;


ALTER FUNCTION "public"."change_enrollment_group"("p_enrollment_id" "uuid", "p_group_id" "uuid", "p_effective_on" "date", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."change_tuition_discount_category_version"("p_category_id" "uuid", "p_value" numeric, "p_effective_on" "date", "p_reason" "text") RETURNS "uuid"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
    select
        app_private.change_tuition_discount_category_version_internal(
            p_category_id,
            p_value,
            p_effective_on,
            p_reason
        );
$$;


ALTER FUNCTION "public"."change_tuition_discount_category_version"("p_category_id" "uuid", "p_value" numeric, "p_effective_on" "date", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."correct_credit_application"("p_credit_application_id" "uuid", "p_target_charge_id" "uuid", "p_target_amount" numeric, "p_reason" "text") RETURNS "uuid"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
    select
        app_private.correct_credit_application_internal(
            p_credit_application_id,
            p_target_charge_id,
            p_target_amount,
            p_reason
        );
$$;


ALTER FUNCTION "public"."correct_credit_application"("p_credit_application_id" "uuid", "p_target_charge_id" "uuid", "p_target_amount" numeric, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."correct_payment_allocations"("p_payment_id" "uuid", "p_allocations" "jsonb", "p_reason" "text") RETURNS "uuid"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
    select
        app_private.correct_payment_allocations_internal(
            p_payment_id,
            p_allocations,
            p_reason
        );
$$;


ALTER FUNCTION "public"."correct_payment_allocations"("p_payment_id" "uuid", "p_allocations" "jsonb", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."correct_tuition_discount_category_version"("p_category_id" "uuid", "p_value" numeric, "p_effective_on" "date", "p_reason" "text") RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    select app_private.correct_tuition_discount_category_version_internal(
        p_category_id,
        p_value,
        p_effective_on,
        p_reason
    );
$$;


ALTER FUNCTION "public"."correct_tuition_discount_category_version"("p_category_id" "uuid", "p_value" numeric, "p_effective_on" "date", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_and_activate_enrollment"("p_student_id" "uuid", "p_cycle_id" "uuid", "p_grade_level_id" "uuid", "p_classification_id" "uuid", "p_group_id" "uuid", "p_activated_on" "date", "p_classes_start_on" "date", "p_economic_start_on" "date", "p_initial_period_amount" numeric DEFAULT NULL::numeric, "p_initial_period_due_date" "date" DEFAULT NULL::"date", "p_enrollment_fee_mode" "text" DEFAULT NULL::"text", "p_enrollment_fee_amount" numeric DEFAULT NULL::numeric, "p_reason" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    select app_private.create_and_activate_enrollment_internal(
        p_student_id,
        p_cycle_id,
        p_grade_level_id,
        p_classification_id,
        p_group_id,

        p_activated_on,
        p_classes_start_on,
        p_economic_start_on,

        p_initial_period_amount,
        p_initial_period_due_date,

        p_enrollment_fee_mode,
        p_enrollment_fee_amount,

        p_reason
    );
$$;


ALTER FUNCTION "public"."create_and_activate_enrollment"("p_student_id" "uuid", "p_cycle_id" "uuid", "p_grade_level_id" "uuid", "p_classification_id" "uuid", "p_group_id" "uuid", "p_activated_on" "date", "p_classes_start_on" "date", "p_economic_start_on" "date", "p_initial_period_amount" numeric, "p_initial_period_due_date" "date", "p_enrollment_fee_mode" "text", "p_enrollment_fee_amount" numeric, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_new_student_enrollment"("p_student_full_name" "text", "p_student_sex" "text", "p_student_birth_date" "date", "p_contacts" "jsonb", "p_cycle_id" "uuid", "p_grade_level_id" "uuid", "p_classification_id" "uuid", "p_group_id" "uuid", "p_activated_on" "date", "p_classes_start_on" "date", "p_economic_start_on" "date", "p_initial_period_amount" numeric DEFAULT NULL::numeric, "p_initial_period_due_date" "date" DEFAULT NULL::"date", "p_enrollment_fee_mode" "text" DEFAULT NULL::"text", "p_enrollment_fee_amount" numeric DEFAULT NULL::numeric, "p_discount_category_id" "uuid" DEFAULT NULL::"uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    select
        app_private.create_new_student_enrollment_internal(
            p_student_full_name,
            p_student_sex,
            p_student_birth_date,
            p_contacts,

            p_cycle_id,
            p_grade_level_id,
            p_classification_id,
            p_group_id,

            p_activated_on,
            p_classes_start_on,
            p_economic_start_on,

            p_initial_period_amount,
            p_initial_period_due_date,

            p_enrollment_fee_mode,
            p_enrollment_fee_amount,

            p_discount_category_id,

            p_reason
        );
$$;


ALTER FUNCTION "public"."create_new_student_enrollment"("p_student_full_name" "text", "p_student_sex" "text", "p_student_birth_date" "date", "p_contacts" "jsonb", "p_cycle_id" "uuid", "p_grade_level_id" "uuid", "p_classification_id" "uuid", "p_group_id" "uuid", "p_activated_on" "date", "p_classes_start_on" "date", "p_economic_start_on" "date", "p_initial_period_amount" numeric, "p_initial_period_due_date" "date", "p_enrollment_fee_mode" "text", "p_enrollment_fee_amount" numeric, "p_discount_category_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_preregistration_campaign"("p_target_cycle_id" "uuid", "p_education_level_id" "uuid", "p_name" "text", "p_starts_on" "date", "p_ends_on" "date", "p_price" numeric, "p_covered_concept_id" "uuid", "p_allows_partial_payments" boolean DEFAULT false, "p_non_continuation_policy" "text" DEFAULT 'MANUAL_REVIEW'::"text", "p_status" "text" DEFAULT 'DRAFT'::"text") RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    select app_private.create_preregistration_campaign_internal(
        p_target_cycle_id,
        p_education_level_id,
        p_name,
        p_starts_on,
        p_ends_on,
        p_price,
        p_covered_concept_id,
        p_allows_partial_payments,
        p_non_continuation_policy,
        p_status
    );
$$;


ALTER FUNCTION "public"."create_preregistration_campaign"("p_target_cycle_id" "uuid", "p_education_level_id" "uuid", "p_name" "text", "p_starts_on" "date", "p_ends_on" "date", "p_price" numeric, "p_covered_concept_id" "uuid", "p_allows_partial_payments" boolean, "p_non_continuation_policy" "text", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_preregistration_intake"("p_preregistered_on" "date", "p_student_id" "uuid", "p_student_full_name" "text", "p_target_cycle_id" "uuid", "p_target_education_level_id" "uuid", "p_target_grade_level_id" "uuid", "p_target_group_id" "uuid", "p_campaign_id" "uuid", "p_contacts" "jsonb", "p_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    select app_private.create_preregistration_intake_internal(
        p_preregistered_on,

        p_student_id,
        p_student_full_name,

        p_target_cycle_id,
        p_target_education_level_id,
        p_target_grade_level_id,
        p_target_group_id,

        p_campaign_id,

        p_contacts,

        p_notes
    );
$$;


ALTER FUNCTION "public"."create_preregistration_intake"("p_preregistered_on" "date", "p_student_id" "uuid", "p_student_full_name" "text", "p_target_cycle_id" "uuid", "p_target_education_level_id" "uuid", "p_target_grade_level_id" "uuid", "p_target_group_id" "uuid", "p_campaign_id" "uuid", "p_contacts" "jsonb", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_retroactive_preregistration"("p_student_id" "uuid", "p_campaign_id" "uuid", "p_preregistered_on" "date", "p_target_grade_level_id" "uuid", "p_target_group_id" "uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    select app_private.create_retroactive_preregistration_internal(
        p_student_id,
        p_campaign_id,
        p_preregistered_on,
        p_target_grade_level_id,
        p_target_group_id,
        p_notes
    );
$$;


ALTER FUNCTION "public"."create_retroactive_preregistration"("p_student_id" "uuid", "p_campaign_id" "uuid", "p_preregistered_on" "date", "p_target_grade_level_id" "uuid", "p_target_group_id" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_tuition_base_agreement"("p_enrollment_id" "uuid", "p_effective_on" "date", "p_reason" "text") RETURNS "uuid"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
    select
        app_private.create_tuition_base_agreement_internal(
            p_enrollment_id,
            p_effective_on,
            p_reason
        );
$$;


ALTER FUNCTION "public"."create_tuition_base_agreement"("p_enrollment_id" "uuid", "p_effective_on" "date", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_tuition_discount_category"("p_cycle_id" "uuid", "p_name" "text", "p_discount_type" "text", "p_value" numeric, "p_effective_on" "date", "p_reason" "text") RETURNS "uuid"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
    select
        app_private.create_tuition_discount_category_internal(
            p_cycle_id,
            p_name,
            p_discount_type,
            p_value,
            p_effective_on,
            p_reason
        );
$$;


ALTER FUNCTION "public"."create_tuition_discount_category"("p_cycle_id" "uuid", "p_name" "text", "p_discount_type" "text", "p_value" numeric, "p_effective_on" "date", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enrollment_as_of"("p_cycle_id" "uuid", "p_as_of" "date") RETURNS TABLE("enrollment_id" "uuid", "student_id" "uuid", "student_code" "text", "student_name" "text", "sex" "text", "cycle_id" "uuid", "cycle_code" "text", "education_level_id" "uuid", "education_level_code" "text", "education_level_name" "text", "grade_level_id" "uuid", "grade_code" "text", "grade_name" "text", "group_id" "uuid", "classification_id" "uuid", "classification_code" "text", "classification_name" "text", "counts_for_sep" boolean, "counts_for_campus" boolean, "status" "text", "enrolled_on" "date", "classes_start_on" "date", "closed_on" "date", "as_of" "date", "history_quality" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
    select *
    from app_private.enrollment_as_of_internal(
        p_cycle_id,
        p_as_of
    );
$$;


ALTER FUNCTION "public"."enrollment_as_of"("p_cycle_id" "uuid", "p_as_of" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enrollment_fee_is_covered"("p_student_id" "uuid", "p_cycle_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    select app_private.enrollment_fee_is_covered(
        p_student_id,
        p_cycle_id
    );
$$;


ALTER FUNCTION "public"."enrollment_fee_is_covered"("p_student_id" "uuid", "p_cycle_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."initialize_enrollment_financials"("p_enrollment_id" "uuid", "p_effective_on" "date", "p_economic_start_on" "date", "p_initial_period_amount" numeric DEFAULT NULL::numeric, "p_initial_period_due_date" "date" DEFAULT NULL::"date", "p_reason" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
    select
        app_private.initialize_enrollment_financials_internal(
            p_enrollment_id,
            p_effective_on,
            p_economic_start_on,
            p_initial_period_amount,
            p_initial_period_due_date,
            p_reason
        );
$$;


ALTER FUNCTION "public"."initialize_enrollment_financials"("p_enrollment_id" "uuid", "p_effective_on" "date", "p_economic_start_on" "date", "p_initial_period_amount" numeric, "p_initial_period_due_date" "date", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."payment_reporting"("p_from" "date", "p_to" "date") RETURNS TABLE("payment_id" "uuid", "payment_code" "text", "student_id" "uuid", "student_code" "text", "student_name" "text", "received_at" timestamp with time zone, "gross_amount" numeric, "refunded_amount" numeric, "net_amount" numeric, "payment_status" "text", "payment_method_id" "uuid", "method_code" "text", "method_name" "text", "method_classification" "text", "received_by_staff_id" "uuid", "received_by_name" "text", "captured_by_profile_id" "uuid", "bank_reference" "text", "active_allocated_amount" numeric, "active_credit_amount" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
    select *
    from app_private.payment_reporting_internal(
        p_from,
        p_to
    );
$$;


ALTER FUNCTION "public"."payment_reporting"("p_from" "date", "p_to" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_financial_withdrawal"("p_enrollment_id" "uuid", "p_withdrawn_on" "date", "p_mode" "text", "p_current_period_action" "text", "p_current_period_amount" numeric DEFAULT NULL::numeric, "p_custom_future_targets" "jsonb" DEFAULT '[]'::"jsonb", "p_reason" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
    select
        app_private.process_financial_withdrawal_internal(
            p_enrollment_id,
            p_withdrawn_on,
            p_mode,
            p_current_period_action,
            p_current_period_amount,
            p_custom_future_targets,
            p_reason
        );
$$;


ALTER FUNCTION "public"."process_financial_withdrawal"("p_enrollment_id" "uuid", "p_withdrawn_on" "date", "p_mode" "text", "p_current_period_action" "text", "p_current_period_amount" numeric, "p_custom_future_targets" "jsonb", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reactivate_enrollment"("p_enrollment_id" "uuid", "p_reactivated_on" "date", "p_group_id" "uuid" DEFAULT NULL::"uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
    select
        app_private.reactivate_enrollment_internal(
            p_enrollment_id,
            p_reactivated_on,
            p_group_id,
            p_reason
        );
$$;


ALTER FUNCTION "public"."reactivate_enrollment"("p_enrollment_id" "uuid", "p_reactivated_on" "date", "p_group_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reactivate_enrollment_financial"("p_enrollment_id" "uuid", "p_reactivated_on" "date", "p_group_id" "uuid" DEFAULT NULL::"uuid", "p_economic_start_on" "date" DEFAULT NULL::"date", "p_initial_tuition_amount" numeric DEFAULT NULL::numeric, "p_initial_tuition_due_date" "date" DEFAULT NULL::"date", "p_enrollment_fee_mode" "text" DEFAULT NULL::"text", "p_enrollment_fee_amount" numeric DEFAULT NULL::numeric, "p_reason" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    select app_private.reactivate_enrollment_financial_internal(
        p_enrollment_id,
        p_reactivated_on,
        p_group_id,
        p_economic_start_on,
        p_initial_tuition_amount,
        p_initial_tuition_due_date,
        p_enrollment_fee_mode,
        p_enrollment_fee_amount,
        p_reason
    );
$$;


ALTER FUNCTION "public"."reactivate_enrollment_financial"("p_enrollment_id" "uuid", "p_reactivated_on" "date", "p_group_id" "uuid", "p_economic_start_on" "date", "p_initial_tuition_amount" numeric, "p_initial_tuition_due_date" "date", "p_enrollment_fee_mode" "text", "p_enrollment_fee_amount" numeric, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."receiver_income"("p_staff_id" "uuid", "p_from" "date", "p_to" "date") RETURNS TABLE("staff_id" "uuid", "staff_name" "text", "payment_count" bigint, "gross_amount" numeric, "refunded_amount" numeric, "net_amount" numeric, "cash_like_amount" numeric, "in_kind_amount" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
    select *
    from app_private.receiver_income_internal(
        p_staff_id,
        p_from,
        p_to
    );
$$;


ALTER FUNCTION "public"."receiver_income"("p_staff_id" "uuid", "p_from" "date", "p_to" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refund_payment"("p_payment_id" "uuid", "p_amount" numeric, "p_refunded_at" timestamp with time zone, "p_refund_method_id" "uuid", "p_reason" "text", "p_components" "jsonb") RETURNS "uuid"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
    select app_private.refund_payment_internal(
        p_payment_id,
        p_amount,
        p_refunded_at,
        p_refund_method_id,
        p_reason,
        p_components
    );
$$;


ALTER FUNCTION "public"."refund_payment"("p_payment_id" "uuid", "p_amount" numeric, "p_refunded_at" timestamp with time zone, "p_refund_method_id" "uuid", "p_reason" "text", "p_components" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."register_payment"("p_student_id" "uuid", "p_received_at" timestamp with time zone, "p_amount" numeric, "p_payment_method_id" "uuid", "p_received_by_staff_id" "uuid", "p_bank_reference" "text" DEFAULT NULL::"text", "p_notes" "text" DEFAULT NULL::"text", "p_receipt_visible_note" "text" DEFAULT NULL::"text", "p_allocations" "jsonb" DEFAULT '[]'::"jsonb", "p_allocation_override_reason" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
    select app_private.register_payment_internal(
        p_student_id,
        p_received_at,
        p_amount,
        p_payment_method_id,
        p_received_by_staff_id,
        p_bank_reference,
        p_notes,
        p_receipt_visible_note,
        p_allocations,
        p_allocation_override_reason
    );
$$;


ALTER FUNCTION "public"."register_payment"("p_student_id" "uuid", "p_received_at" timestamp with time zone, "p_amount" numeric, "p_payment_method_id" "uuid", "p_received_by_staff_id" "uuid", "p_bank_reference" "text", "p_notes" "text", "p_receipt_visible_note" "text", "p_allocations" "jsonb", "p_allocation_override_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."register_preregistration_in_campaign"("p_campaign_id" "uuid", "p_student_id" "uuid", "p_target_grade_level_id" "uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    select app_private.register_preregistration_in_campaign_internal(
        p_campaign_id,
        p_student_id,
        p_target_grade_level_id,
        p_notes
    );
$$;


ALTER FUNCTION "public"."register_preregistration_in_campaign"("p_campaign_id" "uuid", "p_student_id" "uuid", "p_target_grade_level_id" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."regularize_enrollment_financial_start"("p_enrollment_id" "uuid", "p_economic_start_on" "date", "p_initial_period_amount" numeric DEFAULT NULL::numeric, "p_initial_period_due_date" "date" DEFAULT NULL::"date", "p_reason" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    select
        app_private.regularize_enrollment_financial_start_internal(
            p_enrollment_id,
            p_economic_start_on,
            p_initial_period_amount,
            p_initial_period_due_date,
            p_reason
        );
$$;


ALTER FUNCTION "public"."regularize_enrollment_financial_start"("p_enrollment_id" "uuid", "p_economic_start_on" "date", "p_initial_period_amount" numeric, "p_initial_period_due_date" "date", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rename_tuition_discount_category"("p_category_id" "uuid", "p_name" "text", "p_reason" "text") RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    select app_private.rename_tuition_discount_category_internal(
        p_category_id,
        p_name,
        p_reason
    );
$$;


ALTER FUNCTION "public"."rename_tuition_discount_category"("p_category_id" "uuid", "p_name" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_preregistration_to_enrollment"("p_preregistration_id" "uuid", "p_classification_id" "uuid", "p_group_id" "uuid", "p_activated_on" "date", "p_classes_start_on" "date", "p_economic_start_on" "date", "p_initial_period_amount" numeric DEFAULT NULL::numeric, "p_initial_period_due_date" "date" DEFAULT NULL::"date", "p_enrollment_fee_mode" "text" DEFAULT NULL::"text", "p_enrollment_fee_amount" numeric DEFAULT NULL::numeric, "p_reason" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    select app_private.resolve_preregistration_to_enrollment_internal(
        p_preregistration_id,
        p_classification_id,
        p_group_id,
        p_activated_on,
        p_classes_start_on,
        p_economic_start_on,
        p_initial_period_amount,
        p_initial_period_due_date,
        p_enrollment_fee_mode,
        p_enrollment_fee_amount,
        p_reason
    );
$$;


ALTER FUNCTION "public"."resolve_preregistration_to_enrollment"("p_preregistration_id" "uuid", "p_classification_id" "uuid", "p_group_id" "uuid", "p_activated_on" "date", "p_classes_start_on" "date", "p_economic_start_on" "date", "p_initial_period_amount" numeric, "p_initial_period_due_date" "date", "p_enrollment_fee_mode" "text", "p_enrollment_fee_amount" numeric, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reverse_credit_application"("p_credit_application_id" "uuid", "p_reason" "text") RETURNS "uuid"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
    select
        app_private.reverse_credit_application_internal(
            p_credit_application_id,
            p_reason
        );
$$;


ALTER FUNCTION "public"."reverse_credit_application"("p_credit_application_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reverse_payment"("p_payment_id" "uuid", "p_reason" "text") RETURNS "uuid"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
    select app_private.reverse_payment_internal(
        p_payment_id,
        p_reason
    );
$$;


ALTER FUNCTION "public"."reverse_payment"("p_payment_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_base_rate"("p_cycle_id" "uuid", "p_education_level_id" "uuid", "p_financial_concept_id" "uuid", "p_amount" numeric, "p_effective_on" "date", "p_reason" "text") RETURNS "uuid"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
    select app_private.set_base_rate_internal(
        p_cycle_id,
        p_education_level_id,
        p_financial_concept_id,
        p_amount,
        p_effective_on,
        p_reason
    );
$$;


ALTER FUNCTION "public"."set_base_rate"("p_cycle_id" "uuid", "p_education_level_id" "uuid", "p_financial_concept_id" "uuid", "p_amount" numeric, "p_effective_on" "date", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_enrollment_tuition_discount"("p_enrollment_id" "uuid", "p_category_id" "uuid", "p_effective_on" "date", "p_effect_mode" "text", "p_current_period_amount" numeric DEFAULT NULL::numeric, "p_reason" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
    select
        app_private.set_enrollment_tuition_discount_internal(
            p_enrollment_id,
            p_category_id,
            p_effective_on,
            p_effect_mode,
            p_current_period_amount,
            p_reason
        );
$$;


ALTER FUNCTION "public"."set_enrollment_tuition_discount"("p_enrollment_id" "uuid", "p_category_id" "uuid", "p_effective_on" "date", "p_effect_mode" "text", "p_current_period_amount" numeric, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_tuition_discount_category_active"("p_category_id" "uuid", "p_is_active" boolean, "p_reason" "text") RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    select app_private.set_tuition_discount_category_active_internal(
        p_category_id,
        p_is_active,
        p_reason
    );
$$;


ALTER FUNCTION "public"."set_tuition_discount_category_active"("p_category_id" "uuid", "p_is_active" boolean, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."student_account_movements"("p_student_id" "uuid") RETURNS TABLE("movement_on" "date", "recorded_at" timestamp with time zone, "movement_type" "text", "reference_id" "uuid", "parent_reference_id" "uuid", "cycle_id" "uuid", "financial_concept_id" "uuid", "concept_code" "text", "description" "text", "received_by_name_snapshot" "text", "debit" numeric, "credit" numeric, "status" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
    select *
    from app_private.student_account_movements_internal(
        p_student_id
    );
$$;


ALTER FUNCTION "public"."student_account_movements"("p_student_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."student_account_summary"("p_student_id" "uuid") RETURNS TABLE("student_id" "uuid", "active_charge_count" bigint, "original_charge_total" numeric, "adjustment_total" numeric, "effective_charge_total" numeric, "payment_applied_total" numeric, "credit_applied_total" numeric, "outstanding_total" numeric, "overdue_total" numeric, "overdue_charge_count" bigint, "available_credit" numeric, "is_current" boolean)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
    select *
    from app_private.student_account_summary_internal(
        p_student_id
    );
$$;


ALTER FUNCTION "public"."student_account_summary"("p_student_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."student_charge_balances"("p_student_id" "uuid") RETURNS TABLE("charge_id" "uuid", "enrollment_id" "uuid", "cycle_id" "uuid", "cycle_code" "text", "financial_concept_id" "uuid", "concept_code" "text", "concept_name" "text", "coverage_year" smallint, "coverage_month" smallint, "due_date" "date", "origin" "text", "original_amount" numeric, "adjustment_amount" numeric, "effective_amount" numeric, "payment_applied" numeric, "credit_applied" numeric, "total_applied" numeric, "outstanding_amount" numeric, "is_paid" boolean, "is_overdue" boolean)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
    select *
    from app_private.student_charge_balances_internal(
        p_student_id
    );
$$;


ALTER FUNCTION "public"."student_charge_balances"("p_student_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_payment_metadata"("p_payment_id" "uuid", "p_patch" "jsonb", "p_reason" "text") RETURNS "uuid"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
    select
        app_private.update_payment_metadata_internal(
            p_payment_id,
            p_patch,
            p_reason
        );
$$;


ALTER FUNCTION "public"."update_payment_metadata"("p_payment_id" "uuid", "p_patch" "jsonb", "p_reason" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."academic_capture_windows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "evaluation_period_id" "uuid" NOT NULL,
    "cycle_id" "uuid" NOT NULL,
    "grade_level_id" "uuid" NOT NULL,
    "group_id" "uuid" NOT NULL,
    "curriculum_subject_id" "uuid" NOT NULL,
    "teacher_assignment_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'CLOSED'::"text" NOT NULL,
    "opened_at" timestamp with time zone,
    "opened_by" "uuid",
    "closed_at" timestamp with time zone,
    "closed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "academic_capture_windows_closed_state_check" CHECK ((("status" <> 'CLOSED'::"text") OR ("opened_at" IS NULL) OR ("closed_at" IS NOT NULL))),
    CONSTRAINT "academic_capture_windows_open_state_check" CHECK ((("status" <> 'OPEN'::"text") OR (("opened_at" IS NOT NULL) AND ("opened_by" IS NOT NULL)))),
    CONSTRAINT "academic_capture_windows_status_check" CHECK (("status" = ANY (ARRAY['OPEN'::"text", 'CLOSED'::"text"])))
);


ALTER TABLE "public"."academic_capture_windows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_profile_id" "uuid",
    "action" "text" NOT NULL,
    "entity_name" "text" NOT NULL,
    "entity_id" "uuid",
    "old_values" "jsonb",
    "new_values" "jsonb",
    "reason" "text",
    "correlation_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "audit_log_action_not_blank" CHECK (("btrim"("action") <> ''::"text")),
    CONSTRAINT "audit_log_entity_name_not_blank" CHECK (("btrim"("entity_name") <> ''::"text"))
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."base_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cycle_id" "uuid" NOT NULL,
    "education_level_id" "uuid" NOT NULL,
    "financial_concept_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "valid_from" "date" NOT NULL,
    "valid_until" "date",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "base_rates_amount_nonnegative" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "base_rates_validity_check" CHECK ((("valid_until" IS NULL) OR ("valid_until" >= "valid_from")))
);


ALTER TABLE "public"."base_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."benefits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "benefit_type" "text" NOT NULL,
    "value" numeric(12,2) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "benefits_name_not_blank" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "benefits_type_check" CHECK (("benefit_type" = ANY (ARRAY['PERCENTAGE'::"text", 'FIXED_AMOUNT'::"text"]))),
    CONSTRAINT "benefits_value_check" CHECK (((("benefit_type" = 'PERCENTAGE'::"text") AND ("value" > (0)::numeric) AND ("value" <= (100)::numeric)) OR (("benefit_type" = 'FIXED_AMOUNT'::"text") AND ("value" > (0)::numeric))))
);


ALTER TABLE "public"."benefits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."charge_adjustments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "charge_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "adjustment_type" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "charge_adjustments_amount_nonzero" CHECK (("amount" <> (0)::numeric)),
    CONSTRAINT "charge_adjustments_reason_not_blank" CHECK (("btrim"("reason") <> ''::"text")),
    CONSTRAINT "charge_adjustments_type_check" CHECK (("adjustment_type" = ANY (ARRAY['DISCOUNT'::"text", 'WAIVER'::"text", 'CORRECTION'::"text", 'WITHDRAWAL'::"text", 'AGREEMENT'::"text", 'OTHER'::"text"])))
);


ALTER TABLE "public"."charge_adjustments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."charges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "enrollment_id" "uuid",
    "cycle_id" "uuid",
    "financial_concept_id" "uuid" NOT NULL,
    "financial_plan_period_id" "uuid",
    "financial_agreement_id" "uuid",
    "coverage_year" smallint,
    "coverage_month" smallint,
    "original_amount" numeric(12,2) NOT NULL,
    "due_date" "date" NOT NULL,
    "origin" "text" NOT NULL,
    "status" "text" DEFAULT 'ACTIVE'::"text" NOT NULL,
    "created_by" "uuid",
    "legacy_reference" "text",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "charges_agreement_requires_enrollment" CHECK ((("financial_agreement_id" IS NULL) OR ("enrollment_id" IS NOT NULL))),
    CONSTRAINT "charges_amount_nonnegative" CHECK (("original_amount" >= (0)::numeric)),
    CONSTRAINT "charges_coverage_month_check" CHECK ((("coverage_month" IS NULL) OR (("coverage_month" >= 1) AND ("coverage_month" <= 12)))),
    CONSTRAINT "charges_coverage_pair" CHECK (((("coverage_year" IS NULL) AND ("coverage_month" IS NULL)) OR (("coverage_year" IS NOT NULL) AND ("coverage_month" IS NOT NULL)))),
    CONSTRAINT "charges_coverage_year_check" CHECK ((("coverage_year" IS NULL) OR (("coverage_year" >= 2000) AND ("coverage_year" <= 2200)))),
    CONSTRAINT "charges_enrollment_requires_cycle" CHECK ((("enrollment_id" IS NULL) OR ("cycle_id" IS NOT NULL))),
    CONSTRAINT "charges_origin_not_blank" CHECK (("btrim"("origin") <> ''::"text")),
    CONSTRAINT "charges_plan_period_requires_cycle" CHECK ((("financial_plan_period_id" IS NULL) OR ("cycle_id" IS NOT NULL))),
    CONSTRAINT "charges_status_check" CHECK (("status" = ANY (ARRAY['ACTIVE'::"text", 'VOID'::"text"])))
);


ALTER TABLE "public"."charges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "credit_id" "uuid" NOT NULL,
    "charge_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "reversed_at" timestamp with time zone,
    CONSTRAINT "credit_applications_amount_positive" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "credit_applications_reversed_date_check" CHECK ((("reversed_at" IS NULL) OR ("reversed_at" >= "created_at")))
);


ALTER TABLE "public"."credit_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "source_payment_id" "uuid" NOT NULL,
    "original_amount" numeric(12,2) NOT NULL,
    "reserved_charge_id" "uuid",
    "status" "text" DEFAULT 'ACTIVE'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "credits_original_amount_positive" CHECK (("original_amount" > (0)::numeric)),
    CONSTRAINT "credits_status_check" CHECK (("status" = ANY (ARRAY['ACTIVE'::"text", 'VOID'::"text"])))
);


ALTER TABLE "public"."credits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."curriculum_subjects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cycle_id" "uuid" NOT NULL,
    "grade_level_id" "uuid" NOT NULL,
    "subject_id" "uuid" NOT NULL,
    "quantitative_enabled" boolean DEFAULT true NOT NULL,
    "qualitative_enabled" boolean DEFAULT true NOT NULL,
    "quantitative_min" numeric(4,2),
    "quantitative_max" numeric(4,2),
    "qualitative_max_length" integer,
    "sort_order" integer NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "include_in_main_average" boolean DEFAULT false NOT NULL,
    CONSTRAINT "curriculum_subjects_evaluation_enabled_check" CHECK ((("quantitative_enabled" = true) OR ("qualitative_enabled" = true))),
    CONSTRAINT "curriculum_subjects_qualitative_config_check" CHECK (((("qualitative_enabled" = true) AND ("qualitative_max_length" IS NOT NULL) AND ("qualitative_max_length" > 0)) OR (("qualitative_enabled" = false) AND ("qualitative_max_length" IS NULL)))),
    CONSTRAINT "curriculum_subjects_quantitative_config_check" CHECK (((("quantitative_enabled" = true) AND ("quantitative_min" IS NOT NULL) AND ("quantitative_max" IS NOT NULL) AND ("quantitative_max" >= "quantitative_min")) OR (("quantitative_enabled" = false) AND ("quantitative_min" IS NULL) AND ("quantitative_max" IS NULL)))),
    CONSTRAINT "curriculum_subjects_sort_order_positive" CHECK (("sort_order" > 0))
);


ALTER TABLE "public"."curriculum_subjects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."education_levels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "education_levels_code_not_blank" CHECK (("btrim"("code") <> ''::"text")),
    CONSTRAINT "education_levels_name_not_blank" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "education_levels_sort_order_positive" CHECK (("sort_order" > 0))
);


ALTER TABLE "public"."education_levels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."enrollment_charge_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enrollment_id" "uuid" NOT NULL,
    "financial_plan_period_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "custom_due_date" "date",
    "custom_amount" numeric(12,2),
    "reason" "text",
    "authorized_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "enrollment_charge_rules_action_check" CHECK (("action" = ANY (ARRAY['STANDARD'::"text", 'NOT_APPLICABLE'::"text", 'CHARGE_NOW'::"text", 'CHARGE_LATER'::"text", 'CUSTOM'::"text"]))),
    CONSTRAINT "enrollment_charge_rules_charge_later_date" CHECK ((("action" <> 'CHARGE_LATER'::"text") OR ("custom_due_date" IS NOT NULL))),
    CONSTRAINT "enrollment_charge_rules_custom_amount_check" CHECK ((("custom_amount" IS NULL) OR ("custom_amount" >= (0)::numeric))),
    CONSTRAINT "enrollment_charge_rules_custom_value" CHECK ((("action" <> 'CUSTOM'::"text") OR (("custom_due_date" IS NOT NULL) OR ("custom_amount" IS NOT NULL)))),
    CONSTRAINT "enrollment_charge_rules_exception_reason" CHECK ((("action" = 'STANDARD'::"text") OR (("reason" IS NOT NULL) AND ("btrim"("reason") <> ''::"text"))))
);


ALTER TABLE "public"."enrollment_charge_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."enrollment_classifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "counts_for_sep" boolean DEFAULT false NOT NULL,
    "counts_for_campus" boolean DEFAULT true NOT NULL,
    "participates_academically" boolean DEFAULT true NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "enrollment_classifications_code_not_blank" CHECK (("btrim"("code") <> ''::"text")),
    CONSTRAINT "enrollment_classifications_name_not_blank" CHECK (("btrim"("name") <> ''::"text"))
);


ALTER TABLE "public"."enrollment_classifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."enrollment_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enrollment_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "effective_on" "date" NOT NULL,
    "reason" "text",
    "notes" "text",
    "old_values" "jsonb",
    "new_values" "jsonb",
    "created_by" "uuid",
    "recorded_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "enrollment_events_type_check" CHECK (("event_type" = ANY (ARRAY['ENROLLED'::"text", 'ACTIVATED'::"text", 'GROUP_CHANGED'::"text", 'CLASSIFICATION_CHANGED'::"text", 'WITHDRAWN'::"text", 'REACTIVATED'::"text", 'FINALIZED'::"text", 'MARKED_NO_CONTINUA'::"text", 'GRADUATED'::"text"])))
);


ALTER TABLE "public"."enrollment_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."enrollment_financial_exits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enrollment_event_id" "uuid" NOT NULL,
    "mode" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "authorized_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "enrollment_financial_exits_mode_check" CHECK (("mode" = ANY (ARRAY['STOP_FUTURE'::"text", 'KEEP_REMAINING'::"text", 'CUSTOM'::"text"]))),
    CONSTRAINT "enrollment_financial_exits_reason_not_blank" CHECK (("btrim"("reason") <> ''::"text"))
);


ALTER TABLE "public"."enrollment_financial_exits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."enrollment_financial_plan_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enrollment_id" "uuid" NOT NULL,
    "financial_plan_id" "uuid" NOT NULL,
    "economic_start_on" "date" NOT NULL,
    "valid_from" "date" NOT NULL,
    "valid_until" "date",
    "reason" "text" NOT NULL,
    "authorized_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "enrollment_financial_plan_dates_check" CHECK ((("valid_until" IS NULL) OR ("valid_until" >= "valid_from"))),
    CONSTRAINT "enrollment_financial_plan_reason_not_blank" CHECK (("btrim"("reason") <> ''::"text"))
);


ALTER TABLE "public"."enrollment_financial_plan_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."enrollment_tuition_discount_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enrollment_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "valid_from" "date" NOT NULL,
    "valid_until" "date",
    "reason" "text" NOT NULL,
    "authorized_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "enrollment_tuition_discount_dates_check" CHECK ((("valid_until" IS NULL) OR ("valid_until" >= "valid_from"))),
    CONSTRAINT "enrollment_tuition_discount_reason_not_blank" CHECK (("btrim"("reason") <> ''::"text"))
);


ALTER TABLE "public"."enrollment_tuition_discount_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."enrollments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "cycle_id" "uuid" NOT NULL,
    "grade_level_id" "uuid" NOT NULL,
    "group_id" "uuid",
    "classification_id" "uuid" NOT NULL,
    "academic_participation_override" boolean,
    "status" "text" DEFAULT 'PENDIENTE'::"text" NOT NULL,
    "enrolled_on" "date" NOT NULL,
    "classes_start_on" "date",
    "closed_on" "date",
    "created_by" "uuid",
    "legacy_id" "text",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "enrollments_dates_check" CHECK ((("closed_on" IS NULL) OR ("closed_on" >= "enrolled_on"))),
    CONSTRAINT "enrollments_status_check" CHECK (("status" = ANY (ARRAY['PREINSCRITA'::"text", 'PENDIENTE'::"text", 'ACTIVA'::"text", 'BAJA'::"text", 'FINALIZADA'::"text", 'NO_CONTINUA'::"text", 'EGRESADA'::"text"])))
);


ALTER TABLE "public"."enrollments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."evaluation_periods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cycle_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer NOT NULL,
    "capture_status" "text" DEFAULT 'CLOSED'::"text" NOT NULL,
    "opened_at" timestamp with time zone,
    "opened_by" "uuid",
    "closed_at" timestamp with time zone,
    "closed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "evaluation_periods_capture_status_check" CHECK (("capture_status" = ANY (ARRAY['CLOSED'::"text", 'OPEN'::"text", 'CAPTURE_CLOSED'::"text"]))),
    CONSTRAINT "evaluation_periods_code_not_blank" CHECK (("btrim"("code") <> ''::"text")),
    CONSTRAINT "evaluation_periods_name_not_blank" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "evaluation_periods_sort_order_positive" CHECK (("sort_order" > 0))
);


ALTER TABLE "public"."evaluation_periods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."family_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "guardian_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "invitation_id" "uuid",
    "status" "text" DEFAULT 'ACTIVE'::"text" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "granted_by" "uuid",
    "revoked_at" timestamp with time zone,
    "revoked_by" "uuid",
    "revocation_reason" "text",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "family_access_revoked_state_check" CHECK (((("status" = 'REVOKED'::"text") AND ("revoked_at" IS NOT NULL) AND ("revocation_reason" IS NOT NULL) AND ("btrim"("revocation_reason") <> ''::"text")) OR (("status" = 'ACTIVE'::"text") AND ("revoked_at" IS NULL)))),
    CONSTRAINT "family_access_status_check" CHECK (("status" = ANY (ARRAY['ACTIVE'::"text", 'REVOKED'::"text"])))
);


ALTER TABLE "public"."family_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."family_invitation_students" (
    "invitation_id" "uuid" NOT NULL,
    "guardian_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL
);


ALTER TABLE "public"."family_invitation_students" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."family_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "guardian_id" "uuid" NOT NULL,
    "token_hash" "bytea" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_by" "uuid",
    "accepted_by" "uuid",
    "accepted_at" timestamp with time zone,
    "revoked_by" "uuid",
    "revoked_at" timestamp with time zone,
    "revocation_reason" "text",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "family_invitations_accepted_state_check" CHECK (((("status" = 'ACCEPTED'::"text") AND ("accepted_at" IS NOT NULL)) OR ("status" <> 'ACCEPTED'::"text"))),
    CONSTRAINT "family_invitations_expiration_check" CHECK (("expires_at" > "created_at")),
    CONSTRAINT "family_invitations_revoked_state_check" CHECK (((("status" = 'REVOKED'::"text") AND ("revoked_at" IS NOT NULL) AND ("revocation_reason" IS NOT NULL) AND ("btrim"("revocation_reason") <> ''::"text")) OR ("status" <> 'REVOKED'::"text"))),
    CONSTRAINT "family_invitations_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'ACCEPTED'::"text", 'REVOKED'::"text"])))
);


ALTER TABLE "public"."family_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financial_concepts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "financial_concepts_category_check" CHECK (("category" = ANY (ARRAY['TUITION'::"text", 'ENROLLMENT_FEE'::"text", 'PREREGISTRATION'::"text", 'LATE_FEE'::"text", 'OTHER'::"text"]))),
    CONSTRAINT "financial_concepts_code_not_blank" CHECK (("btrim"("code") <> ''::"text")),
    CONSTRAINT "financial_concepts_name_not_blank" CHECK (("btrim"("name") <> ''::"text"))
);


ALTER TABLE "public"."financial_concepts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financial_plan_periods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "financial_plan_id" "uuid" NOT NULL,
    "financial_concept_id" "uuid" NOT NULL,
    "coverage_year" smallint,
    "coverage_month" smallint,
    "due_date" "date" NOT NULL,
    "anchor_period_id" "uuid",
    "sort_order" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "financial_plan_periods_anchor_not_self" CHECK ((("anchor_period_id" IS NULL) OR ("anchor_period_id" <> "id"))),
    CONSTRAINT "financial_plan_periods_coverage_pair" CHECK (((("coverage_year" IS NULL) AND ("coverage_month" IS NULL)) OR (("coverage_year" IS NOT NULL) AND ("coverage_month" IS NOT NULL)))),
    CONSTRAINT "financial_plan_periods_month_check" CHECK ((("coverage_month" IS NULL) OR (("coverage_month" >= 1) AND ("coverage_month" <= 12)))),
    CONSTRAINT "financial_plan_periods_sort_order_positive" CHECK (("sort_order" > 0)),
    CONSTRAINT "financial_plan_periods_year_check" CHECK ((("coverage_year" IS NULL) OR (("coverage_year" >= 2000) AND ("coverage_year" <= 2200))))
);


ALTER TABLE "public"."financial_plan_periods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financial_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cycle_id" "uuid" NOT NULL,
    "education_level_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "installment_count" smallint NOT NULL,
    CONSTRAINT "financial_plans_installment_count_check" CHECK (("installment_count" = ANY (ARRAY[10, 12]))),
    CONSTRAINT "financial_plans_name_not_blank" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "financial_plans_status_check" CHECK (("status" = ANY (ARRAY['DRAFT'::"text", 'ACTIVE'::"text", 'INACTIVE'::"text"])))
);


ALTER TABLE "public"."financial_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."grade_access_entitlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enrollment_id" "uuid" NOT NULL,
    "evaluation_period_id" "uuid" NOT NULL,
    "acquired_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "acquisition_reason" "text" DEFAULT 'PUBLISHED_AND_CURRENT'::"text" NOT NULL,
    CONSTRAINT "grade_access_entitlements_reason_not_blank" CHECK (("btrim"("acquisition_reason") <> ''::"text"))
);


ALTER TABLE "public"."grade_access_entitlements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."grade_levels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "education_level_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer NOT NULL,
    "is_terminal" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "grade_levels_code_not_blank" CHECK (("btrim"("code") <> ''::"text")),
    CONSTRAINT "grade_levels_name_not_blank" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "grade_levels_sort_order_positive" CHECK (("sort_order" > 0))
);


ALTER TABLE "public"."grade_levels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_period_publications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "evaluation_period_id" "uuid" NOT NULL,
    "cycle_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'NOT_PUBLISHED'::"text" NOT NULL,
    "published_at" timestamp with time zone,
    "published_by" "uuid",
    "revoked_at" timestamp with time zone,
    "revoked_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "group_period_publications_publish_state_check" CHECK (((("status" = 'PUBLISHED'::"text") AND ("published_at" IS NOT NULL) AND ("published_by" IS NOT NULL)) OR ("status" = 'NOT_PUBLISHED'::"text"))),
    CONSTRAINT "group_period_publications_status_check" CHECK (("status" = ANY (ARRAY['NOT_PUBLISHED'::"text", 'PUBLISHED'::"text"])))
);


ALTER TABLE "public"."group_period_publications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_primary_teacher_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "cycle_id" "uuid" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "valid_from" "date" NOT NULL,
    "valid_until" "date",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "group_primary_teacher_dates_check" CHECK ((("valid_until" IS NULL) OR ("valid_until" >= "valid_from")))
);


ALTER TABLE "public"."group_primary_teacher_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cycle_id" "uuid" NOT NULL,
    "grade_level_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "groups_code_not_blank" CHECK (("btrim"("code") <> ''::"text")),
    CONSTRAINT "groups_name_not_blank" CHECK (("btrim"("name") <> ''::"text"))
);


ALTER TABLE "public"."groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guardians" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "auth_user_id" "uuid",
    "legacy_id" "text",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "guardians_email_not_blank" CHECK ((("email" IS NULL) OR ("btrim"("email") <> ''::"text"))),
    CONSTRAINT "guardians_full_name_not_blank" CHECK (("btrim"("full_name") <> ''::"text")),
    CONSTRAINT "guardians_phone_not_blank" CHECK ((("phone" IS NULL) OR ("btrim"("phone") <> ''::"text")))
);


ALTER TABLE "public"."guardians" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_agreement_charges" (
    "agreement_id" "uuid" NOT NULL,
    "charge_id" "uuid" NOT NULL,
    "enrollment_id" "uuid" NOT NULL,
    "included_amount" numeric(12,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "payment_agreement_charges_amount_positive" CHECK (("included_amount" > (0)::numeric))
);


ALTER TABLE "public"."payment_agreement_charges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_agreement_installments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agreement_id" "uuid" NOT NULL,
    "installment_number" smallint NOT NULL,
    "due_date" "date" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "payment_agreement_installments_amount_nonnegative" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "payment_agreement_installments_number_positive" CHECK (("installment_number" > 0)),
    CONSTRAINT "payment_agreement_installments_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'FULFILLED'::"text", 'OVERDUE'::"text", 'CANCELLED'::"text"])))
);


ALTER TABLE "public"."payment_agreement_installments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_agreements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enrollment_id" "uuid" NOT NULL,
    "agreement_type" "text" NOT NULL,
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "original_value" numeric(12,2) NOT NULL,
    "agreed_total" numeric(12,2) NOT NULL,
    "starts_on" "date" NOT NULL,
    "accepted_on" "date",
    "reason" "text" NOT NULL,
    "authorized_by" "uuid",
    "created_by" "uuid",
    "supersedes_agreement_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "payment_agreements_acceptance_check" CHECK ((("status" <> ALL (ARRAY['ACTIVE'::"text", 'COMPLETED'::"text", 'SUPERSEDED'::"text"])) OR ("accepted_on" IS NOT NULL))),
    CONSTRAINT "payment_agreements_agreed_total_nonnegative" CHECK (("agreed_total" >= (0)::numeric)),
    CONSTRAINT "payment_agreements_original_value_nonnegative" CHECK (("original_value" >= (0)::numeric)),
    CONSTRAINT "payment_agreements_reason_not_blank" CHECK (("btrim"("reason") <> ''::"text")),
    CONSTRAINT "payment_agreements_status_check" CHECK (("status" = ANY (ARRAY['DRAFT'::"text", 'ACTIVE'::"text", 'COMPLETED'::"text", 'CANCELLED'::"text", 'SUPERSEDED'::"text"]))),
    CONSTRAINT "payment_agreements_supersedes_not_self" CHECK ((("supersedes_agreement_id" IS NULL) OR ("supersedes_agreement_id" <> "id"))),
    CONSTRAINT "payment_agreements_type_check" CHECK (("agreement_type" = ANY (ARRAY['SPECIAL_INSTALLMENTS'::"text", 'DEBT_REPAYMENT'::"text"])))
);


ALTER TABLE "public"."payment_agreements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_allocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "charge_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "allocation_mode" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "reversed_at" timestamp with time zone,
    "legacy_id" "text",
    CONSTRAINT "payment_allocations_amount_positive" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "payment_allocations_mode_check" CHECK (("allocation_mode" = ANY (ARRAY['AUTO'::"text", 'MANUAL'::"text"]))),
    CONSTRAINT "payment_allocations_reversed_date_check" CHECK ((("reversed_at" IS NULL) OR ("reversed_at" >= "created_at")))
);


ALTER TABLE "public"."payment_allocations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_methods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "classification" "text" NOT NULL,
    "requires_description" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "payment_methods_classification_check" CHECK (("classification" = ANY (ARRAY['MONETARY'::"text", 'IN_KIND'::"text"]))),
    CONSTRAINT "payment_methods_code_not_blank" CHECK (("btrim"("code") <> ''::"text")),
    CONSTRAINT "payment_methods_name_not_blank" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "payment_methods_sort_order_positive" CHECK (("sort_order" > 0))
);


ALTER TABLE "public"."payment_methods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_reversals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "reversed_by" "uuid",
    "reversed_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "payment_reversals_reason_not_blank" CHECK (("btrim"("reason") <> ''::"text"))
);


ALTER TABLE "public"."payment_reversals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_code" "text" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "received_at" timestamp with time zone NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "method" "text" NOT NULL,
    "status" "text" DEFAULT 'CONFIRMED'::"text" NOT NULL,
    "received_by_staff_id" "uuid",
    "received_by_name_snapshot" "text" NOT NULL,
    "notes" "text",
    "legacy_id" "text",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "payment_method_id" "uuid" NOT NULL,
    "method_name_snapshot" "text" NOT NULL,
    "method_classification_snapshot" "text" NOT NULL,
    "captured_by_profile_id" "uuid",
    "bank_reference" "text",
    "receipt_visible_note" "text",
    CONSTRAINT "payments_amount_positive" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "payments_bank_reference_not_blank" CHECK ((("bank_reference" IS NULL) OR ("btrim"("bank_reference") <> ''::"text"))),
    CONSTRAINT "payments_method_classification_snapshot_check" CHECK (("method_classification_snapshot" = ANY (ARRAY['MONETARY'::"text", 'IN_KIND'::"text"]))),
    CONSTRAINT "payments_method_name_snapshot_not_blank" CHECK (("btrim"("method_name_snapshot") <> ''::"text")),
    CONSTRAINT "payments_payment_code_not_blank" CHECK (("btrim"("payment_code") <> ''::"text")),
    CONSTRAINT "payments_receipt_visible_note_not_blank" CHECK ((("receipt_visible_note" IS NULL) OR ("btrim"("receipt_visible_note") <> ''::"text"))),
    CONSTRAINT "payments_receiver_snapshot_not_blank" CHECK (("btrim"("received_by_name_snapshot") <> ''::"text")),
    CONSTRAINT "payments_status_check" CHECK (("status" = ANY (ARRAY['CONFIRMED'::"text", 'REVERSED'::"text"])))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "description" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "permissions_code_not_blank" CHECK (("btrim"("code") <> ''::"text")),
    CONSTRAINT "permissions_description_not_blank" CHECK (("btrim"("description") <> ''::"text"))
);


ALTER TABLE "public"."permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."preregistration_campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "target_cycle_id" "uuid" NOT NULL,
    "education_level_id" "uuid",
    "name" "text" NOT NULL,
    "starts_on" "date" NOT NULL,
    "ends_on" "date" NOT NULL,
    "price" numeric(12,2) NOT NULL,
    "covered_concept_id" "uuid",
    "allows_partial_payments" boolean DEFAULT false NOT NULL,
    "non_continuation_policy" "text" NOT NULL,
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "preregistration_campaigns_dates_check" CHECK (("ends_on" >= "starts_on")),
    CONSTRAINT "preregistration_campaigns_name_not_blank" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "preregistration_campaigns_non_continuation_policy_check" CHECK (("non_continuation_policy" = ANY (ARRAY['NON_REFUNDABLE'::"text", 'REFUNDABLE'::"text", 'TRANSFERABLE'::"text", 'REASSIGNABLE'::"text", 'MANUAL_REVIEW'::"text"]))),
    CONSTRAINT "preregistration_campaigns_price_nonnegative" CHECK (("price" >= (0)::numeric)),
    CONSTRAINT "preregistration_campaigns_status_check" CHECK (("status" = ANY (ARRAY['DRAFT'::"text", 'ACTIVE'::"text", 'CLOSED'::"text", 'CANCELLED'::"text"])))
);


ALTER TABLE "public"."preregistration_campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."preregistrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "campaign_id" "uuid",
    "target_cycle_id" "uuid" NOT NULL,
    "target_education_level_id" "uuid" NOT NULL,
    "target_grade_level_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolution" "text",
    "notes" "text",
    "legacy_reference" "text",
    "charge_id" "uuid",
    "preregistered_on" "date" NOT NULL,
    "target_group_id" "uuid",
    CONSTRAINT "preregistrations_resolution_pair" CHECK (((("resolved_at" IS NULL) AND ("resolution" IS NULL)) OR (("resolved_at" IS NOT NULL) AND ("resolution" IS NOT NULL) AND ("btrim"("resolution") <> ''::"text")))),
    CONSTRAINT "preregistrations_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'CONFIRMED'::"text", 'CANCELLED'::"text", 'NO_CONTINUA'::"text", 'RESOLVED'::"text"])))
);


ALTER TABLE "public"."preregistrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."refund_components" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "refund_id" "uuid" NOT NULL,
    "payment_allocation_id" "uuid",
    "credit_id" "uuid",
    "amount" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "refund_components_amount_positive" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "refund_components_one_source" CHECK (("num_nonnulls"("payment_allocation_id", "credit_id") = 1))
);


ALTER TABLE "public"."refund_components" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."refunds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "reason" "text" NOT NULL,
    "refunded_at" timestamp with time zone NOT NULL,
    "created_by" "uuid",
    "authorized_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "refund_method_id" "uuid",
    "refund_method_code_snapshot" "text",
    "refund_method_name_snapshot" "text",
    "refund_method_classification_snapshot" "text",
    CONSTRAINT "refunds_amount_positive" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "refunds_method_classification_snapshot_check" CHECK ((("refund_method_classification_snapshot" IS NULL) OR ("refund_method_classification_snapshot" = ANY (ARRAY['MONETARY'::"text", 'IN_KIND'::"text"])))),
    CONSTRAINT "refunds_method_code_snapshot_not_blank" CHECK ((("refund_method_code_snapshot" IS NULL) OR ("btrim"("refund_method_code_snapshot") <> ''::"text"))),
    CONSTRAINT "refunds_method_name_snapshot_not_blank" CHECK ((("refund_method_name_snapshot" IS NULL) OR ("btrim"("refund_method_name_snapshot") <> ''::"text"))),
    CONSTRAINT "refunds_reason_not_blank" CHECK (("btrim"("reason") <> ''::"text"))
);


ALTER TABLE "public"."refunds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "role_id" "uuid" NOT NULL,
    "permission_id" "uuid" NOT NULL,
    "scope" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "role_permissions_scope_check" CHECK (("scope" = ANY (ARRAY['OWN'::"text", 'ASSIGNED'::"text", 'LINKED'::"text", 'ALL'::"text"])))
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "is_system" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "roles_code_not_blank" CHECK (("btrim"("code") <> ''::"text")),
    CONSTRAINT "roles_name_not_blank" CHECK (("btrim"("name") <> ''::"text"))
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."school_cycles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "starts_on" "date" NOT NULL,
    "ends_on" "date" NOT NULL,
    "status" "text" DEFAULT 'PREPARATION'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "school_cycles_code_not_blank" CHECK (("btrim"("code") <> ''::"text")),
    CONSTRAINT "school_cycles_dates_check" CHECK (("ends_on" >= "starts_on")),
    CONSTRAINT "school_cycles_name_not_blank" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "school_cycles_status_check" CHECK (("status" = ANY (ARRAY['PREPARATION'::"text", 'ACTIVE'::"text", 'CLOSED'::"text"])))
);


ALTER TABLE "public"."school_cycles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text" NOT NULL,
    "phone" "text",
    "status" "text" DEFAULT 'ACTIVE'::"text" NOT NULL,
    "profile_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "staff_full_name_not_blank" CHECK (("btrim"("full_name") <> ''::"text")),
    CONSTRAINT "staff_phone_not_blank" CHECK ((("phone" IS NULL) OR ("btrim"("phone") <> ''::"text"))),
    CONSTRAINT "staff_status_check" CHECK (("status" = ANY (ARRAY['ACTIVE'::"text", 'INACTIVE'::"text"])))
);


ALTER TABLE "public"."staff" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "initial_role_id" "uuid" NOT NULL,
    "token_hash" "bytea" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_by" "uuid",
    "accepted_user_id" "uuid",
    "accepted_at" timestamp with time zone,
    "revoked_by" "uuid",
    "revoked_at" timestamp with time zone,
    "revocation_reason" "text",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "staff_id" "uuid" NOT NULL,
    CONSTRAINT "staff_invitations_accepted_state_check" CHECK (((("status" = 'ACCEPTED'::"text") AND ("accepted_user_id" IS NOT NULL) AND ("accepted_at" IS NOT NULL)) OR ("status" <> 'ACCEPTED'::"text"))),
    CONSTRAINT "staff_invitations_email_not_blank" CHECK (("btrim"("email") <> ''::"text")),
    CONSTRAINT "staff_invitations_expiration_check" CHECK (("expires_at" > "created_at")),
    CONSTRAINT "staff_invitations_full_name_not_blank" CHECK (("btrim"("full_name") <> ''::"text")),
    CONSTRAINT "staff_invitations_revoked_state_check" CHECK (((("status" = 'REVOKED'::"text") AND ("revoked_at" IS NOT NULL) AND ("revocation_reason" IS NOT NULL) AND ("btrim"("revocation_reason") <> ''::"text")) OR ("status" <> 'REVOKED'::"text"))),
    CONSTRAINT "staff_invitations_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'ACCEPTED'::"text", 'REVOKED'::"text"])))
);


ALTER TABLE "public"."staff_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_evaluation_quantitative_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_evaluation_id" "uuid" NOT NULL,
    "old_value" numeric,
    "new_value" numeric,
    "changed_by" "uuid",
    "reason" "text",
    "changed_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "student_eval_quant_history_changed" CHECK (("old_value" IS DISTINCT FROM "new_value"))
);


ALTER TABLE "public"."student_evaluation_quantitative_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_evaluations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enrollment_id" "uuid" NOT NULL,
    "evaluation_period_id" "uuid" NOT NULL,
    "curriculum_subject_id" "uuid" NOT NULL,
    "group_id" "uuid" NOT NULL,
    "cycle_id" "uuid" NOT NULL,
    "grade_level_id" "uuid" NOT NULL,
    "teacher_assignment_id" "uuid",
    "quantitative_value" numeric(4,2),
    "qualitative_comment" "text",
    "created_by" "uuid" NOT NULL,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "correction_reason" "text",
    CONSTRAINT "student_evaluations_has_value" CHECK ((("quantitative_value" IS NOT NULL) OR (("qualitative_comment" IS NOT NULL) AND ("btrim"("qualitative_comment") <> ''::"text")))),
    CONSTRAINT "student_evaluations_qualitative_absolute_max" CHECK ((("qualitative_comment" IS NULL) OR ("char_length"("qualitative_comment") <= 1000))),
    CONSTRAINT "student_evaluations_quantitative_range" CHECK ((("quantitative_value" IS NULL) OR (("quantitative_value" >= (0)::numeric) AND ("quantitative_value" <= (10)::numeric))))
);


ALTER TABLE "public"."student_evaluations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_financial_agreements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enrollment_id" "uuid" NOT NULL,
    "financial_concept_id" "uuid" NOT NULL,
    "base_rate_id" "uuid",
    "benefit_id" "uuid",
    "base_amount_snapshot" numeric(12,2) NOT NULL,
    "benefit_type_snapshot" "text",
    "benefit_value_snapshot" numeric(12,2),
    "agreed_amount" numeric(12,2) NOT NULL,
    "valid_from" "date" NOT NULL,
    "valid_until" "date",
    "reason" "text",
    "authorized_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "reduction_amount_snapshot" numeric NOT NULL,
    "discount_category_version_id" "uuid",
    CONSTRAINT "student_financial_agreements_agreed_amount_check" CHECK (("agreed_amount" >= (0)::numeric)),
    CONSTRAINT "student_financial_agreements_base_amount_check" CHECK (("base_amount_snapshot" >= (0)::numeric)),
    CONSTRAINT "student_financial_agreements_benefit_snapshot_pair" CHECK (((("benefit_type_snapshot" IS NULL) AND ("benefit_value_snapshot" IS NULL)) OR (("benefit_type_snapshot" IS NOT NULL) AND ("benefit_value_snapshot" IS NOT NULL)))),
    CONSTRAINT "student_financial_agreements_benefit_snapshot_required" CHECK ((("benefit_id" IS NULL) OR (("benefit_type_snapshot" IS NOT NULL) AND ("benefit_value_snapshot" IS NOT NULL)))),
    CONSTRAINT "student_financial_agreements_benefit_type_check" CHECK ((("benefit_type_snapshot" IS NULL) OR ("benefit_type_snapshot" = ANY (ARRAY['PERCENTAGE'::"text", 'FIXED_AMOUNT'::"text"])))),
    CONSTRAINT "student_financial_agreements_benefit_value_check" CHECK ((("benefit_type_snapshot" IS NULL) OR (("benefit_type_snapshot" = 'PERCENTAGE'::"text") AND ("benefit_value_snapshot" > (0)::numeric) AND ("benefit_value_snapshot" <= (100)::numeric)) OR (("benefit_type_snapshot" = 'FIXED_AMOUNT'::"text") AND ("benefit_value_snapshot" > (0)::numeric)))),
    CONSTRAINT "student_financial_agreements_dates_check" CHECK ((("valid_until" IS NULL) OR ("valid_until" >= "valid_from"))),
    CONSTRAINT "student_financial_agreements_reduction_snapshot_check" CHECK ((("reduction_amount_snapshot" >= (0)::numeric) AND ("reduction_amount_snapshot" <= "base_amount_snapshot")))
);


ALTER TABLE "public"."student_financial_agreements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_guardians" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "guardian_id" "uuid" NOT NULL,
    "relationship" "text" NOT NULL,
    "priority" smallint NOT NULL,
    "via_whatsapp" boolean NOT NULL,
    "via_email" boolean NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "started_at" "date" DEFAULT CURRENT_DATE NOT NULL,
    "ended_at" "date",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "student_guardians_dates_check" CHECK ((("ended_at" IS NULL) OR ("ended_at" >= "started_at"))),
    CONSTRAINT "student_guardians_priority_positive" CHECK (("priority" > 0)),
    CONSTRAINT "student_guardians_relationship_not_blank" CHECK (("btrim"("relationship") <> ''::"text"))
);


ALTER TABLE "public"."student_guardians" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."students" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_code" "text",
    "full_name" "text" NOT NULL,
    "sex" "text",
    "birth_date" "date",
    "legacy_id" "text",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "students_full_name_not_blank" CHECK (("btrim"("full_name") <> ''::"text")),
    CONSTRAINT "students_sex_check" CHECK ((("sex" IS NULL) OR ("sex" = ANY (ARRAY['H'::"text", 'M'::"text"])))),
    CONSTRAINT "students_student_code_not_blank" CHECK ((("student_code" IS NULL) OR ("btrim"("student_code") <> ''::"text")))
);


ALTER TABLE "public"."students" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subjects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "subjects_code_not_blank" CHECK (("btrim"("code") <> ''::"text")),
    CONSTRAINT "subjects_name_not_blank" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "subjects_sort_order_positive" CHECK (("sort_order" > 0))
);


ALTER TABLE "public"."subjects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teacher_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_staff_id" "uuid" NOT NULL,
    "curriculum_subject_id" "uuid" NOT NULL,
    "group_id" "uuid" NOT NULL,
    "cycle_id" "uuid" NOT NULL,
    "grade_level_id" "uuid" NOT NULL,
    "valid_from" "date" NOT NULL,
    "valid_until" "date",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "teacher_assignments_dates_check" CHECK ((("valid_until" IS NULL) OR ("valid_until" >= "valid_from")))
);


ALTER TABLE "public"."teacher_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tuition_discount_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cycle_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "discount_type" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "tuition_discount_category_name_not_blank" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "tuition_discount_category_type_check" CHECK (("discount_type" = ANY (ARRAY['PERCENTAGE'::"text", 'FIXED_AMOUNT'::"text"])))
);


ALTER TABLE "public"."tuition_discount_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tuition_discount_category_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid" NOT NULL,
    "value" numeric NOT NULL,
    "valid_from" "date" NOT NULL,
    "valid_until" "date",
    "reason" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "tuition_discount_category_version_dates_check" CHECK ((("valid_until" IS NULL) OR ("valid_until" >= "valid_from"))),
    CONSTRAINT "tuition_discount_category_version_reason_not_blank" CHECK (("btrim"("reason") <> ''::"text")),
    CONSTRAINT "tuition_discount_category_version_value_positive" CHECK (("value" > (0)::numeric))
);


ALTER TABLE "public"."tuition_discount_category_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "valid_from" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "valid_until" timestamp with time zone,
    "assigned_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "user_roles_validity_check" CHECK ((("valid_until" IS NULL) OR ("valid_until" > "valid_from")))
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."academic_capture_windows"
    ADD CONSTRAINT "academic_capture_windows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."base_rates"
    ADD CONSTRAINT "base_rates_no_overlapping_validity" EXCLUDE USING "gist" ("cycle_id" WITH =, "education_level_id" WITH =, "financial_concept_id" WITH =, "daterange"("valid_from",
CASE
    WHEN ("valid_until" IS NULL) THEN 'infinity'::"date"
    ELSE ("valid_until" + 1)
END, '[)'::"text") WITH &&);



ALTER TABLE ONLY "public"."base_rates"
    ADD CONSTRAINT "base_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."benefits"
    ADD CONSTRAINT "benefits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."charge_adjustments"
    ADD CONSTRAINT "charge_adjustments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."charges"
    ADD CONSTRAINT "charges_id_enrollment_uq" UNIQUE ("id", "enrollment_id");



ALTER TABLE ONLY "public"."charges"
    ADD CONSTRAINT "charges_id_student_uq" UNIQUE ("id", "student_id");



ALTER TABLE ONLY "public"."charges"
    ADD CONSTRAINT "charges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_applications"
    ADD CONSTRAINT "credit_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credits"
    ADD CONSTRAINT "credits_id_student_uq" UNIQUE ("id", "student_id");



ALTER TABLE ONLY "public"."credits"
    ADD CONSTRAINT "credits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."curriculum_subjects"
    ADD CONSTRAINT "curriculum_subjects_cycle_grade_subject_uq" UNIQUE ("cycle_id", "grade_level_id", "subject_id");



ALTER TABLE ONLY "public"."curriculum_subjects"
    ADD CONSTRAINT "curriculum_subjects_id_cycle_grade_uq" UNIQUE ("id", "cycle_id", "grade_level_id");



ALTER TABLE ONLY "public"."curriculum_subjects"
    ADD CONSTRAINT "curriculum_subjects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."education_levels"
    ADD CONSTRAINT "education_levels_code_uq" UNIQUE ("code");



ALTER TABLE ONLY "public"."education_levels"
    ADD CONSTRAINT "education_levels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enrollment_charge_rules"
    ADD CONSTRAINT "enrollment_charge_rules_enrollment_period_uq" UNIQUE ("enrollment_id", "financial_plan_period_id");



ALTER TABLE ONLY "public"."enrollment_charge_rules"
    ADD CONSTRAINT "enrollment_charge_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enrollment_classifications"
    ADD CONSTRAINT "enrollment_classifications_code_uq" UNIQUE ("code");



ALTER TABLE ONLY "public"."enrollment_classifications"
    ADD CONSTRAINT "enrollment_classifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enrollment_events"
    ADD CONSTRAINT "enrollment_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enrollment_financial_exits"
    ADD CONSTRAINT "enrollment_financial_exits_event_uq" UNIQUE ("enrollment_event_id");



ALTER TABLE ONLY "public"."enrollment_financial_exits"
    ADD CONSTRAINT "enrollment_financial_exits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enrollment_financial_plan_assignments"
    ADD CONSTRAINT "enrollment_financial_plan_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enrollment_financial_plan_assignments"
    ADD CONSTRAINT "enrollment_financial_plan_no_overlap" EXCLUDE USING "gist" ("enrollment_id" WITH =, "daterange"("valid_from",
CASE
    WHEN ("valid_until" IS NULL) THEN 'infinity'::"date"
    ELSE ("valid_until" + 1)
END, '[)'::"text") WITH &&);



ALTER TABLE ONLY "public"."enrollment_tuition_discount_assignments"
    ADD CONSTRAINT "enrollment_tuition_discount_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enrollment_tuition_discount_assignments"
    ADD CONSTRAINT "enrollment_tuition_discount_no_overlap" EXCLUDE USING "gist" ("enrollment_id" WITH =, "daterange"("valid_from",
CASE
    WHEN ("valid_until" IS NULL) THEN 'infinity'::"date"
    ELSE ("valid_until" + 1)
END, '[)'::"text") WITH &&);



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_id_cycle_grade_uq" UNIQUE ("id", "cycle_id", "grade_level_id");



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_id_student_cycle_uq" UNIQUE ("id", "student_id", "cycle_id");



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_student_cycle_uq" UNIQUE ("student_id", "cycle_id");



ALTER TABLE ONLY "public"."evaluation_periods"
    ADD CONSTRAINT "evaluation_periods_cycle_code_uq" UNIQUE ("cycle_id", "code");



ALTER TABLE ONLY "public"."evaluation_periods"
    ADD CONSTRAINT "evaluation_periods_cycle_sort_uq" UNIQUE ("cycle_id", "sort_order");



ALTER TABLE ONLY "public"."evaluation_periods"
    ADD CONSTRAINT "evaluation_periods_id_cycle_uq" UNIQUE ("id", "cycle_id");



ALTER TABLE ONLY "public"."evaluation_periods"
    ADD CONSTRAINT "evaluation_periods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."family_access"
    ADD CONSTRAINT "family_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."family_invitation_students"
    ADD CONSTRAINT "family_invitation_students_invitation_student_uq" PRIMARY KEY ("invitation_id", "student_id");



ALTER TABLE ONLY "public"."family_invitations"
    ADD CONSTRAINT "family_invitations_id_guardian_uq" UNIQUE ("id", "guardian_id");



ALTER TABLE ONLY "public"."family_invitations"
    ADD CONSTRAINT "family_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."family_invitations"
    ADD CONSTRAINT "family_invitations_token_hash_uq" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."financial_concepts"
    ADD CONSTRAINT "financial_concepts_code_uq" UNIQUE ("code");



ALTER TABLE ONLY "public"."financial_concepts"
    ADD CONSTRAINT "financial_concepts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financial_plan_periods"
    ADD CONSTRAINT "financial_plan_periods_id_concept_uq" UNIQUE ("id", "financial_concept_id");



ALTER TABLE ONLY "public"."financial_plan_periods"
    ADD CONSTRAINT "financial_plan_periods_id_plan_uq" UNIQUE ("id", "financial_plan_id");



ALTER TABLE ONLY "public"."financial_plan_periods"
    ADD CONSTRAINT "financial_plan_periods_period_uq" UNIQUE ("financial_plan_id", "financial_concept_id", "coverage_year", "coverage_month");



ALTER TABLE ONLY "public"."financial_plan_periods"
    ADD CONSTRAINT "financial_plan_periods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financial_plan_periods"
    ADD CONSTRAINT "financial_plan_periods_sort_order_uq" UNIQUE ("financial_plan_id", "sort_order");



ALTER TABLE ONLY "public"."financial_plans"
    ADD CONSTRAINT "financial_plans_cycle_level_name_uq" UNIQUE ("cycle_id", "education_level_id", "name");



ALTER TABLE ONLY "public"."financial_plans"
    ADD CONSTRAINT "financial_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."grade_access_entitlements"
    ADD CONSTRAINT "grade_access_entitlements_enrollment_period_uq" UNIQUE ("enrollment_id", "evaluation_period_id");



ALTER TABLE ONLY "public"."grade_access_entitlements"
    ADD CONSTRAINT "grade_access_entitlements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."grade_levels"
    ADD CONSTRAINT "grade_levels_id_education_level_uq" UNIQUE ("id", "education_level_id");



ALTER TABLE ONLY "public"."grade_levels"
    ADD CONSTRAINT "grade_levels_level_code_uq" UNIQUE ("education_level_id", "code");



ALTER TABLE ONLY "public"."grade_levels"
    ADD CONSTRAINT "grade_levels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_period_publications"
    ADD CONSTRAINT "group_period_publications_group_period_uq" UNIQUE ("group_id", "evaluation_period_id");



ALTER TABLE ONLY "public"."group_period_publications"
    ADD CONSTRAINT "group_period_publications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_primary_teacher_assignments"
    ADD CONSTRAINT "group_primary_teacher_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_primary_teacher_assignments"
    ADD CONSTRAINT "group_primary_teacher_no_overlap" EXCLUDE USING "gist" ("group_id" WITH =, "daterange"("valid_from",
CASE
    WHEN ("valid_until" IS NULL) THEN 'infinity'::"date"
    ELSE ("valid_until" + 1)
END, '[)'::"text") WITH &&);



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_cycle_grade_code_uq" UNIQUE ("cycle_id", "grade_level_id", "code");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_id_cycle_grade_uq" UNIQUE ("id", "cycle_id", "grade_level_id");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_id_cycle_uq" UNIQUE ("id", "cycle_id");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guardians"
    ADD CONSTRAINT "guardians_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_agreement_charges"
    ADD CONSTRAINT "payment_agreement_charges_pkey" PRIMARY KEY ("agreement_id", "charge_id");



ALTER TABLE ONLY "public"."payment_agreement_installments"
    ADD CONSTRAINT "payment_agreement_installments_number_uq" UNIQUE ("agreement_id", "installment_number");



ALTER TABLE ONLY "public"."payment_agreement_installments"
    ADD CONSTRAINT "payment_agreement_installments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_agreements"
    ADD CONSTRAINT "payment_agreements_id_enrollment_uq" UNIQUE ("id", "enrollment_id");



ALTER TABLE ONLY "public"."payment_agreements"
    ADD CONSTRAINT "payment_agreements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_allocations"
    ADD CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_reversals"
    ADD CONSTRAINT "payment_reversals_payment_uq" UNIQUE ("payment_id");



ALTER TABLE ONLY "public"."payment_reversals"
    ADD CONSTRAINT "payment_reversals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_id_student_uq" UNIQUE ("id", "student_id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_payment_code_uq" UNIQUE ("payment_code");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_code_uq" UNIQUE ("code");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."preregistration_campaigns"
    ADD CONSTRAINT "preregistration_campaigns_cycle_name_uq" UNIQUE ("target_cycle_id", "name");



ALTER TABLE ONLY "public"."preregistration_campaigns"
    ADD CONSTRAINT "preregistration_campaigns_id_cycle_uq" UNIQUE ("id", "target_cycle_id");



ALTER TABLE ONLY "public"."preregistration_campaigns"
    ADD CONSTRAINT "preregistration_campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."preregistrations"
    ADD CONSTRAINT "preregistrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."preregistrations"
    ADD CONSTRAINT "preregistrations_student_cycle_uq" UNIQUE ("student_id", "target_cycle_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."refund_components"
    ADD CONSTRAINT "refund_components_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_code_uq" UNIQUE ("code");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."school_cycles"
    ADD CONSTRAINT "school_cycles_code_uq" UNIQUE ("code");



ALTER TABLE ONLY "public"."school_cycles"
    ADD CONSTRAINT "school_cycles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_invitations"
    ADD CONSTRAINT "staff_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_invitations"
    ADD CONSTRAINT "staff_invitations_token_hash_uq" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."student_evaluation_quantitative_history"
    ADD CONSTRAINT "student_evaluation_quantitative_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_evaluations"
    ADD CONSTRAINT "student_evaluations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_evaluations"
    ADD CONSTRAINT "student_evaluations_unique_evaluation" UNIQUE ("enrollment_id", "evaluation_period_id", "curriculum_subject_id");



ALTER TABLE ONLY "public"."student_financial_agreements"
    ADD CONSTRAINT "student_financial_agreements_id_enrollment_concept_uq" UNIQUE ("id", "enrollment_id", "financial_concept_id");



ALTER TABLE ONLY "public"."student_financial_agreements"
    ADD CONSTRAINT "student_financial_agreements_no_overlap" EXCLUDE USING "gist" ("enrollment_id" WITH =, "financial_concept_id" WITH =, "daterange"("valid_from",
CASE
    WHEN ("valid_until" IS NULL) THEN 'infinity'::"date"
    ELSE ("valid_until" + 1)
END, '[)'::"text") WITH &&);



ALTER TABLE ONLY "public"."student_financial_agreements"
    ADD CONSTRAINT "student_financial_agreements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_guardians"
    ADD CONSTRAINT "student_guardians_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_guardians"
    ADD CONSTRAINT "student_guardians_student_guardian_uq" UNIQUE ("student_id", "guardian_id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subjects"
    ADD CONSTRAINT "subjects_code_uq" UNIQUE ("code");



ALTER TABLE ONLY "public"."subjects"
    ADD CONSTRAINT "subjects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teacher_assignments"
    ADD CONSTRAINT "teacher_assignments_id_group_curriculum_uq" UNIQUE ("id", "group_id", "curriculum_subject_id");



ALTER TABLE ONLY "public"."teacher_assignments"
    ADD CONSTRAINT "teacher_assignments_no_self_overlap" EXCLUDE USING "gist" ("teacher_staff_id" WITH =, "curriculum_subject_id" WITH =, "group_id" WITH =, "daterange"("valid_from",
CASE
    WHEN ("valid_until" IS NULL) THEN 'infinity'::"date"
    ELSE ("valid_until" + 1)
END, '[)'::"text") WITH &&);



ALTER TABLE ONLY "public"."teacher_assignments"
    ADD CONSTRAINT "teacher_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tuition_discount_categories"
    ADD CONSTRAINT "tuition_discount_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tuition_discount_category_versions"
    ADD CONSTRAINT "tuition_discount_category_version_no_overlap" EXCLUDE USING "gist" ("category_id" WITH =, "daterange"("valid_from",
CASE
    WHEN ("valid_until" IS NULL) THEN 'infinity'::"date"
    ELSE ("valid_until" + 1)
END, '[)'::"text") WITH &&);



ALTER TABLE ONLY "public"."tuition_discount_category_versions"
    ADD CONSTRAINT "tuition_discount_category_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_no_overlapping_role" EXCLUDE USING "gist" ("user_id" WITH =, "role_id" WITH =, "tstzrange"("valid_from", COALESCE("valid_until", 'infinity'::timestamp with time zone), '[)'::"text") WITH &&);



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "academic_capture_windows_period_assignment_uq" ON "public"."academic_capture_windows" USING "btree" ("evaluation_period_id", "teacher_assignment_id");



CREATE INDEX "academic_capture_windows_scope_idx" ON "public"."academic_capture_windows" USING "btree" ("evaluation_period_id", "group_id", "curriculum_subject_id", "status");



CREATE INDEX "academic_capture_windows_teacher_idx" ON "public"."academic_capture_windows" USING "btree" ("teacher_assignment_id", "status");



CREATE INDEX "audit_log_actor_profile_idx" ON "public"."audit_log" USING "btree" ("actor_profile_id") WHERE ("actor_profile_id" IS NOT NULL);



CREATE INDEX "audit_log_correlation_idx" ON "public"."audit_log" USING "btree" ("correlation_id");



CREATE INDEX "audit_log_entity_idx" ON "public"."audit_log" USING "btree" ("entity_name", "entity_id");



CREATE INDEX "audit_log_occurred_at_idx" ON "public"."audit_log" USING "btree" ("occurred_at");



CREATE INDEX "base_rates_cycle_id_idx" ON "public"."base_rates" USING "btree" ("cycle_id");



CREATE INDEX "base_rates_education_level_id_idx" ON "public"."base_rates" USING "btree" ("education_level_id");



CREATE INDEX "base_rates_financial_concept_id_idx" ON "public"."base_rates" USING "btree" ("financial_concept_id");



CREATE INDEX "charge_adjustments_charge_id_idx" ON "public"."charge_adjustments" USING "btree" ("charge_id");



CREATE UNIQUE INDEX "charges_active_enrollment_plan_period_uq" ON "public"."charges" USING "btree" ("enrollment_id", "financial_plan_period_id") WHERE (("enrollment_id" IS NOT NULL) AND ("financial_plan_period_id" IS NOT NULL) AND ("status" = 'ACTIVE'::"text"));



CREATE INDEX "charges_active_student_due_idx" ON "public"."charges" USING "btree" ("student_id", "due_date") WHERE ("status" = 'ACTIVE'::"text");



CREATE INDEX "charges_concept_id_idx" ON "public"."charges" USING "btree" ("financial_concept_id");



CREATE INDEX "charges_cycle_id_idx" ON "public"."charges" USING "btree" ("cycle_id") WHERE ("cycle_id" IS NOT NULL);



CREATE INDEX "charges_due_date_idx" ON "public"."charges" USING "btree" ("due_date");



CREATE INDEX "charges_enrollment_id_idx" ON "public"."charges" USING "btree" ("enrollment_id") WHERE ("enrollment_id" IS NOT NULL);



CREATE INDEX "charges_student_id_idx" ON "public"."charges" USING "btree" ("student_id");



CREATE INDEX "credit_applications_active_charge_idx" ON "public"."credit_applications" USING "btree" ("charge_id") WHERE ("reversed_at" IS NULL);



CREATE INDEX "credit_applications_active_credit_idx" ON "public"."credit_applications" USING "btree" ("credit_id") WHERE ("reversed_at" IS NULL);



CREATE INDEX "credit_applications_charge_id_idx" ON "public"."credit_applications" USING "btree" ("charge_id");



CREATE INDEX "credit_applications_credit_id_idx" ON "public"."credit_applications" USING "btree" ("credit_id");



CREATE INDEX "credits_active_student_idx" ON "public"."credits" USING "btree" ("student_id") WHERE ("status" = 'ACTIVE'::"text");



CREATE INDEX "credits_reserved_charge_id_idx" ON "public"."credits" USING "btree" ("reserved_charge_id") WHERE ("reserved_charge_id" IS NOT NULL);



CREATE INDEX "credits_source_payment_id_idx" ON "public"."credits" USING "btree" ("source_payment_id");



CREATE INDEX "credits_student_id_idx" ON "public"."credits" USING "btree" ("student_id");



CREATE INDEX "curriculum_subjects_cycle_idx" ON "public"."curriculum_subjects" USING "btree" ("cycle_id");



CREATE INDEX "curriculum_subjects_grade_idx" ON "public"."curriculum_subjects" USING "btree" ("grade_level_id");



CREATE INDEX "curriculum_subjects_subject_idx" ON "public"."curriculum_subjects" USING "btree" ("subject_id");



CREATE INDEX "enrollment_charge_rules_enrollment_id_idx" ON "public"."enrollment_charge_rules" USING "btree" ("enrollment_id");



CREATE INDEX "enrollment_charge_rules_plan_period_id_idx" ON "public"."enrollment_charge_rules" USING "btree" ("financial_plan_period_id");



CREATE INDEX "enrollment_events_effective_on_idx" ON "public"."enrollment_events" USING "btree" ("effective_on");



CREATE INDEX "enrollment_events_enrollment_effective_idx" ON "public"."enrollment_events" USING "btree" ("enrollment_id", "effective_on" DESC, "recorded_at" DESC, "id" DESC);



CREATE INDEX "enrollment_events_enrollment_id_idx" ON "public"."enrollment_events" USING "btree" ("enrollment_id");



CREATE INDEX "enrollment_financial_plan_enrollment_idx" ON "public"."enrollment_financial_plan_assignments" USING "btree" ("enrollment_id", "valid_from");



CREATE INDEX "enrollment_financial_plan_plan_idx" ON "public"."enrollment_financial_plan_assignments" USING "btree" ("financial_plan_id");



CREATE INDEX "enrollment_tuition_discount_category_idx" ON "public"."enrollment_tuition_discount_assignments" USING "btree" ("category_id");



CREATE INDEX "enrollment_tuition_discount_enrollment_idx" ON "public"."enrollment_tuition_discount_assignments" USING "btree" ("enrollment_id", "valid_from");



CREATE INDEX "enrollments_classification_id_idx" ON "public"."enrollments" USING "btree" ("classification_id");



CREATE INDEX "enrollments_cycle_enrolled_on_idx" ON "public"."enrollments" USING "btree" ("cycle_id", "enrolled_on");



CREATE INDEX "enrollments_cycle_id_idx" ON "public"."enrollments" USING "btree" ("cycle_id");



CREATE INDEX "enrollments_grade_level_id_idx" ON "public"."enrollments" USING "btree" ("grade_level_id");



CREATE INDEX "enrollments_group_id_idx" ON "public"."enrollments" USING "btree" ("group_id") WHERE ("group_id" IS NOT NULL);



CREATE UNIQUE INDEX "enrollments_legacy_id_uq" ON "public"."enrollments" USING "btree" ("legacy_id") WHERE ("legacy_id" IS NOT NULL);



CREATE INDEX "enrollments_status_idx" ON "public"."enrollments" USING "btree" ("status");



CREATE INDEX "evaluation_periods_capture_status_idx" ON "public"."evaluation_periods" USING "btree" ("capture_status");



CREATE INDEX "evaluation_periods_cycle_idx" ON "public"."evaluation_periods" USING "btree" ("cycle_id");



CREATE UNIQUE INDEX "family_access_active_guardian_student_uq" ON "public"."family_access" USING "btree" ("guardian_id", "student_id") WHERE ("status" = 'ACTIVE'::"text");



CREATE INDEX "family_access_guardian_idx" ON "public"."family_access" USING "btree" ("guardian_id");



CREATE INDEX "family_access_invitation_idx" ON "public"."family_access" USING "btree" ("invitation_id") WHERE ("invitation_id" IS NOT NULL);



CREATE INDEX "family_access_student_idx" ON "public"."family_access" USING "btree" ("student_id");



CREATE INDEX "family_invitation_students_guardian_idx" ON "public"."family_invitation_students" USING "btree" ("guardian_id");



CREATE INDEX "family_invitation_students_student_idx" ON "public"."family_invitation_students" USING "btree" ("student_id");



CREATE INDEX "family_invitations_guardian_idx" ON "public"."family_invitations" USING "btree" ("guardian_id");



CREATE INDEX "family_invitations_pending_idx" ON "public"."family_invitations" USING "btree" ("guardian_id", "expires_at") WHERE ("status" = 'PENDING'::"text");



CREATE INDEX "financial_plan_periods_anchor_id_idx" ON "public"."financial_plan_periods" USING "btree" ("anchor_period_id") WHERE ("anchor_period_id" IS NOT NULL);



CREATE INDEX "financial_plan_periods_concept_id_idx" ON "public"."financial_plan_periods" USING "btree" ("financial_concept_id");



CREATE INDEX "financial_plan_periods_plan_id_idx" ON "public"."financial_plan_periods" USING "btree" ("financial_plan_id");



CREATE INDEX "financial_plans_cycle_id_idx" ON "public"."financial_plans" USING "btree" ("cycle_id");



CREATE INDEX "financial_plans_education_level_id_idx" ON "public"."financial_plans" USING "btree" ("education_level_id");



CREATE UNIQUE INDEX "financial_plans_one_active_default_uq" ON "public"."financial_plans" USING "btree" ("cycle_id", "education_level_id") WHERE (("is_default" = true) AND ("status" = 'ACTIVE'::"text"));



CREATE UNIQUE INDEX "financial_plans_one_default_per_cycle_level_uq" ON "public"."financial_plans" USING "btree" ("cycle_id", "education_level_id") WHERE ("is_default" = true);



CREATE INDEX "grade_access_entitlements_period_idx" ON "public"."grade_access_entitlements" USING "btree" ("evaluation_period_id");



CREATE INDEX "grade_levels_education_level_id_idx" ON "public"."grade_levels" USING "btree" ("education_level_id");



CREATE INDEX "group_period_publications_group_idx" ON "public"."group_period_publications" USING "btree" ("group_id");



CREATE INDEX "group_period_publications_period_idx" ON "public"."group_period_publications" USING "btree" ("evaluation_period_id");



CREATE INDEX "group_period_publications_published_idx" ON "public"."group_period_publications" USING "btree" ("group_id", "evaluation_period_id") WHERE ("status" = 'PUBLISHED'::"text");



CREATE INDEX "group_primary_teacher_cycle_idx" ON "public"."group_primary_teacher_assignments" USING "btree" ("cycle_id");



CREATE INDEX "group_primary_teacher_staff_idx" ON "public"."group_primary_teacher_assignments" USING "btree" ("staff_id");



CREATE INDEX "groups_cycle_id_idx" ON "public"."groups" USING "btree" ("cycle_id");



CREATE INDEX "groups_grade_level_id_idx" ON "public"."groups" USING "btree" ("grade_level_id");



CREATE UNIQUE INDEX "guardians_auth_user_id_uq" ON "public"."guardians" USING "btree" ("auth_user_id") WHERE ("auth_user_id" IS NOT NULL);



CREATE UNIQUE INDEX "guardians_email_uq" ON "public"."guardians" USING "btree" ("lower"("btrim"("email"))) WHERE ("email" IS NOT NULL);



CREATE UNIQUE INDEX "guardians_legacy_id_uq" ON "public"."guardians" USING "btree" ("legacy_id") WHERE ("legacy_id" IS NOT NULL);



CREATE INDEX "payment_agreement_charges_charge_idx" ON "public"."payment_agreement_charges" USING "btree" ("charge_id");



CREATE INDEX "payment_agreement_installments_agreement_idx" ON "public"."payment_agreement_installments" USING "btree" ("agreement_id");



CREATE INDEX "payment_agreement_installments_due_date_idx" ON "public"."payment_agreement_installments" USING "btree" ("due_date");



CREATE INDEX "payment_agreements_enrollment_idx" ON "public"."payment_agreements" USING "btree" ("enrollment_id");



CREATE INDEX "payment_agreements_status_idx" ON "public"."payment_agreements" USING "btree" ("status");



CREATE UNIQUE INDEX "payment_agreements_supersedes_uq" ON "public"."payment_agreements" USING "btree" ("supersedes_agreement_id") WHERE ("supersedes_agreement_id" IS NOT NULL);



CREATE INDEX "payment_allocations_active_charge_idx" ON "public"."payment_allocations" USING "btree" ("charge_id") WHERE ("reversed_at" IS NULL);



CREATE INDEX "payment_allocations_active_payment_idx" ON "public"."payment_allocations" USING "btree" ("payment_id") WHERE ("reversed_at" IS NULL);



CREATE INDEX "payment_allocations_charge_id_idx" ON "public"."payment_allocations" USING "btree" ("charge_id");



CREATE UNIQUE INDEX "payment_allocations_legacy_id_uq" ON "public"."payment_allocations" USING "btree" ("legacy_id") WHERE ("legacy_id" IS NOT NULL);



CREATE INDEX "payment_allocations_payment_id_idx" ON "public"."payment_allocations" USING "btree" ("payment_id");



CREATE UNIQUE INDEX "payment_methods_code_uq" ON "public"."payment_methods" USING "btree" ("upper"("btrim"("code")));



CREATE INDEX "payment_reversals_reversed_at_idx" ON "public"."payment_reversals" USING "btree" ("reversed_at");



CREATE INDEX "payments_captured_by_profile_idx" ON "public"."payments" USING "btree" ("captured_by_profile_id", "created_at") WHERE ("captured_by_profile_id" IS NOT NULL);



CREATE UNIQUE INDEX "payments_legacy_id_uq" ON "public"."payments" USING "btree" ("legacy_id") WHERE ("legacy_id" IS NOT NULL);



CREATE INDEX "payments_payment_method_idx" ON "public"."payments" USING "btree" ("payment_method_id");



CREATE INDEX "payments_received_at_idx" ON "public"."payments" USING "btree" ("received_at");



CREATE INDEX "payments_received_by_staff_date_idx" ON "public"."payments" USING "btree" ("received_by_staff_id", "received_at") WHERE ("received_by_staff_id" IS NOT NULL);



CREATE INDEX "payments_received_by_staff_idx" ON "public"."payments" USING "btree" ("received_by_staff_id") WHERE ("received_by_staff_id" IS NOT NULL);



CREATE INDEX "payments_status_idx" ON "public"."payments" USING "btree" ("status");



CREATE INDEX "payments_student_id_idx" ON "public"."payments" USING "btree" ("student_id");



CREATE INDEX "preregistration_campaigns_level_idx" ON "public"."preregistration_campaigns" USING "btree" ("education_level_id") WHERE ("education_level_id" IS NOT NULL);



CREATE INDEX "preregistration_campaigns_status_idx" ON "public"."preregistration_campaigns" USING "btree" ("status");



CREATE INDEX "preregistration_campaigns_target_cycle_idx" ON "public"."preregistration_campaigns" USING "btree" ("target_cycle_id");



CREATE INDEX "preregistrations_campaign_idx" ON "public"."preregistrations" USING "btree" ("campaign_id") WHERE ("campaign_id" IS NOT NULL);



CREATE UNIQUE INDEX "preregistrations_charge_id_uq" ON "public"."preregistrations" USING "btree" ("charge_id") WHERE ("charge_id" IS NOT NULL);



CREATE INDEX "preregistrations_status_idx" ON "public"."preregistrations" USING "btree" ("status");



CREATE INDEX "preregistrations_student_idx" ON "public"."preregistrations" USING "btree" ("student_id");



CREATE INDEX "preregistrations_target_cycle_idx" ON "public"."preregistrations" USING "btree" ("target_cycle_id");



CREATE INDEX "preregistrations_target_grade_idx" ON "public"."preregistrations" USING "btree" ("target_grade_level_id");



CREATE INDEX "refund_components_credit_idx" ON "public"."refund_components" USING "btree" ("credit_id") WHERE ("credit_id" IS NOT NULL);



CREATE INDEX "refund_components_payment_allocation_idx" ON "public"."refund_components" USING "btree" ("payment_allocation_id") WHERE ("payment_allocation_id" IS NOT NULL);



CREATE INDEX "refund_components_refund_idx" ON "public"."refund_components" USING "btree" ("refund_id");



CREATE INDEX "refunds_method_idx" ON "public"."refunds" USING "btree" ("refund_method_id");



CREATE INDEX "refunds_payment_id_idx" ON "public"."refunds" USING "btree" ("payment_id");



CREATE INDEX "refunds_refunded_at_idx" ON "public"."refunds" USING "btree" ("refunded_at");



CREATE INDEX "role_permissions_permission_idx" ON "public"."role_permissions" USING "btree" ("permission_id");



CREATE INDEX "staff_invitations_accepted_user_idx" ON "public"."staff_invitations" USING "btree" ("accepted_user_id") WHERE ("accepted_user_id" IS NOT NULL);



CREATE INDEX "staff_invitations_initial_role_idx" ON "public"."staff_invitations" USING "btree" ("initial_role_id");



CREATE UNIQUE INDEX "staff_invitations_pending_email_uq" ON "public"."staff_invitations" USING "btree" ("lower"("btrim"("email"))) WHERE ("status" = 'PENDING'::"text");



CREATE INDEX "staff_invitations_staff_idx" ON "public"."staff_invitations" USING "btree" ("staff_id");



CREATE INDEX "staff_profile_id_idx" ON "public"."staff" USING "btree" ("profile_id") WHERE ("profile_id" IS NOT NULL);



CREATE INDEX "staff_status_idx" ON "public"."staff" USING "btree" ("status");



CREATE INDEX "student_eval_quant_history_evaluation_idx" ON "public"."student_evaluation_quantitative_history" USING "btree" ("student_evaluation_id", "changed_at");



CREATE INDEX "student_evaluations_curriculum_idx" ON "public"."student_evaluations" USING "btree" ("curriculum_subject_id");



CREATE INDEX "student_evaluations_enrollment_idx" ON "public"."student_evaluations" USING "btree" ("enrollment_id");



CREATE INDEX "student_evaluations_group_idx" ON "public"."student_evaluations" USING "btree" ("group_id");



CREATE INDEX "student_evaluations_period_idx" ON "public"."student_evaluations" USING "btree" ("evaluation_period_id");



CREATE INDEX "student_evaluations_teacher_assignment_idx" ON "public"."student_evaluations" USING "btree" ("teacher_assignment_id") WHERE ("teacher_assignment_id" IS NOT NULL);



CREATE INDEX "student_financial_agreements_base_rate_id_idx" ON "public"."student_financial_agreements" USING "btree" ("base_rate_id") WHERE ("base_rate_id" IS NOT NULL);



CREATE INDEX "student_financial_agreements_benefit_id_idx" ON "public"."student_financial_agreements" USING "btree" ("benefit_id") WHERE ("benefit_id" IS NOT NULL);



CREATE INDEX "student_financial_agreements_concept_id_idx" ON "public"."student_financial_agreements" USING "btree" ("financial_concept_id");



CREATE INDEX "student_financial_agreements_discount_version_idx" ON "public"."student_financial_agreements" USING "btree" ("discount_category_version_id") WHERE ("discount_category_version_id" IS NOT NULL);



CREATE INDEX "student_financial_agreements_enrollment_id_idx" ON "public"."student_financial_agreements" USING "btree" ("enrollment_id");



CREATE INDEX "student_guardians_active_student_idx" ON "public"."student_guardians" USING "btree" ("student_id") WHERE ("is_active" = true);



CREATE INDEX "student_guardians_guardian_id_idx" ON "public"."student_guardians" USING "btree" ("guardian_id");



CREATE UNIQUE INDEX "students_legacy_id_uq" ON "public"."students" USING "btree" ("legacy_id") WHERE ("legacy_id" IS NOT NULL);



CREATE UNIQUE INDEX "students_student_code_uq" ON "public"."students" USING "btree" ("student_code") WHERE ("student_code" IS NOT NULL);



CREATE INDEX "teacher_assignments_curriculum_idx" ON "public"."teacher_assignments" USING "btree" ("curriculum_subject_id");



CREATE INDEX "teacher_assignments_cycle_idx" ON "public"."teacher_assignments" USING "btree" ("cycle_id");



CREATE INDEX "teacher_assignments_group_idx" ON "public"."teacher_assignments" USING "btree" ("group_id");



CREATE INDEX "teacher_assignments_teacher_idx" ON "public"."teacher_assignments" USING "btree" ("teacher_staff_id");



CREATE INDEX "tuition_discount_categories_cycle_active_idx" ON "public"."tuition_discount_categories" USING "btree" ("cycle_id", "is_active");



CREATE UNIQUE INDEX "tuition_discount_categories_cycle_name_uq" ON "public"."tuition_discount_categories" USING "btree" ("cycle_id", "lower"("btrim"("name")));



CREATE INDEX "tuition_discount_category_versions_category_idx" ON "public"."tuition_discount_category_versions" USING "btree" ("category_id", "valid_from");



CREATE INDEX "user_roles_active_user_idx" ON "public"."user_roles" USING "btree" ("user_id", "role_id") WHERE ("valid_until" IS NULL);



CREATE INDEX "user_roles_role_idx" ON "public"."user_roles" USING "btree" ("role_id");



CREATE INDEX "user_roles_user_idx" ON "public"."user_roles" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "audit_nonfinancial_mutation" AFTER INSERT OR DELETE OR UPDATE ON "public"."academic_capture_windows" FOR EACH ROW EXECUTE FUNCTION "app_private"."audit_nonfinancial_mutation"();



CREATE OR REPLACE TRIGGER "audit_nonfinancial_mutation" AFTER INSERT OR DELETE OR UPDATE ON "public"."curriculum_subjects" FOR EACH ROW EXECUTE FUNCTION "app_private"."audit_nonfinancial_mutation"();



CREATE OR REPLACE TRIGGER "audit_nonfinancial_mutation" AFTER INSERT OR DELETE OR UPDATE ON "public"."evaluation_periods" FOR EACH ROW EXECUTE FUNCTION "app_private"."audit_nonfinancial_mutation"();



CREATE OR REPLACE TRIGGER "audit_nonfinancial_mutation" AFTER INSERT OR DELETE OR UPDATE ON "public"."family_access" FOR EACH ROW EXECUTE FUNCTION "app_private"."audit_nonfinancial_mutation"();



CREATE OR REPLACE TRIGGER "audit_nonfinancial_mutation" AFTER INSERT OR DELETE OR UPDATE ON "public"."group_period_publications" FOR EACH ROW EXECUTE FUNCTION "app_private"."audit_nonfinancial_mutation"();



CREATE OR REPLACE TRIGGER "audit_nonfinancial_mutation" AFTER INSERT OR DELETE OR UPDATE ON "public"."group_primary_teacher_assignments" FOR EACH ROW EXECUTE FUNCTION "app_private"."audit_nonfinancial_mutation"();



CREATE OR REPLACE TRIGGER "audit_nonfinancial_mutation" AFTER INSERT OR DELETE OR UPDATE ON "public"."groups" FOR EACH ROW EXECUTE FUNCTION "app_private"."audit_nonfinancial_mutation"();



CREATE OR REPLACE TRIGGER "audit_nonfinancial_mutation" AFTER INSERT OR DELETE OR UPDATE ON "public"."guardians" FOR EACH ROW EXECUTE FUNCTION "app_private"."audit_nonfinancial_mutation"();



CREATE OR REPLACE TRIGGER "audit_nonfinancial_mutation" AFTER INSERT OR DELETE OR UPDATE ON "public"."permissions" FOR EACH ROW EXECUTE FUNCTION "app_private"."audit_nonfinancial_mutation"();



CREATE OR REPLACE TRIGGER "audit_nonfinancial_mutation" AFTER INSERT OR DELETE OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "app_private"."audit_nonfinancial_mutation"();



CREATE OR REPLACE TRIGGER "audit_nonfinancial_mutation" AFTER INSERT OR DELETE OR UPDATE ON "public"."role_permissions" FOR EACH ROW EXECUTE FUNCTION "app_private"."audit_nonfinancial_mutation"();



CREATE OR REPLACE TRIGGER "audit_nonfinancial_mutation" AFTER INSERT OR DELETE OR UPDATE ON "public"."roles" FOR EACH ROW EXECUTE FUNCTION "app_private"."audit_nonfinancial_mutation"();



CREATE OR REPLACE TRIGGER "audit_nonfinancial_mutation" AFTER INSERT OR DELETE OR UPDATE ON "public"."staff" FOR EACH ROW EXECUTE FUNCTION "app_private"."audit_nonfinancial_mutation"();



CREATE OR REPLACE TRIGGER "audit_nonfinancial_mutation" AFTER INSERT OR DELETE OR UPDATE ON "public"."student_guardians" FOR EACH ROW EXECUTE FUNCTION "app_private"."audit_nonfinancial_mutation"();



CREATE OR REPLACE TRIGGER "audit_nonfinancial_mutation" AFTER INSERT OR DELETE OR UPDATE ON "public"."students" FOR EACH ROW EXECUTE FUNCTION "app_private"."audit_nonfinancial_mutation"();



CREATE OR REPLACE TRIGGER "audit_nonfinancial_mutation" AFTER INSERT OR DELETE OR UPDATE ON "public"."subjects" FOR EACH ROW EXECUTE FUNCTION "app_private"."audit_nonfinancial_mutation"();



CREATE OR REPLACE TRIGGER "audit_nonfinancial_mutation" AFTER INSERT OR DELETE OR UPDATE ON "public"."teacher_assignments" FOR EACH ROW EXECUTE FUNCTION "app_private"."audit_nonfinancial_mutation"();



CREATE OR REPLACE TRIGGER "audit_nonfinancial_mutation" AFTER INSERT OR DELETE OR UPDATE ON "public"."user_roles" FOR EACH ROW EXECUTE FUNCTION "app_private"."audit_nonfinancial_mutation"();



CREATE OR REPLACE TRIGGER "charge_adjustments_refresh_grade_access" AFTER INSERT OR UPDATE OF "amount" ON "public"."charge_adjustments" FOR EACH ROW EXECUTE FUNCTION "app_private"."refresh_entitlements_from_charge_adjustment"();



CREATE OR REPLACE TRIGGER "charges_refresh_grade_access" AFTER INSERT OR UPDATE OF "status", "due_date", "original_amount" ON "public"."charges" FOR EACH ROW EXECUTE FUNCTION "app_private"."refresh_entitlements_from_charge"();



CREATE OR REPLACE TRIGGER "credit_applications_refresh_grade_access" AFTER INSERT OR UPDATE OF "reversed_at" ON "public"."credit_applications" FOR EACH ROW EXECUTE FUNCTION "app_private"."refresh_entitlements_from_credit_application"();



CREATE OR REPLACE TRIGGER "enrollments_record_created_event" AFTER INSERT ON "public"."enrollments" FOR EACH ROW EXECUTE FUNCTION "app_private"."record_new_enrollment_event"();



CREATE OR REPLACE TRIGGER "enrollments_refresh_grade_access" AFTER INSERT OR UPDATE OF "status", "group_id" ON "public"."enrollments" FOR EACH ROW EXECUTE FUNCTION "app_private"."refresh_entitlements_from_enrollment"();



CREATE OR REPLACE TRIGGER "group_period_publications_refresh_entitlements" AFTER INSERT OR UPDATE OF "status" ON "public"."group_period_publications" FOR EACH ROW EXECUTE FUNCTION "app_private"."refresh_entitlements_after_publication"();



CREATE OR REPLACE TRIGGER "payment_allocations_refresh_grade_access" AFTER INSERT OR UPDATE OF "reversed_at" ON "public"."payment_allocations" FOR EACH ROW EXECUTE FUNCTION "app_private"."refresh_entitlements_from_payment_allocation"();



CREATE OR REPLACE TRIGGER "student_evaluations_track_change" BEFORE UPDATE ON "public"."student_evaluations" FOR EACH ROW EXECUTE FUNCTION "app_private"."track_student_evaluation_change"();



CREATE OR REPLACE TRIGGER "student_evaluations_validate" BEFORE INSERT OR UPDATE ON "public"."student_evaluations" FOR EACH ROW EXECUTE FUNCTION "app_private"."validate_student_evaluation"();



ALTER TABLE ONLY "public"."academic_capture_windows"
    ADD CONSTRAINT "academic_capture_windows_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."academic_capture_windows"
    ADD CONSTRAINT "academic_capture_windows_curriculum_fk" FOREIGN KEY ("curriculum_subject_id", "cycle_id", "grade_level_id") REFERENCES "public"."curriculum_subjects"("id", "cycle_id", "grade_level_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."academic_capture_windows"
    ADD CONSTRAINT "academic_capture_windows_group_fk" FOREIGN KEY ("group_id", "cycle_id", "grade_level_id") REFERENCES "public"."groups"("id", "cycle_id", "grade_level_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."academic_capture_windows"
    ADD CONSTRAINT "academic_capture_windows_opened_by_fkey" FOREIGN KEY ("opened_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."academic_capture_windows"
    ADD CONSTRAINT "academic_capture_windows_period_fk" FOREIGN KEY ("evaluation_period_id", "cycle_id") REFERENCES "public"."evaluation_periods"("id", "cycle_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."academic_capture_windows"
    ADD CONSTRAINT "academic_capture_windows_teacher_assignment_id_fkey" FOREIGN KEY ("teacher_assignment_id") REFERENCES "public"."teacher_assignments"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."academic_capture_windows"
    ADD CONSTRAINT "academic_capture_windows_teacher_context_fk" FOREIGN KEY ("teacher_assignment_id", "group_id", "curriculum_subject_id") REFERENCES "public"."teacher_assignments"("id", "group_id", "curriculum_subject_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_actor_profile_id_fkey" FOREIGN KEY ("actor_profile_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."base_rates"
    ADD CONSTRAINT "base_rates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."base_rates"
    ADD CONSTRAINT "base_rates_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."school_cycles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."base_rates"
    ADD CONSTRAINT "base_rates_education_level_id_fkey" FOREIGN KEY ("education_level_id") REFERENCES "public"."education_levels"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."base_rates"
    ADD CONSTRAINT "base_rates_financial_concept_id_fkey" FOREIGN KEY ("financial_concept_id") REFERENCES "public"."financial_concepts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."charge_adjustments"
    ADD CONSTRAINT "charge_adjustments_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "public"."charges"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."charge_adjustments"
    ADD CONSTRAINT "charge_adjustments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."charges"
    ADD CONSTRAINT "charges_agreement_enrollment_concept_fk" FOREIGN KEY ("financial_agreement_id", "enrollment_id", "financial_concept_id") REFERENCES "public"."student_financial_agreements"("id", "enrollment_id", "financial_concept_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."charges"
    ADD CONSTRAINT "charges_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."charges"
    ADD CONSTRAINT "charges_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."school_cycles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."charges"
    ADD CONSTRAINT "charges_enrollment_student_cycle_fk" FOREIGN KEY ("enrollment_id", "student_id", "cycle_id") REFERENCES "public"."enrollments"("id", "student_id", "cycle_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."charges"
    ADD CONSTRAINT "charges_financial_concept_id_fkey" FOREIGN KEY ("financial_concept_id") REFERENCES "public"."financial_concepts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."charges"
    ADD CONSTRAINT "charges_plan_period_concept_fk" FOREIGN KEY ("financial_plan_period_id", "financial_concept_id") REFERENCES "public"."financial_plan_periods"("id", "financial_concept_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."charges"
    ADD CONSTRAINT "charges_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."credit_applications"
    ADD CONSTRAINT "credit_applications_charge_student_fk" FOREIGN KEY ("charge_id", "student_id") REFERENCES "public"."charges"("id", "student_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."credit_applications"
    ADD CONSTRAINT "credit_applications_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."credit_applications"
    ADD CONSTRAINT "credit_applications_credit_student_fk" FOREIGN KEY ("credit_id", "student_id") REFERENCES "public"."credits"("id", "student_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."credit_applications"
    ADD CONSTRAINT "credit_applications_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."credits"
    ADD CONSTRAINT "credits_reserved_charge_student_fk" FOREIGN KEY ("reserved_charge_id", "student_id") REFERENCES "public"."charges"("id", "student_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."credits"
    ADD CONSTRAINT "credits_source_payment_student_fk" FOREIGN KEY ("source_payment_id", "student_id") REFERENCES "public"."payments"("id", "student_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."credits"
    ADD CONSTRAINT "credits_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."curriculum_subjects"
    ADD CONSTRAINT "curriculum_subjects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."curriculum_subjects"
    ADD CONSTRAINT "curriculum_subjects_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."school_cycles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."curriculum_subjects"
    ADD CONSTRAINT "curriculum_subjects_grade_level_id_fkey" FOREIGN KEY ("grade_level_id") REFERENCES "public"."grade_levels"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."curriculum_subjects"
    ADD CONSTRAINT "curriculum_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."enrollment_charge_rules"
    ADD CONSTRAINT "enrollment_charge_rules_authorized_by_fkey" FOREIGN KEY ("authorized_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."enrollment_charge_rules"
    ADD CONSTRAINT "enrollment_charge_rules_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."enrollment_charge_rules"
    ADD CONSTRAINT "enrollment_charge_rules_financial_plan_period_id_fkey" FOREIGN KEY ("financial_plan_period_id") REFERENCES "public"."financial_plan_periods"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."enrollment_events"
    ADD CONSTRAINT "enrollment_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."enrollment_events"
    ADD CONSTRAINT "enrollment_events_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."enrollment_financial_exits"
    ADD CONSTRAINT "enrollment_financial_exits_authorized_by_fkey" FOREIGN KEY ("authorized_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."enrollment_financial_exits"
    ADD CONSTRAINT "enrollment_financial_exits_enrollment_event_id_fkey" FOREIGN KEY ("enrollment_event_id") REFERENCES "public"."enrollment_events"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."enrollment_financial_plan_assignments"
    ADD CONSTRAINT "enrollment_financial_plan_assignments_authorized_by_fkey" FOREIGN KEY ("authorized_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."enrollment_financial_plan_assignments"
    ADD CONSTRAINT "enrollment_financial_plan_assignments_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."enrollment_financial_plan_assignments"
    ADD CONSTRAINT "enrollment_financial_plan_assignments_financial_plan_id_fkey" FOREIGN KEY ("financial_plan_id") REFERENCES "public"."financial_plans"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."enrollment_tuition_discount_assignments"
    ADD CONSTRAINT "enrollment_tuition_discount_assignments_authorized_by_fkey" FOREIGN KEY ("authorized_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."enrollment_tuition_discount_assignments"
    ADD CONSTRAINT "enrollment_tuition_discount_assignments_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."tuition_discount_categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."enrollment_tuition_discount_assignments"
    ADD CONSTRAINT "enrollment_tuition_discount_assignments_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_classification_id_fkey" FOREIGN KEY ("classification_id") REFERENCES "public"."enrollment_classifications"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."school_cycles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_grade_level_id_fkey" FOREIGN KEY ("grade_level_id") REFERENCES "public"."grade_levels"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_group_cycle_grade_fk" FOREIGN KEY ("group_id", "cycle_id", "grade_level_id") REFERENCES "public"."groups"("id", "cycle_id", "grade_level_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."evaluation_periods"
    ADD CONSTRAINT "evaluation_periods_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."evaluation_periods"
    ADD CONSTRAINT "evaluation_periods_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."school_cycles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."evaluation_periods"
    ADD CONSTRAINT "evaluation_periods_opened_by_fkey" FOREIGN KEY ("opened_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."family_access"
    ADD CONSTRAINT "family_access_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."family_access"
    ADD CONSTRAINT "family_access_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "public"."guardians"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."family_access"
    ADD CONSTRAINT "family_access_guardian_relation_fk" FOREIGN KEY ("student_id", "guardian_id") REFERENCES "public"."student_guardians"("student_id", "guardian_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."family_access"
    ADD CONSTRAINT "family_access_invitation_guardian_fk" FOREIGN KEY ("invitation_id", "guardian_id") REFERENCES "public"."family_invitations"("id", "guardian_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."family_access"
    ADD CONSTRAINT "family_access_invitation_student_fk" FOREIGN KEY ("invitation_id", "student_id") REFERENCES "public"."family_invitation_students"("invitation_id", "student_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."family_access"
    ADD CONSTRAINT "family_access_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."family_access"
    ADD CONSTRAINT "family_access_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."family_invitation_students"
    ADD CONSTRAINT "family_invitation_students_guardian_relation_fk" FOREIGN KEY ("student_id", "guardian_id") REFERENCES "public"."student_guardians"("student_id", "guardian_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."family_invitation_students"
    ADD CONSTRAINT "family_invitation_students_invitation_guardian_fk" FOREIGN KEY ("invitation_id", "guardian_id") REFERENCES "public"."family_invitations"("id", "guardian_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."family_invitations"
    ADD CONSTRAINT "family_invitations_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."family_invitations"
    ADD CONSTRAINT "family_invitations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."family_invitations"
    ADD CONSTRAINT "family_invitations_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "public"."guardians"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."family_invitations"
    ADD CONSTRAINT "family_invitations_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."financial_plan_periods"
    ADD CONSTRAINT "financial_plan_periods_anchor_fk" FOREIGN KEY ("anchor_period_id", "financial_plan_id") REFERENCES "public"."financial_plan_periods"("id", "financial_plan_id") ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."financial_plan_periods"
    ADD CONSTRAINT "financial_plan_periods_financial_concept_id_fkey" FOREIGN KEY ("financial_concept_id") REFERENCES "public"."financial_concepts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."financial_plan_periods"
    ADD CONSTRAINT "financial_plan_periods_financial_plan_id_fkey" FOREIGN KEY ("financial_plan_id") REFERENCES "public"."financial_plans"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."financial_plans"
    ADD CONSTRAINT "financial_plans_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."school_cycles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."financial_plans"
    ADD CONSTRAINT "financial_plans_education_level_id_fkey" FOREIGN KEY ("education_level_id") REFERENCES "public"."education_levels"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."grade_access_entitlements"
    ADD CONSTRAINT "grade_access_entitlements_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."grade_access_entitlements"
    ADD CONSTRAINT "grade_access_entitlements_evaluation_period_id_fkey" FOREIGN KEY ("evaluation_period_id") REFERENCES "public"."evaluation_periods"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."grade_levels"
    ADD CONSTRAINT "grade_levels_education_level_id_fkey" FOREIGN KEY ("education_level_id") REFERENCES "public"."education_levels"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."group_period_publications"
    ADD CONSTRAINT "group_period_publications_group_cycle_fk" FOREIGN KEY ("group_id", "cycle_id") REFERENCES "public"."groups"("id", "cycle_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."group_period_publications"
    ADD CONSTRAINT "group_period_publications_period_cycle_fk" FOREIGN KEY ("evaluation_period_id", "cycle_id") REFERENCES "public"."evaluation_periods"("id", "cycle_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."group_period_publications"
    ADD CONSTRAINT "group_period_publications_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."group_period_publications"
    ADD CONSTRAINT "group_period_publications_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."group_primary_teacher_assignments"
    ADD CONSTRAINT "group_primary_teacher_assignments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."group_primary_teacher_assignments"
    ADD CONSTRAINT "group_primary_teacher_assignments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."group_primary_teacher_assignments"
    ADD CONSTRAINT "group_primary_teacher_group_fk" FOREIGN KEY ("group_id", "cycle_id") REFERENCES "public"."groups"("id", "cycle_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."school_cycles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_grade_level_id_fkey" FOREIGN KEY ("grade_level_id") REFERENCES "public"."grade_levels"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."guardians"
    ADD CONSTRAINT "guardians_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payment_agreement_charges"
    ADD CONSTRAINT "payment_agreement_charges_agreement_enrollment_fk" FOREIGN KEY ("agreement_id", "enrollment_id") REFERENCES "public"."payment_agreements"("id", "enrollment_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payment_agreement_charges"
    ADD CONSTRAINT "payment_agreement_charges_charge_enrollment_fk" FOREIGN KEY ("charge_id", "enrollment_id") REFERENCES "public"."charges"("id", "enrollment_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payment_agreement_installments"
    ADD CONSTRAINT "payment_agreement_installments_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "public"."payment_agreements"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payment_agreements"
    ADD CONSTRAINT "payment_agreements_authorized_by_fkey" FOREIGN KEY ("authorized_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payment_agreements"
    ADD CONSTRAINT "payment_agreements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payment_agreements"
    ADD CONSTRAINT "payment_agreements_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payment_agreements"
    ADD CONSTRAINT "payment_agreements_supersedes_same_enrollment_fk" FOREIGN KEY ("supersedes_agreement_id", "enrollment_id") REFERENCES "public"."payment_agreements"("id", "enrollment_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payment_allocations"
    ADD CONSTRAINT "payment_allocations_charge_student_fk" FOREIGN KEY ("charge_id", "student_id") REFERENCES "public"."charges"("id", "student_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payment_allocations"
    ADD CONSTRAINT "payment_allocations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payment_allocations"
    ADD CONSTRAINT "payment_allocations_payment_student_fk" FOREIGN KEY ("payment_id", "student_id") REFERENCES "public"."payments"("id", "student_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payment_allocations"
    ADD CONSTRAINT "payment_allocations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "payment_methods_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payment_reversals"
    ADD CONSTRAINT "payment_reversals_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payment_reversals"
    ADD CONSTRAINT "payment_reversals_reversed_by_fkey" FOREIGN KEY ("reversed_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_captured_by_profile_id_fkey" FOREIGN KEY ("captured_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_received_by_staff_id_fkey" FOREIGN KEY ("received_by_staff_id") REFERENCES "public"."staff"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."preregistration_campaigns"
    ADD CONSTRAINT "preregistration_campaigns_covered_concept_id_fkey" FOREIGN KEY ("covered_concept_id") REFERENCES "public"."financial_concepts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."preregistration_campaigns"
    ADD CONSTRAINT "preregistration_campaigns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."preregistration_campaigns"
    ADD CONSTRAINT "preregistration_campaigns_education_level_id_fkey" FOREIGN KEY ("education_level_id") REFERENCES "public"."education_levels"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."preregistration_campaigns"
    ADD CONSTRAINT "preregistration_campaigns_target_cycle_id_fkey" FOREIGN KEY ("target_cycle_id") REFERENCES "public"."school_cycles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."preregistrations"
    ADD CONSTRAINT "preregistrations_campaign_cycle_fk" FOREIGN KEY ("campaign_id", "target_cycle_id") REFERENCES "public"."preregistration_campaigns"("id", "target_cycle_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."preregistrations"
    ADD CONSTRAINT "preregistrations_charge_student_fk" FOREIGN KEY ("charge_id", "student_id") REFERENCES "public"."charges"("id", "student_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."preregistrations"
    ADD CONSTRAINT "preregistrations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."preregistrations"
    ADD CONSTRAINT "preregistrations_grade_level_fk" FOREIGN KEY ("target_grade_level_id", "target_education_level_id") REFERENCES "public"."grade_levels"("id", "education_level_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."preregistrations"
    ADD CONSTRAINT "preregistrations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."preregistrations"
    ADD CONSTRAINT "preregistrations_target_cycle_id_fkey" FOREIGN KEY ("target_cycle_id") REFERENCES "public"."school_cycles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."preregistrations"
    ADD CONSTRAINT "preregistrations_target_education_level_id_fkey" FOREIGN KEY ("target_education_level_id") REFERENCES "public"."education_levels"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."preregistrations"
    ADD CONSTRAINT "preregistrations_target_group_fk" FOREIGN KEY ("target_group_id", "target_cycle_id", "target_grade_level_id") REFERENCES "public"."groups"("id", "cycle_id", "grade_level_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."refund_components"
    ADD CONSTRAINT "refund_components_credit_id_fkey" FOREIGN KEY ("credit_id") REFERENCES "public"."credits"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."refund_components"
    ADD CONSTRAINT "refund_components_payment_allocation_id_fkey" FOREIGN KEY ("payment_allocation_id") REFERENCES "public"."payment_allocations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."refund_components"
    ADD CONSTRAINT "refund_components_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "public"."refunds"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_authorized_by_fkey" FOREIGN KEY ("authorized_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_refund_method_id_fkey" FOREIGN KEY ("refund_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."staff_invitations"
    ADD CONSTRAINT "staff_invitations_accepted_user_id_fkey" FOREIGN KEY ("accepted_user_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."staff_invitations"
    ADD CONSTRAINT "staff_invitations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."staff_invitations"
    ADD CONSTRAINT "staff_invitations_initial_role_id_fkey" FOREIGN KEY ("initial_role_id") REFERENCES "public"."roles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."staff_invitations"
    ADD CONSTRAINT "staff_invitations_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."staff_invitations"
    ADD CONSTRAINT "staff_invitations_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."student_evaluation_quantitative_history"
    ADD CONSTRAINT "student_evaluation_quantitative_hist_student_evaluation_id_fkey" FOREIGN KEY ("student_evaluation_id") REFERENCES "public"."student_evaluations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."student_evaluation_quantitative_history"
    ADD CONSTRAINT "student_evaluation_quantitative_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."student_evaluations"
    ADD CONSTRAINT "student_evaluations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."student_evaluations"
    ADD CONSTRAINT "student_evaluations_curriculum_context_fk" FOREIGN KEY ("curriculum_subject_id", "cycle_id", "grade_level_id") REFERENCES "public"."curriculum_subjects"("id", "cycle_id", "grade_level_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."student_evaluations"
    ADD CONSTRAINT "student_evaluations_enrollment_context_fk" FOREIGN KEY ("enrollment_id", "cycle_id", "grade_level_id") REFERENCES "public"."enrollments"("id", "cycle_id", "grade_level_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."student_evaluations"
    ADD CONSTRAINT "student_evaluations_group_context_fk" FOREIGN KEY ("group_id", "cycle_id", "grade_level_id") REFERENCES "public"."groups"("id", "cycle_id", "grade_level_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."student_evaluations"
    ADD CONSTRAINT "student_evaluations_period_cycle_fk" FOREIGN KEY ("evaluation_period_id", "cycle_id") REFERENCES "public"."evaluation_periods"("id", "cycle_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."student_evaluations"
    ADD CONSTRAINT "student_evaluations_teacher_assignment_fk" FOREIGN KEY ("teacher_assignment_id", "group_id", "curriculum_subject_id") REFERENCES "public"."teacher_assignments"("id", "group_id", "curriculum_subject_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."student_evaluations"
    ADD CONSTRAINT "student_evaluations_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."student_financial_agreements"
    ADD CONSTRAINT "student_financial_agreements_authorized_by_fkey" FOREIGN KEY ("authorized_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."student_financial_agreements"
    ADD CONSTRAINT "student_financial_agreements_base_rate_id_fkey" FOREIGN KEY ("base_rate_id") REFERENCES "public"."base_rates"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."student_financial_agreements"
    ADD CONSTRAINT "student_financial_agreements_benefit_id_fkey" FOREIGN KEY ("benefit_id") REFERENCES "public"."benefits"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."student_financial_agreements"
    ADD CONSTRAINT "student_financial_agreements_discount_category_version_id_fkey" FOREIGN KEY ("discount_category_version_id") REFERENCES "public"."tuition_discount_category_versions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."student_financial_agreements"
    ADD CONSTRAINT "student_financial_agreements_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."student_financial_agreements"
    ADD CONSTRAINT "student_financial_agreements_financial_concept_id_fkey" FOREIGN KEY ("financial_concept_id") REFERENCES "public"."financial_concepts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."student_guardians"
    ADD CONSTRAINT "student_guardians_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "public"."guardians"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."student_guardians"
    ADD CONSTRAINT "student_guardians_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."teacher_assignments"
    ADD CONSTRAINT "teacher_assignments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."teacher_assignments"
    ADD CONSTRAINT "teacher_assignments_curriculum_fk" FOREIGN KEY ("curriculum_subject_id", "cycle_id", "grade_level_id") REFERENCES "public"."curriculum_subjects"("id", "cycle_id", "grade_level_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."teacher_assignments"
    ADD CONSTRAINT "teacher_assignments_group_fk" FOREIGN KEY ("group_id", "cycle_id", "grade_level_id") REFERENCES "public"."groups"("id", "cycle_id", "grade_level_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."teacher_assignments"
    ADD CONSTRAINT "teacher_assignments_teacher_staff_id_fkey" FOREIGN KEY ("teacher_staff_id") REFERENCES "public"."staff"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."tuition_discount_categories"
    ADD CONSTRAINT "tuition_discount_categories_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."tuition_discount_categories"
    ADD CONSTRAINT "tuition_discount_categories_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."school_cycles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."tuition_discount_category_versions"
    ADD CONSTRAINT "tuition_discount_category_versions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."tuition_discount_categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."tuition_discount_category_versions"
    ADD CONSTRAINT "tuition_discount_category_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE "public"."academic_capture_windows" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "academic_capture_windows_manage" ON "public"."academic_capture_windows" TO "authenticated" USING ("app_private"."current_user_has_permission"('grades.capture.manage'::"text", 'ALL'::"text")) WITH CHECK ("app_private"."current_user_has_permission"('grades.capture.manage'::"text", 'ALL'::"text"));



CREATE POLICY "academic_capture_windows_select_teacher" ON "public"."academic_capture_windows" FOR SELECT TO "authenticated" USING (("teacher_assignment_id" IN ( SELECT "ta"."id"
   FROM "public"."teacher_assignments" "ta"
  WHERE ("ta"."teacher_staff_id" = "app_private"."current_staff_id"()))));



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."base_rates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "base_rates_select_staff" ON "public"."base_rates" FOR SELECT TO "authenticated" USING ("app_private"."current_user_has_permission"('balances.view'::"text", 'ALL'::"text"));



ALTER TABLE "public"."benefits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "benefits_select_staff" ON "public"."benefits" FOR SELECT TO "authenticated" USING ("app_private"."current_user_has_permission"('balances.view'::"text", 'ALL'::"text"));



ALTER TABLE "public"."charge_adjustments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "charge_adjustments_select_finance" ON "public"."charge_adjustments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."charges" "c"
  WHERE (("c"."id" = "charge_adjustments"."charge_id") AND "app_private"."current_user_can_view_student_finance"("c"."student_id")))));



ALTER TABLE "public"."charges" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "charges_select_finance" ON "public"."charges" FOR SELECT TO "authenticated" USING ("app_private"."current_user_can_view_student_finance"("student_id"));



ALTER TABLE "public"."credit_applications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "credit_applications_select_finance" ON "public"."credit_applications" FOR SELECT TO "authenticated" USING ("app_private"."current_user_can_view_student_finance"("student_id"));



ALTER TABLE "public"."credits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "credits_select_finance" ON "public"."credits" FOR SELECT TO "authenticated" USING ("app_private"."current_user_can_view_student_finance"("student_id"));



ALTER TABLE "public"."curriculum_subjects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "curriculum_subjects_manage" ON "public"."curriculum_subjects" TO "authenticated" USING ("app_private"."current_user_has_permission"('cycles.manage'::"text", 'ALL'::"text")) WITH CHECK ("app_private"."current_user_has_permission"('cycles.manage'::"text", 'ALL'::"text"));



CREATE POLICY "curriculum_subjects_select_active_user" ON "public"."curriculum_subjects" FOR SELECT TO "authenticated" USING ("app_private"."current_user_is_active"());



ALTER TABLE "public"."education_levels" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "education_levels_select_authenticated" ON "public"."education_levels" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."enrollment_charge_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "enrollment_charge_rules_select" ON "public"."enrollment_charge_rules" FOR SELECT TO "authenticated" USING ("app_private"."current_user_can_view_enrollment_finance"("enrollment_id"));



ALTER TABLE "public"."enrollment_classifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "enrollment_classifications_select_authenticated" ON "public"."enrollment_classifications" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."enrollment_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "enrollment_events_select_all" ON "public"."enrollment_events" FOR SELECT TO "authenticated" USING ("app_private"."current_user_has_permission"('enrollments.view'::"text", 'ALL'::"text"));



ALTER TABLE "public"."enrollment_financial_exits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."enrollment_financial_plan_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "enrollment_financial_plan_assignments_select" ON "public"."enrollment_financial_plan_assignments" FOR SELECT TO "authenticated" USING ("app_private"."current_user_has_permission"('balances.view'::"text", 'ALL'::"text"));



ALTER TABLE "public"."enrollment_tuition_discount_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "enrollment_tuition_discount_assignments_select" ON "public"."enrollment_tuition_discount_assignments" FOR SELECT TO "authenticated" USING ("app_private"."current_user_has_permission"('balances.view'::"text", 'ALL'::"text"));



ALTER TABLE "public"."enrollments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "enrollments_insert_manage" ON "public"."enrollments" FOR INSERT TO "authenticated" WITH CHECK ("app_private"."current_user_has_permission"('students.manage'::"text", 'ALL'::"text"));



CREATE POLICY "enrollments_select_all" ON "public"."enrollments" FOR SELECT TO "authenticated" USING ("app_private"."current_user_has_permission"('enrollments.view'::"text", 'ALL'::"text"));



CREATE POLICY "enrollments_select_family" ON "public"."enrollments" FOR SELECT TO "authenticated" USING (("app_private"."current_user_has_permission"('students.view'::"text", 'LINKED'::"text") AND "app_private"."current_user_has_family_access"("student_id")));



CREATE POLICY "enrollments_select_teacher" ON "public"."enrollments" FOR SELECT TO "authenticated" USING (("app_private"."current_user_has_permission"('enrollments.view'::"text", 'ASSIGNED'::"text") AND "app_private"."current_teacher_has_enrollment"("id")));



CREATE POLICY "enrollments_update_manage" ON "public"."enrollments" FOR UPDATE TO "authenticated" USING ("app_private"."current_user_has_permission"('students.manage'::"text", 'ALL'::"text")) WITH CHECK ("app_private"."current_user_has_permission"('students.manage'::"text", 'ALL'::"text"));



ALTER TABLE "public"."evaluation_periods" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "evaluation_periods_manage" ON "public"."evaluation_periods" TO "authenticated" USING ("app_private"."current_user_has_permission"('cycles.manage'::"text", 'ALL'::"text")) WITH CHECK ("app_private"."current_user_has_permission"('cycles.manage'::"text", 'ALL'::"text"));



CREATE POLICY "evaluation_periods_select_active_user" ON "public"."evaluation_periods" FOR SELECT TO "authenticated" USING ("app_private"."current_user_is_active"());



ALTER TABLE "public"."family_access" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "family_access_insert_manage" ON "public"."family_access" FOR INSERT TO "authenticated" WITH CHECK ("app_private"."current_user_has_permission"('family_access.manage'::"text", 'ALL'::"text"));



CREATE POLICY "family_access_select_manage" ON "public"."family_access" FOR SELECT TO "authenticated" USING ("app_private"."current_user_has_permission"('family_access.manage'::"text", 'ALL'::"text"));



CREATE POLICY "family_access_select_self" ON "public"."family_access" FOR SELECT TO "authenticated" USING (("guardian_id" = "app_private"."current_guardian_id"()));



CREATE POLICY "family_access_update_manage" ON "public"."family_access" FOR UPDATE TO "authenticated" USING ("app_private"."current_user_has_permission"('family_access.manage'::"text", 'ALL'::"text")) WITH CHECK ("app_private"."current_user_has_permission"('family_access.manage'::"text", 'ALL'::"text"));



ALTER TABLE "public"."family_invitation_students" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."family_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."financial_concepts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "financial_concepts_select_active" ON "public"."financial_concepts" FOR SELECT TO "authenticated" USING ("app_private"."current_user_is_active"());



ALTER TABLE "public"."financial_plan_periods" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "financial_plan_periods_select_staff" ON "public"."financial_plan_periods" FOR SELECT TO "authenticated" USING ("app_private"."current_user_has_permission"('balances.view'::"text", 'ALL'::"text"));



ALTER TABLE "public"."financial_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "financial_plans_select_staff" ON "public"."financial_plans" FOR SELECT TO "authenticated" USING ("app_private"."current_user_has_permission"('balances.view'::"text", 'ALL'::"text"));



ALTER TABLE "public"."grade_access_entitlements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."grade_levels" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "grade_levels_select_authenticated" ON "public"."grade_levels" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."group_period_publications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_period_publications_manage" ON "public"."group_period_publications" TO "authenticated" USING ("app_private"."current_user_has_permission"('grades.publish'::"text", 'ALL'::"text")) WITH CHECK ("app_private"."current_user_has_permission"('grades.publish'::"text", 'ALL'::"text"));



CREATE POLICY "group_period_publications_select_staff" ON "public"."group_period_publications" FOR SELECT TO "authenticated" USING (("app_private"."current_user_has_permission"('grades.view'::"text", 'ALL'::"text") OR "app_private"."current_user_has_permission"('grades.publish'::"text", 'ALL'::"text")));



ALTER TABLE "public"."group_primary_teacher_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_primary_teacher_manage" ON "public"."group_primary_teacher_assignments" TO "authenticated" USING ("app_private"."current_user_has_permission"('teacher_assignments.manage'::"text", 'ALL'::"text")) WITH CHECK ("app_private"."current_user_has_permission"('teacher_assignments.manage'::"text", 'ALL'::"text"));



CREATE POLICY "group_primary_teacher_select_own" ON "public"."group_primary_teacher_assignments" FOR SELECT TO "authenticated" USING (("staff_id" = "app_private"."current_staff_id"()));



ALTER TABLE "public"."groups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "groups_manage" ON "public"."groups" TO "authenticated" USING ("app_private"."current_user_has_permission"('cycles.manage'::"text", 'ALL'::"text")) WITH CHECK ("app_private"."current_user_has_permission"('cycles.manage'::"text", 'ALL'::"text"));



CREATE POLICY "groups_select_active_user" ON "public"."groups" FOR SELECT TO "authenticated" USING ("app_private"."current_user_is_active"());



ALTER TABLE "public"."guardians" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "guardians_insert_manage" ON "public"."guardians" FOR INSERT TO "authenticated" WITH CHECK ("app_private"."current_user_has_permission"('family_access.manage'::"text", 'ALL'::"text"));



CREATE POLICY "guardians_select_manage" ON "public"."guardians" FOR SELECT TO "authenticated" USING ("app_private"."current_user_has_permission"('family_access.manage'::"text", 'ALL'::"text"));



CREATE POLICY "guardians_select_self" ON "public"."guardians" FOR SELECT TO "authenticated" USING (("auth_user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "guardians_update_manage" ON "public"."guardians" FOR UPDATE TO "authenticated" USING ("app_private"."current_user_has_permission"('family_access.manage'::"text", 'ALL'::"text")) WITH CHECK ("app_private"."current_user_has_permission"('family_access.manage'::"text", 'ALL'::"text"));



ALTER TABLE "public"."payment_agreement_charges" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_agreement_charges_select_finance" ON "public"."payment_agreement_charges" FOR SELECT TO "authenticated" USING ("app_private"."current_user_can_view_enrollment_finance"("enrollment_id"));



ALTER TABLE "public"."payment_agreement_installments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_agreement_installments_select_finance" ON "public"."payment_agreement_installments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."payment_agreements" "pa"
  WHERE (("pa"."id" = "payment_agreement_installments"."agreement_id") AND "app_private"."current_user_can_view_enrollment_finance"("pa"."enrollment_id")))));



ALTER TABLE "public"."payment_agreements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_agreements_select_finance" ON "public"."payment_agreements" FOR SELECT TO "authenticated" USING ("app_private"."current_user_can_view_enrollment_finance"("enrollment_id"));



ALTER TABLE "public"."payment_allocations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_allocations_select_finance" ON "public"."payment_allocations" FOR SELECT TO "authenticated" USING ("app_private"."current_user_can_view_student_payments"("student_id"));



ALTER TABLE "public"."payment_methods" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_methods_select_staff" ON "public"."payment_methods" FOR SELECT TO "authenticated" USING (("app_private"."current_user_has_permission"('payments.view'::"text", 'ALL'::"text") OR "app_private"."current_user_has_permission"('payments.create'::"text", 'ALL'::"text")));



ALTER TABLE "public"."payment_reversals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_reversals_select_finance" ON "public"."payment_reversals" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."payments" "p"
  WHERE (("p"."id" = "payment_reversals"."payment_id") AND "app_private"."current_user_can_view_student_payments"("p"."student_id")))));



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payments_select_finance" ON "public"."payments" FOR SELECT TO "authenticated" USING ("app_private"."current_user_can_view_student_payments"("student_id"));



ALTER TABLE "public"."permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "permissions_insert_manage_users" ON "public"."permissions" FOR INSERT TO "authenticated" WITH CHECK ("app_private"."current_user_has_permission"('users.manage'::"text", 'ALL'::"text"));



CREATE POLICY "permissions_select_authenticated" ON "public"."permissions" FOR SELECT TO "authenticated" USING ("app_private"."current_user_is_active"());



CREATE POLICY "permissions_update_manage_users" ON "public"."permissions" FOR UPDATE TO "authenticated" USING ("app_private"."current_user_has_permission"('users.manage'::"text", 'ALL'::"text")) WITH CHECK ("app_private"."current_user_has_permission"('users.manage'::"text", 'ALL'::"text"));



ALTER TABLE "public"."preregistration_campaigns" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "preregistration_campaigns_select_manage" ON "public"."preregistration_campaigns" FOR SELECT TO "authenticated" USING (("app_private"."current_user_has_permission"('preregistrations.manage'::"text", 'ALL'::"text") OR "app_private"."current_user_has_permission"('campaigns.manage'::"text", 'ALL'::"text")));



ALTER TABLE "public"."preregistrations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "preregistrations_select_manage" ON "public"."preregistrations" FOR SELECT TO "authenticated" USING ("app_private"."current_user_has_permission"('preregistrations.manage'::"text", 'ALL'::"text"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select_manage_users" ON "public"."profiles" FOR SELECT TO "authenticated" USING ("app_private"."current_user_has_permission"('users.manage'::"text", 'ALL'::"text"));



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "profiles_update_manage_users" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ("app_private"."current_user_has_permission"('users.manage'::"text", 'ALL'::"text")) WITH CHECK ("app_private"."current_user_has_permission"('users.manage'::"text", 'ALL'::"text"));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) AND "app_private"."current_user_is_active"())) WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."refund_components" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "refund_components_select_finance" ON "public"."refund_components" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."refunds" "r"
     JOIN "public"."payments" "p" ON (("p"."id" = "r"."payment_id")))
  WHERE (("r"."id" = "refund_components"."refund_id") AND "app_private"."current_user_can_view_student_payments"("p"."student_id")))));



ALTER TABLE "public"."refunds" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "refunds_select_finance" ON "public"."refunds" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."payments" "p"
  WHERE (("p"."id" = "refunds"."payment_id") AND "app_private"."current_user_can_view_student_payments"("p"."student_id")))));



ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "role_permissions_delete_manage_users" ON "public"."role_permissions" FOR DELETE TO "authenticated" USING ("app_private"."current_user_has_permission"('users.manage'::"text", 'ALL'::"text"));



CREATE POLICY "role_permissions_insert_manage_users" ON "public"."role_permissions" FOR INSERT TO "authenticated" WITH CHECK ("app_private"."current_user_has_permission"('users.manage'::"text", 'ALL'::"text"));



CREATE POLICY "role_permissions_select_authenticated" ON "public"."role_permissions" FOR SELECT TO "authenticated" USING ("app_private"."current_user_is_active"());



CREATE POLICY "role_permissions_update_manage_users" ON "public"."role_permissions" FOR UPDATE TO "authenticated" USING ("app_private"."current_user_has_permission"('users.manage'::"text", 'ALL'::"text")) WITH CHECK ("app_private"."current_user_has_permission"('users.manage'::"text", 'ALL'::"text"));



ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "roles_insert_manage_users" ON "public"."roles" FOR INSERT TO "authenticated" WITH CHECK ("app_private"."current_user_has_permission"('users.manage'::"text", 'ALL'::"text"));



CREATE POLICY "roles_select_authenticated" ON "public"."roles" FOR SELECT TO "authenticated" USING ("app_private"."current_user_is_active"());



CREATE POLICY "roles_update_manage_users" ON "public"."roles" FOR UPDATE TO "authenticated" USING ("app_private"."current_user_has_permission"('users.manage'::"text", 'ALL'::"text")) WITH CHECK ("app_private"."current_user_has_permission"('users.manage'::"text", 'ALL'::"text"));



ALTER TABLE "public"."school_cycles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "school_cycles_select_authenticated" ON "public"."school_cycles" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."staff" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staff_insert_manage" ON "public"."staff" FOR INSERT TO "authenticated" WITH CHECK ("app_private"."current_user_has_permission"('staff.manage'::"text", 'ALL'::"text"));



ALTER TABLE "public"."staff_invitations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staff_select_manage" ON "public"."staff" FOR SELECT TO "authenticated" USING ("app_private"."current_user_has_permission"('staff.manage'::"text", 'ALL'::"text"));



CREATE POLICY "staff_select_own" ON "public"."staff" FOR SELECT TO "authenticated" USING (("profile_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "staff_update_manage" ON "public"."staff" FOR UPDATE TO "authenticated" USING ("app_private"."current_user_has_permission"('staff.manage'::"text", 'ALL'::"text")) WITH CHECK ("app_private"."current_user_has_permission"('staff.manage'::"text", 'ALL'::"text"));



CREATE POLICY "student_eval_quant_history_select_admin" ON "public"."student_evaluation_quantitative_history" FOR SELECT TO "authenticated" USING ("app_private"."current_user_has_permission"('grades.view'::"text", 'ALL'::"text"));



ALTER TABLE "public"."student_evaluation_quantitative_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_evaluations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_evaluations_insert_master" ON "public"."student_evaluations" FOR INSERT TO "authenticated" WITH CHECK ("app_private"."current_user_has_permission"('grades.capture'::"text", 'ALL'::"text"));



CREATE POLICY "student_evaluations_insert_teacher" ON "public"."student_evaluations" FOR INSERT TO "authenticated" WITH CHECK (("app_private"."current_user_has_permission"('grades.capture'::"text", 'ASSIGNED'::"text") AND "app_private"."current_teacher_can_capture"("enrollment_id", "evaluation_period_id", "curriculum_subject_id", "group_id") AND ("created_by" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "student_evaluations_select_all" ON "public"."student_evaluations" FOR SELECT TO "authenticated" USING ("app_private"."current_user_has_permission"('grades.view'::"text", 'ALL'::"text"));



CREATE POLICY "student_evaluations_select_family" ON "public"."student_evaluations" FOR SELECT TO "authenticated" USING ("app_private"."current_family_can_view_grade"("enrollment_id", "group_id", "evaluation_period_id"));



CREATE POLICY "student_evaluations_select_teacher" ON "public"."student_evaluations" FOR SELECT TO "authenticated" USING (("app_private"."current_user_has_permission"('grades.view'::"text", 'ASSIGNED'::"text") AND "app_private"."current_teacher_has_enrollment"("enrollment_id")));



CREATE POLICY "student_evaluations_update_master" ON "public"."student_evaluations" FOR UPDATE TO "authenticated" USING ("app_private"."current_user_has_permission"('grades.capture'::"text", 'ALL'::"text")) WITH CHECK ("app_private"."current_user_has_permission"('grades.capture'::"text", 'ALL'::"text"));



CREATE POLICY "student_evaluations_update_teacher" ON "public"."student_evaluations" FOR UPDATE TO "authenticated" USING (("app_private"."current_user_has_permission"('grades.capture'::"text", 'ASSIGNED'::"text") AND "app_private"."current_teacher_can_capture"("enrollment_id", "evaluation_period_id", "curriculum_subject_id", "group_id"))) WITH CHECK (("app_private"."current_user_has_permission"('grades.capture'::"text", 'ASSIGNED'::"text") AND "app_private"."current_teacher_can_capture"("enrollment_id", "evaluation_period_id", "curriculum_subject_id", "group_id") AND ("updated_by" = ( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."student_financial_agreements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_financial_agreements_select" ON "public"."student_financial_agreements" FOR SELECT TO "authenticated" USING ("app_private"."current_user_can_view_enrollment_finance"("enrollment_id"));



ALTER TABLE "public"."student_guardians" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_guardians_insert_manage" ON "public"."student_guardians" FOR INSERT TO "authenticated" WITH CHECK ("app_private"."current_user_has_permission"('family_access.manage'::"text", 'ALL'::"text"));



CREATE POLICY "student_guardians_select_manage" ON "public"."student_guardians" FOR SELECT TO "authenticated" USING ("app_private"."current_user_has_permission"('family_access.manage'::"text", 'ALL'::"text"));



CREATE POLICY "student_guardians_select_self" ON "public"."student_guardians" FOR SELECT TO "authenticated" USING (("guardian_id" = "app_private"."current_guardian_id"()));



CREATE POLICY "student_guardians_update_manage" ON "public"."student_guardians" FOR UPDATE TO "authenticated" USING ("app_private"."current_user_has_permission"('family_access.manage'::"text", 'ALL'::"text")) WITH CHECK ("app_private"."current_user_has_permission"('family_access.manage'::"text", 'ALL'::"text"));



ALTER TABLE "public"."students" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "students_insert_manage" ON "public"."students" FOR INSERT TO "authenticated" WITH CHECK ("app_private"."current_user_has_permission"('students.manage'::"text", 'ALL'::"text"));



CREATE POLICY "students_select_all" ON "public"."students" FOR SELECT TO "authenticated" USING ("app_private"."current_user_has_permission"('students.view'::"text", 'ALL'::"text"));



CREATE POLICY "students_select_family" ON "public"."students" FOR SELECT TO "authenticated" USING (("app_private"."current_user_has_permission"('students.view'::"text", 'LINKED'::"text") AND "app_private"."current_user_has_family_access"("id")));



CREATE POLICY "students_select_teacher" ON "public"."students" FOR SELECT TO "authenticated" USING (("app_private"."current_user_has_permission"('students.view'::"text", 'ASSIGNED'::"text") AND "app_private"."current_teacher_has_student"("id")));



CREATE POLICY "students_update_manage" ON "public"."students" FOR UPDATE TO "authenticated" USING ("app_private"."current_user_has_permission"('students.manage'::"text", 'ALL'::"text")) WITH CHECK ("app_private"."current_user_has_permission"('students.manage'::"text", 'ALL'::"text"));



ALTER TABLE "public"."subjects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subjects_manage" ON "public"."subjects" TO "authenticated" USING ("app_private"."current_user_has_permission"('cycles.manage'::"text", 'ALL'::"text")) WITH CHECK ("app_private"."current_user_has_permission"('cycles.manage'::"text", 'ALL'::"text"));



CREATE POLICY "subjects_select_active_user" ON "public"."subjects" FOR SELECT TO "authenticated" USING ("app_private"."current_user_is_active"());



ALTER TABLE "public"."teacher_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "teacher_assignments_manage" ON "public"."teacher_assignments" TO "authenticated" USING ("app_private"."current_user_has_permission"('teacher_assignments.manage'::"text", 'ALL'::"text")) WITH CHECK ("app_private"."current_user_has_permission"('teacher_assignments.manage'::"text", 'ALL'::"text"));



CREATE POLICY "teacher_assignments_select_manage" ON "public"."teacher_assignments" FOR SELECT TO "authenticated" USING ("app_private"."current_user_has_permission"('teacher_assignments.manage'::"text", 'ALL'::"text"));



CREATE POLICY "teacher_assignments_select_own" ON "public"."teacher_assignments" FOR SELECT TO "authenticated" USING (("teacher_staff_id" = "app_private"."current_staff_id"()));



ALTER TABLE "public"."tuition_discount_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tuition_discount_categories_select" ON "public"."tuition_discount_categories" FOR SELECT TO "authenticated" USING ("app_private"."current_user_has_permission"('finance.configure'::"text", 'ALL'::"text"));



ALTER TABLE "public"."tuition_discount_category_versions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tuition_discount_category_versions_select" ON "public"."tuition_discount_category_versions" FOR SELECT TO "authenticated" USING ("app_private"."current_user_has_permission"('finance.configure'::"text", 'ALL'::"text"));



ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_roles_delete_manage_users" ON "public"."user_roles" FOR DELETE TO "authenticated" USING ("app_private"."current_user_has_permission"('users.manage'::"text", 'ALL'::"text"));



CREATE POLICY "user_roles_insert_manage_users" ON "public"."user_roles" FOR INSERT TO "authenticated" WITH CHECK ("app_private"."current_user_has_permission"('users.manage'::"text", 'ALL'::"text"));



CREATE POLICY "user_roles_select_manage_users" ON "public"."user_roles" FOR SELECT TO "authenticated" USING ("app_private"."current_user_has_permission"('users.manage'::"text", 'ALL'::"text"));



CREATE POLICY "user_roles_select_own" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "user_roles_update_manage_users" ON "public"."user_roles" FOR UPDATE TO "authenticated" USING ("app_private"."current_user_has_permission"('users.manage'::"text", 'ALL'::"text")) WITH CHECK ("app_private"."current_user_has_permission"('users.manage'::"text", 'ALL'::"text"));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."activate_enrollment"("p_enrollment_id" "uuid", "p_activated_on" "date", "p_group_id" "uuid", "p_classes_start_on" "date", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."activate_enrollment"("p_enrollment_id" "uuid", "p_activated_on" "date", "p_group_id" "uuid", "p_classes_start_on" "date", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."adjust_charge"("p_charge_id" "uuid", "p_target_amount" numeric, "p_adjustment_type" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."adjust_charge"("p_charge_id" "uuid", "p_target_amount" numeric, "p_adjustment_type" "text", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."apply_credit"("p_credit_id" "uuid", "p_charge_id" "uuid", "p_amount" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_credit"("p_credit_id" "uuid", "p_charge_id" "uuid", "p_amount" numeric) TO "authenticated";



GRANT ALL ON FUNCTION "public"."bulk_create_and_activate_enrollments"("p_items" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."change_enrollment_classification"("p_enrollment_id" "uuid", "p_classification_id" "uuid", "p_effective_on" "date", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."change_enrollment_classification"("p_enrollment_id" "uuid", "p_classification_id" "uuid", "p_effective_on" "date", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."change_enrollment_financial_plan"("p_enrollment_id" "uuid", "p_target_financial_plan_id" "uuid", "p_effective_on" "date", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."change_enrollment_financial_plan"("p_enrollment_id" "uuid", "p_target_financial_plan_id" "uuid", "p_effective_on" "date", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."change_enrollment_group"("p_enrollment_id" "uuid", "p_group_id" "uuid", "p_effective_on" "date", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."change_enrollment_group"("p_enrollment_id" "uuid", "p_group_id" "uuid", "p_effective_on" "date", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."change_tuition_discount_category_version"("p_category_id" "uuid", "p_value" numeric, "p_effective_on" "date", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."change_tuition_discount_category_version"("p_category_id" "uuid", "p_value" numeric, "p_effective_on" "date", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."correct_credit_application"("p_credit_application_id" "uuid", "p_target_charge_id" "uuid", "p_target_amount" numeric, "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."correct_credit_application"("p_credit_application_id" "uuid", "p_target_charge_id" "uuid", "p_target_amount" numeric, "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."correct_payment_allocations"("p_payment_id" "uuid", "p_allocations" "jsonb", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."correct_payment_allocations"("p_payment_id" "uuid", "p_allocations" "jsonb", "p_reason" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."correct_tuition_discount_category_version"("p_category_id" "uuid", "p_value" numeric, "p_effective_on" "date", "p_reason" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."create_and_activate_enrollment"("p_student_id" "uuid", "p_cycle_id" "uuid", "p_grade_level_id" "uuid", "p_classification_id" "uuid", "p_group_id" "uuid", "p_activated_on" "date", "p_classes_start_on" "date", "p_economic_start_on" "date", "p_initial_period_amount" numeric, "p_initial_period_due_date" "date", "p_enrollment_fee_mode" "text", "p_enrollment_fee_amount" numeric, "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_new_student_enrollment"("p_student_full_name" "text", "p_student_sex" "text", "p_student_birth_date" "date", "p_contacts" "jsonb", "p_cycle_id" "uuid", "p_grade_level_id" "uuid", "p_classification_id" "uuid", "p_group_id" "uuid", "p_activated_on" "date", "p_classes_start_on" "date", "p_economic_start_on" "date", "p_initial_period_amount" numeric, "p_initial_period_due_date" "date", "p_enrollment_fee_mode" "text", "p_enrollment_fee_amount" numeric, "p_discount_category_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_new_student_enrollment"("p_student_full_name" "text", "p_student_sex" "text", "p_student_birth_date" "date", "p_contacts" "jsonb", "p_cycle_id" "uuid", "p_grade_level_id" "uuid", "p_classification_id" "uuid", "p_group_id" "uuid", "p_activated_on" "date", "p_classes_start_on" "date", "p_economic_start_on" "date", "p_initial_period_amount" numeric, "p_initial_period_due_date" "date", "p_enrollment_fee_mode" "text", "p_enrollment_fee_amount" numeric, "p_discount_category_id" "uuid", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_preregistration_campaign"("p_target_cycle_id" "uuid", "p_education_level_id" "uuid", "p_name" "text", "p_starts_on" "date", "p_ends_on" "date", "p_price" numeric, "p_covered_concept_id" "uuid", "p_allows_partial_payments" boolean, "p_non_continuation_policy" "text", "p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_preregistration_campaign"("p_target_cycle_id" "uuid", "p_education_level_id" "uuid", "p_name" "text", "p_starts_on" "date", "p_ends_on" "date", "p_price" numeric, "p_covered_concept_id" "uuid", "p_allows_partial_payments" boolean, "p_non_continuation_policy" "text", "p_status" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_preregistration_intake"("p_preregistered_on" "date", "p_student_id" "uuid", "p_student_full_name" "text", "p_target_cycle_id" "uuid", "p_target_education_level_id" "uuid", "p_target_grade_level_id" "uuid", "p_target_group_id" "uuid", "p_campaign_id" "uuid", "p_contacts" "jsonb", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_preregistration_intake"("p_preregistered_on" "date", "p_student_id" "uuid", "p_student_full_name" "text", "p_target_cycle_id" "uuid", "p_target_education_level_id" "uuid", "p_target_grade_level_id" "uuid", "p_target_group_id" "uuid", "p_campaign_id" "uuid", "p_contacts" "jsonb", "p_notes" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_retroactive_preregistration"("p_student_id" "uuid", "p_campaign_id" "uuid", "p_preregistered_on" "date", "p_target_grade_level_id" "uuid", "p_target_group_id" "uuid", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_retroactive_preregistration"("p_student_id" "uuid", "p_campaign_id" "uuid", "p_preregistered_on" "date", "p_target_grade_level_id" "uuid", "p_target_group_id" "uuid", "p_notes" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_tuition_base_agreement"("p_enrollment_id" "uuid", "p_effective_on" "date", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_tuition_base_agreement"("p_enrollment_id" "uuid", "p_effective_on" "date", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_tuition_discount_category"("p_cycle_id" "uuid", "p_name" "text", "p_discount_type" "text", "p_value" numeric, "p_effective_on" "date", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_tuition_discount_category"("p_cycle_id" "uuid", "p_name" "text", "p_discount_type" "text", "p_value" numeric, "p_effective_on" "date", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."enrollment_as_of"("p_cycle_id" "uuid", "p_as_of" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enrollment_as_of"("p_cycle_id" "uuid", "p_as_of" "date") TO "authenticated";



GRANT ALL ON FUNCTION "public"."enrollment_fee_is_covered"("p_student_id" "uuid", "p_cycle_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."initialize_enrollment_financials"("p_enrollment_id" "uuid", "p_effective_on" "date", "p_economic_start_on" "date", "p_initial_period_amount" numeric, "p_initial_period_due_date" "date", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."initialize_enrollment_financials"("p_enrollment_id" "uuid", "p_effective_on" "date", "p_economic_start_on" "date", "p_initial_period_amount" numeric, "p_initial_period_due_date" "date", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."payment_reporting"("p_from" "date", "p_to" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."payment_reporting"("p_from" "date", "p_to" "date") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."process_financial_withdrawal"("p_enrollment_id" "uuid", "p_withdrawn_on" "date", "p_mode" "text", "p_current_period_action" "text", "p_current_period_amount" numeric, "p_custom_future_targets" "jsonb", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."process_financial_withdrawal"("p_enrollment_id" "uuid", "p_withdrawn_on" "date", "p_mode" "text", "p_current_period_action" "text", "p_current_period_amount" numeric, "p_custom_future_targets" "jsonb", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."reactivate_enrollment"("p_enrollment_id" "uuid", "p_reactivated_on" "date", "p_group_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reactivate_enrollment"("p_enrollment_id" "uuid", "p_reactivated_on" "date", "p_group_id" "uuid", "p_reason" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."reactivate_enrollment_financial"("p_enrollment_id" "uuid", "p_reactivated_on" "date", "p_group_id" "uuid", "p_economic_start_on" "date", "p_initial_tuition_amount" numeric, "p_initial_tuition_due_date" "date", "p_enrollment_fee_mode" "text", "p_enrollment_fee_amount" numeric, "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."receiver_income"("p_staff_id" "uuid", "p_from" "date", "p_to" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."receiver_income"("p_staff_id" "uuid", "p_from" "date", "p_to" "date") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."refund_payment"("p_payment_id" "uuid", "p_amount" numeric, "p_refunded_at" timestamp with time zone, "p_refund_method_id" "uuid", "p_reason" "text", "p_components" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refund_payment"("p_payment_id" "uuid", "p_amount" numeric, "p_refunded_at" timestamp with time zone, "p_refund_method_id" "uuid", "p_reason" "text", "p_components" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."register_payment"("p_student_id" "uuid", "p_received_at" timestamp with time zone, "p_amount" numeric, "p_payment_method_id" "uuid", "p_received_by_staff_id" "uuid", "p_bank_reference" "text", "p_notes" "text", "p_receipt_visible_note" "text", "p_allocations" "jsonb", "p_allocation_override_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."register_payment"("p_student_id" "uuid", "p_received_at" timestamp with time zone, "p_amount" numeric, "p_payment_method_id" "uuid", "p_received_by_staff_id" "uuid", "p_bank_reference" "text", "p_notes" "text", "p_receipt_visible_note" "text", "p_allocations" "jsonb", "p_allocation_override_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."register_preregistration_in_campaign"("p_campaign_id" "uuid", "p_student_id" "uuid", "p_target_grade_level_id" "uuid", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."register_preregistration_in_campaign"("p_campaign_id" "uuid", "p_student_id" "uuid", "p_target_grade_level_id" "uuid", "p_notes" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."regularize_enrollment_financial_start"("p_enrollment_id" "uuid", "p_economic_start_on" "date", "p_initial_period_amount" numeric, "p_initial_period_due_date" "date", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."regularize_enrollment_financial_start"("p_enrollment_id" "uuid", "p_economic_start_on" "date", "p_initial_period_amount" numeric, "p_initial_period_due_date" "date", "p_reason" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."rename_tuition_discount_category"("p_category_id" "uuid", "p_name" "text", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."resolve_preregistration_to_enrollment"("p_preregistration_id" "uuid", "p_classification_id" "uuid", "p_group_id" "uuid", "p_activated_on" "date", "p_classes_start_on" "date", "p_economic_start_on" "date", "p_initial_period_amount" numeric, "p_initial_period_due_date" "date", "p_enrollment_fee_mode" "text", "p_enrollment_fee_amount" numeric, "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resolve_preregistration_to_enrollment"("p_preregistration_id" "uuid", "p_classification_id" "uuid", "p_group_id" "uuid", "p_activated_on" "date", "p_classes_start_on" "date", "p_economic_start_on" "date", "p_initial_period_amount" numeric, "p_initial_period_due_date" "date", "p_enrollment_fee_mode" "text", "p_enrollment_fee_amount" numeric, "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."reverse_credit_application"("p_credit_application_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reverse_credit_application"("p_credit_application_id" "uuid", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."reverse_payment"("p_payment_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reverse_payment"("p_payment_id" "uuid", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."set_base_rate"("p_cycle_id" "uuid", "p_education_level_id" "uuid", "p_financial_concept_id" "uuid", "p_amount" numeric, "p_effective_on" "date", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_base_rate"("p_cycle_id" "uuid", "p_education_level_id" "uuid", "p_financial_concept_id" "uuid", "p_amount" numeric, "p_effective_on" "date", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."set_enrollment_tuition_discount"("p_enrollment_id" "uuid", "p_category_id" "uuid", "p_effective_on" "date", "p_effect_mode" "text", "p_current_period_amount" numeric, "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_enrollment_tuition_discount"("p_enrollment_id" "uuid", "p_category_id" "uuid", "p_effective_on" "date", "p_effect_mode" "text", "p_current_period_amount" numeric, "p_reason" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."set_tuition_discount_category_active"("p_category_id" "uuid", "p_is_active" boolean, "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."student_account_movements"("p_student_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."student_account_movements"("p_student_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."student_account_summary"("p_student_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."student_account_summary"("p_student_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."student_charge_balances"("p_student_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."student_charge_balances"("p_student_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."update_payment_metadata"("p_payment_id" "uuid", "p_patch" "jsonb", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_payment_metadata"("p_payment_id" "uuid", "p_patch" "jsonb", "p_reason" "text") TO "authenticated";



GRANT MAINTAIN ON TABLE "public"."academic_capture_windows" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."academic_capture_windows" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."academic_capture_windows" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."audit_log" TO "anon";
GRANT MAINTAIN ON TABLE "public"."audit_log" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."audit_log" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."base_rates" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."base_rates" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."base_rates" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."benefits" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."benefits" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."benefits" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."charge_adjustments" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."charge_adjustments" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."charge_adjustments" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."charges" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."charges" TO "authenticated";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."charges" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."credit_applications" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."credit_applications" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."credit_applications" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."credits" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."credits" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."credits" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."curriculum_subjects" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."curriculum_subjects" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."curriculum_subjects" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."education_levels" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."education_levels" TO "authenticated";
GRANT SELECT,MAINTAIN ON TABLE "public"."education_levels" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."enrollment_charge_rules" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."enrollment_charge_rules" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."enrollment_charge_rules" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."enrollment_classifications" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."enrollment_classifications" TO "authenticated";
GRANT SELECT,MAINTAIN ON TABLE "public"."enrollment_classifications" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."enrollment_events" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."enrollment_events" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."enrollment_events" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."enrollment_financial_exits" TO "anon";
GRANT MAINTAIN ON TABLE "public"."enrollment_financial_exits" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."enrollment_financial_exits" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."enrollment_financial_plan_assignments" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."enrollment_financial_plan_assignments" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."enrollment_financial_plan_assignments" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."enrollment_tuition_discount_assignments" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."enrollment_tuition_discount_assignments" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."enrollment_tuition_discount_assignments" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."enrollments" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."enrollments" TO "authenticated";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."enrollments" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."evaluation_periods" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."evaluation_periods" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."evaluation_periods" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."family_access" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."family_access" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."family_access" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."family_invitation_students" TO "anon";
GRANT MAINTAIN ON TABLE "public"."family_invitation_students" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."family_invitation_students" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."family_invitations" TO "anon";
GRANT MAINTAIN ON TABLE "public"."family_invitations" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."family_invitations" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."financial_concepts" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."financial_concepts" TO "authenticated";
GRANT SELECT,MAINTAIN ON TABLE "public"."financial_concepts" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."financial_plan_periods" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."financial_plan_periods" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."financial_plan_periods" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."financial_plans" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."financial_plans" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."financial_plans" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."grade_access_entitlements" TO "anon";
GRANT MAINTAIN ON TABLE "public"."grade_access_entitlements" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."grade_access_entitlements" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."grade_levels" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."grade_levels" TO "authenticated";
GRANT SELECT,MAINTAIN ON TABLE "public"."grade_levels" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."group_period_publications" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."group_period_publications" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."group_period_publications" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."group_primary_teacher_assignments" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."group_primary_teacher_assignments" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."group_primary_teacher_assignments" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."groups" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."groups" TO "authenticated";
GRANT SELECT,MAINTAIN ON TABLE "public"."groups" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."guardians" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."guardians" TO "authenticated";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."guardians" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."payment_agreement_charges" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."payment_agreement_charges" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."payment_agreement_charges" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."payment_agreement_installments" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."payment_agreement_installments" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."payment_agreement_installments" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."payment_agreements" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."payment_agreements" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."payment_agreements" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."payment_allocations" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."payment_allocations" TO "authenticated";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."payment_allocations" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."payment_methods" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."payment_methods" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."payment_methods" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."payment_reversals" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."payment_reversals" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."payment_reversals" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."payments" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."payments" TO "authenticated";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."payments" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."permissions" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."permissions" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."permissions" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."preregistration_campaigns" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."preregistration_campaigns" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."preregistration_campaigns" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."preregistrations" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."preregistrations" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."preregistrations" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,MAINTAIN,UPDATE ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."profiles" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."refund_components" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."refund_components" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."refund_components" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."refunds" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."refunds" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."refunds" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."role_permissions" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."role_permissions" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."role_permissions" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."roles" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."roles" TO "authenticated";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."roles" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."school_cycles" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."school_cycles" TO "authenticated";
GRANT SELECT,MAINTAIN ON TABLE "public"."school_cycles" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."staff" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."staff" TO "authenticated";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."staff" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."staff_invitations" TO "anon";
GRANT MAINTAIN ON TABLE "public"."staff_invitations" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."staff_invitations" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."student_evaluation_quantitative_history" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."student_evaluation_quantitative_history" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."student_evaluation_quantitative_history" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."student_evaluations" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."student_evaluations" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."student_evaluations" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."student_financial_agreements" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."student_financial_agreements" TO "authenticated";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."student_financial_agreements" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."student_guardians" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."student_guardians" TO "authenticated";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."student_guardians" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."students" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."students" TO "authenticated";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."students" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."subjects" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."subjects" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."subjects" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."teacher_assignments" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."teacher_assignments" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."teacher_assignments" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."tuition_discount_categories" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."tuition_discount_categories" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."tuition_discount_categories" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."tuition_discount_category_versions" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."tuition_discount_category_versions" TO "authenticated";
GRANT MAINTAIN ON TABLE "public"."tuition_discount_category_versions" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."user_roles" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."user_roles" TO "authenticated";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."user_roles" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT MAINTAIN ON TABLES TO "service_role";







