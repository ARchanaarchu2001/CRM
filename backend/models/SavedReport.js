import mongoose from 'mongoose';

const savedReportSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Report name is required'],
      trim: true,
      maxlength: [100, 'Report name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    filters: {
      range: { type: String, default: 'today' },
      from: { type: String, default: '' },
      to: { type: String, default: '' },
      teamId: { type: String, default: 'all' },
      agentId: { type: String, default: 'all' },
      importBatchId: { type: String, default: '' },
      product: { type: String, default: '' },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const SavedReport = mongoose.model('SavedReport', savedReportSchema);

export default SavedReport;
