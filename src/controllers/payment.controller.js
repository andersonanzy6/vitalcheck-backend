const Payment = require("../models/Payment");
const Appointment = require("../models/Appointment");
const User = require("../models/User");
const axios = require("axios");

// ============ PAYMENT INITIATION ============

exports.initiatePayment = async (req, res) => {
  try {
    const { appointmentId, paymentMethod, paymentGateway, amount } = req.body;
    const userId = req.user.id;

    // Validate appointment exists
    const appointment = await Appointment.findById(appointmentId)
      .populate("doctorId", "name specialization");
    
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    if (appointment.patientId.toString() !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const user = await User.findById(userId);
    const doctor = appointment.doctorId;

    // Create payment record
    const payment = new Payment({
      userId,
      appointmentId,
      doctorId: doctor._id,
      amount: amount || 100, // Default $100 consultation fee
      paymentMethod,
      paymentGateway,
      status: "pending",
      paymentInitiatedAt: new Date(),
      metadata: {
        appointmentDate: appointment.appointmentDate,
        doctorName: doctor.name,
        patientName: user.name,
        appointmentReason: appointment.reason,
      },
    });

    await payment.save();

    // Generate payment link based on gateway
    let paymentLink = null;

    switch (paymentGateway) {
      case "flutterwave":
        paymentLink = await generateFlutterwaveLink(payment, user, doctor);
        break;
      case "paypal":
        paymentLink = await generatePayPalLink(payment, user);
        break;
      case "stripe":
        paymentLink = await generateStripeLink(payment, user);
        break;
      case "bank_transfer":
        paymentLink = generateBankTransferDetails(payment);
        break;
    }

    res.json({
      paymentId: payment._id,
      transactionId: payment.transactionId,
      paymentLink,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
    });
  } catch (error) {
    console.error("Payment initiation error:", error);
    res.status(500).json({ message: error.message });
  }
};

// ============ FLUTTERWAVE INTEGRATION ============

async function generateFlutterwaveLink(payment, user, doctor) {
  try {
    const response = await axios.post(
      "https://api.flutterwave.com/v3/payments",
      {
        tx_ref: payment.transactionId,
        amount: payment.amount,
        currency: payment.currency,
        payment_options: "card,mobile_money,bank_transfer",
        customer: {
          email: user.email,
          phonenumber: user.phone || "+1234567890",
          name: user.name,
        },
        customizations: {
          title: "Health Consultant Appointment",
          description: `Payment for appointment with Dr. ${doctor.name}`,
          logo: "https://your-app-logo.png",
        },
        meta: {
          appointmentId: payment.appointmentId.toString(),
          paymentId: payment._id.toString(),
        },
        redirect_url: `${process.env.MOBILE_APP_URL || "http://localhost:19000"}/payment-callback`,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        },
      }
    );

    payment.gatewayReference = response.data.data.id;
    payment.gatewayResponse = response.data;
    await payment.save();

    return {
      gateway: "flutterwave",
      link: response.data.data.link,
      reference: response.data.data.id,
    };
  } catch (error) {
    console.error("Flutterwave error:", error.response?.data || error.message);
    throw error;
  }
}

// ============ PAYPAL INTEGRATION ============

async function generatePayPalLink(payment, user) {
  try {
    const response = await axios.post(
      "https://api-m.sandbox.paypal.com/v2/checkout/orders",
      {
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: payment.currency,
              value: payment.amount.toString(),
            },
            reference_id: payment.transactionId,
          },
        ],
        payer: {
          name: {
            given_name: user.name.split(" ")[0],
            surname: user.name.split(" ").slice(1).join(" "),
          },
          email_address: user.email,
        },
        application_context: {
          return_url: `${process.env.MOBILE_APP_URL || "http://localhost:19000"}/payment-success`,
          cancel_url: `${process.env.MOBILE_APP_URL || "http://localhost:19000"}/payment-cancel`,
        },
      },
      {
        auth: {
          username: process.env.PAYPAL_CLIENT_ID,
          password: process.env.PAYPAL_CLIENT_SECRET,
        },
      }
    );

    payment.gatewayReference = response.data.id;
    payment.gatewayResponse = response.data;
    await payment.save();

    return {
      gateway: "paypal",
      orderId: response.data.id,
      link: response.data.links.find((link) => link.rel === "approve").href,
    };
  } catch (error) {
    console.error("PayPal error:", error.response?.data || error.message);
    throw error;
  }
}

// ============ STRIPE INTEGRATION ============

async function generateStripeLink(payment, user) {
  // Stripe implementation - requires stripe npm package
  return {
    gateway: "stripe",
    link: "/stripe-checkout",
    // Full Stripe implementation would go here
  };
}

// ============ BANK TRANSFER ============

function generateBankTransferDetails(payment) {
  return {
    gateway: "bank_transfer",
    bankDetails: {
      accountName: "Health Consultant Ltd",
      accountNumber: process.env.BANK_ACCOUNT_NUMBER || "****1234",
      bankName: process.env.BANK_NAME || "Standard Bank",
      routingNumber: process.env.BANK_ROUTING || "021000021",
      swiftCode: process.env.BANK_SWIFT || "SBINNGLA",
      amount: payment.amount,
      reference: payment.transactionId,
      instructions:
        "Please transfer the amount and upload proof of transfer below",
    },
  };
}

// ============ PAYMENT VERIFICATION ============

