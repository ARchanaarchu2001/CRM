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
