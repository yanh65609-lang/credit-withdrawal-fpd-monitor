WITH params AS (
    SELECT CAST(CURRENT_DATE - INTERVAL '60 day' AS DATE) AS start_date,
           CAST(CURRENT_DATE AS DATE) AS end_date
), credit_history_ranked AS (
    SELECT ca.id,ca.apply_id,
           ROW_NUMBER() OVER(PARTITION BY ca.user_id ORDER BY ca.created_time ASC,ca.id ASC) AS credit_rn
    FROM ods.ods_t_credit_apply_mif ca
), payment_order_base AS (
    SELECT po.order_id,CAST(po.loan_amt AS NUMERIC(38,6)) AS actual_loan_amt
    FROM ods.ods_t_payment_order_mif po
    WHERE po.is_delete='N'
), fpd_credit_base AS (
    SELECT f.order_id,f.user_id,f.credit_id,f.loan_date,f.is_first_order AS loan_type,
           CASE WHEN chr.credit_rn=1 THEN '01_首次授信' WHEN chr.credit_rn IS NOT NULL THEN '02_非首次授信' ELSE '00_未知' END AS credit_type,
           COALESCE(NULLIF(NULLIF(TRIM(f.risk_level),''),'\N'),'UNKNOWN') AS risk_level,
           COALESCE(NULLIF(TRIM(f.sub_product_type),''),'UNKNOWN') AS product,
           ca.pass_time AS credit_pass_time,
           CASE WHEN LOWER(TRIM(f.platform))='android' THEN 'Android' WHEN LOWER(TRIM(f.platform))='ios' THEN 'iOS' ELSE '未知' END AS platform,
           CAST(f.credit_amt AS NUMERIC(38,6)) AS credit_limit,po.actual_loan_amt,
           COALESCE(f.agr_fpd0,0) AS agr_fpd0,COALESCE(f.def_fpd0,0) AS def_fpd0,
           CAST(COALESCE(f.agr_fpd0_amt,0) AS NUMERIC(38,6)) AS agr_fpd0_amt,
           CAST(COALESCE(f.def_fpd0_amt,0) AS NUMERIC(38,6)) AS def_fpd0_amt,
           COALESCE(f.agr_fpd10,0) AS agr_fpd10,COALESCE(f.def_fpd10,0) AS def_fpd10,
           CAST(COALESCE(f.agr_fpd10_amt,0) AS NUMERIC(38,6)) AS agr_fpd10_amt,
           CAST(COALESCE(f.def_fpd10_amt,0) AS NUMERIC(38,6)) AS def_fpd10_amt
    FROM dwd.dwd_t_idn_indonesia_kreditok_fstqpd_df f
    CROSS JOIN params p
    LEFT JOIN payment_order_base po ON po.order_id::TEXT=f.order_id::TEXT
    LEFT JOIN ods.ods_t_credit_apply_mif ca ON ca.apply_id::TEXT=f.credit_id::TEXT
    LEFT JOIN credit_history_ranked chr ON chr.id=ca.id
    WHERE f.loan_date>=p.start_date AND f.loan_date<p.end_date
      AND f.is_first_order IN ('首借','复借')
), app_version_ranked AS (
    SELECT fb.order_id,NULLIF(TRIM(rc.app_version),'') AS app_version,
           ROW_NUMBER() OVER(PARTITION BY fb.order_id ORDER BY rc.created_time DESC,rc.id DESC) AS rn
    FROM fpd_credit_base fb
    LEFT JOIN ods.ods_t_user_request_common_info_df rc
      ON rc.user_id::TEXT=fb.user_id::TEXT
     AND rc.deleted_flag='0'
     AND NULLIF(TRIM(rc.app_version),'') IS NOT NULL
     AND rc.created_time<=fb.credit_pass_time
), fpd_base AS (
    SELECT fb.order_id,fb.user_id,fb.credit_id,fb.loan_date,fb.loan_type,fb.credit_type,fb.risk_level,fb.product,
           COALESCE(av.app_version,'UNKNOWN') AS app_version,fb.platform,fb.credit_limit,fb.actual_loan_amt,
           fb.agr_fpd0,fb.def_fpd0,fb.agr_fpd0_amt,fb.def_fpd0_amt,
           fb.agr_fpd10,fb.def_fpd10,fb.agr_fpd10_amt,fb.def_fpd10_amt
    FROM fpd_credit_base fb
    LEFT JOIN app_version_ranked av ON av.order_id=fb.order_id AND av.rn=1
), media_dim AS (
    SELECT ci.user_id,CASE WHEN MAX(NULLIF(TRIM(ci.media_source),'')) IS NULL THEN '空值'
      WHEN LOWER(MAX(NULLIF(TRIM(ci.media_source),''))) LIKE '%facebook%' THEN 'Facebook'
      WHEN LOWER(MAX(NULLIF(TRIM(ci.media_source),''))) LIKE '%organic%' THEN 'Organic'
      WHEN LOWER(MAX(NULLIF(TRIM(ci.media_source),''))) LIKE '%google%' THEN 'Google'
      WHEN LOWER(MAX(NULLIF(TRIM(ci.media_source),''))) LIKE '%tiktok%' THEN 'Tiktok'
      WHEN LOWER(MAX(NULLIF(TRIM(ci.media_source),''))) LIKE '%apple%' THEN 'ASA' ELSE '其他' END AS media
    FROM ods.ods_t_channel_info_mif ci JOIN (SELECT DISTINCT user_id FROM fpd_base) u ON u.user_id::TEXT=ci.user_id::TEXT
    GROUP BY ci.user_id
), detail AS (
    SELECT fb.loan_date,fb.order_id,fb.user_id,fb.loan_type,fb.credit_type,fb.risk_level,fb.product,fb.app_version,
           fb.platform,COALESCE(md.media,'空值') AS media,
           CASE WHEN fb.credit_limit IS NULL OR fb.credit_limit<=0 THEN '00_额度缺失'
                WHEN fb.actual_loan_amt<fb.credit_limit THEN '01_100%以下' ELSE '02_100%及以上' END AS loan_utilization_bucket,
           fb.credit_limit,fb.actual_loan_amt,fb.agr_fpd0,fb.def_fpd0,fb.agr_fpd0_amt,fb.def_fpd0_amt,
           fb.agr_fpd10,fb.def_fpd10,fb.agr_fpd10_amt,fb.def_fpd10_amt
    FROM fpd_base fb LEFT JOIN media_dim md ON md.user_id::TEXT=fb.user_id::TEXT
)
SELECT loan_date,loan_type,credit_type,risk_level,product,app_version,platform,media,loan_utilization_bucket,
       COUNT(DISTINCT order_id) AS loan_order_cnt,COUNT(DISTINCT user_id) AS loan_customer_cnt,
       SUM(COALESCE(actual_loan_amt,0)) AS loan_amt_sum,SUM(COALESCE(credit_limit,0)) AS credit_limit_sum,
       SUM(def_fpd0) AS fpd0_numerator,SUM(agr_fpd0) AS fpd0_denominator,
       SUM(def_fpd0_amt) AS fpd0_amt_numerator,SUM(agr_fpd0_amt) AS fpd0_amt_denominator,
       SUM(def_fpd10) AS fpd10_numerator,SUM(agr_fpd10) AS fpd10_denominator,
       SUM(def_fpd10_amt) AS fpd10_amt_numerator,SUM(agr_fpd10_amt) AS fpd10_amt_denominator
FROM detail
GROUP BY loan_date,loan_type,credit_type,risk_level,product,app_version,platform,media,loan_utilization_bucket;
