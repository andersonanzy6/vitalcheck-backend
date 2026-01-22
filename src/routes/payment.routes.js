const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/payment.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Payment Initiation
router.post("/initiate", authMiddleware, paymentController.initiatePayment);

// Payment Verification
router.post("/verify/flutterwave", authMiddleware, paymentController.verifyFlutterwavePayment);
router.post("/verify/paypal", authMiddleware, paymentController.verifyPayPalPayment);
router.post("/bank-transfer/upload-proof/:paymentId", authMiddleware, paymentController.uploadBankTransferProof);

// User Payment History
router.get("/history", authMiddleware, paymentController.getPaymentHistory);
router.get("/receipt/:paymentId", authMiddleware, paymentController.getPaymentReceipt);

// Admin Routes
router.get("/admin/all", authMiddleware, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: "Only admins can access this" });
  }
  paymentController.getAllPayments(req, res);
});

router.get("/admin/stats", authMiddleware, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: "Only admins can access this" });
  }
  paymentController.getPaymentStats(req, res);
});

router.post("/admin/bank-transfer/verify/:paymentId", authMiddleware, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: "Only admins can access this" });
  }
  paymentController.verifyBankTransfer(req, res);
});

module.exports = router;
