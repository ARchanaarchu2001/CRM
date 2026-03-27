import mongoose from 'mongoose';

const productRemarkConfigSchema = new mongoose.Schema(
  {
    product: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    callingRemarks: {
      type: [String],
      default: [],
    },
    contactabilityStatuses: {
      type: [String],
      default: ['Reachable', 'Not Reachable'],
    },
    callAttempt1Label: {
      type: String,
      default: 'Call Attempt 1 - Date',
      trim: true,
    },
    callAttempt2Label: {
      type: String,
      default: 'Call Attempt 2 - Date',
      trim: true,
    },
    callingRemarkLabel: {
      type: String,
      default: 'Calling Remarks',
      trim: true,
    },
    interestedRemarkLabel: {
      type: String,
      default: 'Interested Remarks',
      trim: true,
    },
    notInterestedRemarkLabel: {
      type: String,
      default: 'Not Interested Remarks',
      trim: true,
    },
    interestedRemarks: {
      type: [String],
      default: [],
    },
    notInterestedRemarks: {
      type: [String],
      default: [],
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const ProductRemarkConfig = mongoose.model('ProductRemarkConfig', productRemarkConfigSchema);

export default ProductRemarkConfig;
