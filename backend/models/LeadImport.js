import mongoose from 'mongoose';

const leadImportSchema = new mongoose.Schema(
  {
    product: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    sourceFileName: {
      type: String,
      required: true,
      trim: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    contactColumn: {
      type: String,
      required: true,
      trim: true,
    },
    headers: {
      type: [String],
      default: [],
    },
    totalRows: {
      type: Number,
      default: 0,
    },
    duplicateInFileCount: {
      type: Number,
      default: 0,
    },
    duplicateInSystemCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const LeadImport = mongoose.model('LeadImport', leadImportSchema);

export default LeadImport;
