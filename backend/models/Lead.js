import mongoose from 'mongoose';

const leadSchema = new mongoose.Schema(
  {
    importBatch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeadImport',
      required: true,
    },
    batchName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    product: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    rowIndex: {
      type: Number,
      required: true,
    },
    contactNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    contactColumn: {
      type: String,
      required: true,
      trim: true,
    },
    rawData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    duplicateStatus: {
      type: String,
      enum: ['unique', 'duplicate_in_file', 'duplicate_in_system', 'duplicate_in_file_and_system'],
      default: 'unique',
    },
    assignedAgentCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Lead = mongoose.model('Lead', leadSchema);

export default Lead;
