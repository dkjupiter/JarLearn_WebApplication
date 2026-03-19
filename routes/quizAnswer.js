const db = require("../db");
const {
  calculateSingleScore,
  calculateMultipleScore,
  calculateOrderingScore,
} = require("../services/scoreCalculator");

const rankingSnapshot = {};

module.exports = (io, socket) => {

  console.log("📝 QuizAnswer socket ready:", socket.id);

  const submitLocks = new Set();

  /* =====================================================
     SUBMIT ANSWER
  ===================================================== */

  socket.on("submit_answer", async (payload) => {

    const {
      activitySessionId,
      quizId,
      questionId,
      studentId,
      questionType,
      choiceIds,
      timeSpent,
      currentQuestionIndex,
      totalQuestions
    } = payload;

    const lockKey = `${activitySessionId}-${questionId}-${studentId}`;

    if (submitLocks.has(lockKey)) return;

    submitLocks.add(lockKey);

    try {

      await db.query("BEGIN");

      /* ================= GET IDs ================= */

      const assignedRes = await db.query(`
        SELECT "AssignedQuiz_ID"
        FROM "AssignedQuiz"
        WHERE "ActivitySession_ID" = $1
      `, [activitySessionId]);

      const assignedQuizId =
        assignedRes.rows[0]?.AssignedQuiz_ID;

      const partiRes = await db.query(`
        SELECT "ActivityParticipant_ID"
        FROM "ActivityParticipants"
        WHERE "ActivitySession_ID" = $1
        AND "Student_ID" = $2
      `, [activitySessionId, studentId]);

      const participantId =
        partiRes.rows[0]?.ActivityParticipant_ID;

      /* ================= DELETE OLD ANSWER ================= */

      await db.query(`
        DELETE FROM "QuizAnswers"
        WHERE "AssignedQuiz_ID" = $1
        AND "Question_ID" = $2
        AND "ActivityParticipant_ID" = $3
      `, [
        assignedQuizId,
        questionId,
        participantId
      ]);

      let isCorrect = false;

      /* =====================================================
         ORDERING QUESTION
      ===================================================== */

      if (questionType === "ordering") {

        for (const ans of choiceIds) {

          await db.query(`
            INSERT INTO "QuizAnswers"
            (
              "AssignedQuiz_ID",
              "Question_ID",
              "ActivityParticipant_ID",
              "Choice_ID",
              "Answer_Order",
              "Answered_At",
              "Time_Spent"
            )
            VALUES ($1,$2,$3,$4,$5,NOW(),$6)
          `,
            [
              assignedQuizId,
              questionId,
              participantId,
              ans.optionId,
              ans.order,
              timeSpent
            ]);

        }

        const studentOrder =
          choiceIds
            .sort((a, b) => a.order - b.order)
            .map(a => Number(a.optionId));

        const correctRes = await db.query(`
          SELECT "Option_ID"
          FROM "QuestionOptions"
          WHERE "Question_ID" = $1
          ORDER BY "Option_ID"
        `, [questionId]);

        const correctOrder =
          correctRes.rows.map(r => Number(r.Option_ID));

        isCorrect =
          studentOrder.length === correctOrder.length &&
          studentOrder.every((id, i) => id === correctOrder[i]);

      }

      /* =====================================================
         SINGLE / MULTIPLE
      ===================================================== */

      else {

        const correctRes = await db.query(`
          SELECT "Option_ID"
          FROM "Question_Correct_Options"
          WHERE "Question_ID" = $1
        `, [questionId]);

        const correctOptionIds =
          correctRes.rows.map(r => Number(r.Option_ID));

        const selectedIds =
          choiceIds.map(Number);

        if (selectedIds.length === 0) {

          isCorrect = false;

        }
        else if (correctOptionIds.length === 1) {

          isCorrect =
            selectedIds[0] === correctOptionIds[0];

        }
        else {

          isCorrect =
            selectedIds.length === correctOptionIds.length &&
            selectedIds.every(id =>
              correctOptionIds.includes(id)
            );

        }

        for (const choiceId of choiceIds) {

          await db.query(`
            INSERT INTO "QuizAnswers"
            (
              "AssignedQuiz_ID",
              "Question_ID",
              "ActivityParticipant_ID",
              "Choice_ID",
              "Answered_At",
              "Time_Spent"
            )
            VALUES ($1,$2,$3,$4,NOW(),$5)
          `,
            [
              assignedQuizId,
              questionId,
              participantId,
              choiceId,
              timeSpent
            ]);

        }

      }

      socket.emit("answer_result", {
        questionId,
        isCorrect
      });

      /* =====================================================
         UPDATE PROGRESS
      ===================================================== */

      await db.query(`
        INSERT INTO "QuizProgress"
        (
          "AssignedQuiz_ID",
          "ActivityParticipant_ID",
          "Current_Question",
          "Total_Questions",
          "Updated_At"
        )
        VALUES ($1,$2,$3,$4,NOW())
        ON CONFLICT ("AssignedQuiz_ID","ActivityParticipant_ID")
        DO UPDATE SET
          "Current_Question" = GREATEST(
            "QuizProgress"."Current_Question",
            EXCLUDED."Current_Question"
          ),
          "Updated_At" = NOW()
      `,
        [
          assignedQuizId,
          participantId,
          currentQuestionIndex ?? 1,
          totalQuestions ?? 1
        ]);

      /* =====================================================
   CALCULATE SCORE
===================================================== */

      let score = 0;
      let correctAdd = 0;
      let incorrectAdd = 0;
      let questionAdd = 1;

      if (!choiceIds || choiceIds.length === 0) {

        score = 0;

      } else {

        const assignedTimer = await db.query(`
          SELECT "Question_Time"
          FROM "AssignedQuiz"
          WHERE "AssignedQuiz_ID" = $1
        `, [assignedQuizId]);

        const maxTime =
          assignedTimer.rows[0]?.Question_Time ?? timeSpent;

        /* ---------- SINGLE ---------- */

        if (questionType === "single") {

          score = calculateSingleScore({
            isCorrect,
            timeSpent,
            maxTime
          });

        }

        /* ---------- MULTIPLE ---------- */

        else if (questionType === "multiple") {

          const correctRes = await db.query(`
            SELECT "Option_ID"
            FROM "Question_Correct_Options"
            WHERE "Question_ID" = $1
          `, [questionId]);

          const correctOptionIds =
            correctRes.rows.map(r => Number(r.Option_ID));

          const selectedIds =
            choiceIds.map(Number);

          const correctCount =
            selectedIds.filter(id =>
              correctOptionIds.includes(id)
            ).length;

          score = calculateMultipleScore({
            correctCount,
            wrongCount: selectedIds.length - correctCount,
            maxTime,
            timeSpent
          });

        }

        /* ---------- ORDERING ---------- */

        else if (questionType === "ordering") {

          const correctRes = await db.query(`
            SELECT "Option_ID"
            FROM "QuestionOptions"
            WHERE "Question_ID" = $1
            ORDER BY "Option_ID"
          `, [questionId]);

          const correctOrder =
            correctRes.rows.map(r => Number(r.Option_ID));

          const studentOrder =
            choiceIds
              .sort((a, b) => a.order - b.order)
              .map(a => Number(a.optionId));

          score = calculateOrderingScore({
            correctOrder,
            studentOrder,
            maxTime,
            timeSpent
          });

        }

      }

      if (isCorrect) correctAdd = 1;
      else incorrectAdd = 1;

      /* =====================================================
         UPSERT QUIZ RESULTS
      ===================================================== */

      await db.query(`
        INSERT INTO "QuizResults"
        (
          "ActivityParticipant_ID",
          "AssignedQuiz_ID",
          "Total_Score",
          "Total_Time_Taken",
          "Total_Correct",
          "Total_Incorrct",
          "Total_Question"
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT ("ActivityParticipant_ID","AssignedQuiz_ID")
        DO UPDATE SET
          "Total_Score" =
            "QuizResults"."Total_Score" + EXCLUDED."Total_Score",
          "Total_Time_Taken" =
            "QuizResults"."Total_Time_Taken" + EXCLUDED."Total_Time_Taken",
          "Total_Correct" =
            "QuizResults"."Total_Correct" + EXCLUDED."Total_Correct",
          "Total_Incorrct" =
            "QuizResults"."Total_Incorrct" + EXCLUDED."Total_Incorrct",
          "Total_Question" =
            "QuizResults"."Total_Question" + EXCLUDED."Total_Question"
      `,
        [
          participantId,
          assignedQuizId,
          score,
          timeSpent,
          correctAdd,
          incorrectAdd,
          questionAdd
        ]);

      /* =====================================================
         REALTIME RESULT
      ===================================================== */

      const totalRes = await db.query(`
        SELECT "Total_Score"
        FROM "QuizResults"
        WHERE "ActivityParticipant_ID" = $1
        AND "AssignedQuiz_ID" = $2
      `,
        [
          participantId,
          assignedQuizId
        ]);

      const totalScore =
        totalRes.rows[0]?.Total_Score ?? 0;

      io.to(`activity_${activitySessionId}`).emit(
        "student_result",
        {
          studentId,
          scoreForThis: score,
          totalScore
        }
      );

      socket.emit("submit_answer_success", {
        questionId,
        studentId
      });

      // io.emit("quiz_progress_updated", {
      //   activitySessionId
      // });

      io.to(`activity_${activitySessionId}`).emit("quiz_progress_updated", {
        activitySessionId
      });

      socket.emit("check_quiz_finished", {
        activitySessionId
      });

      await db.query("COMMIT");

    } catch (err) {

      await db.query("ROLLBACK");

      console.error("❌ submit_answer error:", err.message);

      socket.emit("submit_answer_error", {
        message: err.message
      });

    } finally {

      submitLocks.delete(lockKey);

    }

  });

  /* =====================================================
     CHECK ANSWER STATUS
  ===================================================== */

  socket.on("check_answer_status", async ({
    activitySessionId,
    questionId,
    studentId,
    questionType
  }) => {

    try {

      /* ---------- หา IDs ---------- */

      const assignedRes = await db.query(`
        SELECT "AssignedQuiz_ID"
        FROM "AssignedQuiz"
        WHERE "ActivitySession_ID" = $1
      `, [activitySessionId]);

      const assignedQuizId =
        assignedRes.rows[0]?.AssignedQuiz_ID;

      const partiRes = await db.query(`
        SELECT "ActivityParticipant_ID"
        FROM "ActivityParticipants"
        WHERE "ActivitySession_ID" = $1
        AND "Student_ID" = $2
      `, [activitySessionId, studentId]);

      const participantId =
        partiRes.rows[0]?.ActivityParticipant_ID;

      /* ---------- ดึงคำตอบ ---------- */

      const answerRes = await db.query(`
        SELECT *
        FROM "QuizAnswers"
        WHERE "AssignedQuiz_ID" = $1
        AND "Question_ID" = $2
        AND "ActivityParticipant_ID" = $3
      `,
        [
          assignedQuizId,
          questionId,
          participantId
        ]);

      if (answerRes.rowCount === 0) {

        return socket.emit("answer_status", {
          alreadyAnswered: false,
          questionId
        });

      }

      const timeSpent =
        answerRes.rows[0]?.Time_Spent ?? 0;

      /* ---------- maxTime ---------- */

      const assignedTimer = await db.query(`
        SELECT "Question_Time"
        FROM "AssignedQuiz"
        WHERE "AssignedQuiz_ID" = $1
      `, [assignedQuizId]);

      const maxTime =
        assignedTimer.rows[0]?.Question_Time ?? timeSpent;

      let isCorrect = false;
      let scoreForThis = 0;

      /* =====================================================
         SINGLE / MULTIPLE
      ===================================================== */

      if (questionType === "single" || questionType === "multiple") {

        const correctRes = await db.query(`
          SELECT "Option_ID"
          FROM "Question_Correct_Options"
          WHERE "Question_ID" = $1
        `, [questionId]);

        const correctOptionIds =
          correctRes.rows.map(r => Number(r.Option_ID));

        const selectedIds =
          answerRes.rows.map(r => Number(r.Choice_ID));

        if (questionType === "single") {

          isCorrect =
            selectedIds.length === 1 &&
            selectedIds[0] === correctOptionIds[0];

          scoreForThis = calculateSingleScore({
            isCorrect,
            timeSpent,
            maxTime
          });

        }
        else {

          const correctCount =
            selectedIds.filter(id =>
              correctOptionIds.includes(id)
            ).length;

          isCorrect =
            selectedIds.length === correctOptionIds.length &&
            correctCount === correctOptionIds.length;

          scoreForThis = calculateMultipleScore({
            correctCount,
            wrongCount: selectedIds.length - correctCount,
            maxTime,
            timeSpent
          });

        }

      }

      /* =====================================================
         ORDERING
      ===================================================== */

      else if (questionType === "ordering") {

        const correctRes = await db.query(`
          SELECT "Option_ID"
          FROM "QuestionOptions"
          WHERE "Question_ID" = $1
          ORDER BY "Option_ID"
        `, [questionId]);

        const correctOrder =
          correctRes.rows.map(r => Number(r.Option_ID));

        const studentOrder =
          answerRes.rows
            .sort((a, b) => a.Answer_Order - b.Answer_Order)
            .map(r => Number(r.Choice_ID));

        isCorrect =
          studentOrder.length === correctOrder.length &&
          studentOrder.every((id, i) => id === correctOrder[i]);

        scoreForThis = calculateOrderingScore({
          correctOrder,
          studentOrder,
          maxTime,
          timeSpent
        });

      }

      /* ---------- ดึงคะแนนรวม ---------- */

      const totalRes = await db.query(`
        SELECT "Total_Score"
        FROM "QuizResults"
        WHERE "ActivityParticipant_ID" = $1
        AND "AssignedQuiz_ID" = $2
      `,
        [
          participantId,
          assignedQuizId
        ]);

      const totalScore =
        totalRes.rows[0]?.Total_Score ?? 0;

      socket.emit("answer_status", {
        alreadyAnswered: true,
        isCorrect,
        scoreForThis,
        totalScore,
        timeSpent,
        questionId
      });

    } catch (err) {

      console.error("❌ check_answer_status error:", err.message);

    }

  });

  /* =====================================================
     QUIZ PROGRESS
  ===================================================== */

  socket.on("get_quiz_progress", async ({ activitySessionId }) => {

    try {

      const res = await db.query(`
        SELECT
          s."Student_ID",
          s."Student_Name",
          COALESCE(qp."Current_Question",0) AS current_question,
          COALESCE(qp."Total_Questions",0) AS total_questions,
          ROUND(
            COALESCE(qp."Current_Question",0)*100.0
            / NULLIF(qp."Total_Questions",0)
          ) AS percent
        FROM "ActivityParticipants" ap
        JOIN "Students" s
          ON s."Student_ID" = ap."Student_ID"
        LEFT JOIN "QuizProgress" qp
          ON qp."ActivityParticipant_ID" = ap."ActivityParticipant_ID"
        WHERE ap."ActivitySession_ID" = $1
        AND ap."Left_At" IS NULL
        ORDER BY s."Student_Name"
      `, [activitySessionId]);

      socket.emit("quiz_progress_data", res.rows);

    } catch (err) {

      console.error("❌ get_quiz_progress error:", err.message);

      socket.emit("quiz_progress_data", []);

    }

  });

  /* =====================================================
     CHECK QUIZ FINISHED
  ===================================================== */

  socket.on("check_quiz_finished", async ({ activitySessionId }) => {

    try {

      const res = await db.query(`
        SELECT
          COUNT(*) FILTER (
            WHERE "Current_Question" >= "Total_Questions"
          ) AS finished,
          COUNT(*) AS total
        FROM "QuizProgress"
        WHERE "AssignedQuiz_ID" = (
          SELECT "AssignedQuiz_ID"
          FROM "AssignedQuiz"
          WHERE "ActivitySession_ID" = $1
        )
      `, [activitySessionId]);

      const { finished, total } = res.rows[0];

      socket.emit("quiz_finished_status", {
        finished: Number(finished),
        total: Number(total),
        isFinished:
          Number(finished) === Number(total) &&
          total > 0
      });

      if (Number(finished) === Number(total) && total > 0) {

        socket.broadcast.emit("quiz_auto_finished", {
          activitySessionId
        });

      }

    } catch (err) {

      console.error("❌ check_quiz_finished error:", err.message);

    }

  });
  /* =====================================================
   CALCULATE RANKING
===================================================== */

  socket.on("calculate_ranking", async ({ activitySessionId }) => {

    try {

      const modeRes = await db.query(`
        SELECT "Mode"
        FROM "AssignedQuiz"
        WHERE "ActivitySession_ID" = $1
      `, [activitySessionId]);

      const mode = modeRes.rows[0]?.Mode || "individual";

      let result;

      /* ================= INDIVIDUAL ================= */

      if (mode === "individual") {

        result = await db.query(`
          SELECT
            s."Student_ID",
            s."Student_Name" AS name,
            qr."Total_Score" AS score,
            qr."Total_Time_Taken" AS time,
            RANK() OVER (
              ORDER BY qr."Total_Score" DESC,
                       qr."Total_Time_Taken" ASC
            ) AS rank
          FROM "QuizResults" qr
          JOIN "ActivityParticipants" ap
            ON ap."ActivityParticipant_ID" = qr."ActivityParticipant_ID"
          JOIN "Students" s
            ON s."Student_ID" = ap."Student_ID"
          WHERE qr."AssignedQuiz_ID" = (
            SELECT "AssignedQuiz_ID"
            FROM "AssignedQuiz"
            WHERE "ActivitySession_ID" = $1
          )
          ORDER BY
            qr."Total_Score" DESC,
            qr."Total_Time_Taken" ASC
        `, [activitySessionId]);

      }

      /* ================= TEAM ================= */

      else {

        result = await db.query(`
          SELECT
  ta."Team_ID",
  ta."Team_Name" AS name,
  SUM(qr."Total_Score") AS score,
  SUM(qr."Total_Time_Taken") AS time,
  RANK() OVER (
    ORDER BY SUM(qr."Total_Score") DESC,
             SUM(qr."Total_Time_Taken") ASC
  ) AS rank

FROM "QuizResults" qr

JOIN "TeamMembers" tm
  ON tm."ActivityParticipant_ID" = qr."ActivityParticipant_ID"

JOIN "TeamAssignments" ta
  ON ta."Team_ID" = tm."Team_ID"

JOIN "AssignedQuiz" aq
  ON aq."AssignedQuiz_ID" = ta."AssignedQuiz_ID"

WHERE aq."ActivitySession_ID" = $1

GROUP BY ta."Team_ID", ta."Team_Name"

ORDER BY score DESC, time ASC;
        `, [activitySessionId]);

      }

      const rows = result.rows;

      rankingSnapshot[activitySessionId] = rows;

      const top5 = rows.slice(0, 5);

      io.to(`activity_${activitySessionId}`)
        .emit("question_ranking", top5);

      io.to(`activity_${activitySessionId}`)
        .emit("go_to_ranking");

    }
    catch (err) {

      console.error("❌ calculate_ranking error:", err.message);

    }

  });


  /* =====================================================
     REQUEST MY RANK
  ===================================================== */

  socket.on("request_my_rank", async ({ activitySessionId, studentId }) => {

    try {

      const snapshot =
        rankingSnapshot[activitySessionId];

      if (!snapshot) {

        return socket.emit("my_rank_update", {
          studentId,
          rank: null
        });

      }

      const modeRes = await db.query(`
        SELECT "Mode"
        FROM "AssignedQuiz"
        WHERE "ActivitySession_ID" = $1
      `, [activitySessionId]);

      const mode = modeRes.rows[0]?.Mode || "individual";

      /* ================= INDIVIDUAL ================= */

      if (mode === "individual") {

        const myData = snapshot.find(
          r => Number(r.Student_ID) === Number(studentId)
        );

        const myRank = myData?.rank ?? null;

        socket.emit("my_rank_update", {
          studentId,
          rank: myRank
        });

      }

      /* ================= TEAM ================= */

      else {

        const teamRes = await db.query(`
          SELECT ta."Team_ID"
          FROM "TeamAssignments" ta

          JOIN "AssignedQuiz" aq
            ON aq."AssignedQuiz_ID" = ta."AssignedQuiz_ID"

          JOIN "TeamMembers" tm
            ON tm."Team_ID" = ta."Team_ID"

          JOIN "ActivityParticipants" ap
            ON ap."ActivityParticipant_ID" = tm."ActivityParticipant_ID"

          WHERE aq."ActivitySession_ID" = $1
          AND ap."Student_ID" = $2

          LIMIT 1
        `, [activitySessionId, studentId]);

        const teamId =
          teamRes.rows[0]?.Team_ID;

        if (!teamId) {

          return socket.emit("my_rank_update", {
            studentId,
            teamRank: null
          });

        }

        const myTeamData = snapshot.find(
          r => Number(r.Team_ID) === Number(teamId)
        );

        const teamRank =
          myTeamData?.rank ?? null;

        const teamScore =
          myTeamData?.score ?? 0;

        const teamName =
          myTeamData?.name ?? null;

        socket.emit("my_rank_update", {
          studentId,
          teamRank,
          teamScore,
          teamName
        });

      }

    }
    catch (err) {

      console.error("❌ request_my_rank error:", err.message);

    }

  });


  /* =====================================================
     END ACTIVITY
  ===================================================== */

  socket.on("end_activity_and_kick_students", ({ activitySessionId }) => {

    delete rankingSnapshot[activitySessionId];

    io.to(`activity_${activitySessionId}`)
      .emit("force_back_to_lobby");

  });

};