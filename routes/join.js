// const pool = require("../db");

// module.exports = (io, socket,rooms) => {
//   console.log("🎓 Student connected:", socket.id);

//   // =====================
//   // JOIN CLASS
//   // =====================
//   socket.on("join_class", async ({ joinCode }) => {
//     try {
//       const classRes = await pool.query(
//         'SELECT * FROM "ClassRooms" WHERE "Join_Code"=$1',
//         [joinCode]
//       );

//       if (!classRes.rows.length) {
//         return socket.emit("join_result", { success: false, message: "invalid room code" });
//       }

//       if (!classRes.rows[0].is_open) {
//         return socket.emit("join_result", {
//           success: false,
//           message: "Teacher has not started the room yet",
//         });
//       }

//       const classId = classRes.rows[0].Class_ID;

//       /* ⭐ check lobby capacity */
//       const room = rooms[joinCode];

//       console.log("🔎 join_class check room:", joinCode);

//       if (room) {
//         console.log("👥 lobby students =", room.students.length);
//       } else {
//         console.log("👥 lobby students = 0 (room not created yet)");
//       }

//       if (room && room.students.length >= 200) {
//         console.log("⛔ ROOM FULL:", room.students.length);

//         return socket.emit("join_result", {
//           success: false,
//           message: "This room is full (200 students)"
//         });
//       }


//       socket.join(`class_${classId}`);

//       socket.emit("join_result", {
//         success: true,
//         joinCode,
//         classId,
//       });
//     } catch (err) {
//       socket.emit("join_result", { success: false, message: err.message });
//     }
//   });
//   // =====================
//   // CHECK STUDENT
//   // =====================
//   socket.on("check_student", async ({ joinCode, studentNumber }) => {
//     try {
//       // 1️⃣ หา class จาก joinCode
//       const classRes = await pool.query(
//         'SELECT "Class_ID" FROM "ClassRooms" WHERE "Join_Code"=$1',
//         [joinCode]
//       );

//       if (classRes.rows.length === 0) {
//         return socket.emit("student_checked", {
//           exists: false,
//           message: "Invalid room code",
//         });
//       }

//       const classId = classRes.rows[0].Class_ID;

//       // 2️⃣ เช็ก student ใน class นี้
//       const res = await pool.query(
//         'SELECT * FROM "Students" WHERE "Student_Number"=$1 AND "Class_ID"=$2',
//         [studentNumber, classId]
//       );
//       if (res.rows.length > 0) {
//         const student = res.rows[0];

//         socket.emit("student_checked", {
//           exists: true,
//           studentId: student.Student_ID,
//           studentNumber: student.Student_Number,
//           stageName: student.Student_Name,
//         });
//       } else {
//         socket.emit("student_checked", {
//           exists: false,
//           studentId: null,
//           studentNumber,
//         });
//       }
//     } catch (err) {
//       socket.emit("student_checked", {
//         exists: false,
//         error: err.message,
//       });
//     }
//   });

//   socket.on("create_student", async ({ joinCode, studentNumber }) => {
//     try {
//       const classRes = await pool.query(
//         'SELECT "Class_ID" FROM "ClassRooms" WHERE "Join_Code"=$1',
//         [joinCode]
//       );

//       if (classRes.rows.length === 0) {
//         return socket.emit("student_created", {
//           success: false,
//           message: "Invalid room code",
//         });
//       }

//       const classId = classRes.rows[0].Class_ID;

//       const insertRes = await pool.query(
//         'INSERT INTO "Students" ("Student_Number", "Student_Name" , "Class_ID") VALUES ($1, $2, $3) RETURNING  "Student_ID","Student_Number","Student_Name"',
//         [studentNumber, studentNumber, classId]
//       );

//       const student = insertRes.rows[0];

//       socket.emit("student_created", {
//         success: true,
//         studentId: student.Student_ID,
//         studentNumber: student.Student_Number,
//         stageName: student.Student_Name || student.Student_Number,
//       });
//     } catch (err) {
//       socket.emit("student_created", {
//         success: false,
//         error: err.message,
//       });
//     }
//   });

//   socket.on("update-player", async ({ joinCode, studentId, stageName, avatar }) => {
//     const room = rooms[joinCode];
//     if (!room) return;

//     const player = room.students.find(
//       (p) => String(p.studentId) === String(studentId)
//     );

