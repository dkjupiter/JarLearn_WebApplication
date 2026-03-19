const db = require("../db");

module.exports = (io,socket,rooms) => {
  console.log("Classroom socket ready:", socket.id);

  // 📚 get_classrooms
  socket.on("get_classrooms", async (teacherId) => {
    console.log("get_classrooms called with teacherId:", teacherId);

    try {
      const result = await db.query(
        `SELECT 
          "Class_ID",
          "Class_Name",
          "Class_Section",
          "Is_Hidden"
         FROM "ClassRooms"
         WHERE "Teacher_ID" = $1
         ORDER BY "Class_ID" DESC;`,
        [teacherId]
      );

      socket.emit("classrooms_data", result.rows);
    } catch (err) {
      console.error("Error in get_classrooms:", err);
      socket.emit("classrooms_data", { error: err.message });
    }
  });

  // ➕ create_class
  socket.on("create_class", async (data) => {
    console.log("create_class called with data:", data);

    try {
      const { name, section, subject, code, teacherId } = data;

      if (!name || !section || !subject || !code || !teacherId) {
        return socket.emit("create_class_result", {
          success: false,
          message: "Missing required fields",
        });
      }

      const countRes = await db.query(
        `SELECT COUNT(*) 
        FROM "ClassRooms"
        WHERE "Teacher_ID"=$1`,
        [teacherId]
      );

      const classCount = Number(countRes.rows[0].count);

      if (classCount >= 50) {
        return socket.emit("create_class_result", {
          success: false,
          message: "You can create up to 50 classes only",
        });
      }

      // 🔍 เช็กว่ารหัสซ้ำไหม
      const checkCode = await db.query(
        `SELECT 1 FROM "ClassRooms" WHERE "Join_Code" = $1`,
        [code]
      );

      if (checkCode.rowCount > 0) {
        return socket.emit("create_class_result", {
          success: false,
          message: "Code room already exists",
        });
      }

      // ✅ ไม่ซ้ำ → INSERT
      const result = await db.query(
        `INSERT INTO "ClassRooms"
        ("Class_Name","Class_Section","Class_Subject","Join_Code","Teacher_ID")
        VALUES ($1,$2,$3,$4,$5)
        RETURNING "Class_ID"`,
        [name, section, subject, code, teacherId]
      );

      socket.emit("create_class_result", {
        success: true,
        classId: result.rows[0].Class_ID,
      });

    } catch (err) {
      console.error("Error in create_class:", err);
      socket.emit("create_class_result", {
        success: false,
        message: err.message,
      });
    }
  });

  // 📄 get_class_detail
  socket.on("get_class_detail", async (classId) => {
    console.log("get_class_detail:", classId);

    try {
      const result = await db.query(
        `SELECT 
          "Class_Name",
          "Class_Section",
          "Class_Subject",
          "Join_Code"
         FROM "ClassRooms"
         WHERE "Class_ID" = $1`,
        [classId]
      );

      socket.emit("class_detail_data", result.rows[0]);
    } catch (err) {
      socket.emit("class_detail_data", { error: err.message });
    }
  });

  // ✏️ update_class
  socket.on("update_class", async (data) => {
    console.log("update_class payload:", data);

    try {
      const { classId, field, value } = data;

      const allowedFields = {
        className: `"Class_Name"`,
        section: `"Class_Section"`,
        subject: `"Class_Subject"`,
      };

      if (!allowedFields[field]) {
        return socket.emit("update_class_result", {
          success: false,
          message: "Invalid field",
        });
      }

      await db.query(
        `UPDATE "ClassRooms"
         SET ${allowedFields[field]} = $1
         WHERE "Class_ID" = $2`,
        [value, classId]
      );

      socket.emit("update_class_result", { success: true });
    } catch (err) {
      socket.emit("update_class_result", {
        success: false,
        message: err.message,
      });
    }
  });

  // 🔎 get_join_code
  socket.on("get_join_code", async (classId) => {
    console.log("🔥 get_join_code called with classId:", classId);
    try {
      const result = await db.query(
        `SELECT "Join_Code"
        FROM "ClassRooms"
        WHERE "Class_ID" = $1`,
        [classId]
      );

      if (result.rowCount === 0) {
        return socket.emit("get_join_code_result", {
          success: false,
          message: "Class not found",
        });
      }

      socket.emit("get_join_code_result", {
        success: true,
        joinCode: result.rows[0].Join_Code,
      });
    } catch (err) {
      socket.emit("get_join_code_result", {
        success: false,
        message: err.message,
      });
    }
  });


  // 🔓 open_room (Start Room)
  socket.on("open_room", async ({ joinCode }) => {
    console.log("open_room:", joinCode);

    try {
      const result = await db.query(
        `
        UPDATE "ClassRooms"
        SET is_open = TRUE
        WHERE "Join_Code" = $1
        RETURNING "Class_ID", "Join_Code", is_open
        `,
        [joinCode]
      );

      if (result.rowCount === 0) {
        return socket.emit("open_room_result", {
          success: false,
          message: "Class not found",
        });
      }

      socket.emit("open_room_result", {
        success: true,
        room: result.rows[0],
      });
    } catch (err) {
      console.error("open_room error:", err);
      socket.emit("open_room_result", {
        success: false,
        message: err.message,
      });
    }
  });

  // 🔒 end_room (End Room)
  socket.on("end_room", async ({ joinCode }) => {
    console.log("end_room:", joinCode);

    try {
      const result = await db.query(
        `
        UPDATE "ClassRooms"
        SET is_open = FALSE
        WHERE "Join_Code" = $1
        RETURNING "Class_ID", "Join_Code", is_open
        `,
        [joinCode]
      );

      if (result.rowCount === 0) {
        return socket.emit("end_room_result", {
          success: false,
          message: "Class not found",
        });
      }
      const classId = result.rows[0].Class_ID;

      // ⭐ ปิด activity session ที่ยัง active
      await db.query(`
        UPDATE "ActivitySessions"
        SET "Status" = 'finished',
            "Ended_At" = NOW()
        WHERE "Class_ID" = $1
        AND "Status" = 'active'
      `,[classId]);

      console.log("🛑 ActivitySessions closed for class:", classId);

      // 🔔 แจ้งทุกคน
      io.to(joinCode).emit("room_closed");

      // 🧨 บังคับทุก socket ออกจาก room จริง ๆ
      io.in(joinCode).socketsLeave(joinCode);

      // 🧹 ลบ memory
      if (rooms[joinCode]) {
        delete rooms[joinCode];
        console.log("🧹 room memory cleared:", joinCode);
      }

      socket.emit("end_room_result", {
        success: true,
        room: result.rows[0],
      });
    } catch (err) {
      console.error("end_room error:", err);
      socket.emit("end_room_result", {
        success: false,
        message: err.message,
      });
    }
  });

// hide_class
socket.on("hide_class", async (classId) => {
  try {
    await db.query(
      `UPDATE "ClassRooms" SET "Is_Hidden" = TRUE WHERE "Class_ID" = $1`,
      [classId]
    );
    socket.emit("hide_class_result", { success: true, classId });
  } catch (err) {
    socket.emit("hide_class_result", { success: false, message: err.message });
  }
});

// show_class
socket.on("show_class", async (classId) => {
  try {
    await db.query(
      `UPDATE "ClassRooms" SET "Is_Hidden" = FALSE WHERE "Class_ID" = $1`,
      [classId]
    );
    socket.emit("show_class_result", { success: true, classId });
  } catch (err) {
    socket.emit("show_class_result", { success: false, message: err.message });
  }
});

};
