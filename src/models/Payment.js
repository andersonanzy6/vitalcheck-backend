const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "USD",
      enum: ["USD", "NGN", "GHS", "KES", "ZAR", "EUR"],
    },
    paymentMethod: {
      type: String,
      enum: ["card", "mobile_money", "bank_transfer", "paypal", "wallet"],
      required: true,
    },
    paymentGateway: {
      type: String,
      enum: ["flutterwave", "paypal", "bank_transfer", "stripe"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
    },
    transactionId: {
      type: String,
      unique: true,
      sparse: true,
    },
    gatewayReference: {
      type: String,
      // Reference ID from payment gateway (Flutterwave ref, PayPal transaction ID, etc.)
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
      // Store full response from payment gateway
    },
    receipt: {
      receiptNumber: String,
      receiptUrl: String,
    },
    bankTransferDetails: {
      accountName: String,
      accountNumber: String,
      bankName: String,
      routingNumber: String,
      swiftCode: String,
      proofOfTransfer: String, // Document URL
      verifiedAt: Date,
    },
    description: {
      type: String,
      default: "Consultation fee for appointment",
    },
    paymentDetails: {
      cardLast4: String,
      cardBrand: String, // Visa, Mastercard, etc.
      expiryMonth: Number,
      expiryYear: Number,
      mobileNumber: String, // For mobile money
      paypalEmail: String,
    },
    metadata: {
      appointmentDate: Date,
      doctorName: String,
      patientName: String,
      appointmentReason: String,
    },
    refund: {
      refundAmount: Number,
      refundReason: String,
      refundedAt: Date,
      refundTransactionId: String,
    },
    failureReason: String, // If payment failed
    attempts: {
      type: Number,
      default: 1,
    },
    paymentInitiatedAt: Date,
    paymentCompletedAt: Date,
  },
  { timestamps: true }
);

// Indexes for faster queries
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ appointmentId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ paymentInitiatedAt: 1 });

// Generate transaction ID before saving
paymentSchema.pre("save", function (next) {
  if (!this.transactionId) {
    this.transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

module.exports = mongoose.model("Payment", paymentSchema);
