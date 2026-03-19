// const db = require("../db");

// module.exports = (io, socket) => {
//   socket.on("get_final_ranking", async ({ activitySessionId }) => {
//     try {

//       // 🔎 1️⃣ เช็คว่า session นี้เป็น team หรือ individual
//       const modeRes = await db.query(`
//         SELECT "Mode"
//         FROM "AssignedQuiz"
//         WHERE "ActivitySession_ID" = $1
//       `, [activitySessionId]);

//       const mode = modeRes.rows[0]?.Mode || "individual";

//       let result;

//       // ==============================
//       // 🧑‍🎓 INDIVIDUAL MODE
//       // ==============================
//       if (mode === "individual") {
//         result = await db.query(`
//           SELECT
//             s."Student_Name" AS name,
//             qr."Total_Score" AS total_score,
//             qr."Total_Time_Taken" AS total_time,

//             b."Body_Image",
//             c."Costume_Image",
//             m."Mask_Image",
//             a."Accessory_Image"

//           FROM "QuizResults" qr

//           JOIN "Students" s
//             ON s."Student_ID" = qr."Student_ID"

//           LEFT JOIN "Avatars" av
//             ON s."Avatar_ID" = av."Avatar_ID"

//           LEFT JOIN "AvatarBodies" b
//             ON av."Body_ID" = b."Body_ID"

//           LEFT JOIN "AvatarCostumes" c
//             ON av."Costume_ID" = c."Costume_ID"

//           LEFT JOIN "AvatarMasks" m
//             ON av."Mask_ID" = m."Mask_ID"

//           LEFT JOIN "AvatarAccessories" a
//             ON av."Accessory_ID" = a."Accessory_ID"

//           WHERE qr."ActivitySession_ID" = $1

//           ORDER BY total_score DESC, total_time ASC
//           LIMIT 5
//         `, [activitySessionId]);
//       }

//       // ==============================
//       // 👥 TEAM MODE
//       // ==============================
//       else {
//         result = await db.query(`
//           SELECT
//             ta."Team_Name" AS name,
//             SUM(qr."Total_Score") AS total_score,
//             SUM(qr."Total_Time_Taken") AS total_time
//           FROM "QuizResults" qr
//           JOIN "TeamMembers" tm
//             ON tm."Student_ID" = qr."Student_ID"
//           JOIN "TeamAssignments" ta
//             ON ta."Team_ID" = tm."Team_ID"
//           WHERE qr."ActivitySession_ID" = $1
//           AND ta."ActivitySession_ID" = $1
//           GROUP BY ta."Team_Name"
//           ORDER BY total_score DESC, total_time ASC
//           LIMIT 5
//         `, [activitySessionId]);
//       }

//       const ranking = result.rows.map(r => {

//         const row = {
//           name: r.name,
//           total_score: r.total_score,
//           total_time: r.total_time
//         };

//         // ⭐ ใส่ avatar เฉพาะ individual
//         if (mode === "individual") {
//           row.avatar = {
//             bodyPath: r.Body_Image,
//             costumePath: r.Costume_Image,
//             facePath: r.Mask_Image,
//             hairPath: r.Accessory_Image
//           };
//         }

//         return row;
//       });

//       io.to(`activity_${activitySessionId}`)
//         .emit("final_ranking_data", ranking);

//     } catch (err) {
//       console.error("❌ get_final_ranking error:", err.message);
//       socket.emit("final_ranking_data", []);
//     }
//   });

//   socket.on("finish_quiz_session", async ({ activitySessionId }) => {
//     try {

//       const result = await db.query(`
//         UPDATE "ActivitySessions"
//         SET "Status" = 'finished',
//             "Ended_At" = NOW()
//         WHERE "ActivitySession_ID" = $1
//         RETURNING "Ended_At"
//       `, [activitySessionId]);

//       const endedAt = result.rows[0].Ended_At;

//       const res = await db.query(`
//         UPDATE "ActivityParticipants"
//         SET "Left_At"=$1
//         WHERE "ActivitySession_ID"=$2
//         AND "Left_At" IS NULL
//         RETURNING "Student_ID"
//       `, [endedAt, activitySessionId]);

//       console.log("👥 participants updated:", res.rowCount);

//       socket.emit("quiz_session_finished_success");

//     } catch (err) {

//       console.error("❌ finish_quiz_session error:", err.message);

//     }
//   });


