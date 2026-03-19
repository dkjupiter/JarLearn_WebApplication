// const db = require("../db");

// module.exports = (io, socket) => {
//     /* ===========================
//    POLL VOTE
//    =========================== */

//     socket.on("submit_poll_vote", async ({ pollId, optionId, studentId }) => {

//         try {

//             const already = await db.query(`
//       SELECT * FROM "PollAnswers"
//       WHERE "AssignedPoll_ID"=$1
//       AND "Student_ID"=$2
//     `, [pollId, studentId])

//             if (already.rows.length > 0) {
//                 return
//             }

//             await db.query(`
//                 INSERT INTO "PollAnswers"
//                 ("AssignedPoll_ID","PollOption_ID","Student_ID")
//                 VALUES ($1,$2,$3)
//                 `, [pollId, optionId, studentId])

//             const results = await db.query(`
//                 SELECT 
//                     o."PollOption_ID",
//                     o."Option_Text",
//                     COUNT(a."PollAnswer_ID") AS votes
//                 FROM "PollOptions" o
//                 LEFT JOIN "PollAnswers" a
//                 ON a."PollOption_ID" = o."PollOption_ID"
//                 AND a."AssignedPoll_ID" = o."AssignedPoll_ID"
//                 WHERE o."AssignedPoll_ID" = $1
//                 GROUP BY o."PollOption_ID", o."Option_Text"
//                 ORDER BY o."PollOption_ID";
//                 `, [pollId])

//             const pollRes = await db.query(`
//                 SELECT "ActivitySession_ID"
//                 FROM "AssignedPoll"
//                 WHERE "AssignedPoll_ID"=$1
//                 `, [pollId])

//             const activitySessionId = pollRes.rows[0].ActivitySession_ID

//             io.to(`activity_${activitySessionId}`).emit(
//                 "poll_result_update",
//                 results.rows
//             )

//         } catch (err) {
//             console.error(err)
//         }

//     });

//     socket.on("end_poll", async (payload) => {

//         const pollId = payload?.pollId

//         if (!pollId) {
//             console.log("⚠ end_poll called without pollId")
//             return
//         }

//         try {

//             const pollRes = await db.query(`
//             SELECT "ActivitySession_ID"
//             FROM "AssignedPoll"
//             WHERE "AssignedPoll_ID"=$1
//         `, [pollId])

//             const activitySessionId = pollRes.rows[0].ActivitySession_ID

//             /* 2️⃣ update activity และดึง Ended_At */
//             const result = await db.query(`
//             UPDATE "ActivitySessions"
//             SET "Status"='finished',
//                 "Ended_At"=NOW()
//             WHERE "ActivitySession_ID"=$1
//             RETURNING "Ended_At"
//             `, [activitySessionId]);

//             const endedAt = result.rows[0].Ended_At;

//             /* 3️⃣ update participants */
//             await db.query(`
//             UPDATE "ActivityParticipants"
//             SET "Left_At"=$1
//             WHERE "ActivitySession_ID"=$2
//             AND "Left_At" IS NULL
//             `, [endedAt, activitySessionId]);

//             io.to(`activity_${activitySessionId}`).emit("poll_ended", {
//                 pollId
//             })

//         } catch (err) {

//             console.error("end_poll error:", err)

//         }

//     })

//     socket.on("get_poll", async ({ activitySessionId }) => {

//         const pollRes = await db.query(`
//             SELECT *
//             FROM "AssignedPoll"
//             WHERE "ActivitySession_ID"=$1
//             `, [activitySessionId])

//         if (!pollRes.rows.length) return

//         const poll = pollRes.rows[0]

//         const options = await db.query(`
//             SELECT *
//             FROM "PollOptions"
//             WHERE "AssignedPoll_ID"=$1
//             ORDER BY "PollOption_ID"
//             `, [poll.AssignedPoll_ID])

//         console.log("activitySessionId", activitySessionId)
    
//         const totalStudentsRes = await db.query(`
//             SELECT COUNT(*) 
//             FROM "ActivityParticipants"
//             WHERE "ActivitySession_ID" = $1
//             `, [activitySessionId])

//         const totalStudents = Number(totalStudentsRes.rows[0].count)

//         console.log("totalStudents", totalStudentsRes.rows)
//         socket.emit("poll_started", {
//             pollId: poll.AssignedPoll_ID,
//             question: poll.Poll_Question,
//             options: options.rows,
//             totalStudents
        
//         })

//     })

//     socket.on("close_poll", async ({ pollId }) => {

//         try {

//             const pollRes = await db.query(`
//                 SELECT "ActivitySession_ID"
//                 FROM "AssignedPoll"
//                 WHERE "AssignedPoll_ID"=$1
//             `, [pollId])

