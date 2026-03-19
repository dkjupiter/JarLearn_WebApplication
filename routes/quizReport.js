// const db = require("../db");

// module.exports = (socket) => {

//   socket.on("get_quiz_report", async ({ activitySessionId }) => {
//     try {

//       /* ================= Student × Question ================= */
//       const studentRes = await db.query(`
//       WITH student_question AS (
//         SELECT
//           qa."Student_ID",
//           qa."Question_ID",
//           CASE
//             WHEN COUNT(*) = (
//               SELECT COUNT(*)
//               FROM "Question_Correct_Options"
//               WHERE "Question_ID" = qa."Question_ID"
//             )
//             AND BOOL_AND(
//               qa."Choice_ID" IN (
//                 SELECT "Option_ID"
//                 FROM "Question_Correct_Options"
//                 WHERE "Question_ID" = qa."Question_ID"
//               )
//             )
//             THEN 1 ELSE 0
//           END AS is_correct
//         FROM "QuizAnswers" qa
//         WHERE qa."ActivitySession_ID" = $1
//         GROUP BY qa."Student_ID", qa."Question_ID"
//       )

//       SELECT
//         sq."Student_ID",
//         s."Student_Number",
//         sq."Question_ID",
//         sq.is_correct
//       FROM student_question sq
//       JOIN "Students" s
//         ON s."Student_ID" = sq."Student_ID"
//       ORDER BY sq."Student_ID", sq."Question_ID"
//     `, [activitySessionId]);



//       /* ================= Overall ================= */

//       const overallRes = await db.query(`
//       SELECT
//         ROUND(AVG(qr."Total_Time_Taken")) AS avg_time,
//         COUNT(DISTINCT qr."Student_ID") AS total_student
//       FROM "QuizResults" qr
//       WHERE qr."ActivitySession_ID" = $1
//     `, [activitySessionId]);



//       /* ================= Ranking ================= */

//       const scoreRes = await db.query(`
//       SELECT
//         qr."Student_ID",
//         s."Student_Number",
//         qr."Total_Score"
//       FROM "QuizResults" qr
//       JOIN "Students" s
//         ON s."Student_ID" = qr."Student_ID"
//       WHERE qr."ActivitySession_ID" = $1
//       ORDER BY qr."Total_Score" DESC
//     `, [activitySessionId]);



//       /* ================= Each Question ================= */

//       const questionRes = await db.query(`
//       WITH student_question AS (
//         SELECT
//           qa."Student_ID",
//           qa."Question_ID",
//           CASE
//             WHEN COUNT(*) = (
//               SELECT COUNT(*)
//               FROM "Question_Correct_Options"
//               WHERE "Question_ID" = qa."Question_ID"
//             )
//             AND BOOL_AND(
//               qa."Choice_ID" IN (
//                 SELECT "Option_ID"
//                 FROM "Question_Correct_Options"
//                 WHERE "Question_ID" = qa."Question_ID"
//               )
//             )
//             THEN 1 ELSE 0
//           END AS is_correct
//         FROM "QuizAnswers" qa
//         WHERE qa."ActivitySession_ID" = $1
//         GROUP BY qa."Student_ID", qa."Question_ID"
//       )

//       SELECT
//         q."Question_ID",
//         q."Question_Text",
//         ROUND(AVG(sq.is_correct) * 100) AS correct_percent
//       FROM student_question sq
//       JOIN "Questions" q
//         ON q."Question_ID" = sq."Question_ID"
//       GROUP BY q."Question_ID", q."Question_Text"
//       ORDER BY q."Question_ID"
//     `, [activitySessionId]);

//       /* ================= Option Analysis (Distractor) ================= */

//       const answerRes = await db.query(`
//   SELECT
//   q."Question_ID",
//   q."Question_Text",
//   o."Option_ID",
//   o."Option_Text",

//   CASE
//     WHEN o."Option_ID" IN (
//       SELECT "Option_ID"
//       FROM "Question_Correct_Options"
//       WHERE "Question_ID" = q."Question_ID"
//     )
//     THEN true
//     ELSE false
//   END AS is_correct,

//   COUNT(qa."Choice_ID") AS selected_count

// FROM "ActivitySessions" asn

// JOIN "AssignedQuiz" aq
//   ON aq."ActivitySession_ID" = asn."ActivitySession_ID"

// JOIN "QuestionSets" qs
//   ON qs."Set_ID" = aq."Quiz_ID"

// JOIN "Questions" q
//   ON q."Set_ID" = qs."Set_ID"

// JOIN "QuestionOptions" o
//   ON o."Question_ID" = q."Question_ID"

// LEFT JOIN "QuizAnswers" qa
//   ON qa."Choice_ID" = o."Option_ID"
//   AND qa."ActivitySession_ID" = asn."ActivitySession_ID"

// WHERE asn."ActivitySession_ID" = $1

// GROUP BY
//   q."Question_ID",
//   q."Question_Text",
//   o."Option_ID",
//   o."Option_Text"

// ORDER BY
//   q."Question_ID",
//   o."Option_ID"
// `, [activitySessionId]);



//       socket.emit("quiz_report_data", {
//         overall: {
//           avgTime: Number(overallRes.rows[0]?.avg_time ?? 0),
//           totalStudent: Number(overallRes.rows[0]?.total_student ?? 0)
//         },
//         student: studentRes.rows,
//         scores: scoreRes.rows,
//         eachQuestion: questionRes.rows,

//         answerAnalytics: answerRes.rows
//       });

//     } catch (err) {
//       console.error("❌ get_quiz_report error:", err);
//       socket.emit("quiz_report_data", null);
//     }
//   });

//   socket.on("get_finished_quiz_sessions", async ({ classId }) => {
//     try {

//       const res = await db.query(`
//           SELECT
//       asn."ActivitySession_ID",
//       qs."Title" AS quiz_name,
//       asn."Ended_At",
//       COUNT(DISTINCT qa."Student_ID") AS student_count

//     FROM "ActivitySessions" asn

//     JOIN "AssignedQuiz" aq
//       ON aq."ActivitySession_ID" = asn."ActivitySession_ID"

//     LEFT JOIN "QuestionSets" qs
//       ON qs."Set_ID" = aq."Quiz_ID"

//     LEFT JOIN "QuizAnswers" qa
//       ON qa."ActivitySession_ID" = asn."ActivitySession_ID"

//     WHERE asn."Class_ID" = $1
//       AND asn."Status" = 'finished'

//     GROUP BY
//       asn."ActivitySession_ID",
//       qs."Title",
//       asn."Ended_At"

//     ORDER BY asn."Ended_At" DESC;

//     `, [classId]);

//       socket.emit("finished_quiz_sessions_data", res.rows);
//     } catch (err) {
//       console.error("❌ get_finished_quiz_sessions error:", err);
//       socket.emit("finished_quiz_sessions_data", []);
//     }
//   });

//   /* =====================================================
//      2️⃣ REPORT ระดับคลาส (ALL QUIZ COMBINED)
//   ===================================================== */
//   socket.on("get_class_report", async ({ classId }) => {
//     try {
//       /* ================= Total Students ================= */
//       const studentRes = await db.query(`
//         SELECT COUNT(*) AS total_student
//         FROM "Students"
//         WHERE "Class_ID" = $1
//       `, [classId]);

//       const totalStudent = Number(studentRes.rows[0]?.total_student ?? 0);

//       /* ================= Total Quiz Sessions ================= */
//       const quizRes = await db.query(`
//         SELECT COUNT(*) AS total_quiz
//         FROM "ActivitySessions"
//         WHERE "Class_ID" = $1
//           AND "Status" = 'finished'
//       `, [classId]);

//       const totalQuiz = Number(quizRes.rows[0]?.total_quiz ?? 0);

