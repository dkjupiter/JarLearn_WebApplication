// const db = require("../db");

// module.exports = (socket) => {
//   socket.on("get_question_analysis", async ({ activitySessionId, questionId }) => {
//     try {
//       const result = await db.query(
//         `
//         SELECT
//           o."Question_ID",
//           o."Option_ID",
//           o."Option_Text",
//           COUNT(DISTINCT qa."Student_ID") AS selected_count,
//           ROUND(
//             COUNT(DISTINCT qa."Student_ID") * 100.0
//             / NULLIF(total.total_students,0),
//             1
//           ) AS percent,
//           BOOL_OR(qco."Option_ID" IS NOT NULL) AS is_correct,
//           ROUND(AVG(qa."Time_Spent")::numeric, 1)::float AS avg_time
//         FROM "QuestionOptions" o
//         LEFT JOIN "QuizAnswers" qa
//           ON qa."Choice_ID" = o."Option_ID"
//          AND qa."ActivitySession_ID" = $1
//          AND qa."Question_ID" = $2
//         LEFT JOIN "Question_Correct_Options" qco
//           ON qco."Question_ID" = o."Question_ID"
//          AND qco."Option_ID" = o."Option_ID"
//         CROSS JOIN (
//           SELECT COUNT(DISTINCT "Student_ID") AS total_students
//           FROM "QuizAnswers"
//           WHERE "ActivitySession_ID" = $1
//             AND "Question_ID" = $2
//         ) total
//         WHERE o."Question_ID" = $2
//         GROUP BY
//           o."Question_ID",
//           o."Option_ID",
//           o."Option_Text",
//           total.total_students
//         ORDER BY o."Option_ID";
//         `,
//         [activitySessionId, questionId]
//       );

//       socket.emit("question_analysis_data", result.rows);
//     } catch (err) {
//       console.error("❌ get_question_analysis error:", err.message);
//       socket.emit("question_analysis_data", []);
//     }
//   });

//   socket.on("get_questions_by_activity", async ({ activitySessionId }) => {
//     try {
//       const res = await db.query(`
//       SELECT
//         q."Question_ID",
//         q."Question_Text",
//         q."Question_Type"
//       FROM "Questions" q
//       JOIN "AssignedQuiz" aq
//         ON aq."Quiz_ID" = q."Set_ID"
//       WHERE aq."ActivitySession_ID" = $1
//       ORDER BY q."Question_ID"
//     `, [activitySessionId]);

//       socket.emit("questions_by_activity_data", res.rows);
//     } catch (err) {
//       console.error("❌ get_questions_by_activity error:", err.message);
//       socket.emit("questions_by_activity_data", []);
//     }
//   });

//   socket.on("get_full_analysis", async ({ activitySessionId }) => {
//   try {
//     const result = await db.query(`
//       SELECT
//         qa."Question_ID",
//         o."Option_ID",
//         o."Option_Text",
//         COUNT(DISTINCT qa."Student_ID") AS selected_count,
//         ROUND(
//           COUNT(DISTINCT qa."Student_ID") * 100.0
//           / NULLIF(total.total_students,0),
//           1
//         ) AS percent,
//         BOOL_OR(qco."Option_ID" IS NOT NULL) AS is_correct,
//         ROUND(AVG(qa."Time_Spent")::numeric, 1)::float AS avg_time
//       FROM "QuestionOptions" o
//       LEFT JOIN "QuizAnswers" qa
//         ON qa."Choice_ID" = o."Option_ID"
//        AND qa."ActivitySession_ID" = $1
//       LEFT JOIN "Question_Correct_Options" qco
//         ON qco."Question_ID" = o."Question_ID"
//        AND qco."Option_ID" = o."Option_ID"
//       CROSS JOIN (
//         SELECT COUNT(DISTINCT "Student_ID") AS total_students
//         FROM "QuizAnswers"
//         WHERE "ActivitySession_ID" = $1
//       ) total
//       GROUP BY
//         qa."Question_ID",
//         o."Option_ID",
//         o."Option_Text",
//         total.total_students
//       ORDER BY qa."Question_ID", o."Option_ID"
//     `, [activitySessionId]);

//     socket.emit(
//       "full_analysis_data",
//       JSON.parse(JSON.stringify(result.rows)) // 🔥 safety
//     );

//   } catch (err) {
//     console.error("❌ get_full_analysis error:", err.message);
//     socket.emit("full_analysis_data", []);
//   }
// });


// };


// const db = require("../db");

