import {Schema, model} from 'mongoose';

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
      minlength: 3,
      maxlength: 30,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // Don't include in queries by default (security)
    },
    deviceId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Index for faster lookups
userSchema.index({username: 1});
userSchema.index({email: 1});
userSchema.index({deviceId: 1});

const User = model('User', userSchema);

export default User;