//       /* ================= Average Accuracy ================= */
//       const avgRes = await db.query(`
//         SELECT
//           ROUND(
//             AVG(
//               CASE
//                 WHEN qr."Total_Question" = 0 THEN 0
//                 ELSE qr."Total_Correct" * 100.0 / qr."Total_Question"
//               END
//             )
//           ) AS avg_accuracy,
//           ROUND(AVG(qr."Total_Time_Taken")) AS avg_time
//         FROM "QuizResults" qr
//         JOIN "ActivitySessions" asn
//           ON asn."ActivitySession_ID" = qr."ActivitySession_ID"
//         WHERE asn."Class_ID" = $1
//           AND asn."Status" = 'finished'
//       `, [classId]);

//       const avgAccuracy = Number(avgRes.rows[0]?.avg_accuracy ?? 0);
//       const avgTime = Number(avgRes.rows[0]?.avg_time ?? 0);

//       /* ================= Completion ================= */
//       const doneRes = await db.query(`
//         WITH total_quiz AS (
//           SELECT COUNT(*) AS quiz_count
//           FROM "ActivitySessions"
//           WHERE "Class_ID" = $1
//             AND "Status" = 'finished'
//         ),
//         student_done AS (
//           SELECT
//             qr."Student_ID",
//             COUNT(DISTINCT qr."ActivitySession_ID") AS done_count
//           FROM "QuizResults" qr
//           JOIN "ActivitySessions" asn
//             ON asn."ActivitySession_ID" = qr."ActivitySession_ID"
//           WHERE asn."Class_ID" = $1
//             AND asn."Status" = 'finished'
//           GROUP BY qr."Student_ID"
//         )
//         SELECT COUNT(*) AS done_student
//         FROM student_done, total_quiz
//         WHERE student_done.done_count = total_quiz.quiz_count
//       `, [classId]);

//       const doneStudent = Number(doneRes.rows[0]?.done_student ?? 0);
//       const alreadyDonePercent =
//         totalStudent === 0
//           ? 0
//           : Math.round((doneStudent / totalStudent) * 100);

//       /* ================= Each Quiz ================= */
//       const eachQuizRes = await db.query(`
//         WITH student_question AS (
//   SELECT
//     qa."Student_ID",
//     qa."Question_ID",
//     qa."ActivitySession_ID",
//     CASE
//       WHEN COUNT(*) = (
//         SELECT COUNT(*)
//         FROM "Question_Correct_Options"
//         WHERE "Question_ID" = qa."Question_ID"
//       )
//       AND BOOL_AND(
//         qa."Choice_ID" IN (
//           SELECT "Option_ID"
//           FROM "Question_Correct_Options"
//           WHERE "Question_ID" = qa."Question_ID"
//         )
//       )
//       THEN 1 ELSE 0
//     END AS is_correct
//   FROM "QuizAnswers" qa
//   GROUP BY qa."Student_ID", qa."Question_ID", qa."ActivitySession_ID"
// )

// SELECT
//   asn."ActivitySession_ID",
//   qs."Title",
//   ROUND(AVG(is_correct) * 100) AS avg_accuracy
// FROM student_question sq
// JOIN "ActivitySessions" asn
//   ON asn."ActivitySession_ID" = sq."ActivitySession_ID"
// JOIN "AssignedQuiz" aq
//   ON aq."ActivitySession_ID" = asn."ActivitySession_ID"
// JOIN "QuestionSets" qs
//   ON qs."Set_ID" = aq."Quiz_ID"
// WHERE asn."Class_ID" = $1
// GROUP BY asn."ActivitySession_ID", qs."Title"
//         ORDER BY asn."Ended_At"
//       `, [classId]);

//       /* ================= 🥇 Top Students ================= */
//       const topRes = await db.query(`
//         SELECT
//           s."Student_ID",
//           s."Student_Number",
//           ROUND(AVG(
//             CASE
//               WHEN qr."Total_Question" = 0 THEN 0
//               ELSE qr."Total_Correct" * 100.0 / qr."Total_Question"
//             END
//           )) AS avg_score
//         FROM "QuizResults" qr
//         JOIN "Students" s ON s."Student_ID" = qr."Student_ID"
//         JOIN "ActivitySessions" asn
//           ON asn."ActivitySession_ID" = qr."ActivitySession_ID"
//         WHERE asn."Class_ID" = $1
//           AND asn."Status" = 'finished'
//         GROUP BY s."Student_ID", s."Student_Number"
//         ORDER BY avg_score DESC
//         LIMIT 3
//       `, [classId]);

//       /* ================= ⚠️ Needs Attention ================= */
//       const attentionRes = await db.query(`
//         SELECT
//           s."Student_ID",
//           s."Student_Number",
//           ROUND(AVG(
//             CASE
//               WHEN qr."Total_Question" = 0 THEN 0
//               ELSE qr."Total_Correct" * 100.0 / qr."Total_Question"
//             END
//           )) AS avg_score
//         FROM "QuizResults" qr
//         JOIN "Students" s ON s."Student_ID" = qr."Student_ID"
//         JOIN "ActivitySessions" asn
//           ON asn."ActivitySession_ID" = qr."ActivitySession_ID"
//         WHERE asn."Class_ID" = $1
//           AND asn."Status" = 'finished'
//         GROUP BY s."Student_ID", s."Student_Number"
//         HAVING ROUND(AVG(
//           CASE
//             WHEN qr."Total_Question" = 0 THEN 0
//             ELSE qr."Total_Correct" * 100.0 / qr."Total_Question"
//           END
//         )) < 50
//         ORDER BY avg_score ASC
//         LIMIT 5
//       `, [classId]);

//       /* ================= Emit ================= */
//       socket.emit("class_report_data", {
//         overall: {
//           totalStudent,
//           totalQuiz,
//           avgAccuracy,
//           avgTime,
//           alreadyDone: doneStudent,
//           alreadyDonePercent
//         },
//         eachQuiz: eachQuizRes.rows,
//         topStudents: topRes.rows,
//         needsAttention: attentionRes.rows
//       });

//     } catch (err) {
//       console.error("❌ get_class_report error:", err);
//       socket.emit("class_report_data", null);
//     }
//   });

//   /* =====================================================
//      📁 EXPORT CSV (placeholder)
//   ===================================================== */
//   //   socket.on("export_class_report_csv", async ({ classId }) => {


//   //     try {
//   //       const res = await db.query(`
//   //         WITH quiz_scores AS (

//   // SELECT
//   // s."Student_Number",
//   // qs."Title" AS quiz_title,
//   // ROUND(
//   // CASE
//   // WHEN qr."Total_Question" = 0 THEN 0
//   // ELSE qr."Total_Correct" * 100.0 / qr."Total_Question"
//   // END
//   // ) AS score

//   // FROM "QuizResults" qr

//   // JOIN "Students" s
//   // ON s."Student_ID" = qr."Student_ID"

//   // JOIN "ActivitySessions" asn
//   // ON asn."ActivitySession_ID" = qr."ActivitySession_ID"

//   // JOIN "AssignedQuiz" aq
//   // ON aq."ActivitySession_ID" = asn."ActivitySession_ID"

//   // JOIN "QuestionSets" qs
//   // ON qs."Set_ID" = aq."Quiz_ID"

//   // WHERE asn."Class_ID" = $1
//   // AND asn."Status" = 'finished'

//   // )

//   // SELECT *
//   // FROM quiz_scores
//   // ORDER BY "Student_Number"
//   //       `, [classId]);

//   //       socket.emit("export_class_report_csv_data", res.rows);

//   //     } catch (err) {
//   //       console.error("❌ export_class_report_csv error:", err);
//   //     }
//   //   });

//   /* =====================================================
//    📁 EXPORT CLASS REPORT (ALL QUIZ)
// ===================================================== */

