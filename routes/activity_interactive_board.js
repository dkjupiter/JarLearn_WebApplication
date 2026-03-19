// const db = require("../db");

// module.exports = (io, socket) => {

//     console.log("📌 Interactive Board socket ready:", socket.id);

//     /* =========================
//        GET BOARD INFO
//     ========================= */

//     socket.on("get_board_info", async ({ activitySessionId }) => {

//         try {

//             const result = await db.query(`
//         SELECT *
//         FROM "AssignedInteractiveBoards"
//         WHERE "ActivitySession_ID"=$1
//       `, [activitySessionId])

//             socket.emit("board_info", result.rows[0])

//         } catch (err) {

//             console.error("get_board_info error:", err)

//         }

//     })


//     /* =========================
//        GET MESSAGES
//     ========================= */

//     socket.on("get_board_messages", async ({ activitySessionId }) => {

//         try {

//             const result = await db.query(`
//         SELECT *
//         FROM "InteractiveBoardMessages"
//         WHERE "ActivitySession_ID" = $1
//         ORDER BY "Sent_At"
//       `, [activitySessionId])

//             socket.emit("board_messages", result.rows)

//         } catch (err) {

//             console.error("get_board_messages error:", err)

//         }

//     })


//     /* =========================
//        STUDENT SEND MESSAGE
//     ========================= */

//     socket.on("send_board_message", async ({
//         activitySessionId,
//         studentId,
//         message
//     }) => {

//         try {

//             const result = await db.query(`
//         INSERT INTO "InteractiveBoardMessages"
//         (
//           "ActivitySession_ID",
//           "ActivityParticipant_ID",
//           "Sender_Type",
//           "Message"
//         )
//         SELECT
//           $1,
//           "ActivityParticipant_ID",
//           'student',
//           $3
//         FROM "ActivityParticipants"
//         WHERE "ActivitySession_ID"=$1
//         AND "Student_ID"=$2
//         RETURNING *
//       `, [activitySessionId, studentId, message])

//             if (!result.rows.length) return

//             const msg = result.rows[0]

//             io.to(`activity_${activitySessionId}`)
//                 .emit("board_message", msg)

//         } catch (err) {

//             console.error("send_board_message error:", err)

//         }

//     })


//     /* =========================
//        TEACHER SEND MESSAGE
//     ========================= */

//     socket.on("teacher_message", async ({
//         activitySessionId,
//         message
//     }) => {

//         try {

//             const result = await db.query(`
//         INSERT INTO "InteractiveBoardMessages"
//         (
//           "ActivitySession_ID",
//           "Sender_Type",
//           "Message"
//         )
//         VALUES ($1,'teacher',$2)
//         RETURNING *
//       `, [activitySessionId, message])

//             const msg = result.rows[0]

//             io.to(`activity_${activitySessionId}`)
//                 .emit("board_message", msg)

//         } catch (err) {

//             console.error("teacher_message error:", err)

//         }

//     })


//     /* =========================
//        CLOSE BOARD
//     ========================= */

//     socket.on("end_board_session", async ({ activitySessionId }) => {

//         try {

//            const result = await db.query(`
//             UPDATE "ActivitySessions"
//             SET "Status"='finished',
//                 "Ended_At"=NOW()
//             WHERE "ActivitySession_ID"=$1
//             RETURNING "Ended_At"
//             `, [activitySessionId]);

//             const endedAt = result.rows[0].Ended_At;

//             /* 2️⃣ update participants */
//             await db.query(`
//             UPDATE "ActivityParticipants"
//             SET "Left_At"=$1
//             WHERE "ActivitySession_ID"=$2
//             AND "Left_At" IS NULL
//             `, [endedAt, activitySessionId]);


//             io.to(`activity_${activitySessionId}`)
//                 .emit("board_closed")

//         } catch (err) {

//             console.error("end_board_session error:", err)

//         }

//     })


//     /* =========================
//        DEBUG CONNECTION
//     ========================= */

//     socket.on("join_activity_debug", ({ activitySessionId }) => {

//         socket.join(`activity_${activitySessionId}`)

//         console.log("user joined board room:", activitySessionId)

//     })

//     /* =========================
//      GET CHAT LOGS
//   ========================= */

//     socket.on("get_chat_logs", async ({ classId }) => {

//         try {

//             const result = await db.query(`
// SELECT 
//   a."ActivitySession_ID",
//   b."Board_Name",
//   a."Assigned_At",
//   COUNT(DISTINCT ap."ActivityParticipant_ID") AS participant_count

// FROM "ActivitySessions" a

// JOIN "AssignedInteractiveBoards" b
//   ON b."ActivitySession_ID" = a."ActivitySession_ID"

// LEFT JOIN "ActivityParticipants" ap
//   ON ap."ActivitySession_ID" = a."ActivitySession_ID"

// WHERE a."Class_ID" = $1
//   AND a."Activity_Type" = 'chat'

// GROUP BY 
//   a."ActivitySession_ID",
//   b."Board_Name",
//   a."Assigned_At"

// ORDER BY a."Assigned_At" DESC
//     `, [classId])

//             socket.emit("chat_logs", result.rows)

//         } catch (err) {

//             console.error("get_chat_logs error:", err)

//         }

//     })

// };

const db = require("../db");

