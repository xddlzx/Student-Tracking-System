
-- Students below Math target over last 5 trials
WITH last5 AS (
  SELECT tr.student_id, tr.id AS trial_result_id, trs.net, ROW_NUMBER() OVER (PARTITION BY tr.student_id ORDER BY tr.entered_at DESC) rn
  FROM trial_result tr
  JOIN trial_result_subject trs ON trs.trial_result_id = tr.id AND trs.subject_code = 'MAT'
)
SELECT s.full_name, s.class_section, AVG(l.net) AS avg_mat_net
FROM last5 l
JOIN student s ON s.id = l.student_id
WHERE l.rn <= 5
GROUP BY s.id
HAVING AVG(l.net) < 10
ORDER BY avg_mat_net ASC;

-- Workbook progress overview per class
SELECT s.class_section, COUNT(*) AS student_count, AVG(sw.progress_percent) AS avg_progress
FROM student_workbook sw
JOIN student s ON s.id = sw.student_id
GROUP BY s.class_section
ORDER BY s.class_section;
