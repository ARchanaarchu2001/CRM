import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    reportType: {
      type: String,
      enum: ['lead', 'agent_performance', 'daily', 'monthly'],
      required: true,
    },
    reportName: {
      type: String,
      required: true,
      trim: true,
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    dateRange: {
      startDate: {
        type: Date,
        required: true,
      },
      endDate: {
        type: Date,
        required: true,
      },
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      default: null,
    },
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reportData: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    summary: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    filters: {
      product: String,
      batchName: String,
      status: String,
    },
  },
  {
    timestamps: true,
  }
);

const Report = mongoose.model('Report', reportSchema);

export default Report;