//   socket.on("export_class_report_csv", async ({ classId }) => {
//     try {

//       /* ================= Students × Quiz Scores ================= */

//       const scoreRes = await db.query(`
//       SELECT
//         s."Student_ID",
//         s."Student_Number",
//         asn."ActivitySession_ID",
//         qs."Title" AS quiz_title,

//         qr."Total_Correct" AS correct,
//         qr."Total_Question" AS total_question
//       FROM "QuizResults" qr

//       JOIN "Students" s
//         ON s."Student_ID" = qr."Student_ID"

//       JOIN "ActivitySessions" asn
//         ON asn."ActivitySession_ID" = qr."ActivitySession_ID"

//       JOIN "AssignedQuiz" aq
//         ON aq."ActivitySession_ID" = asn."ActivitySession_ID"

//       JOIN "QuestionSets" qs
//         ON qs."Set_ID" = aq."Quiz_ID"

//       WHERE asn."Class_ID" = $1
//         AND asn."Status" = 'finished'

//       ORDER BY s."Student_Number"
//     `, [classId]);


//       /* ================= Quiz Summary ================= */

//       const quizSummaryRes = await db.query(`
//       SELECT
//         asn."ActivitySession_ID",
//         qs."Title" AS quiz_title,
//         COUNT(DISTINCT qr."Student_ID") AS student_count,

//         ROUND(
//           AVG(
//             CASE
//               WHEN qr."Total_Question" = 0 THEN 0
//               ELSE qr."Total_Correct" * 100.0 / qr."Total_Question"
//             END
//           )
//         ) AS avg_score

//       FROM "QuizResults" qr

//       JOIN "ActivitySessions" asn
//         ON asn."ActivitySession_ID" = qr."ActivitySession_ID"

//       JOIN "AssignedQuiz" aq
//         ON aq."ActivitySession_ID" = asn."ActivitySession_ID"

//       JOIN "QuestionSets" qs
//         ON qs."Set_ID" = aq."Quiz_ID"

//       WHERE asn."Class_ID" = $1
//         AND asn."Status" = 'finished'

//       GROUP BY asn."ActivitySession_ID", qs."Title"
//       ORDER BY asn."Ended_At"
//     `, [classId]);


//       /* ================= All Quiz Question Analysis ================= */

//       const answerRes = await db.query(`
//       SELECT
//         asn."ActivitySession_ID",
//         qs."Title" AS quiz_title,

//         q."Question_ID",
//         q."Question_Text",

//         o."Option_ID",
//         o."Option_Text",

//         CASE
//           WHEN o."Option_ID" IN (
//             SELECT "Option_ID"
//             FROM "Question_Correct_Options"
//             WHERE "Question_ID" = q."Question_ID"
//           )
//           THEN true
//           ELSE false
//         END AS is_correct,

//         COUNT(qa."Choice_ID") AS selected_count

//       FROM "ActivitySessions" asn

//       JOIN "AssignedQuiz" aq
//         ON aq."ActivitySession_ID" = asn."ActivitySession_ID"

//       JOIN "QuestionSets" qs
//         ON qs."Set_ID" = aq."Quiz_ID"

//       JOIN "Questions" q
//         ON q."Set_ID" = qs."Set_ID"

//       JOIN "QuestionOptions" o
//         ON o."Question_ID" = q."Question_ID"

//       LEFT JOIN "QuizAnswers" qa
//         ON qa."Choice_ID" = o."Option_ID"
//         AND qa."ActivitySession_ID" = asn."ActivitySession_ID"

//       WHERE asn."Class_ID" = $1
//         AND asn."Status" = 'finished'

//       GROUP BY
//         asn."ActivitySession_ID",
//         qs."Title",
//         q."Question_ID",
//         q."Question_Text",
//         o."Option_ID",
//         o."Option_Text"

//       ORDER BY
//         asn."ActivitySession_ID",
//         q."Question_ID",
//         o."Option_ID"
//     `, [classId]);


//       /* ================= Overall ================= */

//       const overallRes = await db.query(`
//       SELECT
//         COUNT(DISTINCT s."Student_ID") AS total_student,
//         COUNT(DISTINCT asn."ActivitySession_ID") AS total_quiz,

//         ROUND(
//           AVG(
//             CASE
//               WHEN qr."Total_Question" = 0 THEN 0
//               ELSE qr."Total_Correct" * 100.0 / qr."Total_Question"
//             END
//           )
//         ) AS avg_accuracy,

//         ROUND(AVG(qr."Total_Time_Taken")) AS avg_time

//       FROM "QuizResults" qr

//       JOIN "ActivitySessions" asn
//         ON asn."ActivitySession_ID" = qr."ActivitySession_ID"

//       JOIN "Students" s
//         ON s."Student_ID" = qr."Student_ID"

//       WHERE asn."Class_ID" = $1
//         AND asn."Status" = 'finished'
//     `, [classId]);


//       /* ================= Emit to Frontend ================= */

//       socket.emit("export_class_report_csv_data", {
//         scores: scoreRes.rows,
//         quizSummary: quizSummaryRes.rows,
//         quizAnswers: answerRes.rows,
//         overall: overallRes.rows[0] ?? {}
//       });

//     } catch (err) {

//       console.error("❌ export_class_report_csv error:", err);

//     }
//   });
// };


// const db = require("../db");

// module.exports = (socket) => {

//   socket.on("get_quiz_report", async ({ activitySessionId }) => {
//     try {

//       /* ================= Student × Question ================= */
//       const studentRes = await db.query(`
//       WITH student_question AS (
//         SELECT
//           qa."Student_ID",
//           qa."Question_ID",
//           CASE
//             WHEN COUNT(*) = (
//               SELECT COUNT(*)
//               FROM "Question_Correct_Options"
//               WHERE "Question_ID" = qa."Question_ID"
//             )
//             AND BOOL_AND(
//               qa."Choice_ID" IN (
//                 SELECT "Option_ID"
//                 FROM "Question_Correct_Options"
//                 WHERE "Question_ID" = qa."Question_ID"
//               )
//             )
//             THEN 1 ELSE 0
//           END AS is_correct
//         FROM "QuizAnswers" qa
//         WHERE qa."ActivitySession_ID" = $1
//         GROUP BY qa."Student_ID", qa."Question_ID"
//       )

//       SELECT
//         sq."Student_ID",
//         s."Student_Number",
//         sq."Question_ID",
//         sq.is_correct
//       FROM student_question sq
//       JOIN "Students" s
//         ON s."Student_ID" = sq."Student_ID"
//       ORDER BY sq."Student_ID", sq."Question_ID"
//     `, [activitySessionId]);



//       /* ================= Overall ================= */

//       const overallRes = await db.query(`
//       SELECT
//         ROUND(AVG(qr."Total_Time_Taken")) AS avg_time,
//         COUNT(DISTINCT qr."Student_ID") AS total_student
//       FROM "QuizResults" qr
//       WHERE qr."ActivitySession_ID" = $1
//     `, [activitySessionId]);



//       /* ================= Ranking ================= */

//       const scoreRes = await db.query(`
//       SELECT
//         qr."Student_ID",
//         s."Student_Number",
//         qr."Total_Score"
//       FROM "QuizResults" qr
//       JOIN "Students" s
//         ON s."Student_ID" = qr."Student_ID"
//       WHERE qr."ActivitySession_ID" = $1
//       ORDER BY qr."Total_Score" DESC
//     `, [activitySessionId]);



//       /* ================= Each Question ================= */