//     if (!player) return;

//     player.stageName = stageName;

//     if (avatar) {
//       // 🔥 ดึง path จาก DB ตาม id ใหม่
//       const result = await pool.query(`
//         SELECT 
//           b."Body_Image",
//           c."Costume_Image",
//           m."Mask_Image",
//           a."Accessory_Image"
//         FROM "Avatars" av
//         LEFT JOIN "AvatarBodies" b ON av."Body_ID" = b."Body_ID"
//         LEFT JOIN "AvatarCostumes" c ON av."Costume_ID" = c."Costume_ID"
//         LEFT JOIN "AvatarMasks" m ON av."Mask_ID" = m."Mask_ID"
//         LEFT JOIN "AvatarAccessories" a ON av."Accessory_ID" = a."Accessory_ID"
//         WHERE av."Avatar_ID" = (
//           SELECT "Avatar_ID"
//           FROM "Students"
//           WHERE "Student_ID" = $1
//         )
//       `, [studentId]);

//       if (result.rows.length > 0) {
//         const row = result.rows[0];

//         player.avatar = {
//           bodyPath: row.Body_Image,
//           costumePath: row.Costume_Image,
//           facePath: row.Mask_Image,
//           hairPath: row.Accessory_Image
//         };
//       }
//     }

//     io.to(joinCode).emit("room-players", room.students);
//   });

//   // =====================
//   // JOIN ROOM (Lobby)
//   // =====================
//   socket.on("join-room", async ({ joinCode, player, role }) => {
//     if (!joinCode) return;

//     const check = await pool.query(
//       'SELECT is_open, "Class_ID" FROM "ClassRooms" WHERE "Join_Code"=$1',
//       [joinCode]
//     );

//     if (!check.rows[0]?.is_open) {
//       socket.emit("room_closed");
//       return;
//     }

//     const classId = check.rows[0].Class_ID;

//     // 👩‍🏫 TEACHER
//     if (role === "teacher") {
//       if (!rooms[joinCode]) {
//         rooms[joinCode] = { teacher: null, students: [] };
//       }

//       socket.join(joinCode);
//       rooms[joinCode].teacher = { socketId: socket.id };

//       socket.emit("room-players", rooms[joinCode].students);
//       return;
//     }

//     // 👨‍🎓 STUDENT
//      // 🔎 ถ้า teacher ไม่อยู่ lobby
//     if (!rooms[joinCode]) {

//       socket.join(joinCode);

//       console.log("🔍 CHECK ACTIVITY for class:", classId);

//       // 🔎 เช็คว่ามี activity active ไหม
//       const activityRes = await pool.query(`
//         SELECT 
//           a."ActivitySession_ID",
//           a."Activity_Type",
//           aq."Mode"
//         FROM "ActivitySessions" a
//         LEFT JOIN "AssignedQuiz" aq
//         ON aq."ActivitySession_ID" = a."ActivitySession_ID"
//         WHERE a."Class_ID"=$1
//         AND a."Status"='active'
//         ORDER BY a."ActivitySession_ID" DESC
//         LIMIT 1
//       `,[classId]);

//       console.log("📦 activityRes =", activityRes.rows);
      
//       if (activityRes.rows.length > 0) {

//         const activity = activityRes.rows[0];

//         socket.join(`activity_${activity.ActivitySession_ID}`);

//         socket.emit("activity_started", {
//           activitySessionId: activity.ActivitySession_ID,
//           activityType: activity.Activity_Type,
//           mode: activity.Mode
//         });

//         return;
//       }

//       socket.emit("room_closed");
//       return;
//     }

//     // 👨‍🎓 STUDENT

//     // if (!rooms[joinCode]) {
//     //   socket.emit("room_closed");
//     //   return;
//     // }
//     // socket.join(joinCode);

//     // // 🔎 เช็ค activity เสมอ
//     // const activityRes = await pool.query(`
//     //   SELECT 
//     //     a."ActivitySession_ID",
//     //     a."Activity_Type",
//     //     aq."Mode"
//     //   FROM "ActivitySessions" a
//     //   LEFT JOIN "AssignedQuiz" aq
//     //   ON aq."ActivitySession_ID" = a."ActivitySession_ID"
//     //   WHERE a."Class_ID"=$1
//     //   AND a."Status"='active'
//     //   ORDER BY a."ActivitySession_ID" DESC
//     //   LIMIT 1
//     // `, [classId]);