module.exports = (io, socket) => {

    console.log("📌 Interactive Board socket ready:", socket.id);

    /* =========================
       GET BOARD INFO
    ========================= */

    socket.on("get_board_info", async ({ activitySessionId }) => {

        try {

            const result = await db.query(`
        SELECT *
        FROM "AssignedInteractiveBoards"
        WHERE "ActivitySession_ID"=$1
        LIMIT 1
      `, [activitySessionId])

            socket.emit("board_info", result.rows[0])

        } catch (err) {

            console.error("get_board_info error:", err)

        }

    })


    /* =========================
       GET MESSAGES
    ========================= */

    socket.on("get_board_messages", async ({ activitySessionId }) => {

        try {

            const result = await db.query(`
        SELECT ibm.*
        FROM "InteractiveBoardMessages" ibm
        JOIN "AssignedInteractiveBoards" aib
        ON aib."AssignedInteractiveBoard_ID" = ibm."AssignedInteractiveBoard_ID"
        WHERE aib."ActivitySession_ID" = $1
        ORDER BY ibm."Sent_At"
      `, [activitySessionId])

            socket.emit("board_messages", result.rows)

        } catch (err) {

            console.error("get_board_messages error:", err)

        }

    })


    /* =========================
       STUDENT SEND MESSAGE
    ========================= */

    socket.on("send_board_message", async ({
        activitySessionId,
        studentId,
        message
    }) => {

        try {

            const result = await db.query(`
        INSERT INTO "InteractiveBoardMessages"
        (
        "AssignedInteractiveBoard_ID",
        "ActivityParticipant_ID",
        "Sender_Type",
        "Message"
        )
        SELECT
        aib."AssignedInteractiveBoard_ID",
        ap."ActivityParticipant_ID",
        'student',
        $3
        FROM "ActivityParticipants" ap
        JOIN "AssignedInteractiveBoards" aib
        ON aib."ActivitySession_ID" = ap."ActivitySession_ID"
        WHERE ap."ActivitySession_ID" = $1
        AND ap."Student_ID" = $2
        RETURNING *
      `, [activitySessionId, studentId, message])

            if (!result.rows.length) return

            const msg = result.rows[0]

            io.to(`activity_${activitySessionId}`)
                .emit("board_message", msg)

        } catch (err) {

            console.error("send_board_message error:", err)

        }

    })


    /* =========================
       TEACHER SEND MESSAGE
    ========================= */

    socket.on("teacher_message", async ({
        activitySessionId,
        message
    }) => {

        try {

            const result = await db.query(`
            INSERT INTO "InteractiveBoardMessages"
            (
            "AssignedInteractiveBoard_ID",
            "Sender_Type",
            "Message"
            )
            SELECT
            "AssignedInteractiveBoard_ID",
            'teacher',
            $2
            FROM "AssignedInteractiveBoards"
            WHERE "ActivitySession_ID" = $1
            RETURNING *
      `, [activitySessionId, message])

            const msg = result.rows[0]

            io.to(`activity_${activitySessionId}`)
                .emit("board_message", msg)

        } catch (err) {

            console.error("teacher_message error:", err)

        }

    })


    /* =========================
       CLOSE BOARD
    ========================= */

    socket.on("end_board_session", async ({ activitySessionId }) => {

        try {

           const result = await db.query(`
            UPDATE "ActivitySessions"
            SET "Status"='finished',
                "Ended_At"=NOW()
            WHERE "ActivitySession_ID"=$1
            RETURNING "Ended_At"
            `, [activitySessionId]);

            const endedAt = result.rows[0].Ended_At;

            /* 2️⃣ update participants */
            await db.query(`
            UPDATE "ActivityParticipants"
            SET "Left_At"=$1
            WHERE "ActivitySession_ID"=$2
            AND "Left_At" IS NULL
            `, [endedAt, activitySessionId]);


            io.to(`activity_${activitySessionId}`)
                .emit("board_closed")

        } catch (err) {

            console.error("end_board_session error:", err)

        }

    })


    /* =========================
       DEBUG CONNECTION
    ========================= */

    socket.on("join_activity_debug", ({ activitySessionId }) => {

        socket.join(`activity_${activitySessionId}`)

        console.log("user joined board room:", activitySessionId)

    })

    /* =========================
     GET CHAT LOGS
  ========================= */

    socket.on("get_chat_logs", async ({ classId }) => {

        try {

            const result = await db.query(`
SELECT 
  a."ActivitySession_ID",
  b."Board_Name",
  a."Assigned_At",
  COUNT(DISTINCT ap."ActivityParticipant_ID") AS participant_count

FROM "ActivitySessions" a

JOIN "AssignedInteractiveBoards" b
  ON b."ActivitySession_ID" = a."ActivitySession_ID"

LEFT JOIN "ActivityParticipants" ap
  ON ap."ActivitySession_ID" = a."ActivitySession_ID"

WHERE a."Class_ID" = $1
  AND a."Activity_Type" = 'chat'

GROUP BY 
  a."ActivitySession_ID",
  b."Board_Name",
  a."Assigned_At"

ORDER BY a."Assigned_At" DESC
    `, [classId])

            socket.emit("chat_logs", result.rows)

        } catch (err) {

            console.error("get_chat_logs error:", err)

        }

    })

};