//       const questionRes = await db.query(`
//       WITH student_question AS (
//         SELECT
//           qa."Student_ID",
//           qa."Question_ID",
//           CASE
//             WHEN COUNT(*) = (
//               SELECT COUNT(*)
//               FROM "Question_Correct_Options"
//               WHERE "Question_ID" = qa."Question_ID"
//             )
//             AND BOOL_AND(
//               qa."Choice_ID" IN (
//                 SELECT "Option_ID"
//                 FROM "Question_Correct_Options"
//                 WHERE "Question_ID" = qa."Question_ID"
//               )
//             )
//             THEN 1 ELSE 0
//           END AS is_correct
//         FROM "QuizAnswers" qa
//         WHERE qa."ActivitySession_ID" = $1
//         GROUP BY qa."Student_ID", qa."Question_ID"
//       )

//       SELECT
//         q."Question_ID",
//         q."Question_Text",
//         ROUND(AVG(sq.is_correct) * 100) AS correct_percent
//       FROM student_question sq
//       JOIN "Questions" q
//         ON q."Question_ID" = sq."Question_ID"
//       GROUP BY q."Question_ID", q."Question_Text"
//       ORDER BY q."Question_ID"
//     `, [activitySessionId]);

//       /* ================= Option Analysis (Distractor) ================= */

//       const answerRes = await db.query(`
//   SELECT
//   q."Question_ID",
//   q."Question_Text",
//   o."Option_ID",
//   o."Option_Text",

//   CASE
//     WHEN o."Option_ID" IN (
//       SELECT "Option_ID"
//       FROM "Question_Correct_Options"
//       WHERE "Question_ID" = q."Question_ID"
//     )
//     THEN true
//     ELSE false
//   END AS is_correct,

//   COUNT(qa."Choice_ID") AS selected_count

// FROM "ActivitySessions" asn

// JOIN "AssignedQuiz" aq
//   ON aq."ActivitySession_ID" = asn."ActivitySession_ID"

// JOIN "QuestionSets" qs
//   ON qs."Set_ID" = aq."Quiz_ID"

// JOIN "Questions" q
//   ON q."Set_ID" = qs."Set_ID"

// JOIN "QuestionOptions" o
//   ON o."Question_ID" = q."Question_ID"

// LEFT JOIN "QuizAnswers" qa
//   ON qa."Choice_ID" = o."Option_ID"
//   AND qa."ActivitySession_ID" = asn."ActivitySession_ID"

// WHERE asn."ActivitySession_ID" = $1

// GROUP BY
//   q."Question_ID",
//   q."Question_Text",
//   o."Option_ID",
//   o."Option_Text"

// ORDER BY
//   q."Question_ID",
//   o."Option_ID"
// `, [activitySessionId]);



//       socket.emit("quiz_report_data", {
//         overall: {
//           avgTime: Number(overallRes.rows[0]?.avg_time ?? 0),
//           totalStudent: Number(overallRes.rows[0]?.total_student ?? 0)
//         },
//         student: studentRes.rows,
//         scores: scoreRes.rows,
//         eachQuestion: questionRes.rows,

//         answerAnalytics: answerRes.rows
//       });

//     } catch (err) {
//       console.error("❌ get_quiz_report error:", err);
//       socket.emit("quiz_report_data", null);
//     }
//   });

//   socket.on("get_finished_quiz_sessions", async ({ classId }) => {
//     try {

//       const res = await db.query(`
//           SELECT
//       asn."ActivitySession_ID",
//       qs."Title" AS quiz_name,
//       asn."Ended_At",
//       COUNT(DISTINCT qa."Student_ID") AS student_count

//     FROM "ActivitySessions" asn

//     JOIN "AssignedQuiz" aq
//       ON aq."ActivitySession_ID" = asn."ActivitySession_ID"

//     LEFT JOIN "QuestionSets" qs
//       ON qs."Set_ID" = aq."Quiz_ID"

//     LEFT JOIN "QuizAnswers" qa
//       ON qa."ActivitySession_ID" = asn."ActivitySession_ID"

//     WHERE asn."Class_ID" = $1
//       AND asn."Status" = 'finished'

//     GROUP BY
//       asn."ActivitySession_ID",
//       qs."Title",
//       asn."Ended_At"

//     ORDER BY asn."Ended_At" DESC;

//     `, [classId]);

//       socket.emit("finished_quiz_sessions_data", res.rows);
//     } catch (err) {
//       console.error("❌ get_finished_quiz_sessions error:", err);
//       socket.emit("finished_quiz_sessions_data", []);
//     }
//   });

//   /* =====================================================
//      2️⃣ REPORT ระดับคลาส (ALL QUIZ COMBINED)
//   ===================================================== */
//   socket.on("get_class_report", async ({ classId }) => {
//     try {
//       /* ================= Total Students ================= */
//       const studentRes = await db.query(`
//         SELECT COUNT(*) AS total_student
//         FROM "Students"
//         WHERE "Class_ID" = $1
//       `, [classId]);

//       const totalStudent = Number(studentRes.rows[0]?.total_student ?? 0);

//       /* ================= Total Quiz Sessions ================= */
//       const quizRes = await db.query(`
//         SELECT COUNT(*) AS total_quiz
//         FROM "ActivitySessions"
//         WHERE "Class_ID" = $1
//           AND "Status" = 'finished'
//       `, [classId]);

//       const totalQuiz = Number(quizRes.rows[0]?.total_quiz ?? 0);

//       /* ================= Average Accuracy ================= */
//       const avgRes = await db.query(`
//         SELECT
//           ROUND(
//             AVG(
//               CASE
//                 WHEN qr."Total_Question" = 0 THEN 0
//                 ELSE qr."Total_Correct" * 100.0 / qr."Total_Question"
//               END
//             )
//           ) AS avg_accuracy,
//           ROUND(AVG(qr."Total_Time_Taken")) AS avg_time
//         FROM "QuizResults" qr
//         JOIN "ActivitySessions" asn
//           ON asn."ActivitySession_ID" = qr."ActivitySession_ID"
//         WHERE asn."Class_ID" = $1
//           AND asn."Status" = 'finished'
//       `, [classId]);

//       const avgAccuracy = Number(avgRes.rows[0]?.avg_accuracy ?? 0);
//       const avgTime = Number(avgRes.rows[0]?.avg_time ?? 0);

//       /* ================= Completion ================= */
//       const doneRes = await db.query(`
//         WITH total_quiz AS (
//           SELECT COUNT(*) AS quiz_count
//           FROM "ActivitySessions"
//           WHERE "Class_ID" = $1
//             AND "Status" = 'finished'
//         ),
//         student_done AS (
//           SELECT
//             qr."Student_ID",
//             COUNT(DISTINCT qr."ActivitySession_ID") AS done_count
//           FROM "QuizResults" qr
//           JOIN "ActivitySessions" asn
//             ON asn."ActivitySession_ID" = qr."ActivitySession_ID"
//           WHERE asn."Class_ID" = $1
//             AND asn."Status" = 'finished'
//           GROUP BY qr."Student_ID"
//         )
//         SELECT COUNT(*) AS done_student
//         FROM student_done, total_quiz
//         WHERE student_done.done_count = total_quiz.quiz_count
//       `, [classId]);

//       const doneStudent = Number(doneRes.rows[0]?.done_student ?? 0);
//       const alreadyDonePercent =
//         totalStudent === 0
//           ? 0
//           : Math.round((doneStudent / totalStudent) * 100);

//       /* ================= Each Quiz ================= */
//       const eachQuizRes = await db.query(`
//         WITH student_question AS (
//   SELECT
//     qa."Student_ID",
//     qa."Question_ID",
//     qa."ActivitySession_ID",
//     CASE
//       WHEN COUNT(*) = (
//         SELECT COUNT(*)
//         FROM "Question_Correct_Options"
//         WHERE "Question_ID" = qa."Question_ID"
//       )
//       AND BOOL_AND(
//         qa."Choice_ID" IN (
//           SELECT "Option_ID"
//           FROM "Question_Correct_Options"
//           WHERE "Question_ID" = qa."Question_ID"
//         )
//       )
//       THEN 1 ELSE 0
//     END AS is_correct
//   FROM "QuizAnswers" qa
//   GROUP BY qa."Student_ID", qa."Question_ID", qa."ActivitySession_ID"
// )

