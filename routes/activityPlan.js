const db = require("../db");

module.exports = (socket) => {
  console.log("ActivityPlan socket ready:", socket.id);

  socket.on("get_activity_plans", async (classId) => {
    console.log("get_activity_plans:", classId);

    try {
      const result = await db.query(
        `SELECT 
          "Plan_ID",
          "Week",
          TO_CHAR("Date_WeekPlan", 'YYYY-MM-DD') AS "Date_WeekPlan",
          "Plan_Content",
          "Activity_Todo",
          "Plan_Created",
          "Plan_Updated"
        FROM "ActivityPlans"
        WHERE "Class_ID" = $1
        ORDER BY "Date_WeekPlan"`,
        [classId]
      );

      socket.emit("activity_plans_data", result.rows);
    } catch (err) {
      socket.emit("activity_plans_data", { error: err.message });
    }
  });

  socket.on("create_activity_plan", async (data) => {
    console.log("🔥 create_activity_plan received:", data);

    try {
      const { classId, week, date, content, activities } = data;

      const result = await db.query(
        `INSERT INTO "ActivityPlans"
         ("Class_ID","Week","Date_WeekPlan","Plan_Content","Activity_Todo")
         VALUES ($1,$2,$3,$4,$5)
         RETURNING "Plan_ID"`,
        [classId, week, date, content, JSON.stringify(activities)]
      );

      socket.emit("create_activity_plan_result", {
        success: true,
        planId: result.rows[0].Plan_ID,
      });
    } catch (err) {
      console.error(err);
      socket.emit("create_activity_plan_result", {
        success: false,
        message: err.message,
      });
    }
  });

  socket.on("update_activity_plan", async (data) => {
    const { planId, week, date, content, activities } = data;

    try {
      await db.query(
        `
        UPDATE "ActivityPlans"
        SET 
          "Week" = $1,
          "Date_WeekPlan" = $2,
          "Plan_Content" = $3,
          "Activity_Todo" = $4,
          "Plan_Updated" = NOW()
        WHERE "Plan_ID" = $5
        `,
        [
          week,
          date,
          content,
          JSON.stringify(activities),
          planId,
        ]
      );

      socket.emit("update_activity_plan_result", {
        success: true,
      });

    } catch (err) {
      console.error("❌ update_activity_plan error:", err);
      socket.emit("update_activity_plan_result", {
        success: false,
        message: err.message,
      });
    }
  });

  socket.on("delete_activity_plan", async (planId) => {
    console.log("🗑 delete_activity_plan received:", planId);

    try {
      await db.query(
        `DELETE FROM "ActivityPlans"
        WHERE "Plan_ID" = $1`,
        [planId]
      );

      socket.emit("delete_activity_plan_result", {
        success: true,
      });

    } catch (err) {
      console.error("❌ delete_activity_plan error:", err);
      socket.emit("delete_activity_plan_result", {
        success: false,
        message: err.message,
      });
    }
  });




};