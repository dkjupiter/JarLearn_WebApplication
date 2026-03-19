const db = require("../db");

module.exports = (socket) => {
  // io.on("connection", (socket) => {
  console.log("✅ Quiz socket connected:", socket.id);

  // ===============================
  // ✅ GET All Question Sets of a Teacher
  // ===============================
  socket.on("get_question_sets", async (teacherId) => {
    console.log("✅ get_question_sets:", teacherId);
    try {
      const result = await db.query(
        `SELECT *
          FROM "QuestionSets"
          WHERE "Teacher_ID"=$1
          AND "Is_Latest"=true
          AND "Is_Archived"=false
          ORDER BY "Question_Last_Edit" DESC`,
        [teacherId]
      );

      socket.emit("question_sets_data", result.rows);
      // console.log("✅ Sending question sets:", result.rows);
    } catch (err) {
      console.error("❌ get_question_sets error:", err.message);
      socket.emit("question_sets_data", { error: err.message });
    }
  });

  // ===============================
  // ✅ SUBMIT CREATE QUESTION SET
  // ===============================
  socket.on("submit_create_question", async (data) => {
    console.log("✅ BACKEND RECEIVED submit_create_question:", data);

    try {
      const { teacherId, title, questionset } = data;
      console.log(teacherId, title, questionset)

      if (!teacherId || !title || !questionset || !questionset.length) {
        console.log("❌ Missing data");
        return socket.emit("submit_create_set_result", {
          success: false,
          message: "Missing data",
        });
      }

      // // ✅ Check duplicate title
      // const exists = await db.query(
      //   `SELECT 1 FROM "QuestionSets" 
      //      WHERE "Teacher_ID"=$1 AND LOWER("Title")=LOWER($2)`,
      //   [teacherId, title]
      // );

      // if (exists.rowCount > 0) {
      //   console.log("❌ Duplicate title");
      //   return socket.emit("submit_create_set_result", {
      //     success: false,
      //     message: "This quiz name already exists",
      //   });
      // }

      // ✅ Limit quiz per teacher (max 50)
      const countRes = await db.query(
        `SELECT COUNT(*) 
        FROM "QuestionSets"
        WHERE "Teacher_ID"=$1
        AND "Is_Latest"=true
        AND "Is_Archived"=false`,
        [teacherId]
      );

      const quizCount = Number(countRes.rows[0].count);

      if (quizCount >= 50) {
        console.log("❌ Quiz limit reached");

        return socket.emit("submit_create_set_result", {
          success: false,
          message: "You can create up to 50 quizzes only"
        });
      }

      // ✅ Insert Set
      const setRes = await db.query(
        `INSERT INTO "QuestionSets"
          ("Title","Teacher_ID","Question_Last_Edit","Parent_Set_ID","Is_Latest")
          VALUES ($1,$2,Now(),NULL,TRUE)
          RETURNING "Set_ID"`,
        [title, teacherId]
      );

      const setId = setRes.rows[0].Set_ID;
      console.log("✅ Created Set_ID:", setId);

      // ✅ Insert Questions + Options
      for (const q of questionset) {
        console.log("➡️ Insert question:", q);

        const qRes = await db.query(
          `INSERT INTO "Questions"
            ("Set_ID","Question_Type","Question_Text","Question_Image")
            VALUES ($1,$2,$3,$4)
            RETURNING "Question_ID"`,
          [setId, q.type, q.text, q.image]
        );

        const questionId = qRes.rows[0].Question_ID;
        // let correctOptionId = null;

        const optionIds = [];

        for (let i = 0; i < q.options.length; i++) {
          const optRes = await db.query(
            `INSERT INTO "QuestionOptions"("Question_ID","Option_Text")
              VALUES ($1,$2)
              RETURNING "Option_ID"`,
            [questionId, q.options[i]]
          );

          optionIds.push(optRes.rows[0].Option_ID);
        }

        // if (correctOptionId) {
        //   await db.query(
        //     `UPDATE "Questions" 
        //      SET "Correct_Option"=$1 
        //      WHERE "Question_ID"=$2`,
        //     [correctOptionId, questionId]
        //   );
        // }
        for (const correctIndex of q.correct) {
          await db.query(
            `INSERT INTO "Question_Correct_Options"
              ("Question_ID","Option_ID")
              VALUES ($1,$2)`,
            [questionId, optionIds[correctIndex]]
          );
        }
      }

      console.log("✅ CREATE SET SUCCESS");
      socket.emit("submit_create_set_result", {
        success: true,
        setId,
      });

    } catch (err) {
      console.error("❌ submit_create_question error:", err.message);
      socket.emit("submit_create_set_result", {
        success: false,
        message: err.message,
      });
    }
  });

  // ===============================
  // ✅ GET Questions in a Set
  // ===============================
  socket.on("get_questions_in_set", async (setId) => {
    console.log("✅ get_questions_in_set:", setId);
    try {
      const result = await db.query(
        `SELECT q."Question_ID",
                  q."Question_Text",
                  q."Question_Type",
                  json_agg(
                    json_build_object(
                      'id', o."Option_ID",
                      'text', o."Option_Text"
                    ) ORDER BY o."Option_ID"
                  ) AS options,
                  COALESCE(
                    ARRAY_AGG(qco."Option_ID")
                    FILTER (WHERE qco."Option_ID" IS NOT NULL),
                    '{}'
                  ) AS correct
            FROM "Questions" q
            LEFT JOIN "QuestionOptions" o
              ON q."Question_ID" = o."Question_ID"
            LEFT JOIN "Question_Correct_Options" qco
              ON q."Question_ID" = qco."Question_ID"
            WHERE q."Set_ID" = $1
            GROUP BY q."Question_ID"
            ORDER BY q."Question_ID"ASC`,
        [setId]
      );

      socket.emit("questions_in_set_data", result.rows);
      console.log("✅ Sending questions for set", setId);
    } catch (err) {
      console.error("❌ get_questions_in_set error:", err.message);
      socket.emit("questions_in_set_data", { error: err.message });
    }
  });

  // ===============================
  // ✅ GET QUIZ FULL DATA (ชื่อ + คำถาม)
  // ===============================
  socket.on("get_quiz_full_data", async (setId) => {
    console.log("📥 get_quiz_full_data:", setId);

    try {
      // 1️⃣ ดึงชื่อ Quiz
      const quizRes = await db.query(
        `SELECT "Title"
       FROM "QuestionSets"
       WHERE "Set_ID" = $1`,
        [setId]
      );

      if (quizRes.rowCount === 0) {
        return socket.emit("quiz_full_data", {
          error: "Quiz not found",
        });
      }

      // 2️⃣ ดึงคำถาม + options
      const questionRes = await db.query(
        `SELECT
              q."Question_ID",
              q."Question_Text",
              q."Question_Type",
              q."Question_Image",

              json_agg(
                json_build_object(
                  'id', o."Option_ID",
                  'text', o."Option_Text"
                )
                ORDER BY o."Option_ID"
              ) AS options,

              (
                SELECT json_agg(qco."Option_ID")
                FROM "Question_Correct_Options" qco
                WHERE qco."Question_ID" = q."Question_ID"
              ) AS correct

            FROM "Questions" q
            LEFT JOIN "QuestionOptions" o
              ON q."Question_ID" = o."Question_ID"
            WHERE q."Set_ID" = $1
            GROUP BY q."Question_ID"
            ORDER BY q."Question_ID";
        `,
        [setId]
      );

      socket.emit("quiz_full_data", {
        title: quizRes.rows[0].Title,
        questions: questionRes.rows,
      });

      console.log("✅ Sent quiz_full_data");

    } catch (err) {
      console.error("❌ get_quiz_full_data error:", err.message);
      socket.emit("quiz_full_data", {
        error: err.message,
      });
    }
  });

  socket.on("update_quiz", async (data) => {

    const { setId, title, question_last_edit, questionset } = data;

    try {

      /* 1️⃣ หา parent id */

      const parentRes = await db.query(
        `SELECT COALESCE("Parent_Set_ID","Set_ID") as parent
       FROM "QuestionSets"
       WHERE "Set_ID"=$1`,
        [setId]
      );

      const parentId = parentRes.rows[0].parent;

      /* 2️⃣ set version เก่าเป็น not latest */

      await db.query(
        `UPDATE "QuestionSets"
       SET "Is_Latest"=false
       WHERE "Parent_Set_ID"=$1 OR "Set_ID"=$1`,
        [parentId]
      );

      /* 3️⃣ create new version */

      const newSet = await db.query(
        `INSERT INTO "QuestionSets"
       ("Title","Teacher_ID","Question_Last_Edit","Parent_Set_ID","Is_Latest")
       SELECT $1,"Teacher_ID",$2,$3,true
       FROM "QuestionSets"
       WHERE "Set_ID"=$4
       RETURNING "Set_ID"`,
        [title, question_last_edit, parentId, setId]
      );

      const newSetId = newSet.rows[0].Set_ID;

      /* 4️⃣ insert questions */

      for (const q of questionset) {

        const qRes = await db.query(
          `INSERT INTO "Questions"
        ("Set_ID","Question_Type","Question_Text","Question_Image")
        VALUES ($1,$2,$3,$4)
        RETURNING "Question_ID"`,
          [newSetId, q.type, q.text, q.image]
        );

        const questionId = qRes.rows[0].Question_ID;
        const optionIds = [];

        for (let i = 0; i < q.options.length; i++) {

          const optRes = await db.query(
            `INSERT INTO "QuestionOptions"
          ("Question_ID","Option_Text")
          VALUES ($1,$2)
          RETURNING "Option_ID"`,
            [questionId, q.options[i]]
          );

          optionIds.push(optRes.rows[0].Option_ID);

        }

        for (const correctIndex of q.correct) {

          await db.query(
            `INSERT INTO "Question_Correct_Options"
          ("Question_ID","Option_ID")
          VALUES ($1,$2)`,
            [questionId, optionIds[correctIndex]]
          );

        }

      }

      socket.emit("update_quiz_result", { success: true });

    } catch (err) {

      socket.emit("update_quiz_result", {
        success: false,
        message: err.message,
      });

    }

  });

  socket.on("delete_quiz", async (setId) => {

    try {

      await db.query(
        `UPDATE "QuestionSets"
       SET "Is_Archived"=true
       WHERE "Set_ID"=$1`,
        [setId]
      );

      socket.emit("quiz_deleted", setId);

    } catch (err) {

      console.error(err);

    }

  });
};