const express = require("express");
const {
  createFinance,
  getFinances,
  updateFinance,
  deleteFinance,
  getSummary
} = require("../controllers/financeController");
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(protect);

router.get("/", authorize("viewer", "analyst", "admin"), getFinances);
router.get("/summary", authorize("analyst", "admin"), getSummary);
router.post("/", authorize("admin"), createFinance);
router.put("/:id", authorize("admin"), updateFinance);
router.delete("/:id", authorize("admin"), deleteFinance);

module.exports = router;
