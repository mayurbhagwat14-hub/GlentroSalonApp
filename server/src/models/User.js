const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    avatar: {
      type: String,
      default: '',
    },
    city: {
      type: String,
      default: '',
    },
    formattedAddress: {
      type: String,
      default: '',
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
      },
    },
    fcmtoken: {
      type: [String],
      default: [],
    },
    fcmtokenmobile: {
      type: [String],
      default: [],
    },
    accountStatus: {
      type: String,
      enum: ['active', 'deleted', 'recovery_requested'],
      default: 'active',
      index: true
    },
    deleteAccount: {
      deletedAt: {
        type: Date,
        default: null
      },
      deletedBy: {
        type: String,
        enum: ['user', 'admin'],
        default: null
      },
      reason: {
        type: String,
        trim: true,
        maxlength: 500,
        default: null
      }
    },
    recoverAccount: {
      requestedAt: {
        type: Date,
        default: null
      },
      reason: {
        type: String,
        trim: true,
        maxlength: 500,
        default: null
      },
      recoveredAt: {
        type: Date,
        default: null
      },
      recoveredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      }
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null
    },
    favorites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Salon',
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Index for geospatial queries
userSchema.index({ location: '2dsphere' });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