// SELECT
//   asn."ActivitySession_ID",
//   qs."Title",
//   ROUND(AVG(is_correct) * 100) AS avg_accuracy
// FROM student_question sq
// JOIN "ActivitySessions" asn
//   ON asn."ActivitySession_ID" = sq."ActivitySession_ID"
// JOIN "AssignedQuiz" aq
//   ON aq."ActivitySession_ID" = asn."ActivitySession_ID"
// JOIN "QuestionSets" qs
//   ON qs."Set_ID" = aq."Quiz_ID"
// WHERE asn."Class_ID" = $1
// GROUP BY asn."ActivitySession_ID", qs."Title"
//         ORDER BY asn."Ended_At"
//       `, [classId]);

//       /* ================= 🥇 Top Students ================= */
//       const topRes = await db.query(`
//         SELECT
//           s."Student_ID",
//           s."Student_Number",
//           ROUND(AVG(
//             CASE
//               WHEN qr."Total_Question" = 0 THEN 0
//               ELSE qr."Total_Correct" * 100.0 / qr."Total_Question"
//             END
//           )) AS avg_score
//         FROM "QuizResults" qr
//         JOIN "Students" s ON s."Student_ID" = qr."Student_ID"
//         JOIN "ActivitySessions" asn
//           ON asn."ActivitySession_ID" = qr."ActivitySession_ID"
//         WHERE asn."Class_ID" = $1
//           AND asn."Status" = 'finished'
//         GROUP BY s."Student_ID", s."Student_Number"
//         ORDER BY avg_score DESC
//         LIMIT 3
//       `, [classId]);

//       /* ================= ⚠️ Needs Attention ================= */
//       const attentionRes = await db.query(`
//         SELECT
//           s."Student_ID",
//           s."Student_Number",
//           ROUND(AVG(
//             CASE
//               WHEN qr."Total_Question" = 0 THEN 0
//               ELSE qr."Total_Correct" * 100.0 / qr."Total_Question"
//             END
//           )) AS avg_score
//         FROM "QuizResults" qr
//         JOIN "Students" s ON s."Student_ID" = qr."Student_ID"
//         JOIN "ActivitySessions" asn
//           ON asn."ActivitySession_ID" = qr."ActivitySession_ID"
//         WHERE asn."Class_ID" = $1
//           AND asn."Status" = 'finished'
//         GROUP BY s."Student_ID", s."Student_Number"
//         HAVING ROUND(AVG(
//           CASE
//             WHEN qr."Total_Question" = 0 THEN 0
//             ELSE qr."Total_Correct" * 100.0 / qr."Total_Question"
//           END
//         )) < 50
//         ORDER BY avg_score ASC
//         LIMIT 5
//       `, [classId]);

//       /* ================= Emit ================= */
//       socket.emit("class_report_data", {
//         overall: {
//           totalStudent,
//           totalQuiz,
//           avgAccuracy,
//           avgTime,
//           alreadyDone: doneStudent,
//           alreadyDonePercent
//         },
//         eachQuiz: eachQuizRes.rows,
//         topStudents: topRes.rows,
//         needsAttention: attentionRes.rows
//       });

//     } catch (err) {
//       console.error("❌ get_class_report error:", err);
//       socket.emit("class_report_data", null);
//     }
//   });

//   /* =====================================================
//      📁 EXPORT CSV (placeholder)
//   ===================================================== */
//   //   socket.on("export_class_report_csv", async ({ classId }) => {


//   //     try {
//   //       const res = await db.query(`
//   //         WITH quiz_scores AS (

//   // SELECT
//   // s."Student_Number",
//   // qs."Title" AS quiz_title,
//   // ROUND(
//   // CASE
//   // WHEN qr."Total_Question" = 0 THEN 0
//   // ELSE qr."Total_Correct" * 100.0 / qr."Total_Question"
//   // END
//   // ) AS score

//   // FROM "QuizResults" qr

//   // JOIN "Students" s
//   // ON s."Student_ID" = qr."Student_ID"

//   // JOIN "ActivitySessions" asn
//   // ON asn."ActivitySession_ID" = qr."ActivitySession_ID"

//   // JOIN "AssignedQuiz" aq
//   // ON aq."ActivitySession_ID" = asn."ActivitySession_ID"

//   // JOIN "QuestionSets" qs
//   // ON qs."Set_ID" = aq."Quiz_ID"

//   // WHERE asn."Class_ID" = $1
//   // AND asn."Status" = 'finished'

//   // )

//   // SELECT *
//   // FROM quiz_scores
//   // ORDER BY "Student_Number"
//   //       `, [classId]);

//   //       socket.emit("export_class_report_csv_data", res.rows);

//   //     } catch (err) {
//   //       console.error("❌ export_class_report_csv error:", err);
//   //     }
//   //   });

//   /* =====================================================
//    📁 EXPORT CLASS REPORT (ALL QUIZ)
// ===================================================== */

//   socket.on("export_class_report_csv", async ({ classId }) => {
//     try {

//       /* ================= Students × Quiz Scores ================= */

//       const scoreRes = await db.query(`
//       SELECT
//         s."Student_ID",
//         s."Student_Number",
//         asn."ActivitySession_ID",
//         qs."Title" AS quiz_title,

//         qr."Total_Correct" AS correct,
//         qr."Total_Question" AS total_question
//       FROM "QuizResults" qr

//       JOIN "Students" s
//         ON s."Student_ID" = qr."Student_ID"

//       JOIN "ActivitySessions" asn
//         ON asn."ActivitySession_ID" = qr."ActivitySession_ID"

//       JOIN "AssignedQuiz" aq
//         ON aq."ActivitySession_ID" = asn."ActivitySession_ID"

//       JOIN "QuestionSets" qs
//         ON qs."Set_ID" = aq."Quiz_ID"

//       WHERE asn."Class_ID" = $1
//         AND asn."Status" = 'finished'

//       ORDER BY s."Student_Number"
//     `, [classId]);


//       /* ================= Quiz Summary ================= */

//       const quizSummaryRes = await db.query(`
//       SELECT
//         asn."ActivitySession_ID",
//         qs."Title" AS quiz_title,
//         COUNT(DISTINCT qr."Student_ID") AS student_count,

//         ROUND(
//           AVG(
//             CASE
//               WHEN qr."Total_Question" = 0 THEN 0
//               ELSE qr."Total_Correct" * 100.0 / qr."Total_Question"
//             END
//           )
//         ) AS avg_score

//       FROM "QuizResults" qr

//       JOIN "ActivitySessions" asn
//         ON asn."ActivitySession_ID" = qr."ActivitySession_ID"

//       JOIN "AssignedQuiz" aq
//         ON aq."ActivitySession_ID" = asn."ActivitySession_ID"

//       JOIN "QuestionSets" qs
//         ON qs."Set_ID" = aq."Quiz_ID"

//       WHERE asn."Class_ID" = $1
//         AND asn."Status" = 'finished'

//       GROUP BY asn."ActivitySession_ID", qs."Title"
//       ORDER BY asn."Ended_At"
//     `, [classId]);


//       /* ================= All Quiz Question Analysis ================= */

//       const answerRes = await db.query(`
//       SELECT
//         asn."ActivitySession_ID",
//         qs."Title" AS quiz_title,

//         q."Question_ID",
//         q."Question_Text",

//         o."Option_ID",
//         o."Option_Text",