//     // console.log("📦 activityRes =", activityRes.rows);

//     // if (activityRes.rows.length > 0) {

//     //   const activity = activityRes.rows[0];

//     //   socket.join(`activity_${activity.ActivitySession_ID}`);

//     //   console.log("🚀 EMIT activity_started:", activity);

//     //   socket.emit("activity_started", {
//     //     activitySessionId: activity.ActivitySession_ID,
//     //     activityType: activity.Activity_Type,
//     //     mode: activity.Mode
//     //   });

//     //   return;
//     // }

//     if (!player) return;

//     socket.join(joinCode);

//     const room = rooms[joinCode];

//     const result = await pool.query(`
//       SELECT 
//         s."Student_ID",
//         s."Student_Name",
//         b."Body_Image",
//         c."Costume_Image",
//         m."Mask_Image",
//         a."Accessory_Image"
//       FROM "Students" s
//       LEFT JOIN "Avatars" av ON s."Avatar_ID" = av."Avatar_ID"
//       LEFT JOIN "AvatarBodies" b ON av."Body_ID" = b."Body_ID"
//       LEFT JOIN "AvatarCostumes" c ON av."Costume_ID" = c."Costume_ID"
//       LEFT JOIN "AvatarMasks" m ON av."Mask_ID" = m."Mask_ID"
//       LEFT JOIN "AvatarAccessories" a ON av."Accessory_ID" = a."Accessory_ID"
//       WHERE s."Student_ID" = $1
//     `, [player.studentId]);

//     if (!result.rows.length) return;

//     const row = result.rows[0];

//     const student = {
//       studentId: row.Student_ID,
//       stageName: row.Student_Name,
//       avatar: {
//         bodyPath: row.Body_Image,
//         costumePath: row.Costume_Image,
//         facePath: row.Mask_Image,
//         hairPath: row.Accessory_Image
//       },
//       socketId: socket.id
//     };

//     const index = room.students.findIndex(
//       p => String(p.studentId) === String(student.studentId)
//     );

//     if (index !== -1) {

//       room.students[index].socketId = socket.id;

//     } else {

//       /* ⭐ check lobby limit */
//       if (room.students.length >= 200) {
//         socket.emit("room_full");
//         return;
//       }

//       room.students.push(student);

//     }

//     io.to(joinCode).emit("room-players", room.students);
//   });

//   // =====================
//   // JOIN ACTIVITY
//   // =====================
//   socket.on("join_activity", async ({ activitySessionId, studentId }) => {
//     const room = `activity_${activitySessionId}`;
//     socket.join(room);

//     if (!studentId) return;

//     socket.data.activitySessionId = activitySessionId;
//     socket.data.studentId = studentId;

//     // 1️⃣ insert participant
//     await pool.query(`
//       INSERT INTO "ActivityParticipants"
//       ("ActivitySession_ID","Student_ID","Joined_At")
//       VALUES ($1,$2,NOW())
//       ON CONFLICT DO NOTHING
//     `,[activitySessionId, studentId]);

//     // 2️⃣ check team
//     const teamRes = await pool.query(`
//       SELECT COUNT(*) FROM "TeamAssignments"
//       WHERE "ActivitySession_ID" = $1
//     `,[activitySessionId]);

//     // 3️⃣ auto add team ถ้ามีทีมแล้ว
//     if (Number(teamRes.rows[0].count) > 0) {
//       await pool.query(`
//         INSERT INTO "TeamMembers" ("Team_ID","Student_ID")
//         SELECT ta."Team_ID", $2
//         FROM "TeamAssignments" ta
//         LEFT JOIN "TeamMembers" tm ON tm."Team_ID" = ta."Team_ID"
//         WHERE ta."ActivitySession_ID" = $1
//         AND NOT EXISTS (
//           SELECT 1 FROM "TeamMembers"
//           WHERE "Student_ID" = $2
//         )
//         GROUP BY ta."Team_ID"
//         ORDER BY COUNT(tm."Student_ID") ASC
//         LIMIT 1
//       `,[activitySessionId, studentId]);

//     }

//     // 4️⃣ 🔥 ค่อย emit ตอนทุกอย่างเสร็จ
//     io.to(room).emit("player-joined");

//   });