exports.verifyFlutterwavePayment = async (req, res) => {
  try {
    const { transactionReference } = req.body;

    const response = await axios.get(
      `https://api.flutterwave.com/v3/transactions/${transactionReference}/verify`,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        },
      }
    );

    const { status, amount, meta } = response.data.data;

    if (status === "successful") {
      const payment = await Payment.findByIdAndUpdate(
        meta.paymentId,
        {
          status: "completed",
          gatewayResponse: response.data.data,
          paymentCompletedAt: new Date(),
          "paymentDetails.cardLast4": response.data.data.card?.last_4k,
          "paymentDetails.cardBrand": response.data.data.card?.issuer,
        },
        { new: true }
      );

      // Update appointment status
      await Appointment.findByIdAndUpdate(meta.appointmentId, {
        paymentStatus: "completed",
      });

      res.json({
        message: "Payment verified successfully",
        payment,
      });
    } else {
      throw new Error("Payment verification failed");
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.verifyPayPalPayment = async (req, res) => {
  try {
    const { orderId } = req.body;

    const response = await axios.post(
      `https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}/capture`,
      {},
      {
        auth: {
          username: process.env.PAYPAL_CLIENT_ID,
          password: process.env.PAYPAL_CLIENT_SECRET,
        },
      }
    );

    if (response.data.status === "COMPLETED") {
      const payment = await Payment.findOne({
        gatewayReference: orderId,
      });

      payment.status = "completed";
      payment.gatewayResponse = response.data;
      payment.paymentCompletedAt = new Date();
      payment.paymentDetails.paypalEmail =
        response.data.payer.email_address;
      await payment.save();

      // Update appointment
      await Appointment.findByIdAndUpdate(payment.appointmentId, {
        paymentStatus: "completed",
      });

      res.json({
        message: "PayPal payment verified",
        payment,
      });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.uploadBankTransferProof = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { proofOfTransfer, bankName, accountNumber } = req.body;

    const payment = await Payment.findByIdAndUpdate(
      paymentId,
      {
        "bankTransferDetails.proofOfTransfer": proofOfTransfer,
        "bankTransferDetails.bankName": bankName,
        "bankTransferDetails.accountNumber": accountNumber,
        status: "pending", // Awaiting admin verification
      },
      { new: true }
    );

    res.json({
      message: "Bank transfer proof uploaded. Awaiting verification.",
      payment,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ============ PAYMENT HISTORY ============

exports.getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status } = req.query;

    let query = { userId };
    if (status) query.status = status;

    const skip = (page - 1) * limit;

    const payments = await Payment.find(query)
      .populate("appointmentId", "appointmentDate reason")
      .populate("doctorId", "name specialization")
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ createdAt: -1 });

    const total = await Payment.countDocuments(query);

    res.json({
      payments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPaymentReceipt = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user.id;

    const payment = await Payment.findById(paymentId)
      .populate("appointmentId")
      .populate("doctorId", "name email specialization")
      .populate("userId", "name email phone");

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    if (payment.userId.toString() !== userId && !req.user.isAdmin) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Generate receipt (can be PDF in production)
    const receipt = {
      receiptNumber: payment.receipt?.receiptNumber || `RCP-${payment.transactionId}`,
      transactionId: payment.transactionId,
      date: payment.paymentCompletedAt || payment.createdAt,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      paymentMethod: payment.paymentMethod,
      patient: {
        name: payment.userId.name,
        email: payment.userId.email,
      },
      doctor: {
        name: payment.doctorId.name,
        specialization: payment.doctorId.specialization,
      },
      appointment: {
        date: payment.metadata.appointmentDate,
        reason: payment.metadata.appointmentReason,
      },
    };

    res.json(receipt);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ============ ADMIN PAYMENT MANAGEMENT ============

exports.getAllPayments = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, paymentGateway } = req.query;

    let query = {};
    if (status) query.status = status;
    if (paymentGateway) query.paymentGateway = paymentGateway;

    const skip = (page - 1) * limit;

    const payments = await Payment.find(query)
      .populate("userId", "name email")
      .populate("doctorId", "name specialization")
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ createdAt: -1 });

    const total = await Payment.countDocuments(query);

    res.json({
      payments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPaymentStats = async (req, res) => {
  try {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const totalRevenue = await Payment.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const last30DaysRevenue = await Payment.aggregate([
      {
        $match: {
          status: "completed",
          paymentCompletedAt: { $gte: last30Days },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const paymentsByGateway = await Payment.aggregate([
      { $group: { _id: "$paymentGateway", count: { $sum: 1 } } },
    ]);

    const paymentsByStatus = await Payment.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    res.json({
      totalRevenue: totalRevenue[0]?.total || 0,
      last30DaysRevenue: last30DaysRevenue[0]?.total || 0,
      paymentsByGateway,
      paymentsByStatus,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.verifyBankTransfer = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { approved, reason } = req.body;

    const payment = await Payment.findByIdAndUpdate(
      paymentId,
      {
        status: approved ? "completed" : "failed",
        "bankTransferDetails.verifiedAt": approved ? new Date() : null,
        failureReason: approved ? null : reason,
        paymentCompletedAt: approved ? new Date() : null,
      },
      { new: true }
    );

    if (approved) {
      await Appointment.findByIdAndUpdate(payment.appointmentId, {
        paymentStatus: "completed",
      });
    }

    res.json({
      message: approved ? "Bank transfer verified" : "Bank transfer rejected",
      payment,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