//             const activitySessionId = pollRes.rows[0].ActivitySession_ID

//             // broadcast ปิดโหวต
//             io.to(`activity_${activitySessionId}`).emit("poll_closed")

//         } catch (err) {

//             console.error("close_poll error:", err)

//         }

//     })

//     socket.on("get_poll_logs", async ({ classId }) => {
//         try {

//             const result = await db.query(`
//       SELECT
//         ap."AssignedPoll_ID",
//         ap."Poll_Question",
//         ap."Created_At",
//         COUNT(DISTINCT pa."Student_ID") AS student_count
//       FROM "AssignedPoll" ap
//       JOIN "ActivitySessions" s
//         ON s."ActivitySession_ID" = ap."ActivitySession_ID"
//       LEFT JOIN "PollAnswers" pa
//         ON pa."AssignedPoll_ID" = ap."AssignedPoll_ID"
//       WHERE s."Class_ID" = $1
//       GROUP BY ap."AssignedPoll_ID"
//       ORDER BY ap."Created_At" DESC
//     `, [classId]);

//             socket.emit("poll_logs_data", result.rows);

//         } catch (err) {
//             console.error(err);
//             socket.emit("poll_logs_data", []);
//         }
//     });

//     socket.on("get_poll_result", async ({ assignedPollId }) => {
//         try {

//             const options = await db.query(`
//       SELECT
//         po."PollOption_ID",
//         po."Option_Text",
//         COUNT(pa."Student_ID") AS votes
//       FROM "PollOptions" po
//       LEFT JOIN "PollAnswers" pa
//         ON pa."PollOption_ID" = po."PollOption_ID"
//         AND pa."AssignedPoll_ID" = po."AssignedPoll_ID"
//       WHERE po."AssignedPoll_ID" = $1
//       GROUP BY po."PollOption_ID", po."Option_Text"
//       ORDER BY po."PollOption_ID"
//     `, [assignedPollId]);

//             const total = options.rows.reduce(
//                 (sum, o) => sum + Number(o.votes),
//                 0
//             );

//             const result = options.rows.map(o => ({
//                 text: o.Option_Text,
//                 votes: Number(o.votes),
//                 percent: total === 0
//                     ? 0
//                     : Math.round((o.votes / total) * 100)
//             }));

//             socket.emit("poll_result_data", result);

//         } catch (err) {
//             console.error(err);
//             socket.emit("poll_result_data", []);
//         }
//     });
// };


const db = require("../db");