// module.exports = (socket) => {
//   socket.on("get_question_analysis", async ({ activitySessionId, questionId }) => {
//     try {
//       const result = await db.query(
//         `
//         SELECT
//           o."Question_ID",
//           o."Option_ID",
//           o."Option_Text",
//           COUNT(DISTINCT qa."Student_ID") AS selected_count,
//           ROUND(
//             COUNT(DISTINCT qa."Student_ID") * 100.0
//             / NULLIF(total.total_students,0),
//             1
//           ) AS percent,
//           BOOL_OR(qco."Option_ID" IS NOT NULL) AS is_correct,
//           ROUND(AVG(qa."Time_Spent")::numeric, 1)::float AS avg_time
//         FROM "QuestionOptions" o
//         LEFT JOIN "QuizAnswers" qa
//           ON qa."Choice_ID" = o."Option_ID"
//          AND qa."ActivitySession_ID" = $1
//          AND qa."Question_ID" = $2
//         LEFT JOIN "Question_Correct_Options" qco
//           ON qco."Question_ID" = o."Question_ID"
//          AND qco."Option_ID" = o."Option_ID"
//         CROSS JOIN (
//           SELECT COUNT(DISTINCT "Student_ID") AS total_students
//           FROM "QuizAnswers"
//           WHERE "ActivitySession_ID" = $1
//             AND "Question_ID" = $2
//         ) total
//         WHERE o."Question_ID" = $2
//         GROUP BY
//           o."Question_ID",
//           o."Option_ID",
//           o."Option_Text",
//           total.total_students
//         ORDER BY o."Option_ID";
//         `,
//         [activitySessionId, questionId]
//       );

//       socket.emit("question_analysis_data", result.rows);
//     } catch (err) {
//       console.error("❌ get_question_analysis error:", err.message);
//       socket.emit("question_analysis_data", []);
//     }
//   });

//   socket.on("get_questions_by_activity", async ({ activitySessionId }) => {
//     try {
//       const res = await db.query(`
//       SELECT
//         q."Question_ID",
//         q."Question_Text",
//         q."Question_Type"
//       FROM "Questions" q
//       JOIN "AssignedQuiz" aq
//         ON aq."Quiz_ID" = q."Set_ID"
//       WHERE aq."ActivitySession_ID" = $1
//       ORDER BY q."Question_ID"
//     `, [activitySessionId]);

//       socket.emit("questions_by_activity_data", res.rows);
//     } catch (err) {
//       console.error("❌ get_questions_by_activity error:", err.message);
//       socket.emit("questions_by_activity_data", []);
//     }
//   });

//   socket.on("get_full_analysis", async ({ activitySessionId }) => {
//   try {
//     const result = await db.query(`
//       SELECT
//         qa."Question_ID",
//         o."Option_ID",
//         o."Option_Text",
//         COUNT(DISTINCT qa."Student_ID") AS selected_count,
//         ROUND(
//           COUNT(DISTINCT qa."Student_ID") * 100.0
//           / NULLIF(total.total_students,0),
//           1
//         ) AS percent,
//         BOOL_OR(qco."Option_ID" IS NOT NULL) AS is_correct,
//         ROUND(AVG(qa."Time_Spent")::numeric, 1)::float AS avg_time
//       FROM "QuestionOptions" o
//       LEFT JOIN "QuizAnswers" qa
//         ON qa."Choice_ID" = o."Option_ID"
//        AND qa."ActivitySession_ID" = $1
//       LEFT JOIN "Question_Correct_Options" qco
//         ON qco."Question_ID" = o."Question_ID"
//        AND qco."Option_ID" = o."Option_ID"
//       CROSS JOIN (
//         SELECT COUNT(DISTINCT "Student_ID") AS total_students
//         FROM "QuizAnswers"
//         WHERE "ActivitySession_ID" = $1
//       ) total
//       GROUP BY
//         qa."Question_ID",
//         o."Option_ID",
//         o."Option_Text",
//         total.total_students
//       ORDER BY qa."Question_ID", o."Option_ID"
//     `, [activitySessionId]);

//     socket.emit(
//       "full_analysis_data",
//       JSON.parse(JSON.stringify(result.rows)) // 🔥 safety
//     );

//   } catch (err) {
//     console.error("❌ get_full_analysis error:", err.message);
//     socket.emit("full_analysis_data", []);
//   }
// });


// };

const db = require("../db");