//         CASE
//           WHEN o."Option_ID" IN (
//             SELECT "Option_ID"
//             FROM "Question_Correct_Options"
//             WHERE "Question_ID" = q."Question_ID"
//           )
//           THEN true
//           ELSE false
//         END AS is_correct,

//         COUNT(qa."Choice_ID") AS selected_count

//       FROM "ActivitySessions" asn

//       JOIN "AssignedQuiz" aq
//         ON aq."ActivitySession_ID" = asn."ActivitySession_ID"

//       JOIN "QuestionSets" qs
//         ON qs."Set_ID" = aq."Quiz_ID"

//       JOIN "Questions" q
//         ON q."Set_ID" = qs."Set_ID"

//       JOIN "QuestionOptions" o
//         ON o."Question_ID" = q."Question_ID"

//       LEFT JOIN "QuizAnswers" qa
//         ON qa."Choice_ID" = o."Option_ID"
//         AND qa."ActivitySession_ID" = asn."ActivitySession_ID"

//       WHERE asn."Class_ID" = $1
//         AND asn."Status" = 'finished'

//       GROUP BY
//         asn."ActivitySession_ID",
//         qs."Title",
//         q."Question_ID",
//         q."Question_Text",
//         o."Option_ID",
//         o."Option_Text"

//       ORDER BY
//         asn."ActivitySession_ID",
//         q."Question_ID",
//         o."Option_ID"
//     `, [classId]);


//       /* ================= Overall ================= */

//       const overallRes = await db.query(`
//       SELECT
//         COUNT(DISTINCT s."Student_ID") AS total_student,
//         COUNT(DISTINCT asn."ActivitySession_ID") AS total_quiz,

//         ROUND(
//           AVG(
//             CASE
//               WHEN qr."Total_Question" = 0 THEN 0
//               ELSE qr."Total_Correct" * 100.0 / qr."Total_Question"
//             END
//           )
//         ) AS avg_accuracy,

//         ROUND(AVG(qr."Total_Time_Taken")) AS avg_time

//       FROM "QuizResults" qr

//       JOIN "ActivitySessions" asn
//         ON asn."ActivitySession_ID" = qr."ActivitySession_ID"

//       JOIN "Students" s
//         ON s."Student_ID" = qr."Student_ID"

//       WHERE asn."Class_ID" = $1
//         AND asn."Status" = 'finished'
//     `, [classId]);


//       /* ================= Emit to Frontend ================= */

//       socket.emit("export_class_report_csv_data", {
//         scores: scoreRes.rows,
//         quizSummary: quizSummaryRes.rows,
//         quizAnswers: answerRes.rows,
//         overall: overallRes.rows[0] ?? {}
//       });

//     } catch (err) {

//       console.error("❌ export_class_report_csv error:", err);

//     }
//   });
// };

const db = require("../db");

