// @ts-ignore don't install the @types for this package, as it conflicts with mongoose
import passportLocalMongoose from '@hyperdx/passport-local-mongoose';
import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

type ObjectId = mongoose.Types.ObjectId;

// FIB §33 — three-role hierarchy plus the default end-user role. KZ certification
// requires that audit-data access (`securityAdmin`), user-management
// (`userAdmin`), and data-administration (`dataAdmin`) be held by different
// people, none of whom may unilaterally delete or modify audit journals.
export type UserRole =
  | 'user'
  | 'dataAdmin'
  | 'userAdmin'
  | 'securityAdmin';

export const USER_ROLES: readonly UserRole[] = [
  'user',
  'dataAdmin',
  'userAdmin',
  'securityAdmin',
] as const;

export interface IPasswordHistoryEntry {
  hash: string; // The opaque passport-local-mongoose hash blob
  changedAt: Date;
}

export interface IUser {
  _id: ObjectId;
  accessKey: string;
  createdAt: Date;
  email: string;
  name: string;
  team: ObjectId;
  role: UserRole;

  // FIB §24 password lifecycle
  passwordChangedAt?: Date;
  passwordExpiresAt?: Date;
  passwordHistory: IPasswordHistoryEntry[];
  mustChangePasswordOnNextLogin: boolean;

  // FIB §22 account lockout (was missing in upstream HyperDX)
  failedLoginCountSinceLastSuccess: number;
  lockedUntil?: Date;

  // FIB §54 last-login surface
  lastLoginAt?: Date;
  lastLoginIp?: string;
  lastFailedLoginAt?: Date;
  lastFailedLoginIp?: string;

  // FIB §51 parallel-session limit (1 active session per user)
  activeSessionId?: string;
  lastSeenAt?: Date;
}

export type UserDocument = mongoose.HydratedDocument<IUser>;

const UserSchema = new Schema(
  {
    name: String,
    email: {
      type: String,
      required: true,
    },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    accessKey: {
      type: String,
      default: function genUUID() {
        return uuidv4();
      },
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: 'user',
    },
    passwordChangedAt: { type: Date },
    passwordExpiresAt: { type: Date },
    passwordHistory: {
      type: [
        {
          hash: { type: String, required: true },
          changedAt: { type: Date, required: true },
          _id: false,
        },
      ],
      default: [],
    },
    mustChangePasswordOnNextLogin: { type: Boolean, default: false },
    failedLoginCountSinceLastSuccess: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    lastLoginAt: { type: Date },
    lastLoginIp: { type: String },
    lastFailedLoginAt: { type: Date },
    lastFailedLoginIp: { type: String },
    activeSessionId: { type: String },
    lastSeenAt: { type: Date },
  },
  {
    timestamps: true,
  },
);

UserSchema.virtual('hasPasswordAuth').get(function (this: IUser) {
  return true;
});

UserSchema.virtual('isPasswordExpired').get(function (this: IUser) {
  return (
    this.passwordExpiresAt != null && this.passwordExpiresAt.getTime() < Date.now()
  );
});

UserSchema.virtual('isLocked').get(function (this: IUser) {
  return this.lockedUntil != null && this.lockedUntil.getTime() > Date.now();
});

UserSchema.plugin(passportLocalMongoose, {
  usernameField: 'email',
  usernameLowerCase: true,
  usernameCaseInsensitive: true,
});

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ role: 1 });
UserSchema.index({ lockedUntil: 1 });
UserSchema.index({ passwordExpiresAt: 1 });

export default mongoose.model<IUser>('User', UserSchema);