module.exports = (io, socket) => {
    /* ===========================
   POLL VOTE
   =========================== */

    socket.on("submit_poll_vote", async ({ pollId, optionId, studentId }) => {

        try {

            const already = await db.query(`
                SELECT 1
                FROM "PollAnswers" pa
                JOIN "PollOptions" po
                ON po."PollOption_ID" = pa."PollOption_ID"
                WHERE po."AssignedPoll_ID"=$1
                AND pa."ActivityParticipant_ID"=$2
                LIMIT 1
                `, [pollId, studentId])

            if (already.rows.length > 0) {
                return
            }

            const partiRes = await db.query(`
                SELECT "ActivityParticipant_ID"
                FROM "ActivityParticipants"
                WHERE "Student_ID"=$1
                AND "ActivitySession_ID" = (
                SELECT "ActivitySession_ID"
                FROM "AssignedPoll"
                WHERE "AssignedPoll_ID"=$2
                )
            `, [studentId, pollId]);

            const participantId = partiRes.rows[0]?.ActivityParticipant_ID;
            if (!participantId) return;

            await db.query(`
                INSERT INTO "PollAnswers"
                ("PollOption_ID","ActivityParticipant_ID")
                VALUES ($1,$2)
                `, [optionId, participantId])

            const results = await db.query(`
                SELECT 
                    o."PollOption_ID",
                    o."Option_Text",
                    COUNT(a."PollAnswer_ID") AS votes
                FROM "PollOptions" o
                LEFT JOIN "PollAnswers" a
                ON a."PollOption_ID" = o."PollOption_ID"
                WHERE o."AssignedPoll_ID" = $1
                GROUP BY o."PollOption_ID", o."Option_Text"
                ORDER BY o."PollOption_ID";
                `, [pollId])

            const pollRes = await db.query(`
                SELECT "ActivitySession_ID"
                FROM "AssignedPoll"
                WHERE "AssignedPoll_ID"=$1
                `, [pollId])

            const activitySessionId = pollRes.rows[0].ActivitySession_ID

            io.to(`activity_${activitySessionId}`).emit(
                "poll_result_update",
                results.rows
            )

        } catch (err) {
            console.error(err)
        }

    });

    socket.on("end_poll", async (payload) => {

        const pollId = payload?.pollId

        if (!pollId) {
            console.log("⚠ end_poll called without pollId")
            return
        }

        try {

            const pollRes = await db.query(`
            SELECT "ActivitySession_ID"
            FROM "AssignedPoll"
            WHERE "AssignedPoll_ID"=$1
        `, [pollId])

            const activitySessionId = pollRes.rows[0].ActivitySession_ID

            /* 2️⃣ update activity และดึง Ended_At */
            const result = await db.query(`
            UPDATE "ActivitySessions"
            SET "Status"='finished',
                "Ended_At"=NOW()
            WHERE "ActivitySession_ID"=$1
            RETURNING "Ended_At"
            `, [activitySessionId]);

            const endedAt = result.rows[0].Ended_At;

            /* 3️⃣ update participants */
            await db.query(`
            UPDATE "ActivityParticipants"
            SET "Left_At"=$1
            WHERE "ActivitySession_ID"=$2
            AND "Left_At" IS NULL
            `, [endedAt, activitySessionId]);

            io.to(`activity_${activitySessionId}`).emit("poll_ended", {
                pollId
            })

        } catch (err) {

            console.error("end_poll error:", err)

        }

    })

    socket.on("get_poll", async ({ activitySessionId }) => {

        const pollRes = await db.query(`
            SELECT *
            FROM "AssignedPoll"
            WHERE "ActivitySession_ID"=$1
            `, [activitySessionId])

        if (!pollRes.rows.length) return

        const poll = pollRes.rows[0]

        const options = await db.query(`
            SELECT *
            FROM "PollOptions"
            WHERE "AssignedPoll_ID"=$1
            ORDER BY "PollOption_ID"
            `, [poll.AssignedPoll_ID])

        console.log("activitySessionId", activitySessionId)
    
        const totalStudentsRes = await db.query(`
            SELECT COUNT(*) 
            FROM "ActivityParticipants"
            WHERE "ActivitySession_ID" = $1
            `, [activitySessionId])

        const totalStudents = Number(totalStudentsRes.rows[0].count)

        console.log("totalStudents", totalStudentsRes.rows)
        socket.emit("poll_started", {
            pollId: poll.AssignedPoll_ID,
            question: poll.Poll_Question,
            options: options.rows,
            totalStudents
        
        })

    })

    socket.on("close_poll", async ({ pollId }) => {

        try {

            const pollRes = await db.query(`
                SELECT "ActivitySession_ID"
                FROM "AssignedPoll"
                WHERE "AssignedPoll_ID"=$1
            `, [pollId])

            const activitySessionId = pollRes.rows[0].ActivitySession_ID

            // broadcast ปิดโหวต
            io.to(`activity_${activitySessionId}`).emit("poll_closed")

        } catch (err) {

            console.error("close_poll error:", err)

        }

    })

    socket.on("get_poll_logs", async ({ classId }) => {
        try {

            const result = await db.query(`
      SELECT
  ap."AssignedPoll_ID",
  ap."Poll_Question",
  ap."Created_At",
  COUNT(DISTINCT pa."ActivityParticipant_ID") AS student_count
FROM "AssignedPoll" ap
JOIN "ActivitySessions" s
  ON s."ActivitySession_ID" = ap."ActivitySession_ID"

LEFT JOIN "PollOptions" po
  ON po."AssignedPoll_ID" = ap."AssignedPoll_ID"

LEFT JOIN "PollAnswers" pa
  ON pa."PollOption_ID" = po."PollOption_ID"

WHERE s."Class_ID" = $1
GROUP BY ap."AssignedPoll_ID"
ORDER BY ap."Created_At" DESC
    `, [classId]);

            socket.emit("poll_logs_data", result.rows);

        } catch (err) {
            console.error(err);
            socket.emit("poll_logs_data", []);
        }
    });

    socket.on("get_poll_result", async ({ assignedPollId }) => {
        try {

            const options = await db.query(`
                SELECT
                po."PollOption_ID",
                po."Option_Text",
                COUNT(pa."PollAnswer_ID") AS votes
                FROM "PollOptions" po
                LEFT JOIN "PollAnswers" pa
                ON pa."PollOption_ID" = po."PollOption_ID"
                WHERE po."AssignedPoll_ID"=$1
                GROUP BY po."PollOption_ID"
                ORDER BY po."PollOption_ID"
            `, [assignedPollId]);

            const total = options.rows.reduce(
                (sum, o) => sum + Number(o.votes),
                0
            );

            const result = options.rows.map(o => ({
                text: o.Option_Text,
                votes: Number(o.votes),
                percent: total === 0
                    ? 0
                    : Math.round((o.votes / total) * 100)
            }));

            socket.emit("poll_result_data", result);

        } catch (err) {
            console.error(err);
            socket.emit("poll_result_data", []);
        }
    });
};