const express = require("express");
const router = express.Router();
const pool = require("../db");

// =====================
// GET avatar options
// =====================
router.use((req, res, next) => {
  console.log("🔥 avatars router HIT", req.method, req.originalUrl);
  next();
});


router.get("/options", async (req, res) => {
  try {
    const masks = await pool.query('SELECT "Mask_ID","Mask_Image" FROM "AvatarMasks"');
    const costumes = await pool.query('SELECT "Costume_ID","Costume_Image" FROM "AvatarCostumes"');
    const bodies = await pool.query('SELECT "Body_ID","Body_Image" FROM "AvatarBodies"');
    const accessories = await pool.query('SELECT "Accessory_ID","Accessory_Image" FROM "AvatarAccessories"');

    res.json({
      masks: masks.rows.map(r => ({ id: r.Mask_ID, path: r.Mask_Image })),
      bodies: bodies.rows.map(r => ({ id: r.Body_ID, path: r.Body_Image })),
      costumes: costumes.rows.map(r => ({ id: r.Costume_ID, path: r.Costume_Image })),
      accessories: accessories.rows.map(r => ({ id: r.Accessory_ID, path: r.Accessory_Image })),
    });
  } catch (err) {
    res.status(500).json({ error: "Cannot fetch avatar options" });
  }
});

router.post("/", async (req, res) => {
  const {
    studentId,
    studentNumber,
    joinCode,
    stageName,
    maskId,
    costumeId,
    accessoryId,
    bodyId,
  } = req.body;

  try {
    // 1. หา class
    const classRes = await pool.query(
      'SELECT "Class_ID" FROM "ClassRooms" WHERE "Join_Code"=$1',
      [joinCode]
    );
    if (classRes.rows.length === 0) {
      return res.status(400).json({ error: "Invalid room code" });
    }

    // 2. create avatar
    const avatarResult = await pool.query(
      `INSERT INTO "Avatars"
       ("Mask_ID","Costume_ID","Accessory_ID","Body_ID")
       VALUES ($1,$2,$3,$4)
       RETURNING "Avatar_ID"`,
      [maskId, costumeId, accessoryId, bodyId]
    );

    const avatarId = avatarResult.rows[0].Avatar_ID;
    const name = stageName?.trim() || studentNumber;

    // 3. update student (สำคัญที่สุด)
    await pool.query(
      `UPDATE "Students"
       SET "Avatar_ID" = $1,
           "Student_Name" = $2
       WHERE "Student_ID" = $3`,
      [avatarId, name, studentId]
    );

    res.json({ avatarId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
