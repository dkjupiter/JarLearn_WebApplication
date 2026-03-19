const db = require("../db");

module.exports = (io, socket) => {
  console.log("Assign Activity socket ready:", socket.id);

  const activitySessions = {};

  // =====================
  // CREATE SESSION
  // =====================
  socket.on("create_activity_session", async ({ classId, activityType, teacherId }) => {
    try {
      if (!classId || !activityType || !teacherId) {
        throw new Error("Missing required fields");
      }

      const result = await db.query(`
        INSERT INTO "ActivitySessions"
        ("Class_ID","Activity_Type","Assigned_By","Status")
        VALUES ($1,$2,$3,'active')
        RETURNING *
      `, [classId, activityType, teacherId]);

      socket.emit("activity_session_created", result.rows[0]);
    } catch (err) {
      socket.emit("activity_session_created", { success: false, message: err.message });
    }
  });

  // =====================
  // ASSIGN QUIZ (🔥 เพิ่ม assignedQuizId)
  // =====================
  socket.on("assign_quiz", async (payload) => {
    const { activitySessionId, quizId, mode, studentPerTeam, timerType, questionTime, quizTime } = payload;

    try {
      const result = await db.query(`
        INSERT INTO "AssignedQuiz"
        ("ActivitySession_ID","Quiz_ID","Mode","Student_Per_Team","Timer_Type","Question_Time","Quiz_Time")
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING *
      `, [activitySessionId, quizId, mode, studentPerTeam || null, timerType, questionTime || null, quizTime || null]);

      const assignedQuiz = result.rows[0];
      const assignedQuizId = assignedQuiz.AssignedQuiz_ID;

      // 🔥 load questions
      const qRes = await db.query(`
        SELECT q."Question_ID", q."Question_Text", q."Question_Type", q."Question_Image",
               o."Option_ID", o."Option_Text"
        FROM "Questions" q
        LEFT JOIN "QuestionOptions" o ON o."Question_ID"=q."Question_ID"
        WHERE q."Set_ID"=$1
        ORDER BY q."Question_ID", o."Option_ID"
      `, [quizId]);

      const grouped = {};
      for (const r of qRes.rows) {
        if (!grouped[r.Question_ID]) {
          grouped[r.Question_ID] = {
            Question_ID: r.Question_ID,
            Question_Text: r.Question_Text,
            Question_Type: r.Question_Type,
            Question_Image: r.Question_Image,
            choices: []
          };
        }
        if (r.Option_ID) {
          grouped[r.Question_ID].choices.push({
            Option_ID: r.Option_ID,
            Option_Text: r.Option_Text
          });
        }
      }

      const questions = Object.values(grouped);

      const classRes = await db.query(`
        SELECT cr."Join_Code"
        FROM "ActivitySessions" a
        JOIN "ClassRooms" cr ON cr."Class_ID"=a."Class_ID"
        WHERE a."ActivitySession_ID"=$1
      `, [activitySessionId]);

      if (!classRes.rows.length) {
        throw new Error("Join code not found");
      }

      const joinCode = classRes.rows[0].Join_Code;

      let timeLimit = null;

      if (
        assignedQuiz.Timer_Type === "question" ||
        assignedQuiz.Timer_Type === "teacher"
      ) {
        timeLimit = Number(assignedQuiz.Question_Time);
      }

      if (assignedQuiz.Timer_Type === "quiz") {
        timeLimit = Number(assignedQuiz.Quiz_Time) * 60;
      }

      io.to(joinCode).emit("activity_started", {
        activityType: "quiz",
        activitySessionId,
        assignedQuizId, // 🔥 สำคัญมาก
        quizId,
        mode,
        questions,
        totalQuestions: questions.length,
        timerType: assignedQuiz.Timer_Type,
        timeLimit,
        quizStartTime: Date.now(),
        serverTime: Date.now()
      });

      socket.emit("assign_quiz_result", {
        success: true,
        assignedQuiz
      });

    } catch (err) {
      socket.emit("assign_quiz_result", { success: false, message: err.message });
    }
  });

  // =====================
  // JOIN ACTIVITY
  // =====================
  socket.on("join_activity", ({ activitySessionId }) => {
    socket.join(`activity_${activitySessionId}`);

    if (!activitySessions[activitySessionId]) {
      activitySessions[activitySessionId] = { currentIndex: 0 };
    }

    socket.emit("joined_activity");
  });

  // =====================
  // QUESTION CONTROL
  // =====================
  socket.on("next_question", ({ activitySessionId }) => {
    if (!activitySessionId) return;

    if (!activitySessions[activitySessionId]) {
      activitySessions[activitySessionId] = { currentIndex: 0 };
    }

    activitySessions[activitySessionId].currentIndex++;

    io.to(`activity_${activitySessionId}`).emit("start_question", {
      index: activitySessions[activitySessionId].currentIndex,
    });
  });

  socket.on("force_submit", ({ activitySessionId }) => {
    io.to(`activity_${activitySessionId}`).emit("force_submit");
  });

  socket.on("end_quiz", async ({ activitySessionId }) => {
    const res = await db.query(`
      SELECT "Mode"
      FROM "AssignedQuiz"
      WHERE "ActivitySession_ID" = $1
    `, [activitySessionId]);

    const mode = res.rows[0]?.Mode || "individual";

    io.to(`activity_${activitySessionId}`).emit("quiz_ended", { mode });
  });

  socket.on("finish_game", async ({ activitySessionId }) => {
    const res = await db.query(`
      SELECT "Mode"
      FROM "AssignedQuiz"
      WHERE "ActivitySession_ID" = $1
    `, [activitySessionId]);

    const mode = res.rows[0]?.Mode;

    if (mode === "team") {
      io.to(`activity_${activitySessionId}`).emit("show_final_team_ranking");
    } else {
      io.to(`activity_${activitySessionId}`).emit("show_final_ranking");
    }
  });

  /* ===========================
   ASSIGN POLL
=========================== */
  socket.on("assign_poll", async (payload) => {
    const {
      activitySessionId,
      pollQuestion,
      choices,
      allowMultiple,
      duration,
    } = payload;

    try {
      const pollResult = await db.query(`
        INSERT INTO "AssignedPoll"
        ("ActivitySession_ID","Poll_Question","Allow_Multiple","Duration")
        VALUES ($1,$2,$3,$4)
        RETURNING *
      `, [
        activitySessionId,
        pollQuestion,
        allowMultiple ?? false,
        duration || null,
      ]);

      const assignedPollId = pollResult.rows[0].AssignedPoll_ID;

      for (const option of choices) {
        await db.query(`
          INSERT INTO "PollOptions"
          ("AssignedPoll_ID", "Option_Text")
          VALUES ($1,$2)
        `, [assignedPollId, option]);
      }

      const options = await db.query(`
        SELECT *
        FROM "PollOptions"
        WHERE "AssignedPoll_ID"=$1
        ORDER BY "PollOption_ID"
      `, [assignedPollId]);

      io.to(`activity_${activitySessionId}`).emit("poll_started", {
        pollId: assignedPollId,
        question: pollQuestion,
        options: options.rows
      });

      const classRes = await db.query(`
        SELECT cr."Join_Code"
        FROM "ActivitySessions" a
        JOIN "ClassRooms" cr ON cr."Class_ID" = a."Class_ID"
        WHERE a."ActivitySession_ID"=$1
      `, [activitySessionId]);

      const joinCode = classRes.rows[0].Join_Code;

      io.to(joinCode).emit("activity_started", {
        activityType: "poll",
        activitySessionId
      });

      socket.emit("assign_poll_result", { success: true });

    } catch (err) {
      console.error("❌ assign_poll error:", err);
    }
  });

  /* ===========================
     ASSIGN INTERACTIVE BOARD
  =========================== */
  socket.on("assign_interactive_board", async (payload) => {

    const { activitySessionId, boardName, allowAnonymous } = payload;

    try {

      const result = await db.query(`
        INSERT INTO "AssignedInteractiveBoards"
        ("ActivitySession_ID","Board_Name","Allow_Anonymous")
        VALUES ($1,$2,$3)
        RETURNING *
      `, [
        activitySessionId,
        boardName || "Interactive Board",
        allowAnonymous ?? false
      ]);

      const classRes = await db.query(`
        SELECT cr."Join_Code"
        FROM "ActivitySessions" a
        JOIN "ClassRooms" cr ON cr."Class_ID" = a."Class_ID"
        WHERE a."ActivitySession_ID"=$1
      `, [activitySessionId]);

      const joinCode = classRes.rows[0].Join_Code;

      io.to(joinCode).emit("activity_started", {
        activityType: "chat",
        activitySessionId
      });

      socket.emit("assign_interactive_board_result", {
        success: true,
        board: result.rows[0]
      });

    } catch (err) {
      console.error("assign_interactive_board error:", err);
    }

  });

  /* ===========================
     GET ASSIGNED QUIZ
  =========================== */
  socket.on("get_assigned_quiz", async ({ activitySessionId }) => {
    try {

      const assignedRes = await db.query(`
        SELECT aq.*, qs."Set_ID", qs."Title"
        FROM "AssignedQuiz" aq
        JOIN "QuestionSets" qs ON qs."Set_ID" = aq."Quiz_ID"
        WHERE aq."ActivitySession_ID" = $1
      `, [activitySessionId]);

      if (!assignedRes.rows.length) {
        return socket.emit("assigned_quiz_data", {
          success: false,
          message: "Assigned quiz not found",
        });
      }

      const assignedQuiz = assignedRes.rows[0];

      const questionRes = await db.query(`
        SELECT 
          q."Question_ID",
          q."Question_Text",
          q."Question_Type",
          q."Question_Image",
          o."Option_ID",
          o."Option_Text",
          (
            SELECT qco."Option_ID"
            FROM "Question_Correct_Options" qco
            WHERE qco."Question_ID" = q."Question_ID"
            AND qco."Option_ID" = o."Option_ID"
            LIMIT 1
          ) AS "Correct_Option_ID"
        FROM "Questions" q
        LEFT JOIN "QuestionOptions" o ON o."Question_ID" = q."Question_ID"
        WHERE q."Set_ID" = $1
        ORDER BY q."Question_ID", o."Option_ID"
      `, [assignedQuiz.Set_ID]);

      socket.emit("assigned_quiz_data", {
        success: true,
        assignedQuiz,
        questions: questionRes.rows,
      });

    } catch (err) {
      console.error("❌ get_assigned_quiz error:", err);
      socket.emit("assigned_quiz_data", {
        success: false,
        message: err.message,
      });
    }
  });
  /* =====================
   PREVIEW TEAMS (ยังใช้ได้)
===================== */
  // socket.on("preview_teams", async ({ activitySessionId, studentPerTeam }) => {
  //   try {

  //     const res = await db.query(`
  //       SELECT ap."ActivityParticipant_ID", ap."Student_ID", s."Student_Name"
  //       FROM "ActivityParticipants" ap
  //       JOIN "Students" s ON s."Student_ID" = ap."Student_ID"
  //       WHERE ap."ActivitySession_ID" = $1
  //       AND ap."Left_At" IS NULL
  //     `, [activitySessionId]);

  //     const students = res.rows;

  //     for (let i = students.length - 1; i > 0; i--) {
  //       const j = Math.floor(Math.random() * (i + 1));
  //       [students[i], students[j]] = [students[j], students[i]];
  //     }

  //     const teams = [];
  //     let teamIndex = 1;

  //     for (let i = 0; i < students.length; i += studentPerTeam) {
  //       teams.push({
  //         teamId: teamIndex,
  //         teamName: `Team ${teamIndex}`,
  //         members: students.slice(i, i + studentPerTeam)
  //       });
  //       teamIndex++;
  //     }

  //     io.to(`activity_${activitySessionId}`).emit("preview_teams_data", teams);

  //   } catch (err) {
  //     console.error("❌ preview_teams error:", err.message);
  //     socket.emit("preview_teams_data", []);
  //   }
  // });

  socket.on("preview_teams", async ({ activitySessionId, studentPerTeam }) => {
    try {

      const res = await db.query(`
      SELECT 
        ap."ActivityParticipant_ID",
        ap."Student_ID",
        s."Student_Name",

        b."Body_Image",
        c."Costume_Image",
        m."Mask_Image",
        a."Accessory_Image"

      FROM "ActivityParticipants" ap

      JOIN "Students" s 
        ON s."Student_ID" = ap."Student_ID"

      LEFT JOIN "Avatars" av
        ON av."Avatar_ID" = s."Avatar_ID"

      LEFT JOIN "AvatarBodies" b
        ON b."Body_ID" = av."Body_ID"

      LEFT JOIN "AvatarCostumes" c
        ON c."Costume_ID" = av."Costume_ID"

      LEFT JOIN "AvatarMasks" m
        ON m."Mask_ID" = av."Mask_ID"

      LEFT JOIN "AvatarAccessories" a
        ON a."Accessory_ID" = av."Accessory_ID"

      WHERE ap."ActivitySession_ID" = $1
      AND ap."Left_At" IS NULL
    `, [activitySessionId]);

      /* 🔥 map avatar เข้าไป */
      const students = res.rows.map(row => ({
        ActivityParticipant_ID: row.ActivityParticipant_ID,
        Student_ID: row.Student_ID,
        Student_Name: row.Student_Name,

        avatar: {
          bodyPath: row.Body_Image,
          costumePath: row.Costume_Image,
          hairPath: row.Accessory_Image,
          facePath: row.Mask_Image
        }
      }));

      /* 🔀 shuffle */
      for (let i = students.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [students[i], students[j]] = [students[j], students[i]];
      }

      /* 👥 สร้างทีม */
      const teams = [];
      let teamIndex = 1;

      for (let i = 0; i < students.length; i += studentPerTeam) {
        teams.push({
          teamId: teamIndex,
          teamName: `Team ${teamIndex}`,
          members: students.slice(i, i + studentPerTeam)
        });
        teamIndex++;
      }

      io.to(`activity_${activitySessionId}`).emit("preview_teams_data", teams);

    } catch (err) {
      console.error("❌ preview_teams error:", err.message);
      socket.emit("preview_teams_data", []);
    }
  });

  /* =====================
     CREATE TEAMS (🔥 FIX)
  ===================== */
  socket.on("create_teams", async ({ activitySessionId, assignedQuizId, teams }) => {
    try {

      for (const team of teams) {

        const teamRes = await db.query(`
          INSERT INTO "TeamAssignments"
          ("AssignedQuiz_ID","Team_Name")
          VALUES ($1,$2)
          RETURNING *
        `, [assignedQuizId, team.teamName]);

        const teamId = teamRes.rows[0].Team_ID;

        for (const m of team.members) {

          await db.query(`
            INSERT INTO "TeamMembers"
            ("Team_ID","ActivityParticipant_ID")
            VALUES ($1,$2)
          `, [teamId, m.ActivityParticipant_ID]);
        }
      }

      io.to(`activity_${activitySessionId}`).emit("teams_created", teams);

    } catch (err) {
      console.error("❌ create_teams error:", err);
    }
  });

  /* =====================
     GET TEAMS (🔥 FIX)
  ===================== */
  // socket.on("get_teams", async ({ activitySessionId }) => {
  //   try {

  //     const res = await db.query(`
  //       SELECT
  //         ta."Team_ID",
  //         ta."Team_Name",
  //         s."Student_ID",
  //         s."Student_Name"
  //       FROM "TeamAssignments" ta
  //       JOIN "AssignedQuiz" aq ON aq."AssignedQuiz_ID" = ta."AssignedQuiz_ID"
  //       JOIN "TeamMembers" tm ON tm."Team_ID" = ta."Team_ID"
  //       JOIN "ActivityParticipants" ap ON ap."ActivityParticipant_ID" = tm."ActivityParticipant_ID"
  //       JOIN "Students" s ON s."Student_ID" = ap."Student_ID"
  //       WHERE aq."ActivitySession_ID" = $1
  //       ORDER BY ta."Team_ID"
  //     `, [activitySessionId]);

  //     const map = {};

  //     for (const row of res.rows) {
  //       if (!map[row.Team_ID]) {
  //         map[row.Team_ID] = {
  //           teamId: row.Team_ID,
  //           teamName: row.Team_Name,
  //           members: []
  //         };
  //       }

  //       map[row.Team_ID].members.push({
  //         Student_ID: row.Student_ID,
  //         Student_Name: row.Student_Name
  //       });
  //     }

  //     socket.emit("teams_data", Object.values(map));

  //   } catch (err) {
  //     console.error("❌ get_teams error:", err.message);
  //     socket.emit("teams_data", []);
  //   }
  // });

  socket.on("get_teams", async ({ activitySessionId }) => {
    try {

      /* 🔍 หา AssignedQuiz_ID */
      const assignedRes = await db.query(`
      SELECT "AssignedQuiz_ID"
      FROM "AssignedQuiz"
      WHERE "ActivitySession_ID" = $1
    `, [activitySessionId]);

      const assignedQuizId = assignedRes.rows[0]?.AssignedQuiz_ID;

      /* 🔥 ดึงทีม + avatar ครบ */
      const res = await db.query(`
      SELECT
        ta."Team_ID",
        ta."Team_Name",

        s."Student_ID",
        s."Student_Name",

        b."Body_Image",
        c."Costume_Image",
        m."Mask_Image",
        a."Accessory_Image"

      FROM "TeamAssignments" ta

      JOIN "TeamMembers" tm
        ON tm."Team_ID" = ta."Team_ID"

      JOIN "ActivityParticipants" ap
        ON ap."ActivityParticipant_ID" = tm."ActivityParticipant_ID"

      JOIN "Students" s
        ON s."Student_ID" = ap."Student_ID"

      LEFT JOIN "Avatars" av
        ON av."Avatar_ID" = s."Avatar_ID"

      LEFT JOIN "AvatarBodies" b
        ON b."Body_ID" = av."Body_ID"

      LEFT JOIN "AvatarCostumes" c
        ON c."Costume_ID" = av."Costume_ID"

      LEFT JOIN "AvatarMasks" m
        ON m."Mask_ID" = av."Mask_ID"

      LEFT JOIN "AvatarAccessories" a
        ON a."Accessory_ID" = av."Accessory_ID"

      WHERE ta."AssignedQuiz_ID" = $1
      ORDER BY ta."Team_ID"
    `, [assignedQuizId]);

      /* 🔥 จัดรูปข้อมูลให้ตรง frontend */
      const teamsMap = {};

      res.rows.forEach(row => {

        if (!teamsMap[row.Team_ID]) {
          teamsMap[row.Team_ID] = {
            teamId: row.Team_ID,
            teamName: row.Team_Name,
            members: []
          };
        }

        teamsMap[row.Team_ID].members.push({
          Student_ID: row.Student_ID,
          Student_Name: row.Student_Name,

          avatar: {
            bodyPath: row.Body_Image,
            costumePath: row.Costume_Image,
            hairPath: row.Accessory_Image,
            facePath: row.Mask_Image
          }
        });

      });

      const teams = Object.values(teamsMap);

      socket.emit("teams_data", teams);

    } catch (err) {
      console.error("❌ get_teams error:", err.message);
      socket.emit("teams_data", []);
    }
  });

  /* =====================
     START TEAM QUIZ
  ===================== */
  socket.on("start_team_quiz", ({ activitySessionId }) => {

    const room = `activity_${activitySessionId}`;

    if (!activitySessions[activitySessionId]) {
      activitySessions[activitySessionId] = { currentIndex: 0 };
    } else {
      activitySessions[activitySessionId].currentIndex = 0;
    }

    io.to(room).emit("start_question", {
      index: 0
    });

  });

};