//   socket.on("get_final_result", async ({ activitySessionId, studentId }) => {
//     try {

//       // 🔎 เช็ค mode
//       const modeRes = await db.query(`
//         SELECT "Mode"
//         FROM "AssignedQuiz"
//         WHERE "ActivitySession_ID" = $1
//       `, [activitySessionId]);

//       const mode = modeRes.rows[0]?.Mode || "individual";

//       /* ===============================
//         👤 INDIVIDUAL MODE
//       =============================== */

//       if (mode === "individual") {

//         const resultRes = await db.query(`
//           SELECT 
//             s."Student_Name" AS name,
//             qr."Total_Score" AS score,
//             qr."Total_Time_Taken" AS time
//           FROM "QuizResults" qr
//           JOIN "Students" s
//             ON s."Student_ID" = qr."Student_ID"
//           WHERE qr."ActivitySession_ID" = $1
//             AND qr."Student_ID" = $2
//         `, [activitySessionId, studentId]);

//         if (!resultRes.rows.length) return;

//         const { name, score, time } = resultRes.rows[0];

//         const rankRes = await db.query(`
//           SELECT COUNT(*) + 1 AS rank
//           FROM "QuizResults"
//           WHERE "ActivitySession_ID" = $1
//             AND (
//               "Total_Score" > $2
//               OR (
//                 "Total_Score" = $2
//                 AND "Total_Time_Taken" < $3
//               )
//             )
//         `, [activitySessionId, score, time]);

//         const rank = Number(rankRes.rows[0].rank);

//         socket.emit("final_result", {
//           mode,
//           name,
//           score,
//           rank
//         });

//       }

//       /* ===============================
//         👥 TEAM MODE
//       =============================== */

//       else {

//         // 🔹 ดึงคะแนนของตัวเอง
//         const playerRes = await db.query(`
//           SELECT 
//             s."Student_Name" AS name,
//             qr."Total_Score" AS score
//           FROM "QuizResults" qr
//           JOIN "Students" s
//             ON s."Student_ID" = qr."Student_ID"
//           WHERE qr."ActivitySession_ID" = $1
//             AND qr."Student_ID" = $2
//         `, [activitySessionId, studentId]);

//         if (!playerRes.rows.length) return;

//         const { name, score } = playerRes.rows[0];

//         // 🔹 หาทีมของ student
//         const teamRes = await db.query(`
//           SELECT ta."Team_ID", ta."Team_Name"
//           FROM "TeamAssignments" ta
//           JOIN "TeamMembers" tm
//             ON tm."Team_ID" = ta."Team_ID"
//           WHERE ta."ActivitySession_ID" = $1
//             AND tm."Student_ID" = $2
//           LIMIT 1
//         `, [activitySessionId, studentId]);

//         if (!teamRes.rows.length) return;

//         const { Team_ID, Team_Name } = teamRes.rows[0];

//         // 🔹 คำนวณคะแนนทีม
//         const teamScoreRes = await db.query(`
//           SELECT 
//             SUM(qr."Total_Score") AS team_score,
//             SUM(qr."Total_Time_Taken") AS team_time
//           FROM "QuizResults" qr
//           JOIN "TeamMembers" tm
//             ON tm."Student_ID" = qr."Student_ID"
//           WHERE qr."ActivitySession_ID" = $1
//             AND tm."Team_ID" = $2
//         `, [activitySessionId, Team_ID]);

//         const teamScore = Number(teamScoreRes.rows[0].team_score || 0);
//         const teamTime = Number(teamScoreRes.rows[0].team_time || 0);

//         // 🔹 หาอันดับทีม
//         const teamRankRes = await db.query(`
//           SELECT COUNT(*) + 1 AS rank
//           FROM (
//             SELECT 
//               ta."Team_ID",
//               SUM(qr."Total_Score") AS score,
//               SUM(qr."Total_Time_Taken") AS time
//             FROM "QuizResults" qr
//             JOIN "TeamMembers" tm
//               ON tm."Student_ID" = qr."Student_ID"
//             JOIN "TeamAssignments" ta
//               ON ta."Team_ID" = tm."Team_ID"
//               AND ta."ActivitySession_ID" = $1
//             WHERE qr."ActivitySession_ID" = $1
//             GROUP BY ta."Team_ID"
//           ) t
//           WHERE 
//             t.score > $2
//             OR (
//               t.score = $2
//               AND t.time < $3
//             )
//         `, [activitySessionId, teamScore, teamTime]);