module.exports = (socket) => {

  /* =====================================================
     QUIZ REPORT
  ===================================================== */

  socket.on("get_quiz_report", async ({ activitySessionId }) => {

    try {

      const assignedRes = await db.query(`
        SELECT "AssignedQuiz_ID"
        FROM "AssignedQuiz"
        WHERE "ActivitySession_ID"=$1
      `, [activitySessionId]);

      const assignedQuizId = assignedRes.rows[0]?.AssignedQuiz_ID;

      /* ================= Student × Question ================= */

      const studentRes = await db.query(`
        WITH student_question AS (
          SELECT
            ap."Student_ID",
            qa."Question_ID",

            CASE
              WHEN COUNT(*) = (
                SELECT COUNT(*)
                FROM "Question_Correct_Options"
                WHERE "Question_ID" = qa."Question_ID"
              )
              AND BOOL_AND(
                qa."Choice_ID" IN (
                  SELECT "Option_ID"
                  FROM "Question_Correct_Options"
                  WHERE "Question_ID" = qa."Question_ID"
                )
              )
              THEN 1 ELSE 0
            END AS is_correct

          FROM "QuizAnswers" qa

          JOIN "ActivityParticipants" ap
            ON ap."ActivityParticipant_ID" = qa."ActivityParticipant_ID"

          WHERE qa."AssignedQuiz_ID"=$1

          GROUP BY ap."Student_ID", qa."Question_ID"
        )

        SELECT
          sq."Student_ID",
          s."Student_Number",
          sq."Question_ID",
          sq.is_correct

        FROM student_question sq
        JOIN "Students" s
          ON s."Student_ID" = sq."Student_ID"

        ORDER BY sq."Student_ID", sq."Question_ID"
      `, [assignedQuizId]);


      /* ================= Overall ================= */

      const overallRes = await db.query(`
        SELECT
          ROUND(AVG(qr."Total_Time_Taken")) AS avg_time,
          COUNT(DISTINCT qr."ActivityParticipant_ID") AS total_student
        FROM "QuizResults" qr
        WHERE qr."AssignedQuiz_ID"=$1
      `, [assignedQuizId]);


      /* ================= Ranking ================= */

      const scoreRes = await db.query(`
        SELECT
          ap."Student_ID",
          s."Student_Number",
          qr."Total_Score"

        FROM "QuizResults" qr

        JOIN "ActivityParticipants" ap
          ON ap."ActivityParticipant_ID" = qr."ActivityParticipant_ID"

        JOIN "Students" s
          ON s."Student_ID" = ap."Student_ID"

        WHERE qr."AssignedQuiz_ID"=$1

        ORDER BY qr."Total_Score" DESC
      `, [assignedQuizId]);


      /* ================= Each Question ================= */

      const questionRes = await db.query(`
        WITH student_question AS (

  SELECT
    ap."Student_ID",
    qa."Question_ID",

    CASE
      WHEN COUNT(*) = (
        SELECT COUNT(*)
        FROM "Question_Correct_Options"
        WHERE "Question_ID" = qa."Question_ID"
      )
      AND BOOL_AND(
        qa."Choice_ID" IN (
          SELECT "Option_ID"
          FROM "Question_Correct_Options"
          WHERE "Question_ID" = qa."Question_ID"
        )
      )
      THEN 1 ELSE 0
    END AS is_correct

  FROM "QuizAnswers" qa

  JOIN "ActivityParticipants" ap
    ON ap."ActivityParticipant_ID" = qa."ActivityParticipant_ID"

  WHERE qa."AssignedQuiz_ID" = $1

  GROUP BY
    ap."Student_ID",
    qa."Question_ID"

)

SELECT
  q."Question_ID",
  q."Question_Text",
  ROUND(AVG(sq.is_correct) * 100) AS correct_percent

FROM "Questions" q

LEFT JOIN student_question sq
  ON q."Question_ID" = sq."Question_ID"

JOIN "QuestionSets" qs
  ON qs."Set_ID" = q."Set_ID"

JOIN "AssignedQuiz" aq
  ON aq."Quiz_ID" = qs."Set_ID"

WHERE aq."AssignedQuiz_ID" = $1

GROUP BY
  q."Question_ID",
  q."Question_Text"

ORDER BY q."Question_ID"
      `, [assignedQuizId]);


      /* ================= Option Analysis ================= */

      const answerRes = await db.query(`
        SELECT

          q."Question_ID",
          q."Question_Text",

          o."Option_ID",
          o."Option_Text",

          CASE
            WHEN o."Option_ID" IN (
              SELECT "Option_ID"
              FROM "Question_Correct_Options"
              WHERE "Question_ID" = q."Question_ID"
            )
            THEN true
            ELSE false
          END AS is_correct,

          COUNT(qa."Choice_ID") AS selected_count

        FROM "AssignedQuiz" aq

        JOIN "QuestionSets" qs
          ON qs."Set_ID" = aq."Quiz_ID"

        JOIN "Questions" q
          ON q."Set_ID" = qs."Set_ID"

        JOIN "QuestionOptions" o
          ON o."Question_ID" = q."Question_ID"

        LEFT JOIN "QuizAnswers" qa
          ON qa."Choice_ID" = o."Option_ID"
         AND qa."AssignedQuiz_ID" = aq."AssignedQuiz_ID"

        WHERE aq."AssignedQuiz_ID"=$1

        GROUP BY
          q."Question_ID",
          q."Question_Text",
          o."Option_ID",
          o."Option_Text"

        ORDER BY
          q."Question_ID",
          o."Option_ID"
      `, [assignedQuizId]);


      socket.emit("quiz_report_data", {

        overall: {
          avgTime: Number(overallRes.rows[0]?.avg_time ?? 0),
          totalStudent: Number(overallRes.rows[0]?.total_student ?? 0)
        },

        student: studentRes.rows,
        scores: scoreRes.rows,
        eachQuestion: questionRes.rows,
        answerAnalytics: answerRes.rows

      });

    }
    catch (err) {

      console.error("❌ get_quiz_report error:", err);
      socket.emit("quiz_report_data", null);

    }

  });



  /* =====================================================
     FINISHED QUIZ SESSIONS
  ===================================================== */

  socket.on("get_finished_quiz_sessions", async ({ classId }) => {

    try {

      const res = await db.query(`
        SELECT

          asn."ActivitySession_ID",
          qs."Title" AS quiz_name,
          asn."Ended_At",

          COUNT(DISTINCT qa."ActivityParticipant_ID") AS student_count

        FROM "ActivitySessions" asn

        JOIN "AssignedQuiz" aq
          ON aq."ActivitySession_ID" = asn."ActivitySession_ID"

        LEFT JOIN "QuestionSets" qs
          ON qs."Set_ID" = aq."Quiz_ID"

        LEFT JOIN "QuizAnswers" qa
          ON qa."AssignedQuiz_ID" = aq."AssignedQuiz_ID"

        WHERE asn."Class_ID"=$1
        AND asn."Status"='finished'

        GROUP BY
          asn."ActivitySession_ID",
          qs."Title",
          asn."Ended_At"

        ORDER BY asn."Ended_At" DESC
      `, [classId]);

      socket.emit("finished_quiz_sessions_data", res.rows);

    }
    catch (err) {

      console.error("❌ get_finished_quiz_sessions error:", err);
      socket.emit("finished_quiz_sessions_data", []);

    }

  });



  /* =====================================================
     CLASS REPORT
  ===================================================== */

  socket.on("get_class_report", async ({ classId }) => {
  try {

    /* ================= Total Students ================= */

    const studentRes = await db.query(`
      SELECT COUNT(*) AS total_student
      FROM "Students"
      WHERE "Class_ID"=$1
    `,[classId]);

    const totalStudent = Number(studentRes.rows[0]?.total_student ?? 0);


    /* ================= Total Quiz ================= */

    const quizRes = await db.query(`
      SELECT COUNT(*) AS total_quiz
      FROM "ActivitySessions"
      WHERE "Class_ID"=$1
      AND "Status"='finished'
    `,[classId]);

    const totalQuiz = Number(quizRes.rows[0]?.total_quiz ?? 0);


    /* ================= Average Accuracy ================= */

    const avgRes = await db.query(`
      SELECT

        ROUND(
          AVG(
            CASE
              WHEN qr."Total_Question"=0 THEN 0
              ELSE qr."Total_Correct"*100.0/qr."Total_Question"
            END
          )
        ) AS avg_accuracy,

        ROUND(AVG(qr."Total_Time_Taken")) AS avg_time

      FROM "QuizResults" qr

      JOIN "AssignedQuiz" aq
        ON aq."AssignedQuiz_ID" = qr."AssignedQuiz_ID"

      JOIN "ActivitySessions" asn
        ON asn."ActivitySession_ID" = aq."ActivitySession_ID"

      WHERE asn."Class_ID"=$1
      AND asn."Status"='finished'
    `,[classId]);

    const avgAccuracy = Number(avgRes.rows[0]?.avg_accuracy ?? 0);
    const avgTime = Number(avgRes.rows[0]?.avg_time ?? 0);


    /* ================= Completion ================= */

    const doneRes = await db.query(`
      WITH total_quiz AS (
        SELECT COUNT(*) AS quiz_count
        FROM "ActivitySessions"
        WHERE "Class_ID"=$1
        AND "Status"='finished'
      ),

      student_done AS (

        SELECT
          ap."Student_ID",
          COUNT(DISTINCT aq."ActivitySession_ID") AS done_count

        FROM "QuizResults" qr

        JOIN "ActivityParticipants" ap
          ON ap."ActivityParticipant_ID" = qr."ActivityParticipant_ID"

        JOIN "AssignedQuiz" aq
          ON aq."AssignedQuiz_ID" = qr."AssignedQuiz_ID"

        JOIN "ActivitySessions" asn
          ON asn."ActivitySession_ID" = aq."ActivitySession_ID"

        WHERE asn."Class_ID"=$1
        AND asn."Status"='finished'

        GROUP BY ap."Student_ID"
      )

      SELECT COUNT(*) AS done_student
      FROM student_done,total_quiz
      WHERE student_done.done_count = total_quiz.quiz_count
    `,[classId]);

    const doneStudent = Number(doneRes.rows[0]?.done_student ?? 0);

    const alreadyDonePercent =
      totalStudent === 0
        ? 0
        : Math.round((doneStudent / totalStudent) * 100);


    /* ================= Each Quiz ================= */

    const eachQuizRes = await db.query(`
      WITH student_question AS (

        SELECT

          ap."Student_ID",
          qa."Question_ID",
          aq."ActivitySession_ID",

          CASE
            WHEN COUNT(*) = (
              SELECT COUNT(*)
              FROM "Question_Correct_Options"
              WHERE "Question_ID" = qa."Question_ID"
            )
            AND BOOL_AND(
              qa."Choice_ID" IN (
                SELECT "Option_ID"
                FROM "Question_Correct_Options"
                WHERE "Question_ID" = qa."Question_ID"
              )
            )
            THEN 1 ELSE 0
          END AS is_correct

        FROM "QuizAnswers" qa

        JOIN "ActivityParticipants" ap
          ON ap."ActivityParticipant_ID" = qa."ActivityParticipant_ID"

        JOIN "AssignedQuiz" aq
          ON aq."AssignedQuiz_ID" = qa."AssignedQuiz_ID"

        GROUP BY
          ap."Student_ID",
          qa."Question_ID",
          aq."ActivitySession_ID"
      )

      SELECT

        asn."ActivitySession_ID",
        qs."Title",

        ROUND(AVG(is_correct)*100) AS avg_accuracy

      FROM student_question sq

      JOIN "ActivitySessions" asn
        ON asn."ActivitySession_ID" = sq."ActivitySession_ID"

      JOIN "AssignedQuiz" aq
        ON aq."ActivitySession_ID" = asn."ActivitySession_ID"

      JOIN "QuestionSets" qs
        ON qs."Set_ID" = aq."Quiz_ID"

      WHERE asn."Class_ID"=$1

      GROUP BY
        asn."ActivitySession_ID",
        qs."Title"

      ORDER BY asn."Ended_At"
    `,[classId]);


    /* ================= Top Students ================= */

    const topRes = await db.query(`
      SELECT

        s."Student_ID",
        s."Student_Number",

        ROUND(
          AVG(
            CASE
              WHEN qr."Total_Question"=0 THEN 0
              ELSE qr."Total_Correct"*100.0/qr."Total_Question"
            END
          )
        ) AS avg_score

      FROM "QuizResults" qr

      JOIN "ActivityParticipants" ap
        ON ap."ActivityParticipant_ID" = qr."ActivityParticipant_ID"

      JOIN "Students" s
        ON s."Student_ID" = ap."Student_ID"

      JOIN "AssignedQuiz" aq
        ON aq."AssignedQuiz_ID" = qr."AssignedQuiz_ID"

      JOIN "ActivitySessions" asn
        ON asn."ActivitySession_ID" = aq."ActivitySession_ID"

      WHERE asn."Class_ID"=$1
      AND asn."Status"='finished'

      GROUP BY
        s."Student_ID",
        s."Student_Number"

      ORDER BY avg_score DESC
      LIMIT 3
    `,[classId]);


    /* ================= Needs Attention ================= */

    const attentionRes = await db.query(`
      SELECT

        s."Student_ID",
        s."Student_Number",

        ROUND(
          AVG(
            CASE
              WHEN qr."Total_Question"=0 THEN 0
              ELSE qr."Total_Correct"*100.0/qr."Total_Question"
            END
          )
        ) AS avg_score

      FROM "QuizResults" qr

      JOIN "ActivityParticipants" ap
        ON ap."ActivityParticipant_ID" = qr."ActivityParticipant_ID"

      JOIN "Students" s
        ON s."Student_ID" = ap."Student_ID"

      JOIN "AssignedQuiz" aq
        ON aq."AssignedQuiz_ID" = qr."AssignedQuiz_ID"

      JOIN "ActivitySessions" asn
        ON asn."ActivitySession_ID" = aq."ActivitySession_ID"

      WHERE asn."Class_ID"=$1
      AND asn."Status"='finished'

      GROUP BY
        s."Student_ID",
        s."Student_Number"

      HAVING ROUND(
        AVG(
          CASE
            WHEN qr."Total_Question"=0 THEN 0
            ELSE qr."Total_Correct"*100.0/qr."Total_Question"
          END
        )
      ) < 50

      ORDER BY avg_score ASC
      LIMIT 5
    `,[classId]);


    /* ================= Emit ================= */

    socket.emit("class_report_data",{

      overall:{
        totalStudent,
        totalQuiz,
        avgAccuracy,
        avgTime,
        alreadyDone:doneStudent,
        alreadyDonePercent
      },

      eachQuiz:eachQuizRes.rows,
      topStudents:topRes.rows,
      needsAttention:attentionRes.rows

    });

  }
  catch(err){

    console.error("❌ get_class_report error:",err);
    socket.emit("class_report_data",null);

  }
});
  /* =====================================================
     EXPORT CSV
  ===================================================== */

socket.on("export_class_report_csv", async ({ classId }) => {
  try {

    /* ================= Students × Quiz Scores ================= */

    const scoreRes = await db.query(`

      SELECT
        s."Student_ID",
        s."Student_Number",

        asn."ActivitySession_ID",
        qs."Title" AS quiz_title,

        qr."Total_Correct" AS correct,
        qr."Total_Question" AS total_question

      FROM "QuizResults" qr

      JOIN "ActivityParticipants" ap
        ON ap."ActivityParticipant_ID" = qr."ActivityParticipant_ID"

      JOIN "Students" s
        ON s."Student_ID" = ap."Student_ID"

      JOIN "AssignedQuiz" aq
        ON aq."AssignedQuiz_ID" = qr."AssignedQuiz_ID"

      JOIN "ActivitySessions" asn
        ON asn."ActivitySession_ID" = aq."ActivitySession_ID"

      JOIN "QuestionSets" qs
        ON qs."Set_ID" = aq."Quiz_ID"

      WHERE asn."Class_ID"=$1
      AND asn."Status"='finished'

      ORDER BY s."Student_Number"

    `,[classId]);


    /* ================= Quiz Summary ================= */

    const quizSummaryRes = await db.query(`

      SELECT

  asn."ActivitySession_ID",
  qs."Title" AS quiz_title,

  COUNT(DISTINCT qr."ActivityParticipant_ID") AS student_count,

  ROUND(
    AVG(
      CASE
        WHEN qr."Total_Question" = 0 THEN 0
        ELSE qr."Total_Correct" * 100.0 / qr."Total_Question"
      END
    )
  ) AS avg_score

FROM "ActivitySessions" asn

JOIN "AssignedQuiz" aq
  ON aq."ActivitySession_ID" = asn."ActivitySession_ID"

JOIN "QuizResults" qr
  ON qr."AssignedQuiz_ID" = aq."AssignedQuiz_ID"

JOIN "QuestionSets" qs
  ON qs."Set_ID" = aq."Quiz_ID"

WHERE asn."Class_ID" = $1
AND asn."Status" = 'finished'

GROUP BY
  asn."ActivitySession_ID",
  qs."Title"

ORDER BY asn."Ended_At"

    `,[classId]);


    /* ================= Question Analysis ================= */

    const answerRes = await db.query(`
SELECT

  asn."ActivitySession_ID",
  qs."Title" AS quiz_title,

  q."Question_ID",
  q."Question_Text",

  o."Option_ID",
  o."Option_Text",

  CASE
    WHEN o."Option_ID" IN (
      SELECT "Option_ID"
      FROM "Question_Correct_Options"
      WHERE "Question_ID" = q."Question_ID"
    )
    THEN true
    ELSE false
  END AS is_correct,

  COUNT(qa."Choice_ID") AS selected_count

FROM "ActivitySessions" asn

JOIN "AssignedQuiz" aq
  ON aq."ActivitySession_ID" = asn."ActivitySession_ID"

  JOIN "QuizResults" qr
  ON qr."AssignedQuiz_ID" = aq."AssignedQuiz_ID"

JOIN "QuestionSets" qs
  ON qs."Set_ID" = aq."Quiz_ID"

JOIN "Questions" q
  ON q."Set_ID" = qs."Set_ID"

JOIN "QuestionOptions" o
  ON o."Question_ID" = q."Question_ID"

LEFT JOIN "QuizAnswers" qa
  ON qa."Choice_ID" = o."Option_ID"
  AND qa."AssignedQuiz_ID" = aq."AssignedQuiz_ID"

WHERE asn."Class_ID" = $1
AND asn."Status" = 'finished'

GROUP BY
  asn."ActivitySession_ID",
  qs."Title",
  q."Question_ID",
  q."Question_Text",
  o."Option_ID",
  o."Option_Text"

ORDER BY
  asn."ActivitySession_ID",
  q."Question_ID",
  o."Option_ID"
    
        `,[classId]);


    /* ================= Overall ================= */

    const overallRes = await db.query(`

      SELECT

        COUNT(DISTINCT s."Student_ID") AS total_student,

        COUNT(DISTINCT asn."ActivitySession_ID") AS total_quiz,

        ROUND(
          AVG(
            CASE
              WHEN qr."Total_Question"=0 THEN 0
              ELSE qr."Total_Correct"*100.0/qr."Total_Question"
            END
          )
        ) AS avg_accuracy,

        ROUND(AVG(qr."Total_Time_Taken")) AS avg_time

      FROM "QuizResults" qr

      JOIN "ActivityParticipants" ap
        ON ap."ActivityParticipant_ID" = qr."ActivityParticipant_ID"

      JOIN "Students" s
        ON s."Student_ID" = ap."Student_ID"

      JOIN "AssignedQuiz" aq
        ON aq."AssignedQuiz_ID" = qr."AssignedQuiz_ID"

      JOIN "ActivitySessions" asn
        ON asn."ActivitySession_ID" = aq."ActivitySession_ID"

      WHERE asn."Class_ID"=$1
      AND asn."Status"='finished'

    `,[classId]);


    /* ================= Emit ================= */

    socket.emit("export_class_report_csv_data",{

      scores:scoreRes.rows,
      quizSummary:quizSummaryRes.rows,
      quizAnswers:answerRes.rows,
      overall:overallRes.rows[0] ?? {}

    });

  }
  catch(err){

    console.error("❌ export_class_report_csv error:",err);

  }
});
};