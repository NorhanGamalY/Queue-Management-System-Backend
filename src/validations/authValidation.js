// validations/authValidation.js
const { z } = require("zod");

const expressZod = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse({
      body: req.body,
      params: req.params,
      query: req.query,
    });
    // replace body with validated body
    req.body = parsed.body || req.body;
    next();
  } catch (err) {
    return res
      .status(400)
      .json({ status: "fail", message: err.errors || err.message });
  }
};

const registerSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    phone: z.string().min(11).max(11),
  }),
});

const registerBusinessSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    mobilePhone: z.string().min(11).max(11),
    landlinePhone: z.string().min(8).max(8),
    address: z.string().min(1),
    paymentMethod: z.enum(["cash", "credit-card", "wallet"]),
    specialization: z.string().optional(),
    profileImage: z.string().optional(),
    businessImages: z.array(z.string()).optional(),
    workingHours: z.array(z.object({
      days: z.string(),
      openTime: z.string(),
      closeTime: z.string(),
      isClosed: z.boolean().optional(),
    })).optional(),
    service: z.array(z.object({
      name: z.string(),
      description: z.string(),
      price: z.number(),
      duration: z.number(),
    })).optional(),
    queueSettings: z.array(z.object({
      maxPatientsPerDay: z.number(),
      LastTimeToAppoint: z.string(),
    })).optional(),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});

const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email(),
  }),
});

const resetPasswordSchema = z.object({
  params: z.object({
    otp: z.string().min(6).max(6),
  }),
  body: z.object({
    password: z.string().min(8),
  }),
});

const updatePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
  }),
});

module.exports = {
  registerValidation: expressZod(registerSchema),
  registerBusinessValidation: expressZod(registerBusinessSchema),
  loginValidation: expressZod(loginSchema),
  forgotPasswordValidation: expressZod(forgotPasswordSchema),
  resetPasswordValidation: expressZod(resetPasswordSchema),
  updatePasswordValidation: expressZod(updatePasswordSchema),
};