//         const teamRank = Number(teamRankRes.rows[0].rank);

//         socket.emit("final_result", {
//           mode,
//           name,
//           score,
//           teamName: Team_Name,
//           teamScore,
//           teamRank
//         });

//       }

//     } catch (err) {
//       console.error("❌ get_final_result error:", err.message);
//     }
//   });
// };



const db = require("../db");

module.exports = (io, socket) => {

  /* =====================================================
     FINAL RANKING
  ===================================================== */

  socket.on("get_final_ranking", async ({ activitySessionId }) => {
    try {

      const modeRes = await db.query(`
        SELECT "Mode","AssignedQuiz_ID"
        FROM "AssignedQuiz"
        WHERE "ActivitySession_ID" = $1
      `,[activitySessionId]);

      const mode = modeRes.rows[0]?.Mode || "individual";
      const assignedQuizId = modeRes.rows[0]?.AssignedQuiz_ID;

      let result;

      /* ================= INDIVIDUAL ================= */

      if (mode === "individual") {

        result = await db.query(`
          SELECT
            s."Student_Name" AS name,
            qr."Total_Score" AS total_score,
            qr."Total_Time_Taken" AS total_time,

            b."Body_Image",
            c."Costume_Image",
            m."Mask_Image",
            a."Accessory_Image"

          FROM "QuizResults" qr

          JOIN "ActivityParticipants" ap
            ON ap."ActivityParticipant_ID" = qr."ActivityParticipant_ID"

          JOIN "Students" s
            ON s."Student_ID" = ap."Student_ID"

          LEFT JOIN "Avatars" av
            ON s."Avatar_ID" = av."Avatar_ID"

          LEFT JOIN "AvatarBodies" b
            ON av."Body_ID" = b."Body_ID"

          LEFT JOIN "AvatarCostumes" c
            ON av."Costume_ID" = c."Costume_ID"

          LEFT JOIN "AvatarMasks" m
            ON av."Mask_ID" = m."Mask_ID"

          LEFT JOIN "AvatarAccessories" a
            ON av."Accessory_ID" = a."Accessory_ID"

          WHERE qr."AssignedQuiz_ID" = $1

          ORDER BY total_score DESC, total_time ASC
          LIMIT 5
        `,[assignedQuizId]);

      }

      /* ================= TEAM ================= */

      else {

        result = await db.query(`
          SELECT
            ta."Team_Name" AS name,
            SUM(qr."Total_Score") AS total_score,
            SUM(qr."Total_Time_Taken") AS total_time

          FROM "QuizResults" qr

          JOIN "TeamMembers" tm
            ON tm."ActivityParticipant_ID" = qr."ActivityParticipant_ID"

          JOIN "TeamAssignments" ta
            ON ta."Team_ID" = tm."Team_ID"
           AND ta."AssignedQuiz_ID" = $1

          GROUP BY ta."Team_Name"

          ORDER BY total_score DESC, total_time ASC
          LIMIT 5
        `,[assignedQuizId]);

      }

      const ranking = result.rows.map(r => {

        const row = {
          name: r.name,
          total_score: r.total_score,
          total_time: r.total_time
        };

        if (mode === "individual") {

          row.avatar = {
            bodyPath: r.Body_Image,
            costumePath: r.Costume_Image,
            facePath: r.Mask_Image,
            hairPath: r.Accessory_Image
          };

        }

        return row;

      });

      io.to(`activity_${activitySessionId}`)
        .emit("final_ranking_data", ranking);

    } catch (err) {

      console.error("❌ get_final_ranking error:", err.message);

      socket.emit("final_ranking_data", []);

    }
  });

  /* =====================================================
     FINISH QUIZ SESSION
  ===================================================== */

  socket.on("finish_quiz_session", async ({ activitySessionId }) => {

    try {

      const result = await db.query(`
        UPDATE "ActivitySessions"
        SET "Status"='finished',
            "Ended_At"=NOW()
        WHERE "ActivitySession_ID"=$1
        RETURNING "Ended_At"
      `,[activitySessionId]);

      const endedAt = result.rows[0].Ended_At;

      const res = await db.query(`
        UPDATE "ActivityParticipants"
        SET "Left_At"=$1
        WHERE "ActivitySession_ID"=$2
        AND "Left_At" IS NULL
        RETURNING "Student_ID"
      `,[endedAt,activitySessionId]);

      console.log("👥 participants updated:",res.rowCount);

      socket.emit("quiz_session_finished_success");

    }
    catch(err){

      console.error("❌ finish_quiz_session error:",err.message);

    }

  });

  /* =====================================================
     FINAL RESULT (PLAYER)
  ===================================================== */

  socket.on("get_final_result", async ({ activitySessionId, studentId }) => {

    try {

      const modeRes = await db.query(`
        SELECT "Mode","AssignedQuiz_ID"
        FROM "AssignedQuiz"
        WHERE "ActivitySession_ID"=$1
      `,[activitySessionId]);

      const mode = modeRes.rows[0]?.Mode || "individual";
      const assignedQuizId = modeRes.rows[0]?.AssignedQuiz_ID;

      /* ================= INDIVIDUAL ================= */

       const resultRes = await db.query(`
          SELECT 
            s."Student_Name" AS name,
            qr."Total_Score" AS score,
            qr."Total_Time_Taken" AS time
          FROM "QuizResults" qr
          JOIN "ActivityParticipants" ap
            ON ap."ActivityParticipant_ID" = qr."ActivityParticipant_ID"
          JOIN "Students" s
            ON s."Student_ID" = ap."Student_ID"
          WHERE qr."AssignedQuiz_ID" = $1
            AND ap."Student_ID" = $2
        `,[assignedQuizId,studentId]);

        if(!resultRes.rows.length) return;

        const { name, score, time } = resultRes.rows[0];

      if(mode === "individual"){

        const rankRes = await db.query(`
          SELECT COUNT(*) + 1 AS rank
          FROM "QuizResults"
          WHERE "AssignedQuiz_ID"=$1
          AND (
            "Total_Score" > $2
            OR (
              "Total_Score" = $2
              AND "Total_Time_Taken" < $3
            )
          )
        `,[assignedQuizId,score,time]);

        const rank = Number(rankRes.rows[0].rank);

        socket.emit("final_result",{
          mode,
          name,
          score,
          rank
        });

      }

      /* ================= TEAM ================= */

      else{

        const teamRes = await db.query(`
          SELECT ta."Team_ID", ta."Team_Name"
          FROM "TeamAssignments" ta
          JOIN "TeamMembers" tm
            ON tm."Team_ID" = ta."Team_ID"
          JOIN "ActivityParticipants" ap
            ON ap."ActivityParticipant_ID" = tm."ActivityParticipant_ID"
          WHERE ta."AssignedQuiz_ID"=$1
          AND ap."Student_ID"=$2
          LIMIT 1
        `,[assignedQuizId,studentId]);

        if(!teamRes.rows.length) return;

        const { Team_ID, Team_Name } = teamRes.rows[0];

        const teamScoreRes = await db.query(`
          SELECT 
            SUM(qr."Total_Score") AS team_score,
            SUM(qr."Total_Time_Taken") AS team_time
          FROM "QuizResults" qr
          JOIN "TeamMembers" tm
            ON tm."ActivityParticipant_ID" = qr."ActivityParticipant_ID"
          WHERE qr."AssignedQuiz_ID"=$1
          AND tm."Team_ID"=$2
        `,[assignedQuizId,Team_ID]);

        const teamScore = Number(teamScoreRes.rows[0].team_score || 0);
        const teamTime = Number(teamScoreRes.rows[0].team_time || 0);

        const teamRankRes = await db.query(`
          SELECT COUNT(*) + 1 AS rank
          FROM (
            SELECT 
              ta."Team_ID",
              SUM(qr."Total_Score") AS score,
              SUM(qr."Total_Time_Taken") AS time
            FROM "QuizResults" qr
            JOIN "TeamMembers" tm
              ON tm."ActivityParticipant_ID" = qr."ActivityParticipant_ID"
            JOIN "TeamAssignments" ta
              ON ta."Team_ID" = tm."Team_ID"
            WHERE ta."AssignedQuiz_ID"=$1
            GROUP BY ta."Team_ID"
          ) t
          WHERE t.score > $2
             OR (t.score=$2 AND t.time<$3)
        `,[assignedQuizId,teamScore,teamTime]);

        const teamRank = Number(teamRankRes.rows[0].rank);

        socket.emit("final_result",{
          mode,
          name,
          score,
          teamName: Team_Name,
          teamScore,
          teamRank
        });

      }

    }catch(err){

      console.error("❌ get_final_result error:",err.message);

    }

  });

};