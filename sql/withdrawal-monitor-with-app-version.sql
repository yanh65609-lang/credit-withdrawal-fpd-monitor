WITH params AS (
    SELECT CAST(CURRENT_DATE - INTERVAL '60 day' AS TIMESTAMP) AS start_time,
           CAST(CURRENT_DATE AS TIMESTAMP) AS end_time
), credit_history_ranked AS (
    SELECT ca.id,
           ROW_NUMBER() OVER(PARTITION BY ca.user_id ORDER BY ca.created_time ASC,ca.id ASC) AS credit_rn
    FROM ods.ods_t_credit_apply_mif ca
), credit_ranked AS (
    SELECT ca.id,ca.user_id,ca.pass_time AS credit_pass_time,CAST(ca.pass_time AS DATE) AS credit_pass_date,
           CAST(ca.loan_amt AS NUMERIC(38,6)) AS credit_limit,
           CASE WHEN chr.credit_rn=1 THEN '01_首次授信' ELSE '02_非首次授信' END AS credit_type,
           CASE WHEN ca.credit_level IN ('RG1','L1') THEN 'RG1' WHEN ca.credit_level IN ('RG2','L2') THEN 'RG2'
                WHEN ca.credit_level IN ('RG3','L3') THEN 'RG3' WHEN ca.credit_level IN ('RG4','L4-1') THEN 'RG4'
                WHEN ca.credit_level IN ('RG4-2','L4-2') THEN 'RG4-2' WHEN ca.credit_level IN ('RG5','L5') THEN 'RG5'
                ELSE COALESCE(NULLIF(TRIM(ca.credit_level),''),'UNKNOWN') END AS risk_level,
           COALESCE(NULLIF(TRIM(ca.sub_product_type),''),'UNKNOWN') AS product,
           ROW_NUMBER() OVER(PARTITION BY ca.user_id,CAST(ca.pass_time AS DATE) ORDER BY ca.pass_time DESC,ca.id DESC) AS rn
    FROM ods.ods_t_credit_apply_mif ca
    JOIN credit_history_ranked chr ON chr.id=ca.id
    CROSS JOIN params p
    WHERE ca.state='06' AND ca.pass_time>=p.start_time AND ca.pass_time<p.end_time
), credit_base AS (
    SELECT id,user_id,credit_pass_time,credit_pass_date,credit_limit,credit_type,risk_level,product
    FROM credit_ranked WHERE rn=1
), app_version_ranked AS (
    SELECT cb.id,NULLIF(TRIM(rc.app_version),'') AS app_version,
           ROW_NUMBER() OVER(PARTITION BY cb.id ORDER BY rc.created_time DESC,rc.id DESC) AS rn
    FROM credit_base cb
    LEFT JOIN ods.ods_t_user_request_common_info_df rc
      ON rc.user_id=cb.user_id
     AND rc.deleted_flag='0'
     AND NULLIF(TRIM(rc.app_version),'') IS NOT NULL
     AND rc.created_time<=cb.credit_pass_time
), credit_bounded AS (
    SELECT cb.*,
           COALESCE(av.app_version,'UNKNOWN') AS app_version,
           LEAD(cb.credit_pass_time) OVER(PARTITION BY cb.user_id ORDER BY cb.credit_pass_time,cb.id) AS next_credit_pass_time
    FROM credit_base cb
    LEFT JOIN app_version_ranked av ON av.id=cb.id AND av.rn=1
), withdraw_ranked AS (
    SELECT cb.credit_pass_date,cb.user_id,poa.order_id,poa.created_time AS withdraw_apply_time,
           CAST(poa.loan_amt AS NUMERIC(38,6)) AS withdraw_apply_amt,
           ROW_NUMBER() OVER(PARTITION BY cb.credit_pass_date,cb.user_id ORDER BY poa.created_time,poa.id) AS rn
    FROM credit_bounded cb JOIN dwd.dwd_t_payment_order_apply_new_df poa
      ON poa.user_id=cb.user_id AND poa.created_time>=cb.credit_pass_time
     AND poa.created_time<cb.credit_pass_time+INTERVAL '7 day'
     AND (cb.next_credit_pass_time IS NULL OR poa.created_time<cb.next_credit_pass_time)
     AND poa.state NOT IN ('1','WAIT_SIGN_CONTRACT','DAILY_LOAN_LIMIT_REFUSE')
), first_withdraw AS (
    SELECT credit_pass_date,user_id,order_id,withdraw_apply_time,withdraw_apply_amt FROM withdraw_ranked WHERE rn=1
), payment_order_base AS (
    SELECT o.order_id,MAX(CAST(o.loan_amt AS NUMERIC(38,6))) AS actual_loan_amt
    FROM ods.ods_t_payment_order_mif o
    WHERE o.is_delete='N'
    GROUP BY o.order_id
), media_dim AS (
    SELECT ci.user_id,CASE WHEN MAX(NULLIF(TRIM(ci.media_source),'')) IS NULL THEN '空值'
      WHEN LOWER(MAX(NULLIF(TRIM(ci.media_source),''))) LIKE '%facebook%' THEN 'Facebook'
      WHEN LOWER(MAX(NULLIF(TRIM(ci.media_source),''))) LIKE '%organic%' THEN 'Organic'
      WHEN LOWER(MAX(NULLIF(TRIM(ci.media_source),''))) LIKE '%google%' THEN 'Google'
      WHEN LOWER(MAX(NULLIF(TRIM(ci.media_source),''))) LIKE '%tiktok%' THEN 'Tiktok'
      WHEN LOWER(MAX(NULLIF(TRIM(ci.media_source),''))) LIKE '%apple%' THEN 'ASA' ELSE '其他' END AS media
    FROM ods.ods_t_channel_info_mif ci JOIN (SELECT DISTINCT user_id FROM credit_base) u ON u.user_id=ci.user_id GROUP BY ci.user_id
), platform_dim AS (
    SELECT p.user_id,CASE WHEN LOWER(TRIM(MAX(p.platform)))='android' THEN 'Android'
      WHEN LOWER(TRIM(MAX(p.platform)))='ios' THEN 'iOS' ELSE '未知' END AS platform
    FROM dwd.dwd_t_user_platform_map_hf p JOIN (SELECT DISTINCT user_id FROM credit_base) u ON u.user_id=p.user_id GROUP BY p.user_id
), detail AS (
    SELECT cb.credit_pass_date,cb.user_id,cb.credit_type,cb.risk_level,cb.product,cb.app_version,
           COALESCE(pd.platform,'未知') AS platform,COALESCE(md.media,'空值') AS media,
           CASE WHEN cb.credit_limit IS NULL OR cb.credit_limit=0 THEN '00_无额度/异常'
                WHEN cb.credit_limit=300000 THEN '01_30万' WHEN cb.credit_limit=400000 THEN '02_40万'
                WHEN cb.credit_limit=500000 THEN '03_50万' WHEN cb.credit_limit=600000 THEN '04_60万'
                WHEN cb.credit_limit=800000 THEN '05_80万' WHEN cb.credit_limit=1000000 THEN '06_100万'
                WHEN cb.credit_limit=1200000 THEN '07_120万' WHEN cb.credit_limit=1500000 THEN '08_150万'
                WHEN cb.credit_limit=1800000 THEN '09_180万' WHEN cb.credit_limit>=2000000 THEN '10_200万及以上'
                ELSE '99_其他额度' END AS credit_limit_bucket,
           CASE WHEN fw.withdraw_apply_time<DATE_TRUNC('day',cb.credit_pass_time)+INTERVAL '1 day'
                     AND cb.credit_limit>0 AND fw.withdraw_apply_amt<cb.credit_limit THEN '01_100%以下'
                WHEN fw.withdraw_apply_time<DATE_TRUNC('day',cb.credit_pass_time)+INTERVAL '1 day'
                     AND cb.credit_limit>0 THEN '02_100%及以上' END AS t0_utilization_bucket,
           CASE WHEN fw.withdraw_apply_time<DATE_TRUNC('day',cb.credit_pass_time)+INTERVAL '1 day' THEN 1 ELSE 0 END AS t0_num,
           CASE WHEN cb.credit_pass_time+INTERVAL '7 day'<=CURRENT_TIMESTAMP AND fw.withdraw_apply_time IS NOT NULL THEN 1 ELSE 0 END AS t7_num,
           CASE WHEN cb.credit_pass_time+INTERVAL '7 day'<=CURRENT_TIMESTAMP THEN 1 ELSE 0 END AS t7_den,
           CASE WHEN fw.withdraw_apply_time<DATE_TRUNC('day',cb.credit_pass_time)+INTERVAL '1 day' THEN fw.withdraw_apply_amt ELSE 0 END AS util_num,
           CASE WHEN fw.withdraw_apply_time<DATE_TRUNC('day',cb.credit_pass_time)+INTERVAL '1 day' THEN cb.credit_limit ELSE 0 END AS util_den,
           CASE WHEN fw.withdraw_apply_time<DATE_TRUNC('day',cb.credit_pass_time)+INTERVAL '1 day' AND po.order_id IS NOT NULL THEN po.actual_loan_amt ELSE 0 END AS t0_loan_amt,
           CASE WHEN fw.withdraw_apply_time<DATE_TRUNC('day',cb.credit_pass_time)+INTERVAL '1 day' AND po.order_id IS NOT NULL THEN 1 ELSE 0 END AS t0_loan_customer_num,
           cb.credit_limit AS credit_limit_amt
    FROM credit_bounded cb
    LEFT JOIN first_withdraw fw ON fw.credit_pass_date=cb.credit_pass_date AND fw.user_id=cb.user_id
    LEFT JOIN payment_order_base po ON po.order_id::TEXT=fw.order_id::TEXT
    LEFT JOIN media_dim md ON md.user_id=cb.user_id
    LEFT JOIN platform_dim pd ON pd.user_id=cb.user_id
)
SELECT credit_pass_date,credit_type,risk_level,product,app_version,platform,media,credit_limit_bucket,t0_utilization_bucket,
       COUNT(*) AS credit_pass_customer_cnt,SUM(t0_num) AS t0_withdraw_numerator,COUNT(*) AS t0_withdraw_denominator,
       SUM(t7_num) AS t7_withdraw_numerator,SUM(t7_den) AS t7_withdraw_denominator,
       SUM(util_num) AS t0_withdraw_utilization_numerator,SUM(util_den) AS t0_withdraw_utilization_denominator,
       SUM(t0_loan_amt) AS t0_loan_amt_sum,SUM(t0_loan_customer_num) AS t0_loan_customer_cnt,
       SUM(credit_limit_amt) AS credit_pass_limit_amt_sum
FROM detail
GROUP BY credit_pass_date,credit_type,risk_level,product,app_version,platform,media,credit_limit_bucket,t0_utilization_bucket;