module.exports = (socket) => {

  /* =====================================================
     QUESTION ANALYSIS (single question)
  ===================================================== */

  socket.on("get_question_analysis", async ({ activitySessionId, questionId }) => {

    try {

      const assignedRes = await db.query(`
        SELECT "AssignedQuiz_ID"
        FROM "AssignedQuiz"
        WHERE "ActivitySession_ID"=$1
      `,[activitySessionId]);

      const assignedQuizId = assignedRes.rows[0]?.AssignedQuiz_ID;

      const result = await db.query(`
        SELECT
          o."Question_ID",
          o."Option_ID",
          o."Option_Text",

          COUNT(DISTINCT qa."ActivityParticipant_ID") AS selected_count,

          ROUND(
            COUNT(DISTINCT qa."ActivityParticipant_ID") * 100.0
            / NULLIF(total.total_students,0),
            1
          ) AS percent,

          BOOL_OR(qco."Option_ID" IS NOT NULL) AS is_correct,

          ROUND(AVG(qa."Time_Spent")::numeric,1)::float AS avg_time

        FROM "QuestionOptions" o

        LEFT JOIN "QuizAnswers" qa
          ON qa."Choice_ID" = o."Option_ID"
         AND qa."AssignedQuiz_ID" = $1
         AND qa."Question_ID" = $2

        LEFT JOIN "Question_Correct_Options" qco
          ON qco."Question_ID" = o."Question_ID"
         AND qco."Option_ID" = o."Option_ID"

        CROSS JOIN (
          SELECT COUNT(DISTINCT "ActivityParticipant_ID") AS total_students
          FROM "QuizAnswers"
          WHERE "AssignedQuiz_ID" = $1
            AND "Question_ID" = $2
        ) total

        WHERE o."Question_ID" = $2

        GROUP BY
          o."Question_ID",
          o."Option_ID",
          o."Option_Text",
          total.total_students

        ORDER BY o."Option_ID"
      `,[assignedQuizId,questionId]);

      socket.emit("question_analysis_data", result.rows);

    }
    catch(err){

      console.error("❌ get_question_analysis error:",err.message);

      socket.emit("question_analysis_data",[]);

    }

  });



  /* =====================================================
     GET QUESTIONS IN ACTIVITY
  ===================================================== */

  socket.on("get_questions_by_activity", async ({ activitySessionId }) => {

    try {

      const res = await db.query(`
        SELECT
          q."Question_ID",
          q."Question_Text",
          q."Question_Type"

        FROM "Questions" q

        JOIN "AssignedQuiz" aq
          ON aq."Quiz_ID" = q."Set_ID"

        WHERE aq."ActivitySession_ID" = $1

        ORDER BY q."Question_ID"
      `,[activitySessionId]);

      socket.emit("questions_by_activity_data", res.rows);

    }
    catch(err){

      console.error("❌ get_questions_by_activity error:",err.message);

      socket.emit("questions_by_activity_data",[]);

    }

  });



  /* =====================================================
     FULL ANALYSIS (all questions)
  ===================================================== */

  socket.on("get_full_analysis", async ({ activitySessionId }) => {

    try {

      const assignedRes = await db.query(`
        SELECT "AssignedQuiz_ID"
        FROM "AssignedQuiz"
        WHERE "ActivitySession_ID"=$1
      `,[activitySessionId]);

      const assignedQuizId = assignedRes.rows[0]?.AssignedQuiz_ID;

      const result = await db.query(`
        SELECT

          qa."Question_ID",
          o."Option_ID",
          o."Option_Text",

          COUNT(DISTINCT qa."ActivityParticipant_ID") AS selected_count,

          ROUND(
            COUNT(DISTINCT qa."ActivityParticipant_ID") * 100.0
            / NULLIF(total.total_students,0),
            1
          ) AS percent,

          BOOL_OR(qco."Option_ID" IS NOT NULL) AS is_correct,

          ROUND(AVG(qa."Time_Spent")::numeric,1)::float AS avg_time

        FROM "QuestionOptions" o

        LEFT JOIN "QuizAnswers" qa
          ON qa."Choice_ID" = o."Option_ID"
         AND qa."AssignedQuiz_ID" = $1

        LEFT JOIN "Question_Correct_Options" qco
          ON qco."Question_ID" = o."Question_ID"
         AND qco."Option_ID" = o."Option_ID"

        CROSS JOIN (
          SELECT COUNT(DISTINCT "ActivityParticipant_ID") AS total_students
          FROM "QuizAnswers"
          WHERE "AssignedQuiz_ID" = $1
        ) total

        GROUP BY
          qa."Question_ID",
          o."Option_ID",
          o."Option_Text",
          total.total_students

        ORDER BY
          qa."Question_ID",
          o."Option_ID"
      `,[assignedQuizId]);

      socket.emit(
        "full_analysis_data",
        JSON.parse(JSON.stringify(result.rows))
      );

    }
    catch(err){

      console.error("❌ get_full_analysis error:",err.message);

      socket.emit("full_analysis_data",[]);

    }

  });

};