//   // =====================
//   // REQUEST PROFILE
//   // =====================
//   socket.on("request_my_profile", async ({ studentId }) => {
//     const res = await pool.query(`
//       SELECT 
//         s."Student_Name",
//         b."Body_Image",
//         c."Costume_Image",
//         m."Mask_Image",
//         a."Accessory_Image"
//       FROM "Students" s
//       LEFT JOIN "Avatars" av ON s."Avatar_ID" = av."Avatar_ID"
//       LEFT JOIN "AvatarBodies" b ON av."Body_ID" = b."Body_ID"
//       LEFT JOIN "AvatarCostumes" c ON av."Costume_ID" = c."Costume_ID"
//       LEFT JOIN "AvatarMasks" m ON av."Mask_ID" = m."Mask_ID"
//       LEFT JOIN "AvatarAccessories" a ON av."Accessory_ID" = a."Accessory_ID"
//       WHERE s."Student_ID" = $1
//     `, [studentId]);

//     if (!res.rows.length) return;

//     const row = res.rows[0];

//     socket.emit("my_profile_data", {
//       stageName: row.Student_Name,
//       avatar: {
//         bodyPath: row.Body_Image,
//         costumePath: row.Costume_Image,
//         facePath: row.Mask_Image,
//         hairPath: row.Accessory_Image
//       }
//     });
//   });
  
//   socket.on("start_activity", (payload) => {
//     const room = rooms[payload.joinCode];
//     if (!room) return;

//     if (room.teacher?.socketId !== socket.id) {
//       console.log("❌ Not teacher");
//       return;
//     }

//     io.to(payload.joinCode).emit("activity_started", payload);
//   });

//   // =====================
//   // DISCONNECT
//   // =====================
//   socket.on("disconnect", async () => {
//     for (const joinCode in rooms) {
//       const room = rooms[joinCode];

//       room.students = room.students.filter(p => p.socketId !== socket.id);

//       // if (room.teacher?.socketId === socket.id) {
//       //   room.teacher = null;
//       // }

//       if (room.teacher?.socketId === socket.id) {

//         console.log("👩‍🏫 teacher disconnected but keep room:", joinCode);

//         room.teacher = null;   // แค่เอา teacher ออก

//         continue;
//       }


//       io.to(joinCode).emit("room-players", room.students);
//     }

//     console.log("❌ disconnected:", socket.id);
//   });
// };


const pool = require("../db");

