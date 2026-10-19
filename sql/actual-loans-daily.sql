WITH dates AS (
    SELECT generate_series(CURRENT_DATE - INTERVAL '60 day', CURRENT_DATE - INTERVAL '1 day', INTERVAL '1 day')::DATE AS loan_date
), actual AS (
    SELECT CAST(created_time AS DATE) AS loan_date,
           COUNT(DISTINCT order_id) AS actual_loan_order_cnt
    FROM ods.ods_t_payment_order_mif
    WHERE is_delete = 'N'
      AND created_time >= CURRENT_DATE - INTERVAL '60 day'
      AND created_time < CURRENT_DATE
    GROUP BY 1
)
SELECT JSON_AGG(JSON_BUILD_OBJECT('loan_date', d.loan_date, 'actual_loan_order_cnt', COALESCE(a.actual_loan_order_cnt, 0)) ORDER BY d.loan_date)::TEXT AS daily_counts
FROM dates d LEFT JOIN actual a ON a.loan_date = d.loan_date;