module.exports = (io, socket, rooms) => {
  console.log("🎓 Student connected:", socket.id);

  // =====================
  // JOIN CLASS
  // =====================
  socket.on("join_class", async ({ joinCode }) => {
    try {
      const classRes = await pool.query(
        'SELECT * FROM "ClassRooms" WHERE "Join_Code"=$1',
        [joinCode]
      );

      if (!classRes.rows.length) {
        return socket.emit("join_result", { success: false, message: "invalid room code" });
      }

      if (!classRes.rows[0].is_open) {
        return socket.emit("join_result", {
          success: false,
          message: "Teacher has not started the room yet",
        });
      }

      const classId = classRes.rows[0].Class_ID;

      /* ⭐ check lobby capacity */
      const room = rooms[joinCode];

      console.log("🔎 join_class check room:", joinCode);

      if (room) {
        console.log("👥 lobby students =", room.students.length);
      } else {
        console.log("👥 lobby students = 0 (room not created yet)");
      }

      if (room && room.students.length >= 200) {
        console.log("⛔ ROOM FULL:", room.students.length);

        return socket.emit("join_result", {
          success: false,
          message: "This room is full (200 students)"
        });
      }


      socket.join(`class_${classId}`);

      socket.emit("join_result", {
        success: true,
        joinCode,
        classId,
      });
    } catch (err) {
      socket.emit("join_result", { success: false, message: err.message });
    }
  });
  // =====================
  // CHECK STUDENT
  // =====================
  socket.on("check_student", async ({ joinCode, studentNumber }) => {
    try {
      // 1️⃣ หา class จาก joinCode
      const classRes = await pool.query(
        'SELECT "Class_ID" FROM "ClassRooms" WHERE "Join_Code"=$1',
        [joinCode]
      );

      if (classRes.rows.length === 0) {
        return socket.emit("student_checked", {
          exists: false,
          message: "Invalid room code",
        });
      }

      const classId = classRes.rows[0].Class_ID;

      // 2️⃣ เช็ก student ใน class นี้
      const res = await pool.query(
        'SELECT * FROM "Students" WHERE "Student_Number"=$1 AND "Class_ID"=$2',
        [studentNumber, classId]
      );
      if (res.rows.length > 0) {
        const student = res.rows[0];

        socket.emit("student_checked", {
          exists: true,
          studentId: student.Student_ID,
          studentNumber: student.Student_Number,
          stageName: student.Student_Name,
        });
      } else {
        socket.emit("student_checked", {
          exists: false,
          studentId: null,
          studentNumber,
        });
      }
    } catch (err) {
      socket.emit("student_checked", {
        exists: false,
        error: err.message,
      });
    }
  });

  socket.on("create_student", async ({ joinCode, studentNumber }) => {
    try {
      const classRes = await pool.query(
        'SELECT "Class_ID" FROM "ClassRooms" WHERE "Join_Code"=$1',
        [joinCode]
      );

      if (classRes.rows.length === 0) {
        return socket.emit("student_created", {
          success: false,
          message: "Invalid room code",
        });
      }

      const classId = classRes.rows[0].Class_ID;

      const insertRes = await pool.query(
        'INSERT INTO "Students" ("Student_Number", "Student_Name" , "Class_ID") VALUES ($1, $2, $3) RETURNING  "Student_ID","Student_Number","Student_Name"',
        [studentNumber, studentNumber, classId]
      );

      const student = insertRes.rows[0];

      socket.emit("student_created", {
        success: true,
        studentId: student.Student_ID,
        studentNumber: student.Student_Number,
        stageName: student.Student_Name || student.Student_Number,
      });
    } catch (err) {
      socket.emit("student_created", {
        success: false,
        error: err.message,
      });
    }
  });

  socket.on("update-player", async ({ joinCode, studentId, stageName, avatar }) => {
    const room = rooms[joinCode];
    if (!room) return;

    const player = room.students.find(
      (p) => String(p.studentId) === String(studentId)
    );

    if (!player) return;

    player.stageName = stageName;

    if (avatar) {
      // 🔥 ดึง path จาก DB ตาม id ใหม่
      const result = await pool.query(`
        SELECT 
          b."Body_Image",
          c."Costume_Image",
          m."Mask_Image",
          a."Accessory_Image"
        FROM "Avatars" av
        LEFT JOIN "AvatarBodies" b ON av."Body_ID" = b."Body_ID"
        LEFT JOIN "AvatarCostumes" c ON av."Costume_ID" = c."Costume_ID"
        LEFT JOIN "AvatarMasks" m ON av."Mask_ID" = m."Mask_ID"
        LEFT JOIN "AvatarAccessories" a ON av."Accessory_ID" = a."Accessory_ID"
        WHERE av."Avatar_ID" = (
          SELECT "Avatar_ID"
          FROM "Students"
          WHERE "Student_ID" = $1
        )
      `, [studentId]);

      if (result.rows.length > 0) {
        const row = result.rows[0];

        player.avatar = {
          bodyPath: row.Body_Image,
          costumePath: row.Costume_Image,
          facePath: row.Mask_Image,
          hairPath: row.Accessory_Image
        };
      }
    }

    io.to(joinCode).emit("room-players", room.students);
  });

  // =====================
  // JOIN ROOM (Lobby)
  // =====================
  socket.on("join-room", async ({ joinCode, player, role }) => {
    if (!joinCode) return;

    const check = await pool.query(
      'SELECT is_open, "Class_ID" FROM "ClassRooms" WHERE "Join_Code"=$1',
      [joinCode]
    );

    if (!check.rows[0]?.is_open) {
      socket.emit("room_closed");
      return;
    }

    const classId = check.rows[0].Class_ID;

    // 👩‍🏫 TEACHER
    if (role === "teacher") {
      if (!rooms[joinCode]) {
        rooms[joinCode] = { teacher: null, students: [] };
      }

      socket.join(joinCode);
      rooms[joinCode].teacher = { socketId: socket.id };

      socket.emit("room-players", rooms[joinCode].students);
      return;
    }

    // 👨‍🎓 STUDENT
    // 🔎 ถ้า teacher ไม่อยู่ lobby
    if (!rooms[joinCode]) {

      socket.join(joinCode);

      console.log("🔍 CHECK ACTIVITY for class:", classId);

      // 🔎 เช็คว่ามี activity active ไหม
      const activityRes = await pool.query(`
        SELECT 
          a."ActivitySession_ID",
          a."Activity_Type",
          aq."Mode"
        FROM "ActivitySessions" a
        LEFT JOIN "AssignedQuiz" aq
        ON aq."ActivitySession_ID" = a."ActivitySession_ID"
        WHERE a."Class_ID"=$1
        AND a."Status"='active'
        ORDER BY a."ActivitySession_ID" DESC
        LIMIT 1
      `, [classId]);

      console.log("📦 activityRes =", activityRes.rows);

      if (activityRes.rows.length > 0) {

        const activity = activityRes.rows[0];

        socket.join(`activity_${activity.ActivitySession_ID}`);

        socket.emit("activity_started", {
          activitySessionId: activity.ActivitySession_ID,
          activityType: activity.Activity_Type,
          mode: activity.Mode
        });

        return;
      }

      socket.emit("room_closed");
      return;
    }

    // 👨‍🎓 STUDENT

    // if (!rooms[joinCode]) {
    //   socket.emit("room_closed");
    //   return;
    // }
    // socket.join(joinCode);

    // // 🔎 เช็ค activity เสมอ
    // const activityRes = await pool.query(`
    //   SELECT 
    //     a."ActivitySession_ID",
    //     a."Activity_Type",
    //     aq."Mode"
    //   FROM "ActivitySessions" a
    //   LEFT JOIN "AssignedQuiz" aq
    //   ON aq."ActivitySession_ID" = a."ActivitySession_ID"
    //   WHERE a."Class_ID"=$1
    //   AND a."Status"='active'
    //   ORDER BY a."ActivitySession_ID" DESC
    //   LIMIT 1
    // `, [classId]);

    // console.log("📦 activityRes =", activityRes.rows);

    // if (activityRes.rows.length > 0) {

    //   const activity = activityRes.rows[0];

    //   socket.join(`activity_${activity.ActivitySession_ID}`);

    //   console.log("🚀 EMIT activity_started:", activity);

    //   socket.emit("activity_started", {
    //     activitySessionId: activity.ActivitySession_ID,
    //     activityType: activity.Activity_Type,
    //     mode: activity.Mode
    //   });

    //   return;
    // }

    if (!player) return;

    socket.join(joinCode);

    const room = rooms[joinCode];

    const result = await pool.query(`
      SELECT 
        s."Student_ID",
        s."Student_Name",
        b."Body_Image",
        c."Costume_Image",
        m."Mask_Image",
        a."Accessory_Image"
      FROM "Students" s
      LEFT JOIN "Avatars" av ON s."Avatar_ID" = av."Avatar_ID"
      LEFT JOIN "AvatarBodies" b ON av."Body_ID" = b."Body_ID"
      LEFT JOIN "AvatarCostumes" c ON av."Costume_ID" = c."Costume_ID"
      LEFT JOIN "AvatarMasks" m ON av."Mask_ID" = m."Mask_ID"
      LEFT JOIN "AvatarAccessories" a ON av."Accessory_ID" = a."Accessory_ID"
      WHERE s."Student_ID" = $1
    `, [player.studentId]);

    if (!result.rows.length) return;

    const row = result.rows[0];

    const student = {
      studentId: row.Student_ID,
      stageName: row.Student_Name,
      avatar: {
        bodyPath: row.Body_Image,
        costumePath: row.Costume_Image,
        facePath: row.Mask_Image,
        hairPath: row.Accessory_Image
      },
      socketId: socket.id
    };

    const index = room.students.findIndex(
      p => String(p.studentId) === String(student.studentId)
    );

    if (index !== -1) {

      room.students[index].socketId = socket.id;

    } else {

      /* ⭐ check lobby limit */
      if (room.students.length >= 200) {
        socket.emit("room_full");
        return;
      }

      room.students.push(student);

    }

    io.to(joinCode).emit("room-players", room.students);
  });

  // =====================
  // JOIN ACTIVITY
  // =====================
  socket.on("join_activity", async ({ activitySessionId, studentId }) => {
    const room = `activity_${activitySessionId}`;
    socket.join(room);

    if (!studentId) return;

    socket.data.activitySessionId = activitySessionId;
    socket.data.studentId = studentId;

    // 1️⃣ insert participant
    await pool.query(`
      INSERT INTO "ActivityParticipants"
      ("ActivitySession_ID","Student_ID","Joined_At")
      VALUES ($1,$2,NOW())
      ON CONFLICT ("ActivitySession_ID","Student_ID")
      DO NOTHING
    `, [activitySessionId, studentId]);

    const partiRes = await pool.query(`
      SELECT "ActivityParticipant_ID"
      FROM "ActivityParticipants"
      WHERE "ActivitySession_ID"=$1
      AND "Student_ID"=$2
    `, [activitySessionId, studentId]);

    const participantId = partiRes.rows[0]?.ActivityParticipant_ID;

    // 2️⃣ check team
    const teamRes = await pool.query(`
      SELECT COUNT(*)
      FROM "TeamAssignments" ta
      JOIN "AssignedQuiz" aq
        ON aq."AssignedQuiz_ID" = ta."AssignedQuiz_ID"
      WHERE aq."ActivitySession_ID" = $1
    `, [activitySessionId]);

    // 3️⃣ auto add team ถ้ามีทีมแล้ว
    if (Number(teamRes.rows[0].count) > 0) {
      await pool.query(`
        INSERT INTO "TeamMembers" ("Team_ID","ActivityParticipant_ID")
        SELECT ta."Team_ID", $2
        FROM "TeamAssignments" ta
        JOIN "AssignedQuiz" aq
          ON aq."AssignedQuiz_ID" = ta."AssignedQuiz_ID"
        LEFT JOIN "TeamMembers" tm
          ON tm."Team_ID" = ta."Team_ID"
        WHERE aq."ActivitySession_ID" = $1
        AND NOT EXISTS (
          SELECT 1
          FROM "TeamMembers"
          WHERE "ActivityParticipant_ID" = $2
        )
        GROUP BY ta."Team_ID"
        ORDER BY COUNT(tm."ActivityParticipant_ID") ASC
        LIMIT 1
      `, [activitySessionId, participantId]);

    }

    // 4️⃣ 🔥 ค่อย emit ตอนทุกอย่างเสร็จ
    io.to(room).emit("player-joined");

  });

  // =====================
  // REQUEST PROFILE
  // =====================
  socket.on("request_my_profile", async ({ studentId }) => {
    const res = await pool.query(`
      SELECT 
        s."Student_Name",
        b."Body_Image",
        c."Costume_Image",
        m."Mask_Image",
        a."Accessory_Image"
      FROM "Students" s
      LEFT JOIN "Avatars" av ON s."Avatar_ID" = av."Avatar_ID"
      LEFT JOIN "AvatarBodies" b ON av."Body_ID" = b."Body_ID"
      LEFT JOIN "AvatarCostumes" c ON av."Costume_ID" = c."Costume_ID"
      LEFT JOIN "AvatarMasks" m ON av."Mask_ID" = m."Mask_ID"
      LEFT JOIN "AvatarAccessories" a ON av."Accessory_ID" = a."Accessory_ID"
      WHERE s."Student_ID" = $1
    `, [studentId]);

    if (!res.rows.length) return;

    const row = res.rows[0];

    socket.emit("my_profile_data", {
      stageName: row.Student_Name,
      avatar: {
        bodyPath: row.Body_Image,
        costumePath: row.Costume_Image,
        facePath: row.Mask_Image,
        hairPath: row.Accessory_Image
      }
    });
  });

  socket.on("start_activity", (payload) => {
    const room = rooms[payload.joinCode];
    if (!room) return;

    if (room.teacher?.socketId !== socket.id) {
      console.log("❌ Not teacher");
      return;
    }

    io.to(payload.joinCode).emit("activity_started", payload);
  });

  // =====================
  // DISCONNECT
  // =====================
  socket.on("disconnect", async () => {
    for (const joinCode in rooms) {
      const room = rooms[joinCode];

      room.students = room.students.filter(p => p.socketId !== socket.id);

      // if (room.teacher?.socketId === socket.id) {
      //   room.teacher = null;
      // }

      if (room.teacher?.socketId === socket.id) {

        console.log("👩‍🏫 teacher disconnected but keep room:", joinCode);

        room.teacher = null;   // แค่เอา teacher ออก

        continue;
      }


      io.to(joinCode).emit("room-players", room.students);
    }

    console.log("❌ disconnected:", socket.id);
  });
};